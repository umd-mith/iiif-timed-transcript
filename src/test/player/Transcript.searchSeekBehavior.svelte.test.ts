// src/test/player/Transcript.searchSeekBehavior.svelte.test.ts
//
// Covers the "Separate match UPDATES from match ACTIVATION" acceptance-gate
// rows (docs/specs/transcript-reading-mode.md): activate-mode type/browse/
// activate, clearing the query / zero results / replacing annotations, and
// the two legacy change-mode regression rows. Reading-mode controls and the
// sync concurrency fix are out of scope here (later steps).
import { describe, test, expect } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import TestTranscriptWithSegments from "./TestTranscriptWithSegments.svelte";
import TestTranscriptWithSearch from "./TestTranscriptWithSearch.svelte";
import { createMockPlayerContext } from "./test-utils";
import type { Annotation } from "../../lib/sync/types";
import type { TranscriptContext } from "../../lib/player/transcript-context";

// render() from vitest-browser-svelte auto-unmounts each component between
// tests (no manual target/afterEach teardown).
describe("Transcript searchSeekBehavior", () => {
  const mockAnnotations: Annotation[] = [
    { id: "a1", startTime: 0, endTime: 5, text: "Hello world" },
    { id: "a2", startTime: 5, endTime: 10, text: "Goodbye world" },
    { id: "a3", startTime: 100, endTime: 120, text: "Testing search" },
  ];

  async function typeQuery(container: HTMLElement, query: string) {
    const input = container.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    flushSync();
  }

  test("context state defaults searchSeekBehavior to change", () => {
    const playerCtx = createMockPlayerContext();
    let capturedCtx: TranscriptContext | null = null;

    render(TestContextHarness, {
      props: {
        context: playerCtx,
        component: TestTranscriptWithSegments,
        props: {
          annotations: mockAnnotations,
          onContextReady: (ctx: TranscriptContext) => {
            capturedCtx = ctx;
          },
        },
      },
    });
    flushSync();

    expect(capturedCtx!.state.searchSeekBehavior).toBe("change");
  });

  test("context state reflects an explicit searchSeekBehavior prop", () => {
    const playerCtx = createMockPlayerContext();
    let capturedCtx: TranscriptContext | null = null;

    render(TestContextHarness, {
      props: {
        context: playerCtx,
        component: TestTranscriptWithSegments,
        props: {
          annotations: mockAnnotations,
          searchSeekBehavior: "activate",
          onContextReady: (ctx: TranscriptContext) => {
            capturedCtx = ctx;
          },
        },
      },
    });
    flushSync();

    expect(capturedCtx!.state.searchSeekBehavior).toBe("activate");
  });

  describe("legacy 'change' mode (default) — Existing integration with no new props", () => {
    test("handleMatchChange still seeks on match select (regression)", () => {
      const playerCtx = createMockPlayerContext();
      let capturedCtx: TranscriptContext | null = null;

      render(TestContextHarness, {
        props: {
          context: playerCtx,
          component: TestTranscriptWithSegments,
          props: {
            annotations: mockAnnotations,
            onContextReady: (ctx: TranscriptContext) => {
              capturedCtx = ctx;
            },
          },
        },
      });
      flushSync();

      capturedCtx!.actions.handleMatchChange([mockAnnotations[1]!], 0);

      expect(playerCtx.actions.seekTo).toHaveBeenCalledWith(5);
    });

    test("typing a query end-to-end still seeks to the selected match (no activation control renders)", async () => {
      const playerCtx = createMockPlayerContext();

      const { container } = render(TestTranscriptWithSearch, {
        props: { context: playerCtx, annotations: mockAnnotations },
      });
      flushSync();

      await typeQuery(container, "world");

      expect(playerCtx.actions.seekTo).toHaveBeenCalledWith(0); // a1's startTime
      expect(
        container.querySelector('button[aria-label="Go to match"]'),
      ).toBeNull();
    });

    test("Query and canvas switch in legacy change mode: the query persists across annotation replacement (not cleared by the new rule)", async () => {
      const playerCtx = createMockPlayerContext();

      const { container, component: wrapper } = render(
        TestTranscriptWithSearch,
        {
          props: { context: playerCtx, annotations: mockAnnotations },
        },
      );
      flushSync();

      await typeQuery(container, "world");

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      expect(input.value).toBe("world");

      // Simulate a canvas switch: a new annotations array replaces the old
      // one. Legacy behavior does not clear the query or otherwise reset
      // Search — it re-filters the same committed query against the new
      // array, exactly as an ordinary annotations-prop change always has.
      const replacement: Annotation[] = [
        { id: "b1", startTime: 20, endTime: 25, text: "A brave new world" },
      ];
      wrapper.setAnnotations(replacement);
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(input.value).toBe("world");
      const counter = container.querySelector(".match-counter");
      expect(counter?.textContent).toBe("1 of 1");
    });
  });

  describe("'activate' mode", () => {
    test("Playing at 30s; typing a query matching a later annotation does not seek, play, or pause", async () => {
      const playerCtx = createMockPlayerContext({
        state: { currentTime: 30, isPlaying: true },
      });
      let capturedCtx: TranscriptContext | null = null;

      const { container } = render(TestTranscriptWithSearch, {
        props: {
          context: playerCtx,
          annotations: mockAnnotations,
          searchSeekBehavior: "activate",
          onContextReady: (c: TranscriptContext) => {
            capturedCtx = c;
          },
        },
      });
      flushSync();
      expect(capturedCtx!.state.readingMode).toBe(false);

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Testing"; // matches a3, startTime 100
      input.dispatchEvent(new Event("input", { bubbles: true }));
      flushSync();

      // Synchronously, before debounce: no playback call yet, but Browsing
      // is already entered (docs/specs/transcript-reading-mode.md,
      // "Search" item 2 — "enters Browsing immediately on input").
      expect(playerCtx.actions.seekTo).not.toHaveBeenCalled();
      expect(capturedCtx!.state.readingMode).toBe(true);

      await new Promise((r) => setTimeout(r, 200));
      flushSync();

      // Match count reflects the resolved match after debounce.
      const counter = container.querySelector(".match-counter");
      expect(counter?.textContent).toBe("1 of 1");

      expect(playerCtx.actions.seekTo).not.toHaveBeenCalled();
      expect(playerCtx.actions.play).not.toHaveBeenCalled();
      expect(playerCtx.actions.pause).not.toHaveBeenCalled();
    });

    test("Paused at 30s; browsing next/previous matches does not seek or change play state", async () => {
      const playerCtx = createMockPlayerContext({
        state: { currentTime: 30, isPlaying: false },
      });

      const { container } = render(TestTranscriptWithSearch, {
        props: {
          context: playerCtx,
          annotations: mockAnnotations,
          searchSeekBehavior: "activate",
        },
      });
      flushSync();

      await typeQuery(container, "world"); // a1, a2

      const nextBtn = container.querySelector(
        'button[aria-label="Next match"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      flushSync();
      const prevBtn = container.querySelector(
        'button[aria-label="Previous match"]',
      ) as HTMLButtonElement;
      prevBtn.click();
      flushSync();

      expect(playerCtx.actions.seekTo).not.toHaveBeenCalled();
      expect(playerCtx.actions.play).not.toHaveBeenCalled();
      expect(playerCtx.actions.pause).not.toHaveBeenCalled();
    });

    test("Activating a match seeks exactly once, without touching play state or rate", async () => {
      const playerCtx = createMockPlayerContext({
        state: { currentTime: 30, isPlaying: true, playbackRate: 1 },
      });

      const { container } = render(TestTranscriptWithSearch, {
        props: {
          context: playerCtx,
          annotations: mockAnnotations,
          searchSeekBehavior: "activate",
        },
      });
      flushSync();

      await typeQuery(container, "Testing"); // a3, startTime 100

      const goBtn = container.querySelector(
        'button[aria-label="Go to match"]',
      ) as HTMLButtonElement;
      expect(goBtn).not.toBeNull();
      goBtn.click();

      expect(playerCtx.actions.seekTo).toHaveBeenCalledTimes(1);
      expect(playerCtx.actions.seekTo).toHaveBeenCalledWith(100);
      expect(playerCtx.actions.play).not.toHaveBeenCalled();
      expect(playerCtx.actions.pause).not.toHaveBeenCalled();
      expect(playerCtx.actions.setPlaybackRate).not.toHaveBeenCalled();
    });

    test("clearing the query does not seek", async () => {
      const playerCtx = createMockPlayerContext();

      const { container } = render(TestTranscriptWithSearch, {
        props: {
          context: playerCtx,
          annotations: mockAnnotations,
          searchSeekBehavior: "activate",
        },
      });
      flushSync();

      await typeQuery(container, "world");
      await typeQuery(container, "");

      expect(playerCtx.actions.seekTo).not.toHaveBeenCalled();
    });

    test("a query with zero results does not seek", async () => {
      const playerCtx = createMockPlayerContext();

      const { container } = render(TestTranscriptWithSearch, {
        props: {
          context: playerCtx,
          annotations: mockAnnotations,
          searchSeekBehavior: "activate",
        },
      });
      flushSync();

      await typeQuery(container, "zzzzz");

      expect(playerCtx.actions.seekTo).not.toHaveBeenCalled();
    });

    test("replacing annotations recalculates matches and clamps selection without seeking", async () => {
      const playerCtx = createMockPlayerContext();

      const { container, component: wrapper } = render(
        TestTranscriptWithSearch,
        {
          props: {
            context: playerCtx,
            annotations: mockAnnotations,
            searchSeekBehavior: "activate",
          },
        },
      );
      flushSync();

      await typeQuery(container, "world"); // matches a1, a2 from the current canvas
      expect(playerCtx.actions.seekTo).not.toHaveBeenCalled();

      // Replace with a different canvas's annotations (simulates a canvas
      // switch) — the query re-filters the new array via Search's own
      // $derived, still with no implicit seek.
      const replacement: Annotation[] = [
        { id: "b1", startTime: 0, endTime: 5, text: "A different world" },
      ];
      wrapper.setAnnotations(replacement);
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(playerCtx.actions.seekTo).not.toHaveBeenCalled();
    });
  });
});

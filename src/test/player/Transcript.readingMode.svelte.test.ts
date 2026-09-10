// src/test/player/Transcript.readingMode.svelte.test.ts
//
// Step 2 of docs/specs/transcript-reading-mode.md: the synchronization
// policy and the reading/return controls. Covers the acceptance-gate rows
// assigned to this step: scroll-with-seek-off, enable-reading-mode-while-
// seek-on, return inside-cue, return between-cue, policy-off-mid-seek (+ no
// replay — see src/test/sync/syncMachine.test.ts and
// src/test/sync/videoController.test.ts for the machine/actor-level
// coverage of that row), two-panel independence, return focus ownership vs
// host write, and single-folded-control. Search-activation coverage lives
// in Transcript.searchSeekBehavior.svelte.test.ts (step 1); the custom
// element and docs are step 3.
import { describe, test, expect } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import TestTranscriptReadingMode from "./TestTranscriptReadingMode.svelte";
import TestTwoReadingModePanels from "./TestTwoReadingModePanels.svelte";
import { createMockPlayerContext } from "./test-utils";
import type { Annotation } from "../../lib/sync/types";
import type { TranscriptContext } from "../../lib/player/transcript-context";

// render() from vitest-browser-svelte auto-unmounts each component between
// tests (no manual target/afterEach teardown).
describe("Transcript reading mode", () => {
  const mockAnnotations: Annotation[] = [
    { id: "a1", startTime: 0, endTime: 5, text: "First annotation" },
    { id: "a2", startTime: 5, endTime: 10, text: "Second annotation" },
    { id: "a3", startTime: 10, endTime: 15, text: "Third annotation" },
  ];

  describe("Single folded control across surfaces", () => {
    test("exactly one track-audio control (Follow along); no separate pause-auto-scroll button", () => {
      const ctx = createMockPlayerContext();
      const { container } = render(TestTranscriptReadingMode, {
        props: { context: ctx, annotations: mockAnnotations },
      });
      flushSync();

      expect(container.querySelector(".auto-scroll-toggle")).toBeNull();

      const switches = container.querySelectorAll('[role="switch"]');
      expect(switches).toHaveLength(1);
      const toggle = switches[0] as HTMLButtonElement;
      expect(toggle.getAttribute("aria-checked")).toBe("true");
      expect(toggle.getAttribute("data-following")).toBe("true");

      // Jump to current does not exist while Following.
      expect(container.querySelector(".jump-to-current")).toBeNull();
    });

    test("Jump to current appears only while Browsing", () => {
      const ctx = createMockPlayerContext();
      const { container } = render(TestTranscriptReadingMode, {
        props: { context: ctx, annotations: mockAnnotations },
      });
      flushSync();

      const followSwitch = container.querySelector(
        ".follow-along-switch",
      ) as HTMLButtonElement;
      followSwitch.click();
      flushSync();

      expect(followSwitch.getAttribute("aria-checked")).toBe("false");
      expect(container.querySelector(".jump-to-current")).not.toBeNull();
    });
  });

  describe("Scroll with scroll-to-seek off", () => {
    test("a deliberate scroll enters reading mode; no seek, and playback-driven scroll stops", async () => {
      // SyncController is only created once a mediaElement is present (see
      // Transcript's controller-creation effect) — the default mock leaves
      // it null, so a live controller (and its DOM scroll listener) needs a
      // stub element here.
      const ctx = createMockPlayerContext({
        mediaElement: document.createElement("audio"),
      });
      let capturedCtx: TranscriptContext | null = null;

      const { container } = render(TestTranscriptReadingMode, {
        props: {
          context: ctx,
          annotations: mockAnnotations,
          scrollToSeek: false,
          onContextReady: (c) => {
            capturedCtx = c;
          },
        },
      });
      flushSync();

      expect(capturedCtx!.state.readingMode).toBe(false);

      const panel = container.querySelector(".transcript-panel") as HTMLElement;
      const segments = container.querySelectorAll<HTMLElement>(
        "[data-annotation-id]",
      );
      expect(segments.length).toBeGreaterThan(0);
      panel.style.cssText =
        "height: 60px; max-height: 60px; overflow-y: scroll; scroll-behavior: auto";
      for (const segment of segments) segment.style.minHeight = "80px";
      const maxScroll = panel.scrollHeight - panel.clientHeight;
      expect(maxScroll).toBeGreaterThan(0);

      let browserScrollSeen = false;
      panel.addEventListener("scroll", (event) => {
        browserScrollSeen ||= event.isTrusted;
      });
      // A real, trusted scroll — not a player action, not a synthetic event.
      panel.scrollTop = maxScroll;
      await new Promise<void>((resolve) => {
        const check = () => {
          if (browserScrollSeen) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });
      flushSync();

      expect(ctx.actions.seekTo).not.toHaveBeenCalled();
      expect(capturedCtx!.state.readingMode).toBe(true);

      const followSwitch = container.querySelector(
        ".follow-along-switch",
      ) as HTMLButtonElement;
      expect(followSwitch.getAttribute("aria-checked")).toBe("false");
    });
  });

  describe("Enable reading mode while scroll-to-seek is on", () => {
    test("scroll->seek and media->scroll both stop; explicit segment activation still seeks", () => {
      const ctx = createMockPlayerContext();
      let capturedCtx: TranscriptContext | null = null;

      const { container } = render(TestTranscriptReadingMode, {
        props: {
          context: ctx,
          annotations: mockAnnotations,
          scrollToSeek: true,
          onContextReady: (c) => {
            capturedCtx = c;
          },
        },
      });
      flushSync();

      const followSwitch = container.querySelector(
        ".follow-along-switch",
      ) as HTMLButtonElement;
      followSwitch.click();
      flushSync();

      expect(capturedCtx!.state.readingMode).toBe(true);

      // Explicit segment activation is unaffected by reading mode.
      const segment = container.querySelector(
        '[data-annotation-id="a2"]',
      ) as HTMLElement;
      segment.click();
      flushSync();

      expect(ctx.actions.seekTo).toHaveBeenCalledWith(5);
    });
  });

  describe("Return", () => {
    test("current time inside a cue: scrolls the active cue into view, no seek, returns to Following", () => {
      const anns: Annotation[] = [
        { id: "before", startTime: 0, endTime: 60, text: "Before" },
        { id: "active", startTime: 70, endTime: 80, text: "Active cue" },
        { id: "after", startTime: 90, endTime: 100, text: "After" },
      ];
      const ctx = createMockPlayerContext({ state: { currentTime: 75 } });
      let capturedCtx: TranscriptContext | null = null;

      const { container } = render(TestTranscriptReadingMode, {
        props: {
          context: ctx,
          annotations: anns,
          readingMode: true,
          onContextReady: (c) => {
            capturedCtx = c;
          },
        },
      });
      flushSync();
      expect(capturedCtx!.state.readingMode).toBe(true);

      const active = container.querySelector(
        '[data-annotation-id="active"]',
      ) as HTMLElement;
      let called = 0;
      active.scrollIntoView = () => {
        called++;
      };

      capturedCtx!.actions.returnToFollowing();
      flushSync();

      expect(called).toBe(1);
      expect(ctx.actions.seekTo).not.toHaveBeenCalled();
      expect(capturedCtx!.state.readingMode).toBe(false);
    });

    test("current time between cues: scrolls the next cue into view without marking it active, no seek, returns to Following", () => {
      const anns: Annotation[] = [
        { id: "before", startTime: 0, endTime: 60, text: "Before" },
        { id: "next", startTime: 90, endTime: 100, text: "Next cue" },
        { id: "after", startTime: 110, endTime: 120, text: "After" },
      ];
      const ctx = createMockPlayerContext({ state: { currentTime: 75 } });
      let capturedCtx: TranscriptContext | null = null;

      const { container } = render(TestTranscriptReadingMode, {
        props: {
          context: ctx,
          annotations: anns,
          readingMode: true,
          onContextReady: (c) => {
            capturedCtx = c;
          },
        },
      });
      flushSync();

      const next = container.querySelector(
        '[data-annotation-id="next"]',
      ) as HTMLElement;
      let called = 0;
      next.scrollIntoView = () => {
        called++;
      };

      capturedCtx!.actions.returnToFollowing();
      flushSync();

      expect(called).toBe(1);
      expect(ctx.actions.seekTo).not.toHaveBeenCalled();
      expect(capturedCtx!.state.readingMode).toBe(false);
      expect(capturedCtx!.state.activeAnnotationId).not.toBe("next");
    });

    test("no annotations: returns to Following without scrolling and without a fallback seek", () => {
      // With zero annotations Transcript renders its empty state instead of
      // `children` (so the context-capturing consumer never mounts) — drive
      // the return through the bindable prop itself, the same "host
      // property write" path used below, rather than the context action.
      const ctx = createMockPlayerContext({ state: { currentTime: 75 } });

      const { component: wrapper } = render(TestTranscriptReadingMode, {
        props: {
          context: ctx,
          annotations: [],
          readingMode: true,
        },
      });
      flushSync();

      expect(() => {
        (
          wrapper as unknown as { setReadingMode: (v: boolean) => void }
        ).setReadingMode(false);
      }).not.toThrow();
      flushSync();

      expect(ctx.actions.seekTo).not.toHaveBeenCalled();
    });
  });

  describe("Return focus ownership vs host property write", () => {
    test("focus moves to the Follow along switch only when Jump to current owned focus", () => {
      const ctx = createMockPlayerContext({ state: { currentTime: 2 } });
      const { container } = render(TestTranscriptReadingMode, {
        props: { context: ctx, annotations: mockAnnotations },
      });
      flushSync();

      const followSwitch = container.querySelector(
        ".follow-along-switch",
      ) as HTMLButtonElement;
      followSwitch.click();
      flushSync();

      const jumpButton = container.querySelector(
        ".jump-to-current",
      ) as HTMLButtonElement;
      expect(jumpButton).not.toBeNull();
      jumpButton.focus();
      expect(document.activeElement).toBe(jumpButton);

      jumpButton.click();
      flushSync();

      expect(container.querySelector(".jump-to-current")).toBeNull();
      expect(document.activeElement).toBe(followSwitch);
    });

    test("returning to Following via a host property write does not move focus", () => {
      const ctx = createMockPlayerContext({ state: { currentTime: 2 } });
      const { container, component: wrapper } = render(
        TestTranscriptReadingMode,
        {
          props: {
            context: ctx,
            annotations: mockAnnotations,
            readingMode: true,
          },
        },
      );
      flushSync();

      // Something else on the page owns focus — not the Jump button.
      const decoy = document.createElement("input");
      document.body.appendChild(decoy);
      decoy.focus();
      expect(document.activeElement).toBe(decoy);

      // A host writes the bindable prop directly (not a click on our own
      // Jump to current button).
      (
        wrapper as unknown as { setReadingMode: (v: boolean) => void }
      ).setReadingMode(false);
      flushSync();

      expect(container.querySelector(".jump-to-current")).toBeNull();
      expect(document.activeElement).toBe(decoy);

      decoy.remove();
    });
  });

  describe("Two-panel independence", () => {
    test("reading state stays independent per panel", () => {
      const ctx = createMockPlayerContext();
      let capturedA: TranscriptContext | null = null;
      let capturedB: TranscriptContext | null = null;

      const annotationsA: Annotation[] = [
        { id: "pa1", startTime: 0, endTime: 5, text: "Panel A first" },
      ];
      const annotationsB: Annotation[] = [
        { id: "pb1", startTime: 0, endTime: 5, text: "Panel B first" },
      ];

      const { container } = render(TestTwoReadingModePanels, {
        props: {
          context: ctx,
          annotationsA,
          annotationsB,
          onContextReadyA: (c: TranscriptContext) => {
            capturedA = c;
          },
          onContextReadyB: (c: TranscriptContext) => {
            capturedB = c;
          },
        },
      });
      flushSync();

      expect(capturedA!.state.readingMode).toBe(false);
      expect(capturedB!.state.readingMode).toBe(false);

      capturedA!.actions.enterBrowsing();
      flushSync();

      expect(capturedA!.state.readingMode).toBe(true);
      expect(capturedB!.state.readingMode).toBe(false);

      // Panel B's own Follow along switch still reflects Following.
      const panelBSwitch = container.querySelector(
        ".panel-b .follow-along-switch",
      ) as HTMLButtonElement;
      expect(panelBSwitch.getAttribute("aria-checked")).toBe("true");

      // Panel B's explicit segment activation still seeks — its
      // SyncController was never disabled by panel A entering Browsing.
      const panelBSegment = container.querySelector(
        '.panel-b [data-annotation-id="pb1"]',
      ) as HTMLElement;
      panelBSegment.click();
      flushSync();
      expect(ctx.actions.seekTo).toHaveBeenCalledWith(0);
    });
  });

  describe("Mode-change announcement (Finding 5)", () => {
    test("does not announce on mount", () => {
      const ctx = createMockPlayerContext();
      const { container } = render(TestTranscriptReadingMode, {
        props: { context: ctx, annotations: mockAnnotations },
      });
      flushSync();

      const liveRegion = container.querySelector(".sr-only");
      expect(liveRegion?.textContent).toBe("");
    });

    test("entering Browsing (Follow along off) announces the Browsing message", () => {
      const ctx = createMockPlayerContext();
      const { container } = render(TestTranscriptReadingMode, {
        props: { context: ctx, annotations: mockAnnotations },
      });
      flushSync();

      const followSwitch = container.querySelector(
        ".follow-along-switch",
      ) as HTMLButtonElement;
      followSwitch.click();
      flushSync();

      const liveRegion = container.querySelector(".sr-only");
      expect(liveRegion?.textContent).toBe("Browsing — playback continues");
    });

    test("returning to Following (Jump to current) announces the Following message", () => {
      const ctx = createMockPlayerContext();
      const { container } = render(TestTranscriptReadingMode, {
        props: {
          context: ctx,
          annotations: mockAnnotations,
          readingMode: true,
        },
      });
      flushSync();

      const jumpButton = container.querySelector(
        ".jump-to-current",
      ) as HTMLButtonElement;
      jumpButton.click();
      flushSync();

      const liveRegion = container.querySelector(".sr-only");
      expect(liveRegion?.textContent).toBe("Following playback");
    });

    test("a host property write that flips readingMode also announces", () => {
      const ctx = createMockPlayerContext();
      const { container, component: wrapper } = render(
        TestTranscriptReadingMode,
        { props: { context: ctx, annotations: mockAnnotations } },
      );
      flushSync();

      (
        wrapper as unknown as { setReadingMode: (v: boolean) => void }
      ).setReadingMode(true);
      flushSync();

      const liveRegion = container.querySelector(".sr-only");
      expect(liveRegion?.textContent).toBe("Browsing — playback continues");
    });
  });
});

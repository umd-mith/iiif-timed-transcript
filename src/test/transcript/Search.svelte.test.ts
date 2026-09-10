// src/lib/transcript/Search.svelte.test.ts
import { describe, it, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import Search from "../../lib/transcript/Search.svelte";
import TestSearchResetSignalWrapper from "./TestSearchResetSignalWrapper.svelte";
import type { Annotation } from "../../lib/sync/types";

describe("Transcript.Search", () => {
  const annotations: Annotation[] = [
    { id: "a1", startTime: 0, endTime: 5, text: "Hello world" },
    { id: "a2", startTime: 5, endTime: 10, text: "Goodbye world" },
    { id: "a3", startTime: 10, endTime: 15, text: "Testing search" },
  ];

  // Set by each test's render() call; read by typeQuery. render() from
  // vitest-browser-svelte auto-unmounts between tests — no manual teardown.
  let container: HTMLElement;

  /** Type into the search input and wait for debounce + effects to settle. */
  async function typeQuery(query: string) {
    const input = container.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    // Wait for 150ms debounce + effect scheduling
    await new Promise((r) => setTimeout(r, 200));
    flushSync();
  }

  it("renders search input with correct placeholder", () => {
    ({ container } = render(Search, { props: { annotations } }));
    flushSync();

    const input = container.querySelector('input[type="search"]');
    expect(input).not.toBeNull();
    expect(input?.getAttribute("placeholder")).toBe("Search transcript…");
  });

  it("fires onmatchchange with matches when query finds results", async () => {
    const onmatchchange = vi.fn();
    ({ container } = render(Search, { props: { annotations, onmatchchange } }));
    flushSync();
    onmatchchange.mockClear(); // Clear initial effect call

    await typeQuery("world");

    // "world" matches "Hello world" and "Goodbye world"
    const lastCall = onmatchchange.mock.calls.at(-1)!;
    expect(lastCall[0]).toHaveLength(2);
    expect(lastCall[0].map((a: Annotation) => a.id)).toEqual(["a1", "a2"]);
    expect(lastCall[1]).toBe(0); // currentIndex starts at 0
  });

  it("fires onmatchchange with empty array when no results", async () => {
    const onmatchchange = vi.fn();
    ({ container } = render(Search, { props: { annotations, onmatchchange } }));
    flushSync();
    onmatchchange.mockClear();

    await typeQuery("nonexistent");

    const lastCall = onmatchchange.mock.calls.at(-1)!;
    expect(lastCall[0]).toHaveLength(0);
  });

  it("fires onmatchchange with empty state when search is cleared", async () => {
    const onmatchchange = vi.fn();
    ({ container } = render(Search, { props: { annotations, onmatchchange } }));
    flushSync();

    await typeQuery("world");
    onmatchchange.mockClear();

    await typeQuery("");

    const lastCall = onmatchchange.mock.calls.at(-1)!;
    expect(lastCall[0]).toEqual([]);
    expect(lastCall[1]).toBe(-1);
  });

  it("shows navigation buttons when matches exist", async () => {
    ({ container } = render(Search, { props: { annotations } }));
    flushSync();

    // No buttons before search
    expect(
      container.querySelector('button[aria-label="Next match"]'),
    ).toBeNull();

    await typeQuery("world");

    expect(
      container.querySelector('button[aria-label="Next match"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('button[aria-label="Previous match"]'),
    ).not.toBeNull();
  });

  it("navigating next fires onmatchchange with incremented index", async () => {
    const onmatchchange = vi.fn();
    ({ container } = render(Search, { props: { annotations, onmatchchange } }));
    flushSync();

    await typeQuery("world"); // 2 matches
    onmatchchange.mockClear();

    const nextBtn = container.querySelector(
      'button[aria-label="Next match"]',
    ) as HTMLButtonElement;
    nextBtn.click();
    flushSync();
    // Wait for effect to settle
    await new Promise((r) => setTimeout(r, 50));
    flushSync();

    const lastCall = onmatchchange.mock.calls.at(-1)!;
    expect(lastCall[0]).toHaveLength(2);
    expect(lastCall[1]).toBe(1); // moved from 0 to 1
  });

  it("navigating previous wraps to last match", async () => {
    const onmatchchange = vi.fn();
    ({ container } = render(Search, { props: { annotations, onmatchchange } }));
    flushSync();

    await typeQuery("world"); // 2 matches, currentIndex=0
    onmatchchange.mockClear();

    const prevBtn = container.querySelector(
      'button[aria-label="Previous match"]',
    ) as HTMLButtonElement;
    prevBtn.click();
    flushSync();
    await new Promise((r) => setTimeout(r, 50));
    flushSync();

    const lastCall = onmatchchange.mock.calls.at(-1)!;
    expect(lastCall[1]).toBe(1); // wrapped from 0 to last index (1)
  });

  it("navigating next wraps to first match", async () => {
    const onmatchchange = vi.fn();
    ({ container } = render(Search, { props: { annotations, onmatchchange } }));
    flushSync();

    await typeQuery("world"); // 2 matches
    // Navigate to index 1
    const nextBtn = container.querySelector(
      'button[aria-label="Next match"]',
    ) as HTMLButtonElement;
    nextBtn.click();
    flushSync();
    await new Promise((r) => setTimeout(r, 50));
    flushSync();
    onmatchchange.mockClear();

    // Navigate again — should wrap to 0
    nextBtn.click();
    flushSync();
    await new Promise((r) => setTimeout(r, 50));
    flushSync();

    const lastCall = onmatchchange.mock.calls.at(-1)!;
    expect(lastCall[1]).toBe(0); // wrapped back to 0
  });

  it("single match: navigation does not fire callback (no index change)", async () => {
    const onmatchchange = vi.fn();
    ({ container } = render(Search, { props: { annotations, onmatchchange } }));
    flushSync();

    await typeQuery("Testing"); // 1 match: "Testing search"
    onmatchchange.mockClear();

    const nextBtn = container.querySelector(
      'button[aria-label="Next match"]',
    ) as HTMLButtonElement;
    nextBtn.click();
    flushSync();
    await new Promise((r) => setTimeout(r, 50));
    flushSync();

    // currentIndex stays at 0 — no state change, no callback
    expect(onmatchchange).not.toHaveBeenCalled();
  });

  it("displays match count correctly", async () => {
    ({ container } = render(Search, { props: { annotations } }));
    flushSync();

    await typeQuery("world");

    const counter = container.querySelector(".match-counter");
    expect(counter?.textContent).toBe("1 of 2");
  });

  it("displays 'No matches' when query has no results", async () => {
    ({ container } = render(Search, { props: { annotations } }));
    flushSync();

    await typeQuery("zzzzz");

    const counter = container.querySelector(".match-counter");
    expect(counter?.textContent).toBe("No matches");
  });

  describe("onqueryinput (synchronous input intent)", () => {
    it("fires synchronously on input, before the debounced onmatchchange", () => {
      const onqueryinput = vi.fn();
      const onmatchchange = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onqueryinput, onmatchchange },
      }));
      flushSync();
      const callsBefore = onmatchchange.mock.calls.length;

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "world";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(onqueryinput).toHaveBeenCalledWith("world");
      // Debounce (150ms default) has not elapsed — matches haven't changed yet.
      expect(onmatchchange.mock.calls.length).toBe(callsBefore);
    });

    it("fires with an empty string when the query is cleared", () => {
      const onqueryinput = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onqueryinput },
      }));
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(onqueryinput).toHaveBeenCalledWith("");
    });

    it("does not fire from previous/next navigation", async () => {
      const onqueryinput = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onqueryinput },
      }));
      flushSync();

      await typeQuery("world");
      onqueryinput.mockClear();

      const nextBtn = container.querySelector(
        'button[aria-label="Next match"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      flushSync();

      expect(onqueryinput).not.toHaveBeenCalled();
    });
  });

  describe("activation control (showActivation)", () => {
    it("renders no activation control by default (legacy change mode)", async () => {
      ({ container } = render(Search, { props: { annotations } }));
      flushSync();

      await typeQuery("world");

      expect(
        container.querySelector('button[aria-label="Go to match"]'),
      ).toBeNull();
    });

    it("renders a Go to match button when showActivation is true and matches exist", async () => {
      ({ container } = render(Search, {
        props: { annotations, showActivation: true },
      }));
      flushSync();

      expect(
        container.querySelector('button[aria-label="Go to match"]'),
      ).toBeNull();

      await typeQuery("world");

      expect(
        container.querySelector('button[aria-label="Go to match"]'),
      ).not.toBeNull();
    });

    it("hides the Go to match button when there are zero matches", async () => {
      ({ container } = render(Search, {
        props: { annotations, showActivation: true },
      }));
      flushSync();

      await typeQuery("zzzzz");

      expect(
        container.querySelector('button[aria-label="Go to match"]'),
      ).toBeNull();
    });

    it("clicking Go to match activates the currently selected match", async () => {
      const onmatchactivate = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onmatchactivate, showActivation: true },
      }));
      flushSync();

      await typeQuery("world"); // 2 matches: a1, a2 — currentIndex 0

      const nextBtn = container.querySelector(
        'button[aria-label="Next match"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      const goBtn = container.querySelector(
        'button[aria-label="Go to match"]',
      ) as HTMLButtonElement;
      goBtn.click();

      expect(onmatchactivate).toHaveBeenCalledWith(annotations[1], 1);
    });
  });

  describe("Enter-to-activate", () => {
    it("does nothing when showActivation is false", async () => {
      const onmatchactivate = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onmatchactivate },
      }));
      flushSync();

      await typeQuery("world");

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      expect(onmatchactivate).not.toHaveBeenCalled();
    });

    it("activates the selected match on Enter", async () => {
      const onmatchactivate = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onmatchactivate, showActivation: true },
      }));
      flushSync();

      await typeQuery("Testing"); // single match: a3

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      expect(onmatchactivate).toHaveBeenCalledWith(annotations[2], 0);
    });

    it("activates whatever match browsing had selected, not index 0", async () => {
      const onmatchactivate = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onmatchactivate, showActivation: true },
      }));
      flushSync();

      await typeQuery("world"); // a1, a2

      const nextBtn = container.querySelector(
        'button[aria-label="Next match"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      expect(onmatchactivate).toHaveBeenCalledWith(annotations[1], 1);
    });

    it("evaluates the current input before activating when Enter interrupts a pending debounce (not a stale result)", async () => {
      const onmatchactivate = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onmatchactivate, showActivation: true },
      }));
      flushSync();

      await typeQuery("world"); // commits "world" — a1 selected

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Testing"; // change the query but don't wait for debounce
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      // Activates the freshly-typed query's match (a3), never the stale a1.
      expect(onmatchactivate).toHaveBeenCalledWith(annotations[2], 0);
      expect(onmatchactivate).not.toHaveBeenCalledWith(
        annotations[0],
        expect.anything(),
      );
    });

    it("does not activate while IME composition is in progress", () => {
      const onmatchactivate = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onmatchactivate, showActivation: true },
      }));
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.dispatchEvent(new CompositionEvent("compositionstart"));
      input.value = "Testing";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          isComposing: true,
        }),
      );

      expect(onmatchactivate).not.toHaveBeenCalled();

      input.dispatchEvent(new CompositionEvent("compositionend"));
    });
  });

  describe("resetSignal (external query/selection reset — Finding 2)", () => {
    it("does not clear an already-empty query on mount", () => {
      ({ container } = render(TestSearchResetSignalWrapper, {
        props: { annotations },
      }));
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      expect(input.value).toBe("");
    });

    it("clears the query and resets selection to the first match when resetSignal changes", async () => {
      const onmatchchange = vi.fn();
      let wrapper!: { bumpResetSignal: () => void };
      ({ container, component: wrapper } = render(
        TestSearchResetSignalWrapper,
        { props: { annotations, onmatchchange } },
      ));
      flushSync();

      await typeQuery("world"); // a1, a2
      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      expect(input.value).toBe("world");

      onmatchchange.mockClear();
      wrapper.bumpResetSignal();
      flushSync();

      expect(input.value).toBe("");
      const counter = container.querySelector(".match-counter");
      expect(counter?.textContent).toBe("");
      // Clearing re-runs the existing matches effect — same "cleared" shape
      // as typing an empty query.
      const lastCall = onmatchchange.mock.calls.at(-1)!;
      expect(lastCall[0]).toEqual([]);
      expect(lastCall[1]).toBe(-1);
    });

    it("does not clear the query when resetSignal is not supplied (standalone use)", async () => {
      ({ container } = render(Search, { props: { annotations } }));
      flushSync();

      await typeQuery("world");
      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      expect(input.value).toBe("world");
    });
  });

  describe("onmatchnavigate (scroll-on-navigate seam — Finding 4)", () => {
    it("fires with the newly selected match on next, after currentIndex updates", async () => {
      const onmatchnavigate = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onmatchnavigate },
      }));
      flushSync();

      await typeQuery("world"); // a1, a2 — currentIndex 0
      onmatchnavigate.mockClear();

      const nextBtn = container.querySelector(
        'button[aria-label="Next match"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(onmatchnavigate).toHaveBeenCalledWith(annotations[1], 1);
    });

    it("fires with the newly selected match on previous", async () => {
      const onmatchnavigate = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onmatchnavigate },
      }));
      flushSync();

      await typeQuery("world"); // a1, a2 — currentIndex 0
      onmatchnavigate.mockClear();

      const prevBtn = container.querySelector(
        'button[aria-label="Previous match"]',
      ) as HTMLButtonElement;
      prevBtn.click(); // wraps to last match
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(onmatchnavigate).toHaveBeenCalledWith(annotations[1], 1);
    });

    it("does not fire while typing", async () => {
      const onmatchnavigate = vi.fn();
      ({ container } = render(Search, {
        props: { annotations, onmatchnavigate },
      }));
      flushSync();

      await typeQuery("world");

      expect(onmatchnavigate).not.toHaveBeenCalled();
    });

    it("does not fire on activation", async () => {
      const onmatchnavigate = vi.fn();
      const onmatchactivate = vi.fn();
      ({ container } = render(Search, {
        props: {
          annotations,
          onmatchnavigate,
          onmatchactivate,
          showActivation: true,
        },
      }));
      flushSync();

      await typeQuery("world");
      onmatchnavigate.mockClear();

      const goBtn = container.querySelector(
        'button[aria-label="Go to match"]',
      ) as HTMLButtonElement;
      goBtn.click();

      expect(onmatchactivate).toHaveBeenCalled();
      expect(onmatchnavigate).not.toHaveBeenCalled();
    });
  });
});

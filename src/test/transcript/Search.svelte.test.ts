// src/lib/transcript/Search.svelte.test.ts
import { describe, it, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import Search from "../../lib/transcript/Search.svelte";
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
});

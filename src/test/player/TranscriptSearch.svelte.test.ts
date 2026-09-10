import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import TranscriptSearch from "../../lib/player/TranscriptSearch.svelte";
import TestTranscriptContextHarness from "./TestTranscriptContextHarness.svelte";
import { createMockTranscriptContext } from "./transcript-test-utils";
import type { Annotation } from "../../lib/sync/types";

// render() from vitest-browser-svelte auto-unmounts between tests.
describe("TranscriptSearch", () => {
  const mockAnnotations: Annotation[] = [
    { id: "a1", startTime: 0, endTime: 5, text: "Hello world" },
    { id: "a2", startTime: 5, endTime: 10, text: "Goodbye world" },
  ];

  test("renders search input with props (standalone)", () => {
    const { container } = render(TranscriptSearch, {
      props: { annotations: mockAnnotations },
    });
    flushSync();

    const input = container.querySelector('input[type="search"]');
    expect(input).not.toBeNull();
  });

  test("accepts placeholder prop", () => {
    const { container } = render(TranscriptSearch, {
      props: { placeholder: "Custom placeholder" },
    });
    flushSync();

    const input = container.querySelector('input[type="search"]');
    expect(input?.getAttribute("placeholder")).toBe("Custom placeholder");
  });

  test("uses annotations from TranscriptContext when no prop given", async () => {
    const handleMatchChange = vi.fn();
    const transcriptCtx = createMockTranscriptContext({
      state: { annotations: mockAnnotations },
      actions: { handleMatchChange },
    });

    const { container } = render(TestTranscriptContextHarness, {
      props: { context: transcriptCtx, component: TranscriptSearch },
    });
    flushSync();

    // Type into search — if annotations came from context, "Hello" matches a1
    const input = container.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;
    input.value = "Hello";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 200));
    flushSync();

    // handleMatchChange should have been called with the match from context annotations
    expect(handleMatchChange).toHaveBeenCalled();
    const [matches] =
      handleMatchChange.mock.calls[handleMatchChange.mock.calls.length - 1]!;
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("a1");
  });

  describe("activation control (searchSeekBehavior='activate')", () => {
    test("shows the Go to match control only when context searchSeekBehavior is activate", async () => {
      const transcriptCtx = createMockTranscriptContext({
        state: { annotations: mockAnnotations, searchSeekBehavior: "change" },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Hello";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();

      expect(
        container.querySelector('button[aria-label="Go to match"]'),
      ).toBeNull();
    });

    test("default activation seeks through the context handleMatchActivate", async () => {
      const handleMatchActivate = vi.fn();
      const transcriptCtx = createMockTranscriptContext({
        state: { annotations: mockAnnotations, searchSeekBehavior: "activate" },
        actions: { handleMatchActivate },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Hello";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();

      const goBtn = container.querySelector(
        'button[aria-label="Go to match"]',
      ) as HTMLButtonElement;
      expect(goBtn).not.toBeNull();
      goBtn.click();

      expect(handleMatchActivate).toHaveBeenCalledWith(mockAnnotations[0], 0);
    });

    test("a supplied onmatchactivate prop overrides the context default", async () => {
      const handleMatchActivate = vi.fn();
      const onmatchactivate = vi.fn();
      const transcriptCtx = createMockTranscriptContext({
        state: { annotations: mockAnnotations, searchSeekBehavior: "activate" },
        actions: { handleMatchActivate },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: {
          context: transcriptCtx,
          component: TranscriptSearch,
          props: { onmatchactivate },
        },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Hello";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();

      const goBtn = container.querySelector(
        'button[aria-label="Go to match"]',
      ) as HTMLButtonElement;
      goBtn.click();

      expect(onmatchactivate).toHaveBeenCalledWith(mockAnnotations[0], 0);
      expect(handleMatchActivate).not.toHaveBeenCalled();
    });
  });

  describe("activation control while reading mode is active (Finding 1)", () => {
    test("shows the Go to match control and Enter-to-activate works with searchSeekBehavior=change (default) while Browsing", async () => {
      const handleMatchActivate = vi.fn();
      const transcriptCtx = createMockTranscriptContext({
        state: {
          annotations: mockAnnotations,
          searchSeekBehavior: "change",
          readingMode: true,
        },
        actions: { handleMatchActivate },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Hello";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();

      const goBtn = container.querySelector(
        'button[aria-label="Go to match"]',
      ) as HTMLButtonElement;
      expect(goBtn).not.toBeNull();

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );

      expect(handleMatchActivate).toHaveBeenCalledWith(mockAnnotations[0], 0);
    });

    test("regression: in change mode while Following (readingMode=false), no activation control renders", async () => {
      const transcriptCtx = createMockTranscriptContext({
        state: {
          annotations: mockAnnotations,
          searchSeekBehavior: "change",
          readingMode: false,
        },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Hello";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();

      expect(
        container.querySelector('button[aria-label="Go to match"]'),
      ).toBeNull();
    });
  });

  describe("onmatchnavigate (scroll-on-navigate — Finding 4)", () => {
    test("default onmatchnavigate scrolls to the newly selected match via the context (activate mode)", async () => {
      const scrollToAnnotation = vi.fn().mockReturnValue(true);
      const transcriptCtx = createMockTranscriptContext({
        state: { annotations: mockAnnotations, searchSeekBehavior: "activate" },
        actions: { scrollToAnnotation },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "world"; // matches a1, a2
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();
      scrollToAnnotation.mockClear();

      const nextBtn = container.querySelector(
        'button[aria-label="Next match"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(scrollToAnnotation).toHaveBeenCalledWith("a2");
    });

    test("a supplied onmatchnavigate prop overrides the context default", async () => {
      const scrollToAnnotation = vi.fn().mockReturnValue(true);
      const onmatchnavigate = vi.fn();
      const transcriptCtx = createMockTranscriptContext({
        state: { annotations: mockAnnotations },
        actions: { scrollToAnnotation },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: {
          context: transcriptCtx,
          component: TranscriptSearch,
          props: { onmatchnavigate },
        },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "world";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();
      scrollToAnnotation.mockClear();

      const nextBtn = container.querySelector(
        'button[aria-label="Next match"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(onmatchnavigate).toHaveBeenCalledWith(mockAnnotations[1], 1);
      expect(scrollToAnnotation).not.toHaveBeenCalled();
    });

    // Fix C: the legacy default (searchSeekBehavior="change", reading mode
    // off) historically only changed the match on prev/next — no explicit
    // programmatic scroll. Gate the default so it scrolls only in activate
    // mode or while Browsing (docs/specs/transcript-reading-mode.md scopes
    // "results scroll" to activate).
    test("in change mode with reading mode off, navigating does not call scrollToAnnotation (legacy default)", async () => {
      const scrollToAnnotation = vi.fn().mockReturnValue(true);
      const transcriptCtx = createMockTranscriptContext({
        state: {
          annotations: mockAnnotations,
          searchSeekBehavior: "change",
          readingMode: false,
        },
        actions: { scrollToAnnotation },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "world"; // matches a1, a2
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();
      scrollToAnnotation.mockClear();

      const nextBtn = container.querySelector(
        'button[aria-label="Next match"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(scrollToAnnotation).not.toHaveBeenCalled();
    });

    test("in change mode while Browsing (readingMode=true), navigating still calls scrollToAnnotation", async () => {
      const scrollToAnnotation = vi.fn().mockReturnValue(true);
      const transcriptCtx = createMockTranscriptContext({
        state: {
          annotations: mockAnnotations,
          searchSeekBehavior: "change",
          readingMode: true,
        },
        actions: { scrollToAnnotation },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "world"; // matches a1, a2
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();
      scrollToAnnotation.mockClear();

      const nextBtn = container.querySelector(
        'button[aria-label="Next match"]',
      ) as HTMLButtonElement;
      nextBtn.click();
      flushSync();
      await new Promise((r) => setTimeout(r, 50));
      flushSync();

      expect(scrollToAnnotation).toHaveBeenCalledWith("a2");
    });

    test("typing does not call scrollToAnnotation", async () => {
      const scrollToAnnotation = vi.fn().mockReturnValue(true);
      const transcriptCtx = createMockTranscriptContext({
        state: { annotations: mockAnnotations },
        actions: { scrollToAnnotation },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "world";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      flushSync();

      expect(scrollToAnnotation).not.toHaveBeenCalled();
    });
  });

  describe("onqueryinput (query-input seam)", () => {
    test("forwards Search's synchronous onqueryinput to the context handleQueryInput, before the debounced match update", () => {
      const handleQueryInput = vi.fn();
      const handleMatchChange = vi.fn();
      const transcriptCtx = createMockTranscriptContext({
        state: { annotations: mockAnnotations, searchSeekBehavior: "activate" },
        actions: { handleQueryInput, handleMatchChange },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();
      const callsBefore = handleMatchChange.mock.calls.length;

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Hello";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(handleQueryInput).toHaveBeenCalledWith("Hello");
      // Debounce hasn't elapsed yet — the match update hasn't fired.
      expect(handleMatchChange.mock.calls.length).toBe(callsBefore);
    });

    test("does not throw when the context provides no handleQueryInput", () => {
      const transcriptCtx = createMockTranscriptContext({
        state: { annotations: mockAnnotations },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: { context: transcriptCtx, component: TranscriptSearch },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Hello";
      expect(() =>
        input.dispatchEvent(new Event("input", { bubbles: true })),
      ).not.toThrow();
    });

    test("a supplied onqueryinput prop overrides the context default", () => {
      const handleQueryInput = vi.fn();
      const onqueryinput = vi.fn();
      const transcriptCtx = createMockTranscriptContext({
        actions: { handleQueryInput },
      });

      const { container } = render(TestTranscriptContextHarness, {
        props: {
          context: transcriptCtx,
          component: TranscriptSearch,
          props: { onqueryinput },
        },
      });
      flushSync();

      const input = container.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      input.value = "Hello";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(onqueryinput).toHaveBeenCalledWith("Hello");
      expect(handleQueryInput).not.toHaveBeenCalled();
    });
  });
});

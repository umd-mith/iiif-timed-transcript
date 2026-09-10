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
});

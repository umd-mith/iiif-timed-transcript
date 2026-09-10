import { describe, test, expect, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import type {
  TranscriptContext,
  TranscriptState,
} from "../../lib/player/transcript-context";

// render() from vitest-browser-svelte auto-unmounts mounted components in a
// beforeEach cleanup, so these tests need no manual target/afterEach teardown.
import TestTranscriptContextHarness from "./TestTranscriptContextHarness.svelte";
import TestTranscriptContextConsumer from "./TestTranscriptContextConsumer.svelte";

describe("transcript-context", () => {
  test("getTranscriptContext throws when no context available", () => {
    expect(() => {
      render(TestTranscriptContextConsumer, {
        props: { onResult: () => {} },
      });
    }).toThrow();
  });

  test("getTranscriptContext returns context when provided", () => {
    const mockContext: TranscriptContext = {
      state: {
        annotations: [{ id: "a1", startTime: 0, endTime: 5, text: "Hello" }],

        activeAnnotationId: null,
        searchMatches: [],
        currentMatchIndex: -1,
        highlightedIds: new Set(),
        currentMatchId: null,
      },
      actions: {
        handleAnnotationClick: vi.fn(),
        handleMatchChange: vi.fn(),
        scrollToAnnotation: vi.fn().mockReturnValue(false),
      },
    };

    let capturedResult: TranscriptContext | null = null;

    render(TestTranscriptContextHarness, {
      props: {
        context: mockContext,
        component: TestTranscriptContextConsumer,
        props: {
          onResult: (ctx: TranscriptContext) => {
            capturedResult = ctx;
          },
        },
      },
    });

    expect(capturedResult).toBe(mockContext);
  });

  test("TranscriptState has required fields", () => {
    // Type-level test: verify the interface shape compiles
    const state: TranscriptState = {
      annotations: [],
      activeAnnotationId: null,
      searchMatches: [],
      currentMatchIndex: -1,
      highlightedIds: new Set<string>(),
      currentMatchId: null,
    };

    expect(state.annotations).toEqual([]);
    expect(state.activeAnnotationId).toBeNull();
    expect(state.searchMatches).toEqual([]);
    expect(state.currentMatchIndex).toBe(-1);
    expect(state.highlightedIds).toBeInstanceOf(Set);
    expect(state.currentMatchId).toBeNull();
  });
});

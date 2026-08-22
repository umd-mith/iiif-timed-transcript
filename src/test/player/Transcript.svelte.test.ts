import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "svelte";
import { flushSync } from "svelte";
import type { Snippet } from "svelte";
import Transcript from "../../lib/player/Transcript.svelte";
import TestContextProvider from "./TestContextProvider.svelte";
import TestTranscriptContextConsumer from "./TestTranscriptContextConsumer.svelte";
import TestTranscriptWithSegments from "./TestTranscriptWithSegments.svelte";
import TestTranscriptLoadingSnippet from "./TestTranscriptLoadingSnippet.svelte";
import { createMockPlayerContext, createChildSnippet } from "./test-utils";
import type { Annotation } from "../../lib/sync/types";
import type { TranscriptContext } from "../../lib/player/transcript-context";

describe("Transcript", () => {
  let target: HTMLElement;

  const mockAnnotations: Annotation[] = [
    { id: "a1", startTime: 0, endTime: 5, text: "First annotation" },
    { id: "a2", startTime: 5, endTime: 10, text: "Second annotation" },
    { id: "a3", startTime: 10, endTime: 15, text: "Third annotation" },
  ];

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
  });

  afterEach(() => {
    if (document.body.contains(target)) {
      document.body.removeChild(target);
    }
  });

  test("renders panel but no segments without compound children", () => {
    const ctx = createMockPlayerContext();

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, Transcript, {
          annotations: mockAnnotations,
        }),
      },
    });
    flushSync();

    const panel = target.querySelector(".transcript-panel");
    expect(panel).not.toBeNull();
    // Without compound children, no segments are rendered (compound mode is the only mode)
    const segments = target.querySelectorAll("[data-annotation-id]");
    expect(segments).toHaveLength(0);
  });

  test("shows empty state when no annotations", () => {
    const ctx = createMockPlayerContext();

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: createChildSnippet(target, Transcript, { annotations: [] }),
      },
    });
    flushSync();

    const emptyMessage = target.querySelector(".empty-message");
    expect(emptyMessage).not.toBeNull();
    expect(emptyMessage?.textContent).toContain("No transcript available");
  });

  describe("context annotations fallback", () => {
    test("uses PlayerContext annotations when no annotations prop given", () => {
      const contextAnnotations: Annotation[] = [
        { id: "ctx1", startTime: 0, endTime: 5, text: "From context" },
        { id: "ctx2", startTime: 5, endTime: 10, text: "Also from context" },
      ];
      const playerCtx = createMockPlayerContext({
        annotations: contextAnnotations,
      });
      let capturedTranscriptCtx: TranscriptContext | null = null;

      mount(TestContextProvider, {
        target,
        props: {
          context: playerCtx,
          children: createChildSnippet(target, Transcript, {
            // No annotations prop — should fall back to context
            children: (() => {
              mount(TestTranscriptContextConsumer, {
                target,
                props: {
                  onResult: (ctx: TranscriptContext) => {
                    capturedTranscriptCtx = ctx;
                  },
                },
              });
            }) as unknown as Snippet,
          }),
        },
      });
      flushSync();

      expect(capturedTranscriptCtx).not.toBeNull();
      expect(capturedTranscriptCtx!.state.annotations).toEqual(
        contextAnnotations,
      );
    });

    test("prefers direct annotations prop over context annotations", () => {
      const contextAnnotations: Annotation[] = [
        { id: "ctx1", startTime: 0, endTime: 5, text: "From context" },
      ];
      const directAnnotations: Annotation[] = [
        { id: "d1", startTime: 0, endTime: 3, text: "Direct prop" },
        { id: "d2", startTime: 3, endTime: 6, text: "Also direct" },
      ];
      const playerCtx = createMockPlayerContext({
        annotations: contextAnnotations,
      });
      let capturedTranscriptCtx: TranscriptContext | null = null;

      mount(TestContextProvider, {
        target,
        props: {
          context: playerCtx,
          children: createChildSnippet(target, Transcript, {
            annotations: directAnnotations,
            children: (() => {
              mount(TestTranscriptContextConsumer, {
                target,
                props: {
                  onResult: (ctx: TranscriptContext) => {
                    capturedTranscriptCtx = ctx;
                  },
                },
              });
            }) as unknown as Snippet,
          }),
        },
      });
      flushSync();

      expect(capturedTranscriptCtx).not.toBeNull();
      expect(capturedTranscriptCtx!.state.annotations).toEqual(
        directAnnotations,
      );
    });
  });

  describe("TranscriptContext provision", () => {
    test("provides TranscriptContext to children", () => {
      const playerCtx = createMockPlayerContext();
      let capturedTranscriptCtx: TranscriptContext | null = null;

      mount(TestContextProvider, {
        target,
        props: {
          context: playerCtx,
          children: createChildSnippet(target, Transcript, {
            annotations: mockAnnotations,
            children: (() => {
              mount(TestTranscriptContextConsumer, {
                target,
                props: {
                  onResult: (ctx: TranscriptContext) => {
                    capturedTranscriptCtx = ctx;
                  },
                },
              });
            }) as unknown as Snippet,
          }),
        },
      });
      flushSync();

      expect(capturedTranscriptCtx).not.toBeNull();
      expect(capturedTranscriptCtx!.state.annotations).toEqual(mockAnnotations);
      expect(
        capturedTranscriptCtx!.actions.handleAnnotationClick,
      ).toBeInstanceOf(Function);
      expect(capturedTranscriptCtx!.actions.handleMatchChange).toBeInstanceOf(
        Function,
      );
    });

    test("context state includes search fields", () => {
      const playerCtx = createMockPlayerContext();
      let capturedCtx: TranscriptContext | null = null;

      mount(TestContextProvider, {
        target,
        props: {
          context: playerCtx,
          children: createChildSnippet(target, Transcript, {
            annotations: mockAnnotations,
            children: (() => {
              mount(TestTranscriptContextConsumer, {
                target,
                props: {
                  onResult: (ctx: TranscriptContext) => {
                    capturedCtx = ctx;
                  },
                },
              });
            }) as unknown as Snippet,
          }),
        },
      });
      flushSync();

      expect(capturedCtx!.state.activeAnnotationId).toBeNull();
      expect(capturedCtx!.state.searchMatches).toEqual([]);
      expect(capturedCtx!.state.currentMatchIndex).toBe(-1);
      expect(capturedCtx!.state.highlightedIds).toBeInstanceOf(Set);
      expect(capturedCtx!.state.currentMatchId).toBeNull();
    });

    test("handleAnnotationClick in context seeks media", () => {
      const playerCtx = createMockPlayerContext();
      let capturedCtx: TranscriptContext | null = null;

      mount(TestContextProvider, {
        target,
        props: {
          context: playerCtx,
          children: createChildSnippet(target, Transcript, {
            annotations: mockAnnotations,
            children: (() => {
              mount(TestTranscriptContextConsumer, {
                target,
                props: {
                  onResult: (ctx: TranscriptContext) => {
                    capturedCtx = ctx;
                  },
                },
              });
            }) as unknown as Snippet,
          }),
        },
      });
      flushSync();

      // Click annotation via context action
      capturedCtx!.actions.handleAnnotationClick(mockAnnotations[1]!);

      expect(playerCtx.actions.seekTo).toHaveBeenCalledWith(5); // startTime of a2
    });

    test("context actions include scrollToAnnotation", () => {
      const playerCtx = createMockPlayerContext();
      let capturedCtx: TranscriptContext | null = null;

      mount(TestContextProvider, {
        target,
        props: {
          context: playerCtx,
          children: createChildSnippet(target, Transcript, {
            annotations: mockAnnotations,
            children: (() => {
              mount(TestTranscriptContextConsumer, {
                target,
                props: {
                  onResult: (ctx: TranscriptContext) => {
                    capturedCtx = ctx;
                  },
                },
              });
            }) as unknown as Snippet,
          }),
        },
      });
      flushSync();

      expect(capturedCtx!.actions.scrollToAnnotation).toBeInstanceOf(Function);
    });

    test("scrollToAnnotation scrolls matching element into view", () => {
      const playerCtx = createMockPlayerContext();
      let capturedCtx: TranscriptContext | null = null;

      // Use wrapper that properly composes Transcript + TranscriptSegments
      // so segments render inside the scroll container
      mount(TestContextProvider, {
        target,
        props: {
          context: playerCtx,
          children: createChildSnippet(target, TestTranscriptWithSegments, {
            annotations: mockAnnotations,
            onContextReady: (ctx: TranscriptContext) => {
              capturedCtx = ctx;
            },
          }),
        },
      });
      flushSync();

      // Mock scrollIntoView on the target element
      const a2Element = target.querySelector(
        '[data-annotation-id="a2"]',
      ) as HTMLElement;
      a2Element.scrollIntoView = vi.fn();

      const result = capturedCtx!.actions.scrollToAnnotation("a2");

      expect(result).toBe(true);
      expect(a2Element.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: "center" }),
      );
    });

    test("scrollToAnnotation returns false for missing annotation", () => {
      const playerCtx = createMockPlayerContext();
      let capturedCtx: TranscriptContext | null = null;

      mount(TestContextProvider, {
        target,
        props: {
          context: playerCtx,
          children: createChildSnippet(target, TestTranscriptWithSegments, {
            annotations: mockAnnotations,
            onContextReady: (ctx: TranscriptContext) => {
              capturedCtx = ctx;
            },
          }),
        },
      });
      flushSync();

      const result = capturedCtx!.actions.scrollToAnnotation("nonexistent");

      expect(result).toBe(false);
    });

    test("scrollToAnnotation accepts ScrollIntoViewOptions", () => {
      const playerCtx = createMockPlayerContext();
      let capturedCtx: TranscriptContext | null = null;

      mount(TestContextProvider, {
        target,
        props: {
          context: playerCtx,
          children: createChildSnippet(target, TestTranscriptWithSegments, {
            annotations: mockAnnotations,
            onContextReady: (ctx: TranscriptContext) => {
              capturedCtx = ctx;
            },
          }),
        },
      });
      flushSync();

      const a1Element = target.querySelector(
        '[data-annotation-id="a1"]',
      ) as HTMLElement;
      a1Element.scrollIntoView = vi.fn();

      capturedCtx!.actions.scrollToAnnotation("a1", {
        behavior: "instant",
        block: "start",
      });

      expect(a1Element.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "instant", block: "start" }),
      );
    });
  });

  describe("transcriptPopulated and loading state", () => {
    test("sets transcriptPopulated on the player context from its effective annotations", () => {
      const ctx = createMockPlayerContext();

      mount(TestContextProvider, {
        target,
        props: {
          context: ctx,
          children: createChildSnippet(target, Transcript, {
            annotations: mockAnnotations,
          }),
        },
      });
      flushSync();

      expect(ctx.transcriptPopulated).toBe(true);
    });

    test("leaves transcriptPopulated false when there is nothing to show", () => {
      const ctx = createMockPlayerContext();

      mount(TestContextProvider, {
        target,
        props: {
          context: ctx,
          children: createChildSnippet(target, Transcript, { annotations: [] }),
        },
      });
      flushSync();

      expect(ctx.transcriptPopulated).toBe(false);
    });

    test("shows a loading affordance instead of the empty state while loading", () => {
      const ctx = createMockPlayerContext({ transcriptStatus: "loading" });

      mount(TestContextProvider, {
        target,
        props: {
          context: ctx,
          children: createChildSnippet(target, Transcript, { annotations: [] }),
        },
      });
      flushSync();

      const panel = target.querySelector(".transcript-panel");
      expect(panel?.getAttribute("aria-busy")).toBe("true");
      expect(target.querySelector(".loading-message")?.textContent).toContain(
        "Loading transcript",
      );
      expect(target.querySelector(".empty-message")).toBeNull();
    });

    test("renders the loading snippet instead of the default message", () => {
      const ctx = createMockPlayerContext({ transcriptStatus: "loading" });

      mount(TestContextProvider, {
        target,
        props: {
          context: ctx,
          children: createChildSnippet(target, TestTranscriptLoadingSnippet),
        },
      });
      flushSync();

      expect(target.querySelector(".custom-loading")?.textContent).toContain(
        "Fetching the transcript",
      );
      expect(target.querySelector(".loading-message")).toBeNull();
      expect(target.querySelector(".custom-empty")).toBeNull();
    });

    test("falls back to the empty snippet once loading finishes", () => {
      const ctx = createMockPlayerContext({ transcriptStatus: "ready" });

      mount(TestContextProvider, {
        target,
        props: {
          context: ctx,
          children: createChildSnippet(target, TestTranscriptLoadingSnippet),
        },
      });
      flushSync();

      expect(target.querySelector(".custom-loading")).toBeNull();
      expect(target.querySelector(".custom-empty")?.textContent).toContain(
        "Nothing here",
      );
    });
  });
});

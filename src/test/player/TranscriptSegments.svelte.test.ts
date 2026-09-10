import { describe, test, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import TranscriptSegments from "../../lib/player/TranscriptSegments.svelte";
import TestTranscriptContextHarness from "./TestTranscriptContextHarness.svelte";
import TestSegmentSnippetWrapper from "./TestSegmentSnippetWrapper.svelte";
import { createMockTranscriptContext } from "./transcript-test-utils";
import type { Annotation } from "../../lib/sync/types";

// render() from vitest-browser-svelte auto-unmounts between tests. Its returned
// container is aliased to `host` here since several tests keep a local
// `container` for the `.segments-container` element.
describe("TranscriptSegments", () => {
  const mockAnnotations: Annotation[] = [
    { id: "a1", startTime: 0, endTime: 5, text: "First segment" },
    { id: "a2", startTime: 5, endTime: 10, text: "Second segment" },
    { id: "a3", startTime: 10, endTime: 15, text: "Third segment" },
  ];

  // Existing behavior: works with props
  test("renders segments container with props", () => {
    const { container: host } = render(TranscriptSegments, {
      props: { annotations: mockAnnotations },
    });
    flushSync();

    const container = host.querySelector(".segments-container");
    expect(container).not.toBeNull();
  });

  test("container uses a labelled group role, not a toolbar (read-first a11y)", () => {
    const { container: host } = render(TranscriptSegments, {
      props: { annotations: mockAnnotations },
    });
    flushSync();

    const container = host.querySelector(".segments-container");
    // Read-first: a transcript is readable text grouped under a label, not a
    // row of action controls. Roving-tabindex navigation is a progressive
    // enhancement, so the composite-only aria-orientation is intentionally absent.
    expect(container?.getAttribute("role")).toBe("group");
    expect(container?.getAttribute("aria-label")).toBe("Transcript segments");
    expect(container?.getAttribute("aria-orientation")).toBeNull();
  });

  test("renders all segments with props", () => {
    const { container: host } = render(TranscriptSegments, {
      props: { annotations: mockAnnotations },
    });
    flushSync();

    const segments = host.querySelectorAll("[data-annotation-id]");
    expect(segments).toHaveLength(3);
  });

  test("shows empty state when no annotations", () => {
    const { container: host } = render(TranscriptSegments, {
      props: { annotations: [] },
    });
    flushSync();

    const emptyMessage = host.querySelector(".empty-message");
    expect(emptyMessage).not.toBeNull();
  });

  // New: context-aware behavior
  test("reads annotations from TranscriptContext when no prop given", () => {
    const transcriptCtx = createMockTranscriptContext({
      state: { annotations: mockAnnotations },
    });

    const { container: host } = render(TestTranscriptContextHarness, {
      props: { context: transcriptCtx, component: TranscriptSegments },
    });
    flushSync();

    const segments = host.querySelectorAll("[data-annotation-id]");
    expect(segments).toHaveLength(3);
  });

  test("reads activeAnnotationId from context", () => {
    const transcriptCtx = createMockTranscriptContext({
      state: {
        annotations: mockAnnotations,
        activeAnnotationId: "a2",
      },
    });

    const { container: host } = render(TestTranscriptContextHarness, {
      props: { context: transcriptCtx, component: TranscriptSegments },
    });
    flushSync();

    const activeSegment = host.querySelector(
      '[data-annotation-id="a2"][data-state="active"]',
    );
    expect(activeSegment).not.toBeNull();
  });

  test("calls context handleAnnotationClick on segment click", () => {
    const handleAnnotationClick = vi.fn();
    const transcriptCtx = createMockTranscriptContext({
      state: { annotations: mockAnnotations },
      actions: { handleAnnotationClick },
    });

    const { container: host } = render(TestTranscriptContextHarness, {
      props: { context: transcriptCtx, component: TranscriptSegments },
    });
    flushSync();

    const firstSegment = host.querySelector(
      '[data-annotation-id="a1"]',
    ) as HTMLElement;
    firstSegment.click();

    expect(handleAnnotationClick).toHaveBeenCalledWith(mockAnnotations[0]);
  });

  test("reads search highlight state from context", () => {
    const transcriptCtx = createMockTranscriptContext({
      state: {
        annotations: mockAnnotations,
        highlightedIds: new Set(["a1", "a3"]),
        currentMatchId: "a3",
      },
    });

    const { container: host } = render(TestTranscriptContextHarness, {
      props: { context: transcriptCtx, component: TranscriptSegments },
    });
    flushSync();

    // a1 should be highlighted (search match but not current)
    const a1 = host.querySelector('[data-annotation-id="a1"]');
    expect(a1?.getAttribute("data-highlighted")).toBe("true");

    // a3 should be current match
    const a3 = host.querySelector('[data-annotation-id="a3"]');
    expect(a3?.getAttribute("data-current-match")).toBe("true");
  });

  // segment snippet (LDA-2117)
  describe("segment snippet", () => {
    test("renders custom segment with segmentAttrs spread", () => {
      const { container: host } = render(TestSegmentSnippetWrapper, {
        props: { annotations: mockAnnotations },
      });
      flushSync();

      // Custom segment class should be rendered (not default Segment.svelte)
      const customSegments = host.querySelectorAll(".custom-segment");
      expect(customSegments).toHaveLength(3);

      // segmentAttrs should be spread onto the custom element
      const first = customSegments[0]!;
      expect(first.getAttribute("data-annotation-id")).toBe("a1");
      expect(first.getAttribute("data-state")).toBe("inactive");
      expect(first.getAttribute("role")).toBeNull();
      expect(first.getAttribute("tabindex")).not.toBeNull();
    });

    test("segmentAttrs onclick fires annotation click", () => {
      const onclick = vi.fn();
      const { container: host } = render(TestSegmentSnippetWrapper, {
        props: { annotations: mockAnnotations, onclick },
      });
      flushSync();

      const second = host.querySelector(
        '[data-annotation-id="a2"]',
      ) as HTMLElement;
      second.click();

      expect(onclick).toHaveBeenCalledWith(mockAnnotations[1]);
    });

    test("segment snippet receives isActive=true for active annotation", () => {
      const { container: host } = render(TestSegmentSnippetWrapper, {
        props: {
          annotations: mockAnnotations,
          activeAnnotationId: "a2",
        },
      });
      flushSync();

      // Active badge should be rendered by our test snippet
      const activeBadge = host.querySelector(".active-badge");
      expect(activeBadge).not.toBeNull();

      // data-state should be "active" on the correct segment
      const activeSegment = host.querySelector('[data-annotation-id="a2"]');
      expect(activeSegment?.getAttribute("data-state")).toBe("active");
    });

    test("segment snippet takes priority over text snippet", () => {
      const { container: host } = render(TestSegmentSnippetWrapper, {
        props: { annotations: mockAnnotations },
      });
      flushSync();

      // Should render custom-segment divs, not default buttons
      const buttons = host.querySelectorAll("button[data-annotation-id]");
      expect(buttons).toHaveLength(0);

      const customSegments = host.querySelectorAll(".custom-segment");
      expect(customSegments).toHaveLength(3);
    });

    // Fix B: custom segment snippets bypassed the text-selection guard that
    // Segment.svelte already applies to its own onclick (docs/specs/
    // transcript-reading-mode.md: "Selecting/copying transcript text must
    // not trigger segment activation on pointer release").
    describe("text-selection suppresses click activation for a custom snippet", () => {
      test("does not call onclick when a non-collapsed text selection exists at click time (drag-to-select)", () => {
        const onclick = vi.fn();
        const { container: host } = render(TestSegmentSnippetWrapper, {
          props: { annotations: mockAnnotations, onclick },
        });
        flushSync();

        const segment = host.querySelector(
          '.custom-segment[data-annotation-id="a1"]',
        ) as HTMLElement;
        const textEl = segment.querySelector(".custom-text") as HTMLElement;

        const range = document.createRange();
        range.selectNodeContents(textEl);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        expect(selection.isCollapsed).toBe(false);

        segment.click();

        expect(onclick).not.toHaveBeenCalled();

        selection.removeAllRanges();
      });

      test("still calls onclick on a plain click with a collapsed selection", () => {
        const onclick = vi.fn();
        const { container: host } = render(TestSegmentSnippetWrapper, {
          props: { annotations: mockAnnotations, onclick },
        });
        flushSync();

        window.getSelection()?.removeAllRanges();

        const segment = host.querySelector(
          '.custom-segment[data-annotation-id="a1"]',
        ) as HTMLElement;
        segment.click();

        expect(onclick).toHaveBeenCalledWith(mockAnnotations[0]);
      });

      test("still activates on Enter even while a non-collapsed selection exists (keyboard activation is never a drag)", () => {
        const onclick = vi.fn();
        const { container: host } = render(TestSegmentSnippetWrapper, {
          props: { annotations: mockAnnotations, onclick },
        });
        flushSync();

        const segment = host.querySelector(
          '.custom-segment[data-annotation-id="a1"]',
        ) as HTMLElement;
        const textEl = segment.querySelector(".custom-text") as HTMLElement;

        const range = document.createRange();
        range.selectNodeContents(textEl);
        const selection = window.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        segment.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
          }),
        );

        expect(onclick).toHaveBeenCalledWith(mockAnnotations[0]);

        selection.removeAllRanges();
      });
    });
  });

  // onkeydown extensibility (LDA-2118)
  describe("onkeydown extensibility", () => {
    test("fires onkeydown with annotation context", () => {
      const onkeydown = vi.fn();
      const { container: host } = render(TranscriptSegments, {
        props: { annotations: mockAnnotations, onkeydown },
      });
      flushSync();

      const container = host.querySelector(
        ".segments-container",
      ) as HTMLElement;
      container.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", bubbles: true }),
      );

      expect(onkeydown).toHaveBeenCalledOnce();
      const [event, context] = onkeydown.mock.calls[0]!;
      expect(event).toBeInstanceOf(KeyboardEvent);
      expect(context.annotation).toEqual(mockAnnotations[0]);
      expect(context.index).toBe(0);
      expect(context.annotations).toEqual(mockAnnotations);
    });

    test("skips built-in nav when consumer calls preventDefault", () => {
      const onkeydown = vi.fn((event: KeyboardEvent) => {
        event.preventDefault();
      });
      const { container: host } = render(TranscriptSegments, {
        props: { annotations: mockAnnotations, onkeydown },
      });
      flushSync();

      const container = host.querySelector(
        ".segments-container",
      ) as HTMLElement;

      // Focus first segment
      const firstSegment = host.querySelector(
        "[data-annotation-id]",
      ) as HTMLElement;
      firstSegment.focus();

      // ArrowDown with preventDefault should NOT move focus
      container.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
      flushSync();

      // focusedIndex should still be 0 (first segment still has tabindex=0)
      const segments = host.querySelectorAll("[data-annotation-id]");
      expect(segments[0]!.getAttribute("tabindex")).toBe("0");
    });
  });

  // highlightedAnnotationId prop (LDA-2117 deep link support)
  describe("highlightedAnnotationId", () => {
    test("sets data-highlighted on matching segment", () => {
      const { container: host } = render(TranscriptSegments, {
        props: {
          annotations: mockAnnotations,
          highlightedAnnotationId: "a2",
        },
      });
      flushSync();

      const a2 = host.querySelector('[data-annotation-id="a2"]');
      expect(a2?.getAttribute("data-highlighted")).toBe("true");

      // Others should not be highlighted
      const a1 = host.querySelector('[data-annotation-id="a1"]');
      expect(a1?.getAttribute("data-highlighted")).toBeNull();
    });

    test("does not conflict with search highlights", () => {
      const transcriptCtx = createMockTranscriptContext({
        state: {
          annotations: mockAnnotations,
          highlightedIds: new Set(["a1"]),
          currentMatchId: null,
        },
      });

      const { container: host } = render(TestTranscriptContextHarness, {
        props: {
          context: transcriptCtx,
          component: TranscriptSegments,
          props: { highlightedAnnotationId: "a3" },
        },
      });
      flushSync();

      // Both a1 (search) and a3 (deep link) should be highlighted
      const a1 = host.querySelector('[data-annotation-id="a1"]');
      expect(a1?.getAttribute("data-highlighted")).toBe("true");
      const a3 = host.querySelector('[data-annotation-id="a3"]');
      expect(a3?.getAttribute("data-highlighted")).toBe("true");
    });
  });

  // scrollToAnnotation imperative API (LDA-2119)
  describe("scrollToAnnotation", () => {
    test("returns true and scrolls when annotation exists", () => {
      const { component: instance, container: host } = render(
        TranscriptSegments,
        { props: { annotations: mockAnnotations } },
      );
      flushSync();

      // Mock scrollIntoView on the target element
      const a2Element = host.querySelector(
        '[data-annotation-id="a2"]',
      ) as HTMLElement;
      a2Element.scrollIntoView = vi.fn();

      const result = instance.scrollToAnnotation("a2");

      expect(result).toBe(true);
      expect(a2Element.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: "center" }),
      );
    });

    test("returns false when annotation does not exist", () => {
      const { component: instance } = render(TranscriptSegments, {
        props: { annotations: mockAnnotations },
      });
      flushSync();

      const result = instance.scrollToAnnotation("nonexistent");

      expect(result).toBe(false);
    });

    test("accepts optional ScrollIntoViewOptions", () => {
      const { component: instance, container: host } = render(
        TranscriptSegments,
        { props: { annotations: mockAnnotations } },
      );
      flushSync();

      const a1Element = host.querySelector(
        '[data-annotation-id="a1"]',
      ) as HTMLElement;
      a1Element.scrollIntoView = vi.fn();

      instance.scrollToAnnotation("a1", {
        behavior: "instant",
        block: "start",
      });

      expect(a1Element.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "instant", block: "start" }),
      );
    });
  });

  // Input-element guard (LDA-2118 refinement)
  describe("input-element guard", () => {
    test("does not fire onkeydown when event target is an input", () => {
      const onkeydown = vi.fn();
      const { container: host } = render(TranscriptSegments, {
        props: { annotations: mockAnnotations, onkeydown },
      });
      flushSync();

      // Create an input inside the container (simulates inline editing)
      const container = host.querySelector(
        ".segments-container",
      ) as HTMLElement;
      const input = document.createElement("input");
      container.appendChild(input);
      input.focus();

      // Dispatch keydown that bubbles from input to container
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "f",
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(onkeydown).not.toHaveBeenCalled();
    });

    test("does not fire onkeydown when event target is a textarea", () => {
      const onkeydown = vi.fn();
      const { container: host } = render(TranscriptSegments, {
        props: { annotations: mockAnnotations, onkeydown },
      });
      flushSync();

      const container = host.querySelector(
        ".segments-container",
      ) as HTMLElement;
      const textarea = document.createElement("textarea");
      container.appendChild(textarea);
      textarea.focus();

      textarea.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "e",
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(onkeydown).not.toHaveBeenCalled();
    });

    test("does not intercept built-in nav from contenteditable", () => {
      const { container: host } = render(TranscriptSegments, {
        props: { annotations: mockAnnotations },
      });
      flushSync();

      const container = host.querySelector(
        ".segments-container",
      ) as HTMLElement;
      const editable = document.createElement("div");
      editable.contentEditable = "true";
      container.appendChild(editable);
      editable.focus();

      // ArrowDown inside contenteditable should NOT trigger segment navigation
      editable.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
      flushSync();

      // focusedIndex should still be 0
      const segments = host.querySelectorAll("[data-annotation-id]");
      expect(segments[0]!.getAttribute("tabindex")).toBe("0");
    });
  });
});

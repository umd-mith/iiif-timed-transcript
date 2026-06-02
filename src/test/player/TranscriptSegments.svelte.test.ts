import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "svelte";
import { flushSync } from "svelte";
import TranscriptSegments from "../../lib/player/TranscriptSegments.svelte";
import TestTranscriptContextProvider from "./TestTranscriptContextProvider.svelte";
import TestSegmentSnippetWrapper from "./TestSegmentSnippetWrapper.svelte";
import { createMockTranscriptContext } from "./transcript-test-utils";
import { createChildSnippet } from "./test-utils";
import type { Annotation } from "../../lib/sync/types";

describe("TranscriptSegments", () => {
  let target: HTMLElement;

  const mockAnnotations: Annotation[] = [
    { id: "a1", startTime: 0, endTime: 5, text: "First segment" },
    { id: "a2", startTime: 5, endTime: 10, text: "Second segment" },
    { id: "a3", startTime: 10, endTime: 15, text: "Third segment" },
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

  // Existing behavior: works with props
  test("renders segments container with props", () => {
    mount(TranscriptSegments, {
      target,
      props: { annotations: mockAnnotations },
    });
    flushSync();

    const container = target.querySelector(".segments-container");
    expect(container).not.toBeNull();
  });

  test("container uses toolbar role with vertical orientation (a11y)", () => {
    mount(TranscriptSegments, {
      target,
      props: { annotations: mockAnnotations },
    });
    flushSync();

    const container = target.querySelector(".segments-container");
    expect(container?.getAttribute("role")).toBe("toolbar");
    expect(container?.getAttribute("aria-orientation")).toBe("vertical");
  });

  test("renders all segments with props", () => {
    mount(TranscriptSegments, {
      target,
      props: { annotations: mockAnnotations },
    });
    flushSync();

    const segments = target.querySelectorAll("[data-annotation-id]");
    expect(segments).toHaveLength(3);
  });

  test("shows empty state when no annotations", () => {
    mount(TranscriptSegments, { target, props: { annotations: [] } });
    flushSync();

    const emptyMessage = target.querySelector(".empty-message");
    expect(emptyMessage).not.toBeNull();
  });

  // New: context-aware behavior
  test("reads annotations from TranscriptContext when no prop given", () => {
    const transcriptCtx = createMockTranscriptContext({
      state: { annotations: mockAnnotations },
    });

    mount(TestTranscriptContextProvider, {
      target,
      props: {
        context: transcriptCtx,
        children: createChildSnippet(target, TranscriptSegments),
      },
    });
    flushSync();

    const segments = target.querySelectorAll("[data-annotation-id]");
    expect(segments).toHaveLength(3);
  });

  test("reads activeAnnotationId from context", () => {
    const transcriptCtx = createMockTranscriptContext({
      state: {
        annotations: mockAnnotations,
        activeAnnotationId: "a2",
      },
    });

    mount(TestTranscriptContextProvider, {
      target,
      props: {
        context: transcriptCtx,
        children: createChildSnippet(target, TranscriptSegments),
      },
    });
    flushSync();

    const activeSegment = target.querySelector(
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

    mount(TestTranscriptContextProvider, {
      target,
      props: {
        context: transcriptCtx,
        children: createChildSnippet(target, TranscriptSegments),
      },
    });
    flushSync();

    const firstSegment = target.querySelector(
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

    mount(TestTranscriptContextProvider, {
      target,
      props: {
        context: transcriptCtx,
        children: createChildSnippet(target, TranscriptSegments),
      },
    });
    flushSync();

    // a1 should be highlighted (search match but not current)
    const a1 = target.querySelector('[data-annotation-id="a1"]');
    expect(a1?.getAttribute("data-highlighted")).toBe("true");

    // a3 should be current match
    const a3 = target.querySelector('[data-annotation-id="a3"]');
    expect(a3?.getAttribute("data-current-match")).toBe("true");
  });

  // segment snippet (LDA-2117)
  describe("segment snippet", () => {
    test("renders custom segment with segmentAttrs spread", () => {
      mount(TestSegmentSnippetWrapper, {
        target,
        props: { annotations: mockAnnotations },
      });
      flushSync();

      // Custom segment class should be rendered (not default Segment.svelte)
      const customSegments = target.querySelectorAll(".custom-segment");
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
      mount(TestSegmentSnippetWrapper, {
        target,
        props: { annotations: mockAnnotations, onclick },
      });
      flushSync();

      const second = target.querySelector(
        '[data-annotation-id="a2"]',
      ) as HTMLElement;
      second.click();

      expect(onclick).toHaveBeenCalledWith(mockAnnotations[1]);
    });

    test("segment snippet receives isActive=true for active annotation", () => {
      mount(TestSegmentSnippetWrapper, {
        target,
        props: {
          annotations: mockAnnotations,
          activeAnnotationId: "a2",
        },
      });
      flushSync();

      // Active badge should be rendered by our test snippet
      const activeBadge = target.querySelector(".active-badge");
      expect(activeBadge).not.toBeNull();

      // data-state should be "active" on the correct segment
      const activeSegment = target.querySelector('[data-annotation-id="a2"]');
      expect(activeSegment?.getAttribute("data-state")).toBe("active");
    });

    test("segment snippet takes priority over text snippet", () => {
      mount(TestSegmentSnippetWrapper, {
        target,
        props: { annotations: mockAnnotations },
      });
      flushSync();

      // Should render custom-segment divs, not default buttons
      const buttons = target.querySelectorAll("button[data-annotation-id]");
      expect(buttons).toHaveLength(0);

      const customSegments = target.querySelectorAll(".custom-segment");
      expect(customSegments).toHaveLength(3);
    });
  });

  // onkeydown extensibility (LDA-2118)
  describe("onkeydown extensibility", () => {
    test("fires onkeydown with annotation context", () => {
      const onkeydown = vi.fn();
      mount(TranscriptSegments, {
        target,
        props: { annotations: mockAnnotations, onkeydown },
      });
      flushSync();

      const container = target.querySelector(
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
      mount(TranscriptSegments, {
        target,
        props: { annotations: mockAnnotations, onkeydown },
      });
      flushSync();

      const container = target.querySelector(
        ".segments-container",
      ) as HTMLElement;

      // Focus first segment
      const firstSegment = target.querySelector(
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
      const segments = target.querySelectorAll("[data-annotation-id]");
      expect(segments[0]!.getAttribute("tabindex")).toBe("0");
    });
  });

  // highlightedAnnotationId prop (LDA-2117 deep link support)
  describe("highlightedAnnotationId", () => {
    test("sets data-highlighted on matching segment", () => {
      mount(TranscriptSegments, {
        target,
        props: {
          annotations: mockAnnotations,
          highlightedAnnotationId: "a2",
        },
      });
      flushSync();

      const a2 = target.querySelector('[data-annotation-id="a2"]');
      expect(a2?.getAttribute("data-highlighted")).toBe("true");

      // Others should not be highlighted
      const a1 = target.querySelector('[data-annotation-id="a1"]');
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

      mount(TestTranscriptContextProvider, {
        target,
        props: {
          context: transcriptCtx,
          children: createChildSnippet(target, TranscriptSegments, {
            highlightedAnnotationId: "a3",
          }),
        },
      });
      flushSync();

      // Both a1 (search) and a3 (deep link) should be highlighted
      const a1 = target.querySelector('[data-annotation-id="a1"]');
      expect(a1?.getAttribute("data-highlighted")).toBe("true");
      const a3 = target.querySelector('[data-annotation-id="a3"]');
      expect(a3?.getAttribute("data-highlighted")).toBe("true");
    });
  });

  // scrollToAnnotation imperative API (LDA-2119)
  describe("scrollToAnnotation", () => {
    test("returns true and scrolls when annotation exists", () => {
      const instance = mount(TranscriptSegments, {
        target,
        props: { annotations: mockAnnotations },
      });
      flushSync();

      // Mock scrollIntoView on the target element
      const a2Element = target.querySelector(
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
      const instance = mount(TranscriptSegments, {
        target,
        props: { annotations: mockAnnotations },
      });
      flushSync();

      const result = instance.scrollToAnnotation("nonexistent");

      expect(result).toBe(false);
    });

    test("accepts optional ScrollIntoViewOptions", () => {
      const instance = mount(TranscriptSegments, {
        target,
        props: { annotations: mockAnnotations },
      });
      flushSync();

      const a1Element = target.querySelector(
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
      mount(TranscriptSegments, {
        target,
        props: { annotations: mockAnnotations, onkeydown },
      });
      flushSync();

      // Create an input inside the container (simulates inline editing)
      const container = target.querySelector(
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
      mount(TranscriptSegments, {
        target,
        props: { annotations: mockAnnotations, onkeydown },
      });
      flushSync();

      const container = target.querySelector(
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
      mount(TranscriptSegments, {
        target,
        props: { annotations: mockAnnotations },
      });
      flushSync();

      const container = target.querySelector(
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
      const segments = target.querySelectorAll("[data-annotation-id]");
      expect(segments[0]!.getAttribute("tabindex")).toBe("0");
    });
  });
});

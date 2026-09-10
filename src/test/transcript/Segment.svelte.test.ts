// src/lib/transcript/Segment.svelte.test.ts
import { describe, it, expect, vi } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import Segment from "../../lib/transcript/Segment.svelte";
import TestSegmentTextSnippetWrapper from "./TestSegmentTextSnippetWrapper.svelte";

// render() from vitest-browser-svelte auto-unmounts each component between
// tests, so no manual target/afterEach teardown is needed.
describe("Transcript.Segment", () => {
  const mockAnnotation = {
    id: "ann-1",
    startTime: 10.5,
    endTime: 15.2,
    text: "Hello world",
  };

  it("renders annotation text", () => {
    const { container } = render(Segment, {
      props: { annotation: mockAnnotation },
    });
    flushSync();

    expect(container.textContent).toContain("Hello world");
  });

  it("renders timestamp", () => {
    const { container } = render(Segment, {
      props: { annotation: mockAnnotation },
    });
    flushSync();

    expect(container.textContent).toContain("0:10");
  });

  it("includes data-annotation-id attribute", () => {
    const { container } = render(Segment, {
      props: { annotation: mockAnnotation },
    });
    flushSync();

    const button = container.querySelector('[data-annotation-id="ann-1"]');
    expect(button).not.toBeNull();
  });

  it("calls onclick when clicked", () => {
    const onclick = vi.fn();
    const { container } = render(Segment, {
      props: { annotation: mockAnnotation, onclick },
    });
    flushSync();

    const segment = container.querySelector(
      "[data-annotation-id]",
    ) as HTMLElement;
    segment.click();

    expect(onclick).toHaveBeenCalledTimes(1);
  });

  it("calls onclick on Enter key", () => {
    const onclick = vi.fn();
    const { container } = render(Segment, {
      props: { annotation: mockAnnotation, onclick },
    });
    flushSync();

    const segment = container.querySelector(
      "[data-annotation-id]",
    ) as HTMLElement;
    segment.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(onclick).toHaveBeenCalledTimes(1);
  });

  it("calls onclick on Space key", () => {
    const onclick = vi.fn();
    const { container } = render(Segment, {
      props: { annotation: mockAnnotation, onclick },
    });
    flushSync();

    const segment = container.querySelector(
      "[data-annotation-id]",
    ) as HTMLElement;
    segment.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(onclick).toHaveBeenCalledTimes(1);
  });

  it("applies active state via data attribute", () => {
    const { container } = render(Segment, {
      props: {
        annotation: mockAnnotation,
        isActive: true,
      },
    });
    flushSync();

    const button = container.querySelector('[data-state="active"]');
    expect(button).not.toBeNull();
  });

  it("applies inactive state when not active", () => {
    const { container } = render(Segment, {
      props: {
        annotation: mockAnnotation,
        isActive: false,
      },
    });
    flushSync();

    const button = container.querySelector('[data-state="inactive"]');
    expect(button).not.toBeNull();
  });

  it("exposes role=button on the interactive segment (a11y)", () => {
    const { container } = render(Segment, {
      props: { annotation: mockAnnotation },
    });
    flushSync();

    const segment = container.querySelector("[data-annotation-id]");
    expect(segment?.getAttribute("role")).toBe("button");
  });

  it("applies lang on the default text path when annotation.language is set", () => {
    const { container } = render(Segment, {
      props: { annotation: { ...mockAnnotation, language: "es" } },
    });
    flushSync();

    const text = container.querySelector(".text");
    expect(text?.getAttribute("lang")).toBe("es");
  });

  it("omits lang when annotation.language is absent", () => {
    const { container } = render(Segment, {
      props: { annotation: mockAnnotation },
    });
    flushSync();

    const text = container.querySelector(".text");
    expect(text?.hasAttribute("lang")).toBe(false);
  });

  it("passes language to a custom text snippet", () => {
    const { container } = render(TestSegmentTextSnippetWrapper, {
      props: { annotation: { ...mockAnnotation, language: "fr" } },
    });
    flushSync();

    const custom = container.querySelector(".custom-text");
    expect(custom?.getAttribute("data-language")).toBe("fr");
  });

  describe("text-selection suppresses click activation (Finding 3)", () => {
    it("does not call onclick when a non-collapsed text selection exists at click time (drag-to-select)", () => {
      const onclick = vi.fn();
      const { container } = render(Segment, {
        props: { annotation: mockAnnotation, onclick },
      });
      flushSync();

      const segment = container.querySelector(
        "[data-annotation-id]",
      ) as HTMLElement;
      const textEl = segment.querySelector(".text") as HTMLElement;

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

    it("still calls onclick on a plain click with a collapsed selection", () => {
      const onclick = vi.fn();
      const { container } = render(Segment, {
        props: { annotation: mockAnnotation, onclick },
      });
      flushSync();

      window.getSelection()?.removeAllRanges();

      const segment = container.querySelector(
        "[data-annotation-id]",
      ) as HTMLElement;
      segment.click();

      expect(onclick).toHaveBeenCalledTimes(1);
    });

    it("still calls onclick on Enter even while a non-collapsed selection exists (keyboard activation is never a drag)", () => {
      const onclick = vi.fn();
      const { container } = render(Segment, {
        props: { annotation: mockAnnotation, onclick },
      });
      flushSync();

      const segment = container.querySelector(
        "[data-annotation-id]",
      ) as HTMLElement;
      const textEl = segment.querySelector(".text") as HTMLElement;

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

      expect(onclick).toHaveBeenCalledTimes(1);

      selection.removeAllRanges();
    });
  });
});

// src/lib/transcript/Segment.svelte.test.ts
import { mount } from "svelte";
import { describe, it, expect, vi, afterEach } from "vitest";
import { flushSync } from "svelte";
import Segment from "../../lib/transcript/Segment.svelte";

describe("Transcript.Segment", () => {
  const mockAnnotation = {
    id: "ann-1",
    startTime: 10.5,
    endTime: 15.2,
    text: "Hello world",
  };

  let target: HTMLElement;

  afterEach(() => {
    if (target && document.body.contains(target)) {
      document.body.removeChild(target);
    }
  });

  it("renders annotation text", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    mount(Segment, { target, props: { annotation: mockAnnotation } });
    flushSync();

    expect(target.textContent).toContain("Hello world");
  });

  it("renders timestamp", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    mount(Segment, { target, props: { annotation: mockAnnotation } });
    flushSync();

    expect(target.textContent).toContain("0:10");
  });

  it("includes data-annotation-id attribute", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    mount(Segment, { target, props: { annotation: mockAnnotation } });
    flushSync();

    const button = target.querySelector('[data-annotation-id="ann-1"]');
    expect(button).not.toBeNull();
  });

  it("calls onclick when clicked", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const onclick = vi.fn();
    mount(Segment, { target, props: { annotation: mockAnnotation, onclick } });
    flushSync();

    const segment = target.querySelector(
      "[data-annotation-id]",
    ) as HTMLElement;
    segment.click();

    expect(onclick).toHaveBeenCalledTimes(1);
  });

  it("calls onclick on Enter key", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    const onclick = vi.fn();
    mount(Segment, { target, props: { annotation: mockAnnotation, onclick } });
    flushSync();

    const segment = target.querySelector(
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
    target = document.createElement("div");
    document.body.appendChild(target);

    const onclick = vi.fn();
    mount(Segment, { target, props: { annotation: mockAnnotation, onclick } });
    flushSync();

    const segment = target.querySelector(
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
    target = document.createElement("div");
    document.body.appendChild(target);

    mount(Segment, {
      target,
      props: {
        annotation: mockAnnotation,
        isActive: true,
      },
    });
    flushSync();

    const button = target.querySelector('[data-state="active"]');
    expect(button).not.toBeNull();
  });

  it("applies inactive state when not active", () => {
    target = document.createElement("div");
    document.body.appendChild(target);

    mount(Segment, {
      target,
      props: {
        annotation: mockAnnotation,
        isActive: false,
      },
    });
    flushSync();

    const button = target.querySelector('[data-state="inactive"]');
    expect(button).not.toBeNull();
  });
});

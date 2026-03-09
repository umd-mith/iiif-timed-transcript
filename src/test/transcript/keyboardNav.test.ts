import { describe, it, expect } from "vitest";
import {
  getNextIndex,
  focusSegmentAtIndex,
} from "../../lib/transcript/keyboardNav";

describe("getNextIndex", () => {
  it("moves down with wrapping", () => {
    expect(getNextIndex("ArrowDown", 0, 5)).toBe(1);
    expect(getNextIndex("ArrowDown", 4, 5)).toBe(0); // wraps
  });

  it("moves up with wrapping", () => {
    expect(getNextIndex("ArrowUp", 2, 5)).toBe(1);
    expect(getNextIndex("ArrowUp", 0, 5)).toBe(4); // wraps
  });

  it("jumps to start on Home", () => {
    expect(getNextIndex("Home", 3, 5)).toBe(0);
  });

  it("jumps to end on End", () => {
    expect(getNextIndex("End", 0, 5)).toBe(4);
  });

  it("returns null for non-navigation keys", () => {
    expect(getNextIndex("Enter", 0, 5)).toBeNull();
    expect(getNextIndex("Tab", 0, 5)).toBeNull();
    expect(getNextIndex("a", 0, 5)).toBeNull();
  });
});

describe("focusSegmentAtIndex", () => {
  it("focuses the button at the given index", () => {
    const container = document.createElement("div");
    const btn0 = document.createElement("button");
    btn0.dataset.annotationId = "a1";
    const btn1 = document.createElement("button");
    btn1.dataset.annotationId = "a2";
    container.append(btn0, btn1);
    document.body.appendChild(container);

    focusSegmentAtIndex(container, 1);
    expect(document.activeElement).toBe(btn1);

    document.body.removeChild(container);
  });

  it("focuses non-button elements with data-annotation-id", () => {
    const container = document.createElement("div");
    const div0 = document.createElement("div");
    div0.dataset.annotationId = "a1";
    div0.tabIndex = 0;
    const div1 = document.createElement("div");
    div1.dataset.annotationId = "a2";
    div1.tabIndex = -1;
    container.append(div0, div1);
    document.body.appendChild(container);

    focusSegmentAtIndex(container, 1);
    expect(document.activeElement).toBe(div1);

    document.body.removeChild(container);
  });

  it("does nothing for out-of-bounds index", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    // Should not throw
    focusSegmentAtIndex(container, 5);

    document.body.removeChild(container);
  });
});

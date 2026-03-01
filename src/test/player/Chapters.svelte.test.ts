import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { mount } from "svelte";
import { flushSync } from "svelte";
import TestContextProvider from "./TestContextProvider.svelte";
import { createMockPlayerContext } from "./test-utils";

const testChapters = [
  { id: "ch1", label: "Introduction", startTime: 0, endTime: 30 },
  { id: "ch2", label: "Main Discussion", startTime: 30, endTime: 90 },
];

describe("Chapters", () => {
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);
  });

  afterEach(() => {
    if (document.body.contains(target)) {
      document.body.removeChild(target);
    }
  });

  test("renders chapter buttons from context", async () => {
    const { default: Chapters } =
      await import("../../lib/player/Chapters.svelte");
    const ctx = createMockPlayerContext({ chapters: testChapters });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: () => {
          mount(Chapters, { target });
        },
      },
    });
    flushSync();

    const buttons = target.querySelectorAll("[data-chapter-id]");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.getAttribute("data-chapter-id")).toBe("ch1");
    expect(buttons[1]!.getAttribute("data-chapter-id")).toBe("ch2");
  });

  test("displays chapter label and time range", async () => {
    const { default: Chapters } =
      await import("../../lib/player/Chapters.svelte");
    const ctx = createMockPlayerContext({ chapters: testChapters });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: () => {
          mount(Chapters, { target });
        },
      },
    });
    flushSync();

    const firstButton = target.querySelector('[data-chapter-id="ch1"]')!;
    expect(firstButton.querySelector(".chapter-label")?.textContent).toBe(
      "Introduction",
    );
    expect(firstButton.querySelector(".chapter-time")?.textContent).toContain(
      "0:00",
    );
    expect(firstButton.querySelector(".chapter-time")?.textContent).toContain(
      "0:30",
    );

    const secondButton = target.querySelector('[data-chapter-id="ch2"]')!;
    expect(secondButton.querySelector(".chapter-label")?.textContent).toBe(
      "Main Discussion",
    );
    expect(secondButton.querySelector(".chapter-time")?.textContent).toContain(
      "0:30",
    );
    expect(secondButton.querySelector(".chapter-time")?.textContent).toContain(
      "1:30",
    );
  });

  test('marks active chapter with data-state="active"', async () => {
    const { default: Chapters } =
      await import("../../lib/player/Chapters.svelte");
    const ctx = createMockPlayerContext({
      chapters: testChapters,
      activeChapterId: "ch1",
    });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: () => {
          mount(Chapters, { target });
        },
      },
    });
    flushSync();

    const ch1 = target.querySelector('[data-chapter-id="ch1"]');
    const ch2 = target.querySelector('[data-chapter-id="ch2"]');
    expect(ch1?.getAttribute("data-state")).toBe("active");
    expect(ch1?.getAttribute("aria-current")).toBe("true");
    expect(ch2?.getAttribute("data-state")).toBe("inactive");
    expect(ch2?.hasAttribute("aria-current")).toBe(false);
  });

  test("clicking chapter calls seekToChapter", async () => {
    const { default: Chapters } =
      await import("../../lib/player/Chapters.svelte");
    const ctx = createMockPlayerContext({ chapters: testChapters });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: () => {
          mount(Chapters, { target });
        },
      },
    });
    flushSync();

    const firstButton = target.querySelector(
      '[data-chapter-id="ch1"]',
    ) as HTMLElement;
    firstButton.click();

    expect(ctx.actions.seekToChapter).toHaveBeenCalledWith(ctx.chapters[0]);
  });

  test("renders empty message when no chapters", async () => {
    const { default: Chapters } =
      await import("../../lib/player/Chapters.svelte");
    const ctx = createMockPlayerContext({ chapters: [] });

    mount(TestContextProvider, {
      target,
      props: {
        context: ctx,
        children: () => {
          mount(Chapters, { target });
        },
      },
    });
    flushSync();

    const emptyMessage = target.querySelector(".empty-message");
    expect(emptyMessage).not.toBeNull();
    expect(emptyMessage?.textContent).toContain("No chapters");
  });
});

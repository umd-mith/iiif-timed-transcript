import { describe, test, expect } from "vitest";
import { flushSync } from "svelte";
import { render } from "vitest-browser-svelte";
import TestContextHarness from "./TestContextHarness.svelte";
import { createMockPlayerContext } from "./test-utils";

const testChapters = [
  { id: "ch1", label: "Introduction", startTime: 0, endTime: 30 },
  { id: "ch2", label: "Main Discussion", startTime: 30, endTime: 90 },
];

describe("Chapters", () => {
  test("renders chapter buttons from context", async () => {
    const { default: Chapters } =
      await import("../../lib/player/Chapters.svelte");
    const ctx = createMockPlayerContext({ chapters: testChapters });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Chapters },
    });
    flushSync();

    const buttons = container.querySelectorAll("[data-chapter-id]");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.getAttribute("data-chapter-id")).toBe("ch1");
    expect(buttons[1]!.getAttribute("data-chapter-id")).toBe("ch2");
  });

  test("displays chapter label and time range", async () => {
    const { default: Chapters } =
      await import("../../lib/player/Chapters.svelte");
    const ctx = createMockPlayerContext({ chapters: testChapters });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Chapters },
    });
    flushSync();

    const firstButton = container.querySelector('[data-chapter-id="ch1"]')!;
    expect(firstButton.querySelector(".chapter-label")?.textContent).toBe(
      "Introduction",
    );
    expect(firstButton.querySelector(".chapter-time")?.textContent).toContain(
      "0:00",
    );
    expect(firstButton.querySelector(".chapter-time")?.textContent).toContain(
      "0:30",
    );

    const secondButton = container.querySelector('[data-chapter-id="ch2"]')!;
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

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Chapters },
    });
    flushSync();

    const ch1 = container.querySelector('[data-chapter-id="ch1"]');
    const ch2 = container.querySelector('[data-chapter-id="ch2"]');
    expect(ch1?.getAttribute("data-state")).toBe("active");
    expect(ch1?.getAttribute("aria-current")).toBe("true");
    expect(ch2?.getAttribute("data-state")).toBe("inactive");
    expect(ch2?.hasAttribute("aria-current")).toBe(false);
  });

  test("clicking chapter calls seekToChapter", async () => {
    const { default: Chapters } =
      await import("../../lib/player/Chapters.svelte");
    const ctx = createMockPlayerContext({ chapters: testChapters });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Chapters },
    });
    flushSync();

    const firstButton = container.querySelector(
      '[data-chapter-id="ch1"]',
    ) as HTMLElement;
    firstButton.click();

    expect(ctx.actions.seekToChapter).toHaveBeenCalledWith(ctx.chapters[0]);
  });

  test("renders empty message when no chapters", async () => {
    const { default: Chapters } =
      await import("../../lib/player/Chapters.svelte");
    const ctx = createMockPlayerContext({ chapters: [] });

    const { container } = render(TestContextHarness, {
      props: { context: ctx, component: Chapters },
    });
    flushSync();

    const emptyMessage = container.querySelector(".empty-message");
    expect(emptyMessage).not.toBeNull();
    expect(emptyMessage?.textContent).toContain("No chapters");
  });
});

import { afterEach, expect, test, vi } from "vitest";
import { register } from "./register";
import {
  mountElement,
  shadow,
  untilShadow,
  removeAllElements,
  silentWavDataUrl,
  withStubMedia,
} from "./test-helpers";
import {
  MANIFEST_WITHOUT_CHAPTERS,
  mockFetchRoutes,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerRef } from "../lib/index";

const realFetch = globalThis.fetch;
afterEach(() => {
  removeAllElements();
  manifestCache.clear();
  globalThis.fetch = realFetch;
});

test("scrolling the transcript to its bottom seeks the real media to the last cue end", async () => {
  register();
  globalThis.fetch = vi.fn() as unknown as typeof fetch;
  const url = "https://example.com/scroll-seek-review.json";
  mockFetchRoutes({
    [url]: {
      json: withStubMedia(MANIFEST_WITHOUT_CHAPTERS, {
        audio: silentWavDataUrl(40),
      }),
    },
  });
  const el = await mountElement(
    { "manifest-url": url },
    {
      annotations: [
        { id: "alpha", startTime: 2, endTime: 4, text: "Alpha" },
        { id: "bravo", startTime: 11, endTime: 17, text: "Bravo" },
        { id: "charlie", startTime: 23, endTime: 29, text: "Charlie" },
      ],
    },
  );
  const audio = await untilShadow<HTMLAudioElement>(el, "audio");
  await vi.waitFor(() => {
    expect((el.playerRef as PlayerRef).state.isReady).toBe(true);
    expect(audio.duration).toBeCloseTo(40, 1);
  });
  const panel = await untilShadow<HTMLElement>(el, ".transcript-panel");
  const segments = shadow(el).querySelectorAll<HTMLElement>(
    "[data-annotation-id]",
  );
  expect(segments).toHaveLength(3);
  panel.style.cssText =
    "height: 80px; max-height: 80px; overflow-y: scroll; scroll-behavior: auto";
  for (const segment of segments) segment.style.minHeight = "120px";
  const maxScroll = panel.scrollHeight - panel.clientHeight;
  expect(maxScroll).toBeGreaterThan(0);
  expect(audio.currentTime).toBe(0);

  let browserScrollSeen = false;
  panel.addEventListener("scroll", (event) => {
    browserScrollSeen ||= event.isTrusted;
  });
  // Let the browser emit a scroll event from a real change of scroll position.
  // Do not call player actions or dispatch a synthetic scroll event.
  panel.scrollTop = maxScroll;
  await vi.waitFor(() => expect(browserScrollSeen).toBe(true));
  // At the bottom of the transcript the target is Charlie's end (29),
  // independently specified above, not the media duration (40).
  await vi.waitFor(() => expect(audio.currentTime).toBeCloseTo(29, 1));
});

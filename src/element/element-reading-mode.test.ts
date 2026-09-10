// src/element/element-reading-mode.test.ts
//
// Custom-element configuration for the transcript-reading-mode spec
// (docs/specs/transcript-reading-mode.md, "Proposed API and compatibility"
// and the acceptance-gate table): `search-seek-behavior`, `scroll-to-seek`,
// `reading-mode` attributes/properties, the `:state(browsing)` custom
// state, and the guarded `reading-mode` reflection. Covers "Custom element
// configured through markup and properties" and the element half of
// "Single folded control across surfaces". The final test walks the
// recommended configuration through the spec's closing journey: listen,
// search, browse, activate, browse again, return.
import {
  describe,
  test,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { register, DEFAULT_TAG } from "./register";
import {
  mountElement,
  shadow,
  untilShadow,
  waitForEvent,
  removeAllElements,
  silentWavDataUrl,
  withStubMedia,
  type ElementHandle,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITHOUT_CHAPTERS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerErrorDetail } from "./events";

type El = ElementHandle & {
  searchSeekBehavior?: string;
  scrollToSeek?: boolean;
  readingMode?: boolean;
};

const ANNOTATIONS = [
  { id: "alpha", startTime: 2, endTime: 6, text: "Alpha segment" },
  { id: "bravo", startTime: 10, endTime: 16, text: "Bravo grapefruit segment" },
  {
    id: "charlie",
    startTime: 22,
    endTime: 28,
    text: "Charlie grapefruit finale",
  },
];

/** Collects the host-tier iiif-player-error details fired on `el`. */
function recordHostErrors(el: HTMLElement): PlayerErrorDetail[] {
  const seen: PlayerErrorDetail[] = [];
  el.addEventListener("iiif-player-error", (e) => {
    const detail = (e as CustomEvent<PlayerErrorDetail>).detail;
    if (detail.source === "host") seen.push(detail);
  });
  return seen;
}

/** Collects "iiif-player-seeked" firings on `el`. */
function recordSeeks(el: HTMLElement): number {
  let count = 0;
  el.addEventListener("iiif-player-seeked", () => {
    count += 1;
  });
  return count;
}

async function readyAudio(el: HTMLElement): Promise<HTMLAudioElement> {
  const audio = await untilShadow<HTMLAudioElement>(el, "audio");
  await vi.waitFor(() => {
    expect((el as ElementHandle).playerRef).toBeTruthy();
  });
  await untilShadow(el, "[data-annotation-id]");
  return audio;
}

function typeQuery(el: HTMLElement, query: string): void {
  const input = shadow(el).querySelector(
    'input[type="search"]',
  ) as HTMLInputElement;
  input.value = query;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

let urlCounter = 0;
function nextUrl(): string {
  urlCounter += 1;
  return `https://example.com/reading-mode-${urlCounter}.json`;
}

function mockManifest(url: string, seconds = 40) {
  mockFetchRoutes({
    [url]: {
      json: withStubMedia(MANIFEST_WITHOUT_CHAPTERS, {
        audio: silentWavDataUrl(seconds),
      }),
    },
  });
}

describe("<iiif-transcript-player> reading-mode configuration", () => {
  beforeAll(() => {
    register();
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    removeAllElements();
    manifestCache.clear();
  });

  test('markup attributes configure search-seek-behavior, scroll-to-seek, and reading-mode; scroll-to-seek="false" parses as false', async () => {
    const url = nextUrl();
    mockManifest(url);
    const el = (await mountElement(
      {
        "manifest-url": url,
        "search-seek-behavior": "activate",
        "scroll-to-seek": "false",
        "reading-mode": "true",
      },
      { annotations: ANNOTATIONS },
    )) as El;
    const audio = await readyAudio(el);

    expect(el.searchSeekBehavior).toBe("activate");
    expect(el.scrollToSeek).toBe(false);
    expect(el.readingMode).toBe(true);
    expect(el.matches(":state(browsing)")).toBe(true);
    // "Go to match" only renders once there is at least one match to go to
    // (Search.svelte); "Jump to current" depends only on reading mode.
    expect(shadow(el).querySelector(".jump-to-current")).toBeTruthy();

    // Typing in activate mode never seeks, even once the debounce settles,
    // and the activation control appears once the match resolves.
    typeQuery(el, "grapefruit");
    await new Promise((r) => setTimeout(r, 250));
    expect(audio.currentTime).toBe(0);
    expect(
      shadow(el).querySelector('button[aria-label="Go to match"]'),
    ).toBeTruthy();
  });

  test("property writes after upgrade produce the same behavior as the matching attributes", async () => {
    const url = nextUrl();
    mockManifest(url);
    const el = (await mountElement(
      { "manifest-url": url },
      { annotations: ANNOTATIONS },
    )) as El;
    await readyAudio(el);

    // Legacy defaults beforehand: no activation control, not Browsing.
    expect(
      shadow(el).querySelector('button[aria-label="Go to match"]'),
    ).toBeNull();
    expect(el.matches(":state(browsing)")).toBe(false);

    el.searchSeekBehavior = "activate";
    el.scrollToSeek = false;
    el.readingMode = true;

    await vi.waitFor(() => {
      expect(el.matches(":state(browsing)")).toBe(true);
    });
    expect(shadow(el).querySelector(".jump-to-current")).toBeTruthy();
    // The property setter always stores a genuine boolean, regardless of
    // how it later gets reflected onto the attribute.
    expect(el.readingMode).toBe(true);
    expect(el.scrollToSeek).toBe(false);

    typeQuery(el, "grapefruit");
    await new Promise((r) => setTimeout(r, 250));
    expect(
      shadow(el).querySelector('button[aria-label="Go to match"]'),
    ).toBeTruthy();
  });

  test("properties set before upgrade configure the element at first render", async () => {
    const url = nextUrl();
    mockManifest(url);
    const el = (await mountElement(
      { "manifest-url": url },
      {
        annotations: ANNOTATIONS,
        searchSeekBehavior: "activate",
        scrollToSeek: false,
        readingMode: true,
      },
    )) as El;
    await readyAudio(el);

    expect(el.matches(":state(browsing)")).toBe(true);
    expect(shadow(el).querySelector(".jump-to-current")).toBeTruthy();

    typeQuery(el, "grapefruit");
    await new Promise((r) => setTimeout(r, 250));
    expect(
      shadow(el).querySelector('button[aria-label="Go to match"]'),
    ).toBeTruthy();
  });

  test("an invalid scroll-to-seek or reading-mode value is a one-time host error and falls back to the default; removing the attribute restores the default", async () => {
    const url = nextUrl();
    mockManifest(url);
    const el = document.createElement(DEFAULT_TAG) as El;
    el.setAttribute("manifest-url", url);
    el.setAttribute("scroll-to-seek", "sortof");
    el.setAttribute("reading-mode", "banana");
    Object.assign(el, { annotations: ANNOTATIONS });
    const hostErrors = recordHostErrors(el);
    document.body.appendChild(el);
    await readyAudio(el);

    expect(el.scrollToSeek).toBe(true);
    expect(el.readingMode).toBe(false);
    expect(el.matches(":state(browsing)")).toBe(false);
    expect(shadow(el).querySelector(".jump-to-current")).toBeNull();
    expect(hostErrors.length).toBeGreaterThanOrEqual(2);
    expect(
      hostErrors.some((e) => e.error.message.includes("`scroll-to-seek`")),
    ).toBe(true);
    expect(
      hostErrors.some((e) => e.error.message.includes("`reading-mode`")),
    ).toBe(true);

    // A good value afterwards still lands (the channel is not poisoned).
    el.setAttribute("reading-mode", "");
    await vi.waitFor(() => {
      expect(el.matches(":state(browsing)")).toBe(true);
    });

    // Removing the attribute is "back to the default", not an error.
    el.removeAttribute("reading-mode");
    await vi.waitFor(() => {
      expect(el.matches(":state(browsing)")).toBe(false);
    });
    expect(el.readingMode).toBe(false);
  });

  test('a genuine scroll with scroll-to-seek="false" enters Browsing without seeking', async () => {
    const url = nextUrl();
    mockManifest(url);
    const el = (await mountElement(
      { "manifest-url": url, "scroll-to-seek": "false" },
      { annotations: ANNOTATIONS },
    )) as El;
    const audio = await readyAudio(el);
    const panel = await untilShadow<HTMLElement>(el, ".transcript-panel");
    const segments = shadow(el).querySelectorAll<HTMLElement>(
      "[data-annotation-id]",
    );
    panel.style.cssText =
      "height: 80px; max-height: 80px; overflow-y: scroll; scroll-behavior: auto";
    for (const segment of segments) segment.style.minHeight = "120px";
    const maxScroll = panel.scrollHeight - panel.clientHeight;
    expect(maxScroll).toBeGreaterThan(0);

    let browserScrollSeen = false;
    panel.addEventListener("scroll", (event) => {
      browserScrollSeen ||= event.isTrusted;
    });
    panel.scrollTop = maxScroll;
    await vi.waitFor(() => expect(browserScrollSeen).toBe(true));

    await vi.waitFor(() => {
      expect(el.matches(":state(browsing)")).toBe(true);
    });
    expect(audio.currentTime).toBe(0);
    await vi.waitFor(() => {
      expect(el.getAttribute("reading-mode")).not.toBeNull();
    });
  });

  test("the Follow along switch is the single track-audio control, toggles :state(browsing), reflects reading-mode, and emits no seeked event", async () => {
    const url = nextUrl();
    mockManifest(url);
    const el = (await mountElement(
      { "manifest-url": url },
      { annotations: ANNOTATIONS },
    )) as El;
    await readyAudio(el);
    const seeksBefore = recordSeeks(el);

    const switches = shadow(el).querySelectorAll('[role="switch"]');
    expect(switches).toHaveLength(1);
    expect(shadow(el).querySelector("button[aria-pressed]")).toBeNull();
    const followAlong = switches[0] as HTMLButtonElement;
    expect(followAlong.getAttribute("aria-checked")).toBe("true");
    expect(el.getAttribute("reading-mode")).toBeNull();

    followAlong.click();

    await vi.waitFor(() => {
      expect(el.matches(":state(browsing)")).toBe(true);
    });
    expect(followAlong.getAttribute("aria-checked")).toBe("false");
    await vi.waitFor(() => {
      expect(el.getAttribute("reading-mode")).not.toBeNull();
    });

    const jumpToCurrent = shadow(el).querySelector(
      ".jump-to-current",
    ) as HTMLButtonElement;
    expect(jumpToCurrent).toBeTruthy();
    jumpToCurrent.click();

    await vi.waitFor(() => {
      expect(el.matches(":state(browsing)")).toBe(false);
    });
    await vi.waitFor(() => {
      expect(el.getAttribute("reading-mode")).toBeNull();
    });
    expect(followAlong.getAttribute("aria-checked")).toBe("true");

    // Reflection itself never seeks.
    expect(seeksBefore).toBe(0);
  });

  test("recommended configuration (activate + scrollToSeek=false) supports listen, search, browse, activate, browse again, return", async () => {
    const url = nextUrl();
    mockManifest(url);
    const el = (await mountElement(
      {
        "manifest-url": url,
        "search-seek-behavior": "activate",
        "scroll-to-seek": "false",
      },
      { annotations: ANNOTATIONS },
    )) as El;
    const audio = await readyAudio(el);
    let seeks = 0;
    el.addEventListener("iiif-player-seeked", () => {
      seeks += 1;
    });

    // Listen: Following by default, nothing has seeked.
    expect(el.matches(":state(browsing)")).toBe(false);
    expect(audio.currentTime).toBe(0);

    // Search: typing enters Browsing on input — before the debounced match
    // update settles (checked well within the 250ms debounce wait below).
    typeQuery(el, "grapefruit");
    await vi.waitFor(() => {
      expect(el.matches(":state(browsing)")).toBe(true);
    });
    await new Promise((r) => setTimeout(r, 250));
    expect(
      shadow(el).querySelector('button[aria-label="Go to match"]'),
    ).toBeTruthy();
    expect(audio.currentTime).toBe(0);
    expect(seeks).toBe(0);

    // Browse: previous/next selects a match without seeking.
    const next = shadow(el).querySelector(
      'button[aria-label="Next match"]',
    ) as HTMLButtonElement;
    next.click();
    expect(audio.currentTime).toBe(0);
    expect(seeks).toBe(0);

    // Activate: seeks exactly once to the selected match, stays Browsing.
    const activateButton = shadow(el).querySelector(
      'button[aria-label="Go to match"]',
    ) as HTMLButtonElement;
    activateButton.click();
    await waitForEvent(el, "iiif-player-seeked");
    expect(seeks).toBe(1);
    expect(el.matches(":state(browsing)")).toBe(true);
    const seekedTime = audio.currentTime;
    expect(seekedTime).toBeGreaterThan(0);

    // Browse again: navigating further still does not seek.
    const prev = shadow(el).querySelector(
      'button[aria-label="Previous match"]',
    ) as HTMLButtonElement;
    prev.click();
    await new Promise((r) => setTimeout(r, 50));
    expect(audio.currentTime).toBe(seekedTime);
    expect(seeks).toBe(1);

    // Return: back to Following, no further seek.
    const followAlong = shadow(el).querySelector(
      '[role="switch"]',
    ) as HTMLButtonElement;
    followAlong.click();
    await vi.waitFor(() => {
      expect(el.matches(":state(browsing)")).toBe(false);
    });
    expect(audio.currentTime).toBe(seekedTime);
    expect(seeks).toBe(1);
  });
});

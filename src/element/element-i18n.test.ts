import {
  describe,
  test,
  expect,
  vi,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { register } from "./register";
import {
  mountElement,
  shadow,
  untilShadow,
  removeAllElements,
  withStubMedia,
} from "./test-helpers";
import {
  mockFetchRoutes,
  MANIFEST_WITHOUT_CHAPTERS,
} from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import { registerTranslation, setLocale } from "../lib/index.js";

const MANIFEST_STUB = withStubMedia(MANIFEST_WITHOUT_CHAPTERS);

describe("<iiif-transcript-player> i18n locale resolution", () => {
  beforeAll(() => {
    register();
    registerTranslation("fr", { "player.playButton.play": "Jouer" });
  });
  beforeEach(() => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });
  afterEach(() => {
    removeAllElements();
    manifestCache.clear();
    document.documentElement.removeAttribute("lang");
    setLocale("en");
  });

  async function mountAndGetPlayLabel(
    setup: (el: HTMLElement) => void,
  ): Promise<string | null> {
    const url = `https://example.com/el-i18n-${Math.random()}.json`;
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    setup(el);
    await untilShadow(el, '[data-audio-button="play-pause"]');
    const button = shadow(el).querySelector('[data-audio-button="play-pause"]');
    return button?.textContent ?? null;
  }

  test("resolves from the element's own lang attribute", async () => {
    const label = await mountAndGetPlayLabel((el) =>
      el.setAttribute("lang", "fr"),
    );
    expect(label).toBe("Jouer");
  });

  test("falls back to <html lang> when the element has no lang", async () => {
    document.documentElement.setAttribute("lang", "fr");
    const label = await mountAndGetPlayLabel(() => {});
    expect(label).toBe("Jouer");
  });

  test("falls back to English when nothing sets lang", async () => {
    const label = await mountAndGetPlayLabel(() => {});
    expect(label).toBe("Play");
  });

  test("element lang takes priority over <html lang>", async () => {
    document.documentElement.setAttribute("lang", "es");
    const label = await mountAndGetPlayLabel((el) =>
      el.setAttribute("lang", "fr"),
    );
    expect(label).toBe("Jouer");
  });

  test("reacts to a lang attribute change after mount", async () => {
    const url = "https://example.com/el-i18n-reactive.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_STUB, id: url } },
    });
    const el = await mountElement({ "manifest-url": url });
    await untilShadow(el, '[data-audio-button="play-pause"]');
    const button = shadow(el).querySelector('[data-audio-button="play-pause"]');
    expect(button?.textContent).toBe("Play");

    el.setAttribute("lang", "fr");
    await vi.waitFor(() => {
      expect(button?.textContent).toBe("Jouer");
    });
  });
});

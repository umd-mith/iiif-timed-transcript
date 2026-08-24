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
import { removeAllElements, withStubMedia } from "./test-helpers";
import { mockFetchRoutes } from "../test/player/test-fixtures";
import { manifestCache } from "../lib/player/manifestCache";
import type { PlayerErrorDetail } from "./events";

type Seen = { type: string; detail: unknown };

function recordEvents(el: HTMLElement): Seen[] {
  const seen: Seen[] = [];
  for (const type of ["iiif-player-ready", "iiif-player-error"]) {
    el.addEventListener(type, (e) =>
      seen.push({ type, detail: (e as CustomEvent).detail }),
    );
  }
  return seen;
}

// Avalon-style 2.x auth service serialization: "@type", no "type" — the
// shape validators.ts:30-53 special-cased for exactly this reason.
const MANIFEST_WITH_AUTH_SERVICE = withStubMedia({
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-auth-service",
  type: "Manifest",
  label: { en: ["Restricted Item"] },
  items: [
    {
      id: "https://example.com/canvas/1",
      type: "Canvas",
      duration: 60,
      items: [
        {
          id: "https://example.com/canvas/1/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/canvas/1/page/1/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/audio.mp3",
                type: "Sound",
                format: "audio/mp3",
                service: [
                  {
                    "@id": "https://example.com/auth/cookie",
                    "@type": "AuthCookieService1",
                    profile: "http://iiif.io/api/auth/1/login",
                  },
                ],
              },
              target: "https://example.com/canvas/1",
            },
          ],
        },
      ],
    },
  ],
});

const MANIFEST_PUBLIC = withStubMedia({
  ...MANIFEST_WITH_AUTH_SERVICE,
  id: "https://example.com/manifest-public",
  items: [
    {
      ...MANIFEST_WITH_AUTH_SERVICE.items[0]!,
      items: [
        {
          ...MANIFEST_WITH_AUTH_SERVICE.items[0]!.items[0],
          items: [
            {
              ...MANIFEST_WITH_AUTH_SERVICE.items[0]!.items[0]!.items[0],
              body: {
                id: "https://example.com/audio.mp3",
                type: "Sound",
                format: "audio/mp3",
              },
            },
          ],
        },
      ],
    },
  ],
});

describe("<iiif-transcript-player> IIIF Auth API 1 detection", () => {
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

  test("a canvas whose media has an AuthCookieService1 fires exactly one fatal iiif-player-error with source 'auth'", async () => {
    const url = "https://example.com/el-auth.json";
    mockFetchRoutes({
      [url]: { json: { ...MANIFEST_WITH_AUTH_SERVICE, id: url } },
    });
    const el = document.createElement(
      "iiif-transcript-player",
    ) as HTMLElement & {
      playerRef?: unknown;
    };
    el.setAttribute("manifest-url", url);
    const seen = recordEvents(el);
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(
        seen.some(
          (s) =>
            s.type === "iiif-player-error" &&
            (s.detail as PlayerErrorDetail).source === "auth",
        ),
      ).toBe(true);
    });
    const authEvents = seen.filter(
      (s) =>
        s.type === "iiif-player-error" &&
        (s.detail as PlayerErrorDetail).source === "auth",
    );
    expect(authEvents).toHaveLength(1);
    expect(authEvents[0]!.detail).toMatchObject({
      fatal: true,
      source: "auth",
    });
    // No competing "media" error for the same load — auth replaces it.
    await new Promise((r) => setTimeout(r, 50));
    expect(
      seen.filter(
        (s) =>
          s.type === "iiif-player-error" &&
          (s.detail as PlayerErrorDetail).source === "media",
      ),
    ).toHaveLength(0);
    expect(el.playerRef == null).toBe(true);
  });

  test("a public manifest with no auth service is unaffected", async () => {
    const url = "https://example.com/el-auth-unaffected.json";
    mockFetchRoutes({ [url]: { json: { ...MANIFEST_PUBLIC, id: url } } });
    const el = document.createElement("iiif-transcript-player") as HTMLElement;
    el.setAttribute("manifest-url", url);
    const seen = recordEvents(el);
    document.body.appendChild(el);

    await vi.waitFor(() => {
      expect(seen.some((s) => s.type === "iiif-player-ready")).toBe(true);
    });
    expect(
      seen.filter(
        (s) =>
          s.type === "iiif-player-error" &&
          (s.detail as PlayerErrorDetail).source === "auth",
      ),
    ).toHaveLength(0);
  });
});

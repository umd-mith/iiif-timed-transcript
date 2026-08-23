// src/lib/player/test-fixtures.ts
// Shared mock manifests for player component tests

import { vi } from "vitest";

/**
 * Minimal manifest with audio and chapter structures.
 * Two chapters: "Introduction" (0-30s) and "Main Discussion" (30-90s).
 */
export const MANIFEST_WITH_CHAPTERS = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest",
  type: "Manifest",
  label: { en: ["Test Manifest"] },
  items: [
    {
      id: "https://example.com/canvas/1",
      type: "Canvas",
      duration: 90,
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
              },
              target: "https://example.com/canvas/1",
            },
          ],
        },
      ],
    },
  ],
  structures: [
    {
      id: "https://example.com/range/1",
      type: "Range",
      label: { en: ["Introduction"] },
      items: [{ id: "https://example.com/canvas/1#t=0,30", type: "Canvas" }],
    },
    {
      id: "https://example.com/range/2",
      type: "Range",
      label: { en: ["Main Discussion"] },
      items: [{ id: "https://example.com/canvas/1#t=30,90", type: "Canvas" }],
    },
  ],
};

/**
 * Minimal manifest WITHOUT structures (no chapters).
 */
export const MANIFEST_WITHOUT_CHAPTERS = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-no-chapters",
  type: "Manifest",
  label: { en: ["Test Manifest No Chapters"] },
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
              },
              target: "https://example.com/canvas/1",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Manifest with an HLS streaming URL (.m3u8).
 */
export const MANIFEST_WITH_HLS = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-hls",
  type: "Manifest",
  label: { en: ["HLS Test Manifest"] },
  items: [
    {
      id: "https://example.com/canvas/1",
      type: "Canvas",
      duration: 120,
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
                id: "https://example.com/stream/master.m3u8",
                type: "Video",
                format: "application/x-mpegURL",
              },
              target: "https://example.com/canvas/1",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Video manifest with a VTT caption file in canvas.annotations.
 * Follows IIIF Cookbook recipe 0219 pattern.
 */
export const MANIFEST_WITH_VTT_CAPTIONS = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-vtt",
  type: "Manifest",
  label: { en: ["VTT Caption Test Manifest"] },
  items: [
    {
      id: "https://example.com/canvas/1",
      type: "Canvas",
      duration: 120,
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
                id: "https://example.com/video.mp4",
                type: "Video",
                format: "video/mp4",
              },
              target: "https://example.com/canvas/1",
            },
          ],
        },
      ],
      annotations: [
        {
          id: "https://example.com/canvas/1/annotations/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/canvas/1/annotations/1/annotation/1",
              type: "Annotation",
              motivation: "supplementing",
              body: {
                id: "https://example.com/captions-fr.vtt",
                type: "Text",
                format: "text/vtt",
                language: "fr",
                label: { fr: ["Sous-titres"] },
              },
              target: "https://example.com/canvas/1",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Multi-canvas manifest with two canvases: audio (90s) and video (120s).
 * Structures reference different canvases for chapter filtering tests.
 * Canvas 2 has VTT annotations for track discovery per canvas.
 */
export const MANIFEST_MULTI_CANVAS = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-multi",
  type: "Manifest",
  label: { en: ["Multi-Canvas Manifest"] },
  items: [
    {
      id: "https://example.com/canvas/1",
      type: "Canvas",
      label: { en: ["Interview Part 1"] },
      duration: 90,
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
                id: "https://example.com/audio1.mp3",
                type: "Sound",
                format: "audio/mp3",
              },
              target: "https://example.com/canvas/1",
            },
          ],
        },
      ],
    },
    {
      id: "https://example.com/canvas/2",
      type: "Canvas",
      label: { en: ["Interview Part 2"] },
      duration: 120,
      width: 1920,
      height: 1080,
      items: [
        {
          id: "https://example.com/canvas/2/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/canvas/2/page/1/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/video2.mp4",
                type: "Video",
                format: "video/mp4",
              },
              target: "https://example.com/canvas/2",
            },
          ],
        },
      ],
      annotations: [
        {
          id: "https://example.com/canvas/2/annotations/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/canvas/2/annotations/1/annotation/1",
              type: "Annotation",
              motivation: "supplementing",
              body: {
                id: "https://example.com/captions-en.vtt",
                type: "Text",
                format: "text/vtt",
                language: "en",
              },
              target: "https://example.com/canvas/2",
            },
          ],
        },
      ],
    },
  ],
  structures: [
    {
      id: "https://example.com/range/1",
      type: "Range",
      label: { en: ["Introduction"] },
      items: [{ id: "https://example.com/canvas/1#t=0,30", type: "Canvas" }],
    },
    {
      id: "https://example.com/range/2",
      type: "Range",
      label: { en: ["Early Life"] },
      items: [{ id: "https://example.com/canvas/1#t=30,90", type: "Canvas" }],
    },
    {
      id: "https://example.com/range/3",
      type: "Range",
      label: { en: ["Career Beginnings"] },
      items: [{ id: "https://example.com/canvas/2#t=0,60", type: "Canvas" }],
    },
    {
      id: "https://example.com/range/4",
      type: "Range",
      label: { en: ["Later Years"] },
      items: [{ id: "https://example.com/canvas/2#t=60,120", type: "Canvas" }],
    },
  ],
};

/**
 * Builds a two-canvas manifest where canvas 0 is HLS and canvas 1 is plain
 * audio, based on MANIFEST_MULTI_CANVAS. Shared by the stale-HLS regression
 * tests in Root.svelte.test.ts and Root.stale-hls-import.svelte.test.ts.
 */
export function buildStaleHlsManifest(url: string) {
  return {
    ...MANIFEST_MULTI_CANVAS,
    id: url,
    items: [
      {
        ...MANIFEST_MULTI_CANVAS.items[0],
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
                  id: "https://example.com/stream/master.m3u8",
                  type: "Video",
                  format: "application/x-mpegURL",
                },
                target: "https://example.com/canvas/1",
              },
            ],
          },
        ],
      },
      MANIFEST_MULTI_CANVAS.items[1],
    ],
  };
}

/**
 * Helper: mock fetch to return a manifest.
 */
export function mockFetchManifest(manifest: Record<string, unknown>) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => manifest,
  });
}

export type FetchRoute =
  | { json: unknown; status?: number }
  | { text: string; status?: number }
  | { status: number }
  | { promise: Promise<FetchRoute> };

/**
 * Helper: route mocked fetch by URL. Unmatched URLs reject (so a test fails
 * loudly on an unexpected request). A route with `promise` defers until it
 * resolves — use `deferred()` to control timing.
 */
export function mockFetchRoutes(routes: Record<string, FetchRoute>) {
  const toResponse = (route: FetchRoute): Response => {
    const status = "status" in route ? (route.status ?? 200) : 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 404 ? "Not Found" : "OK",
      json: async () => ("json" in route ? route.json : undefined),
      text: async () => ("text" in route ? route.text : ""),
    } as Response;
  };
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementation(
    async (input: RequestInfo | URL) => {
      const url = String(input);
      const route = routes[url];
      if (!route) throw new Error(`Unexpected fetch: ${url}`);
      if ("promise" in route) return toResponse(await route.promise);
      return toResponse(route);
    },
  );
}

/** Helper: a promise the test resolves by hand. */
export function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
} {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export const VTT_FIXTURE_OK = `WEBVTT

c1
00:00:00.000 --> 00:00:02.000
<v Narrator>First caption &amp; more

c2
00:00:02.000 --> 00:00:04.000
Second caption
`;

export const VTT_FIXTURE_MALFORMED = `this is not webvtt`;

export const VTT_FIXTURE_PARTIAL = `WEBVTT

00:00:00.000 --> 00:00:01.000
Only good cue

garbage --> 00:00:02.000
Bad cue
`;

/**
 * Audio manifest with embedded TextualBody supplementing annotations
 * (AVAnnotate-style; every annotation reuses the page id, as Voices does).
 */
export const MANIFEST_WITH_EMBEDDED_TRANSCRIPT = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-embedded",
  type: "Manifest",
  label: { en: ["Embedded Transcript Manifest"] },
  items: [
    {
      id: "https://example.com/emb/canvas/1",
      type: "Canvas",
      duration: 30,
      items: [
        {
          id: "https://example.com/emb/canvas/1/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/emb/canvas/1/page/1/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/emb/audio.mp3",
                type: "Sound",
                format: "audio/mpeg",
              },
              target: "https://example.com/emb/canvas/1",
            },
          ],
        },
      ],
      annotations: [
        {
          id: "https://example.com/emb/canvas/1/annotations/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/emb/canvas/1/annotations/1/page1",
              type: "Annotation",
              motivation: ["commenting", "tagging"],
              body: [
                {
                  type: "TextualBody",
                  value: "Welcome to the interview.",
                  format: "text/plain",
                  purpose: "commenting",
                },
                {
                  type: "TextualBody",
                  value: "Interviewer",
                  purpose: "tagging",
                },
              ],
              target: "https://example.com/emb/canvas/1#t=0,5",
            },
            {
              id: "https://example.com/emb/canvas/1/annotations/1/page1",
              type: "Annotation",
              motivation: "commenting",
              body: {
                type: "TextualBody",
                value: "Tell us where you grew up.",
                format: "text/plain",
              },
              target: "https://example.com/emb/canvas/1#t=5,12",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Two-canvas manifest for initial-canvasIndex tests: canvas 0 resolves its
 * transcript from an external VTT (tier 2), canvas 1 from embedded text
 * (tier 1). The split lets a test assert that mounting with canvasIndex=1
 * never issues canvas 0's VTT request.
 */
export const MANIFEST_INITIAL_INDEX = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-initial-index",
  type: "Manifest",
  label: { en: ["Initial Index Manifest"] },
  items: [
    {
      id: "https://example.com/ii/canvas/1",
      type: "Canvas",
      label: { en: ["Part 1"] },
      duration: 60,
      width: 1920,
      height: 1080,
      items: [
        {
          id: "https://example.com/ii/canvas/1/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/ii/canvas/1/page/1/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/initial-index-video0.mp4",
                type: "Video",
                format: "video/mp4",
              },
              target: "https://example.com/ii/canvas/1",
            },
          ],
        },
      ],
      annotations: [
        {
          id: "https://example.com/ii/canvas/1/annotations/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/ii/canvas/1/annotations/1/annotation/1",
              type: "Annotation",
              motivation: "supplementing",
              body: {
                id: "https://example.com/initial-index-c0.vtt",
                type: "Text",
                format: "text/vtt",
                language: "en",
              },
              target: "https://example.com/ii/canvas/1",
            },
          ],
        },
      ],
    },
    {
      id: "https://example.com/ii/canvas/2",
      type: "Canvas",
      label: { en: ["Part 2"] },
      duration: 30,
      items: [
        {
          id: "https://example.com/ii/canvas/2/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/ii/canvas/2/page/1/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                id: "https://example.com/initial-index-audio1.mp3",
                type: "Sound",
                format: "audio/mpeg",
              },
              target: "https://example.com/ii/canvas/2",
            },
          ],
        },
      ],
      annotations: [
        {
          id: "https://example.com/ii/canvas/2/annotations/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/ii/canvas/2/annotations/1/annotation/1",
              type: "Annotation",
              motivation: "commenting",
              body: {
                type: "TextualBody",
                value: "Second canvas text.",
                format: "text/plain",
              },
              target: "https://example.com/ii/canvas/2#t=0,10",
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Avalon-shaped manifest: a Choice of HLS renditions with the non-standard
 * `choiceHint` (stripped by Zod). Before Task 1 this canvas hard-failed with
 * "Canvas is not audio or video media".
 */
export const MANIFEST_WITH_CHOICE_HLS = {
  "@context": "http://iiif.io/api/presentation/3/context.json",
  id: "https://example.com/manifest-choice-hls",
  type: "Manifest",
  label: { en: ["Choice HLS Manifest"] },
  items: [
    {
      id: "https://example.com/choice/canvas/1",
      type: "Canvas",
      duration: 120,
      width: 1280,
      height: 720,
      items: [
        {
          id: "https://example.com/choice/canvas/1/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.com/choice/canvas/1/page/1/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                type: "Choice",
                choiceHint: "user",
                items: [
                  {
                    id: "https://example.com/choice/high.m3u8",
                    type: "Video",
                    format: "application/x-mpegURL",
                    label: { none: ["high"] },
                  },
                  {
                    id: "https://example.com/choice/medium.m3u8",
                    type: "Video",
                    format: "application/x-mpegURL",
                    label: { none: ["medium"] },
                  },
                ],
              },
              target: "https://example.com/choice/canvas/1",
            },
          ],
        },
      ],
    },
  ],
};

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
                id: "https://example.com/captions-en.vtt",
                type: "Text",
                format: "text/vtt",
                language: "en",
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

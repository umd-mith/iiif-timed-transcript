// src/lib/player/test-fixtures.ts
// Shared mock manifests for player component tests

import { vi } from 'vitest';

/**
 * Minimal manifest with audio and chapter structures.
 * Two chapters: "Introduction" (0-30s) and "Main Discussion" (30-90s).
 */
export const MANIFEST_WITH_CHAPTERS = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://example.com/manifest',
  type: 'Manifest',
  label: { en: ['Test Manifest'] },
  items: [
    {
      id: 'https://example.com/canvas/1',
      type: 'Canvas',
      duration: 90,
      items: [
        {
          id: 'https://example.com/canvas/1/page/1',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.com/canvas/1/page/1/annotation/1',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://example.com/audio.mp3',
                type: 'Sound',
                format: 'audio/mp3'
              },
              target: 'https://example.com/canvas/1'
            }
          ]
        }
      ]
    }
  ],
  structures: [
    {
      id: 'https://example.com/range/1',
      type: 'Range',
      label: { en: ['Introduction'] },
      items: [
        { id: 'https://example.com/canvas/1#t=0,30', type: 'Canvas' }
      ]
    },
    {
      id: 'https://example.com/range/2',
      type: 'Range',
      label: { en: ['Main Discussion'] },
      items: [
        { id: 'https://example.com/canvas/1#t=30,90', type: 'Canvas' }
      ]
    }
  ]
};

/**
 * Minimal manifest WITHOUT structures (no chapters).
 */
export const MANIFEST_WITHOUT_CHAPTERS = {
  '@context': 'http://iiif.io/api/presentation/3/context.json',
  id: 'https://example.com/manifest-no-chapters',
  type: 'Manifest',
  label: { en: ['Test Manifest No Chapters'] },
  items: [
    {
      id: 'https://example.com/canvas/1',
      type: 'Canvas',
      items: [
        {
          id: 'https://example.com/canvas/1/page/1',
          type: 'AnnotationPage',
          items: [
            {
              id: 'https://example.com/canvas/1/page/1/annotation/1',
              type: 'Annotation',
              motivation: 'painting',
              body: {
                id: 'https://example.com/audio.mp3',
                type: 'Sound',
                format: 'audio/mp3'
              },
              target: 'https://example.com/canvas/1'
            }
          ]
        }
      ]
    }
  ]
};

/**
 * Helper: mock fetch to return a manifest.
 */
export function mockFetchManifest(manifest: Record<string, unknown>) {
  (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: async () => manifest
  });
}

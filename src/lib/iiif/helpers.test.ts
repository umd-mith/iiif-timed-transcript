import { describe, it, expect } from "vitest";
import {
  getTextualBodies,
  getPrimaryResource,
  getLabel,
  isValidIIIFResource,
  getCanvasDimensions,
  getThumbnail,
  extractIdentifierFromUrl,
  hasMotivation,
  getSupplementaryAnnotations,
  getSupplementaryTextualBodies,
  buildTranscriptAnnotations,
} from "./helpers";
import type { CanvasData } from "./validators";

/**
 * Tests for getTextualBodies() helper function
 * Extracts TextualBody items from canvas painting annotations
 */
describe("getTextualBodies", () => {
  // Helper to create a valid canvas structure
  function createCanvas(bodies: unknown[]): CanvasData {
    return {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
      items: [
        {
          id: "https://example.org/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: bodies.length === 1 ? bodies[0] : bodies,
              target: "https://example.org/canvas/1",
            },
          ],
        },
      ],
    } as CanvasData;
  }

  it("should return empty array for canvas with no textual bodies", () => {
    const canvas = createCanvas([
      {
        id: "https://example.org/image.jpg",
        type: "Image",
        format: "image/jpeg",
      },
    ]);

    const result = getTextualBodies(canvas);

    expect(result).toEqual([]);
  });

  it("should return single TextualBody from canvas", () => {
    const canvas = createCanvas([
      {
        type: "TextualBody",
        value: "This is a transcription",
        format: "text/plain",
        language: "en",
      },
    ]);

    const result = getTextualBodies(canvas);

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe("This is a transcription");
    expect(result[0]!.language).toBe("en");
  });

  it("should extract TextualBody from Choice body", () => {
    const canvas = createCanvas([
      {
        type: "Choice",
        items: [
          {
            type: "TextualBody",
            value: "English transcription",
            language: "en",
          },
          {
            type: "TextualBody",
            value: "Transcription française",
            language: "fr",
          },
        ],
      },
    ]);

    const result = getTextualBodies(canvas);

    expect(result).toHaveLength(2);
    expect(result[0]!.value).toBe("English transcription");
    expect(result[1]!.value).toBe("Transcription française");
  });

  it("should filter out non-TextualBody items from mixed body array", () => {
    const canvas = createCanvas([
      {
        id: "https://example.org/image.jpg",
        type: "Image",
        format: "image/jpeg",
      },
      {
        type: "TextualBody",
        value: "Caption text",
        purpose: "describing",
      },
      {
        id: "https://example.org/audio.mp3",
        type: "Sound",
        format: "audio/mpeg",
      },
    ]);

    const result = getTextualBodies(canvas);

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe("Caption text");
  });

  it("should return empty array for canvas with no annotations", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
      items: [],
    };

    const result = getTextualBodies(canvas);

    expect(result).toEqual([]);
  });

  it("should handle canvas with undefined items", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
    } as CanvasData;

    const result = getTextualBodies(canvas);

    expect(result).toEqual([]);
  });

  it("should extract TextualBodies from multiple annotations", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
      items: [
        {
          id: "https://example.org/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                type: "TextualBody",
                value: "First transcription",
              },
              target: "https://example.org/canvas/1",
            },
            {
              id: "https://example.org/annotation/2",
              type: "Annotation",
              motivation: "painting",
              body: {
                type: "TextualBody",
                value: "Second transcription",
              },
              target: "https://example.org/canvas/1",
            },
          ],
        },
      ],
    } as CanvasData;

    const result = getTextualBodies(canvas);

    expect(result).toHaveLength(2);
    expect(result[0]!.value).toBe("First transcription");
    expect(result[1]!.value).toBe("Second transcription");
  });

  it("should extract from annotations where motivation is an array containing painting", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
      items: [
        {
          id: "https://example.org/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/annotation/1",
              type: "Annotation",
              motivation: ["painting", "supplementing"],
              body: {
                type: "TextualBody",
                value: "Painted with array motivation",
              },
              target: "https://example.org/canvas/1",
            },
          ],
        },
      ],
    } as CanvasData;

    const result = getTextualBodies(canvas);

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe("Painted with array motivation");
  });

  it("should skip annotations where motivation array does not include painting", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
      items: [
        {
          id: "https://example.org/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/annotation/1",
              type: "Annotation",
              motivation: ["commenting", "tagging"],
              body: {
                type: "TextualBody",
                value: "Not painted",
              },
              target: "https://example.org/canvas/1",
            },
          ],
        },
      ],
    } as CanvasData;

    const result = getTextualBodies(canvas);

    expect(result).toHaveLength(0);
  });

  it("should only extract from painting annotations, not other motivations", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
      items: [
        {
          id: "https://example.org/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/annotation/1",
              type: "Annotation",
              motivation: "commenting",
              body: {
                type: "TextualBody",
                value: "This is a comment",
              },
              target: "https://example.org/canvas/1",
            },
            {
              id: "https://example.org/annotation/2",
              type: "Annotation",
              motivation: "painting",
              body: {
                type: "TextualBody",
                value: "This is painted content",
              },
              target: "https://example.org/canvas/1",
            },
          ],
        },
      ],
    } as CanvasData;

    const result = getTextualBodies(canvas);

    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe("This is painted content");
  });
});

/**
 * Edge case tests for existing helper functions
 */
describe("getPrimaryResource edge cases", () => {
  it("should return first external resource from array body", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
      items: [
        {
          id: "https://example.org/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: [
                {
                  id: "https://example.org/image1.jpg",
                  type: "Image",
                  format: "image/jpeg",
                },
                {
                  id: "https://example.org/image2.jpg",
                  type: "Image",
                  format: "image/png",
                },
              ],
              target: "https://example.org/canvas/1",
            },
          ],
        },
      ],
    } as CanvasData;

    const result = getPrimaryResource(canvas);

    expect(result).toBeDefined();
    expect(result?.id).toBe("https://example.org/image1.jpg");
  });

  it("should return undefined for canvas with only TextualBody", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
      items: [
        {
          id: "https://example.org/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/annotation/1",
              type: "Annotation",
              motivation: "painting",
              body: {
                type: "TextualBody",
                value: "Only text, no media",
              },
              target: "https://example.org/canvas/1",
            },
          ],
        },
      ],
    } as CanvasData;

    const result = getPrimaryResource(canvas);

    expect(result).toBeUndefined();
  });

  it("should return undefined for canvas with no body", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      width: 800,
      height: 600,
      items: [
        {
          id: "https://example.org/page/1",
          type: "AnnotationPage",
          items: [
            {
              id: "https://example.org/annotation/1",
              type: "Annotation",
              motivation: "painting",
              target: "https://example.org/canvas/1",
            },
          ],
        },
      ],
    } as CanvasData;

    const result = getPrimaryResource(canvas);

    expect(result).toBeUndefined();
  });
});

describe("getLabel edge cases", () => {
  it("should return empty string for empty language map", () => {
    const resource = { label: {} };

    const result = getLabel(resource);

    expect(result).toBe("");
  });

  it("should return empty string when all arrays are empty", () => {
    const resource = { label: { en: [], fr: [] } };

    const result = getLabel(resource);

    expect(result).toBe("");
  });

  it("should fall back to first available language when preferred not found", () => {
    const resource = { label: { fr: ["Titre français"] } };

    const result = getLabel(resource, "en");

    expect(result).toBe("Titre français");
  });

  it("should return first label when multiple exist in array", () => {
    const resource = { label: { en: ["First", "Second", "Third"] } };

    const result = getLabel(resource);

    expect(result).toBe("First");
  });
});

describe("isValidIIIFResource edge cases", () => {
  it("should return false for null", () => {
    expect(isValidIIIFResource(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isValidIIIFResource(undefined)).toBe(false);
  });

  it("should return false for primitive types", () => {
    expect(isValidIIIFResource("string")).toBe(false);
    expect(isValidIIIFResource(123)).toBe(false);
    expect(isValidIIIFResource(true)).toBe(false);
  });

  it("should return false for object missing id", () => {
    expect(
      isValidIIIFResource({ type: "Manifest", label: { en: ["Test"] } }),
    ).toBe(false);
  });

  it("should return false for object missing type", () => {
    expect(isValidIIIFResource({ id: "test", label: { en: ["Test"] } })).toBe(
      false,
    );
  });

  it("should return false for object missing label", () => {
    expect(isValidIIIFResource({ id: "test", type: "Manifest" })).toBe(false);
  });

  it("should return true for valid IIIF resource structure", () => {
    expect(
      isValidIIIFResource({
        id: "test",
        type: "Manifest",
        label: { en: ["Test"] },
      }),
    ).toBe(true);
  });
});

describe("getCanvasDimensions edge cases", () => {
  it("should return undefined when only width is set", () => {
    const canvas = { id: "test", type: "Canvas", width: 800 } as CanvasData;

    expect(getCanvasDimensions(canvas)).toBeUndefined();
  });

  it("should return undefined when only height is set", () => {
    const canvas = { id: "test", type: "Canvas", height: 600 } as CanvasData;

    expect(getCanvasDimensions(canvas)).toBeUndefined();
  });

  it("should return dimensions when both are set", () => {
    const canvas = {
      id: "test",
      type: "Canvas",
      width: 800,
      height: 600,
    } as CanvasData;

    const result = getCanvasDimensions(canvas);

    expect(result).toEqual({ width: 800, height: 600 });
  });
});

describe("getThumbnail edge cases", () => {
  it("should return undefined for empty thumbnail array", () => {
    const resource = { thumbnail: [] };

    expect(getThumbnail(resource)).toBeUndefined();
  });

  it("should return undefined when thumbnail is undefined", () => {
    const resource = {};

    expect(getThumbnail(resource)).toBeUndefined();
  });

  it("should return first thumbnail id when multiple exist", () => {
    const resource = {
      thumbnail: [
        { id: "https://example.org/thumb1.jpg", type: "Image" as const },
        { id: "https://example.org/thumb2.jpg", type: "Image" as const },
      ],
    };

    expect(getThumbnail(resource)).toBe("https://example.org/thumb1.jpg");
  });
});
describe("extractIdentifierFromUrl", () => {
  describe("default pattern (Lakeland format)", () => {
    it("should extract identifier from relative URL", () => {
      const url = "/api/v1/iiif/abc123";

      const result = extractIdentifierFromUrl(url);

      expect(result).toBe("abc123");
    });

    it("should extract identifier from absolute URL", () => {
      const url = "https://example.com/api/v1/iiif/xyz789";

      const result = extractIdentifierFromUrl(url);

      expect(result).toBe("xyz789");
    });

    it("should extract GUID with hyphens", () => {
      const url = "/api/v1/iiif/550e8400-e29b-41d4-a716-446655440000";

      const result = extractIdentifierFromUrl(url);

      expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
    });

    it("should return undefined for non-matching URL", () => {
      const url = "/other/path/12345";

      const result = extractIdentifierFromUrl(url);

      expect(result).toBeUndefined();
    });

    it("should return undefined for URL with trailing segments", () => {
      const url = "/api/v1/iiif/abc123/extra";

      const result = extractIdentifierFromUrl(url);

      expect(result).toBeUndefined();
    });
  });

  describe("custom pattern", () => {
    it("should extract identifier using custom pattern", () => {
      const url = "https://myserver.org/iiif/image/abc123/info.json";
      const customPattern = /\/iiif\/image\/([^/]+)\//;

      const result = extractIdentifierFromUrl(url, customPattern);

      expect(result).toBe("abc123");
    });

    it("should extract identifier from node-iiif style URL", () => {
      const url = "/prefix/iiif/2/some-id:resource/full/max/0/default.jpg";
      // Match node-iiif pattern: identifier is between /2/ and /region
      const nodeIiifPattern = /\/2\/([^/]+)\//;

      const result = extractIdentifierFromUrl(url, nodeIiifPattern);

      expect(result).toBe("some-id:resource");
    });

    it("should return undefined when custom pattern does not match", () => {
      const url = "https://example.com/wrong/path/123";
      const customPattern = /\/custom\/([^/]+)$/;

      const result = extractIdentifierFromUrl(url, customPattern);

      expect(result).toBeUndefined();
    });

    it("should extract using pattern with multiple capture groups (uses first)", () => {
      const url = "/collection/abc/item/xyz";
      const pattern = /\/collection\/([^/]+)\/item\/([^/]+)/;

      const result = extractIdentifierFromUrl(url, pattern);

      // Should return first capture group
      expect(result).toBe("abc");
    });
  });
});

// ============================================================================
// Supplementary Annotation Tests
// ============================================================================

/**
 * Helper to create a canvas with supplementary annotations (canvas.annotations).
 * Mirrors the existing createCanvas() pattern for painting annotations.
 */
function createSupplementaryCanvas(
  annotationPages: unknown[],
  paintingPages?: unknown[],
): CanvasData {
  return {
    id: "https://example.org/canvas/1",
    type: "Canvas",
    duration: 300,
    items: paintingPages ?? [
      {
        id: "https://example.org/page/painting",
        type: "AnnotationPage",
        items: [
          {
            id: "https://example.org/annotation/media",
            type: "Annotation",
            motivation: "painting",
            body: {
              id: "https://example.org/audio.mp3",
              type: "Sound",
              format: "audio/mpeg",
            },
            target: "https://example.org/canvas/1",
          },
        ],
      },
    ],
    annotations: annotationPages,
  } as CanvasData;
}

/** AVAnnotate-style annotation: multi-body with text + tag, array motivation */
const avAnnotateAnnotation = {
  id: "https://example.org/annotation/av-1",
  type: "Annotation" as const,
  motivation: ["commenting", "tagging"],
  body: [
    {
      type: "TextualBody" as const,
      value: "Hello, welcome to the interview.",
      format: "text/plain",
      purpose: "commenting",
    },
    {
      type: "TextualBody" as const,
      value: "Interviewer",
      purpose: "tagging",
    },
  ],
  target: "https://example.org/canvas/1#t=0,5.2",
};

/** Second AVAnnotate annotation for multi-annotation tests */
const avAnnotateAnnotation2 = {
  id: "https://example.org/annotation/av-2",
  type: "Annotation" as const,
  motivation: ["commenting", "tagging"],
  body: [
    {
      type: "TextualBody" as const,
      value: "Can you tell us about growing up?",
      format: "text/plain",
      purpose: "commenting",
    },
    {
      type: "TextualBody" as const,
      value: "A second thought on this.",
      format: "text/plain",
      purpose: "commenting",
    },
    {
      type: "TextualBody" as const,
      value: "Narrator",
      purpose: "tagging",
    },
  ],
  target: "https://example.org/canvas/1#t=5.2,12",
};

/** Lakeland-style annotation: supplementing motivation with external VTT resource */
const lakelandVttAnnotation = {
  id: "https://example.org/annotation/lda-1",
  type: "Annotation" as const,
  motivation: "supplementing",
  body: {
    id: "https://example.org/transcript.vtt",
    type: "Text" as const,
    format: "text/vtt",
  },
  target: "https://example.org/canvas/1",
};

/** Point-in-time annotation (#t=3 — start only, no end) */
const pointInTimeAnnotation = {
  id: "https://example.org/annotation/point",
  type: "Annotation" as const,
  motivation: "supplementing",
  body: {
    type: "TextualBody" as const,
    value: "A brief moment",
  },
  target: "https://example.org/canvas/1#t=3",
};

describe("hasMotivation", () => {
  it("should match a single string motivation", () => {
    expect(hasMotivation("painting", "painting")).toBe(true);
  });

  it("should not match a different string motivation", () => {
    expect(hasMotivation("painting", "commenting")).toBe(false);
  });

  it("should match when array contains the target", () => {
    expect(hasMotivation(["commenting", "tagging"], "commenting")).toBe(true);
  });

  it("should not match when array does not contain the target", () => {
    expect(hasMotivation(["commenting", "tagging"], "painting")).toBe(false);
  });
});

describe("getSupplementaryAnnotations", () => {
  it("should return empty array when canvas has no annotations property", () => {
    const canvas: CanvasData = {
      id: "https://example.org/canvas/1",
      type: "Canvas",
      duration: 300,
      items: [],
    } as CanvasData;

    expect(getSupplementaryAnnotations(canvas)).toEqual([]);
  });

  it("should return all annotations from pages when no filter", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation, lakelandVttAnnotation],
      },
    ]);

    const result = getSupplementaryAnnotations(canvas);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe(avAnnotateAnnotation.id);
    expect(result[1]!.id).toBe(lakelandVttAnnotation.id);
  });

  it("should filter by single motivation string", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation, lakelandVttAnnotation],
      },
    ]);

    const result = getSupplementaryAnnotations(canvas, "supplementing");

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(lakelandVttAnnotation.id);
  });

  it("should filter by motivation array", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation, lakelandVttAnnotation],
      },
    ]);

    const result = getSupplementaryAnnotations(canvas, ["commenting", "tagging"]);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(avAnnotateAnnotation.id);
  });

  it("should handle array motivation on annotation matching a single filter", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation],
      },
    ]);

    // avAnnotateAnnotation has motivation: ["commenting", "tagging"]
    // Filter for just "commenting" should match
    const result = getSupplementaryAnnotations(canvas, "commenting");

    expect(result).toHaveLength(1);
  });

  it("should collect annotations across multiple pages", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/1",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation],
      },
      {
        id: "https://example.org/page/2",
        type: "AnnotationPage",
        items: [lakelandVttAnnotation],
      },
    ]);

    const result = getSupplementaryAnnotations(canvas);

    expect(result).toHaveLength(2);
  });

  it("should handle pages with no items", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/empty",
        type: "AnnotationPage",
      },
    ]);

    expect(getSupplementaryAnnotations(canvas)).toEqual([]);
  });
});

describe("getSupplementaryTextualBodies", () => {
  it("should separate text and tag bodies by purpose", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation],
      },
    ]);

    const result = getSupplementaryTextualBodies(canvas);

    expect(result).toHaveLength(1);
    expect(result[0]!.textBodies).toHaveLength(1);
    expect(result[0]!.textBodies[0]!.value).toBe("Hello, welcome to the interview.");
    expect(result[0]!.tagBodies).toHaveLength(1);
    expect(result[0]!.tagBodies[0]!.value).toBe("Interviewer");
  });

  it("should treat bodies without purpose as text", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [
          {
            id: "https://example.org/annotation/no-purpose",
            type: "Annotation",
            motivation: "supplementing",
            body: {
              type: "TextualBody",
              value: "No purpose field",
            },
            target: "https://example.org/canvas/1#t=0,5",
          },
        ],
      },
    ]);

    const result = getSupplementaryTextualBodies(canvas);

    expect(result).toHaveLength(1);
    expect(result[0]!.textBodies).toHaveLength(1);
    expect(result[0]!.tagBodies).toHaveLength(0);
  });

  it("should skip annotations with only external resource bodies", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [lakelandVttAnnotation],
      },
    ]);

    const result = getSupplementaryTextualBodies(canvas);

    expect(result).toHaveLength(0);
  });

  it("should handle Choice bodies", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [
          {
            id: "https://example.org/annotation/choice",
            type: "Annotation",
            motivation: "supplementing",
            body: {
              type: "Choice",
              items: [
                {
                  type: "TextualBody",
                  value: "English text",
                  language: "en",
                  purpose: "describing",
                },
                {
                  type: "TextualBody",
                  value: "French text",
                  language: "fr",
                },
              ],
            },
            target: "https://example.org/canvas/1#t=0,10",
          },
        ],
      },
    ]);

    const result = getSupplementaryTextualBodies(canvas);

    expect(result).toHaveLength(1);
    expect(result[0]!.textBodies).toHaveLength(2);
  });

  it("should preserve target string", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation],
      },
    ]);

    const result = getSupplementaryTextualBodies(canvas);

    expect(result[0]!.target).toBe("https://example.org/canvas/1#t=0,5.2");
  });

  it("should pass through motivation filter", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation, lakelandVttAnnotation],
      },
    ]);

    const result = getSupplementaryTextualBodies(canvas, "supplementing");

    // lakelandVttAnnotation matches but has no TextualBody → skipped
    expect(result).toHaveLength(0);
  });
});

describe("buildTranscriptAnnotations", () => {
  it("should build Annotation[] from AVAnnotate multi-body pattern", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation],
      },
    ]);

    const result = buildTranscriptAnnotations(canvas);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "https://example.org/annotation/av-1",
      startTime: 0,
      endTime: 5.2,
      text: "Hello, welcome to the interview.",
      metadata: { tags: ["Interviewer"] },
    });
  });

  it("should parse correct startTime/endTime from #t= fragments", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation, avAnnotateAnnotation2],
      },
    ]);

    const result = buildTranscriptAnnotations(canvas);

    expect(result).toHaveLength(2);
    expect(result[0]!.startTime).toBe(0);
    expect(result[0]!.endTime).toBe(5.2);
    expect(result[1]!.startTime).toBe(5.2);
    expect(result[1]!.endTime).toBe(12);
  });

  it("should join multiple text bodies with space", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation2],
      },
    ]);

    const result = buildTranscriptAnnotations(canvas);

    expect(result[0]!.text).toBe(
      "Can you tell us about growing up? A second thought on this.",
    );
  });

  it("should place tags in metadata.tags", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation2],
      },
    ]);

    const result = buildTranscriptAnnotations(canvas);

    expect(result[0]!.metadata).toEqual({ tags: ["Narrator"] });
  });

  it("should omit metadata when no tags", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [
          {
            id: "https://example.org/annotation/no-tags",
            type: "Annotation",
            motivation: "supplementing",
            body: {
              type: "TextualBody",
              value: "Just text, no tags",
            },
            target: "https://example.org/canvas/1#t=10,20",
          },
        ],
      },
    ]);

    const result = buildTranscriptAnnotations(canvas);

    expect(result).toHaveLength(1);
    expect(result[0]!.metadata).toBeUndefined();
  });

  it("should return empty array for canvas with no supplementary text content", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [lakelandVttAnnotation],
      },
    ]);

    const result = buildTranscriptAnnotations(canvas);

    expect(result).toEqual([]);
  });

  it("should handle point-in-time annotations (start only, no end)", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [pointInTimeAnnotation],
      },
    ]);

    const result = buildTranscriptAnnotations(canvas);

    // #t=3 → temporal: { start: 3 } (no end), builder defaults end to start
    expect(result).toHaveLength(1);
    expect(result[0]!.startTime).toBe(3);
    expect(result[0]!.endTime).toBe(3);
  });

  it("should default start/end to 0 when target has no temporal fragment", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [
          {
            id: "https://example.org/annotation/no-time",
            type: "Annotation",
            motivation: "supplementing",
            body: {
              type: "TextualBody",
              value: "No time fragment",
            },
            target: "https://example.org/canvas/1",
          },
        ],
      },
    ]);

    const result = buildTranscriptAnnotations(canvas);

    expect(result[0]!.startTime).toBe(0);
    expect(result[0]!.endTime).toBe(0);
  });

  it("should respect motivation filter", () => {
    const canvas = createSupplementaryCanvas([
      {
        id: "https://example.org/page/supp",
        type: "AnnotationPage",
        items: [avAnnotateAnnotation, pointInTimeAnnotation],
      },
    ]);

    const result = buildTranscriptAnnotations(canvas, "supplementing");

    // Only pointInTimeAnnotation has motivation "supplementing"
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(pointInTimeAnnotation.id);
  });
});

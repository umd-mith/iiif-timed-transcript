import { describe, it, expect } from "vitest";
import {
  getTextualBodies,
  getPrimaryResource,
  getLabel,
  isValidIIIFResource,
  getCanvasDimensions,
  getThumbnail,
  extractIdentifierFromUrl,
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

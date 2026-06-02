import { describe, it, expect } from "vitest";

/**
 * Tests for IIIF Presentation 3.0 spec-compliant annotation body types.
 * Based on @iiif/presentation-3 official types and W3C Web Annotation Data Model.
 *
 * AnnotationBody = ChoiceBody | ContentResource | ContentResourceString
 * ContentResource = EmbeddedResource | ExternalWebResource | SpecificResource | IIIFExternalWebResource
 */

// Import the schemas we're testing (will be created via TDD)
import {
  TextualBodySchema,
  SpecificResourceSchema,
  ChoiceBodySchema,
  AnnotationBodySchema,
  ExternalResourceSchema,
  ManifestSchema,
} from "../../lib/iiif/validators";

describe("IIIF Annotation Body Schemas", () => {
  describe("ExternalResourceSchema (existing ContentResource)", () => {
    it("should validate Image resource", () => {
      const imageResource = {
        id: "https://example.org/image.jpg",
        type: "Image",
        format: "image/jpeg",
        width: 1000,
        height: 800,
      };

      const result = ExternalResourceSchema.safeParse(imageResource);
      expect(result.success).toBe(true);
    });

    it("should validate Sound resource", () => {
      const soundResource = {
        id: "https://example.org/audio.mp3",
        type: "Sound",
        format: "audio/mpeg",
        duration: 180.5,
      };

      const result = ExternalResourceSchema.safeParse(soundResource);
      expect(result.success).toBe(true);
    });

    it("should validate Video resource", () => {
      const videoResource = {
        id: "https://example.org/video.mp4",
        type: "Video",
        format: "video/mp4",
        width: 1920,
        height: 1080,
        duration: 3600,
      };

      const result = ExternalResourceSchema.safeParse(videoResource);
      expect(result.success).toBe(true);
    });

    it("should validate Text resource", () => {
      const textResource = {
        id: "https://example.org/transcript.txt",
        type: "Text",
        format: "text/plain",
      };

      const result = ExternalResourceSchema.safeParse(textResource);
      expect(result.success).toBe(true);
    });

    it("should validate Dataset resource", () => {
      const datasetResource = {
        id: "https://example.org/data.json",
        type: "Dataset",
        format: "application/json",
      };

      const result = ExternalResourceSchema.safeParse(datasetResource);
      expect(result.success).toBe(true);
    });

    it("should validate Image resource with IIIF Image API service", () => {
      const imageWithService = {
        id: "https://example.org/image/full/max/0/default.jpg",
        type: "Image",
        format: "image/jpeg",
        width: 4000,
        height: 3000,
        service: [
          {
            id: "https://example.org/image",
            type: "ImageService3",
            profile: "level2",
          },
        ],
      };

      const result = ExternalResourceSchema.safeParse(imageWithService);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.service).toHaveLength(1);
        expect(result.data.service?.[0]!.type).toBe("ImageService3");
      }
    });

    it("should validate resource with multiple services", () => {
      const imageWithMultipleServices = {
        id: "https://example.org/image.jpg",
        type: "Image",
        service: [
          {
            id: "https://example.org/image-api",
            type: "ImageService3",
            profile: "level1",
          },
          {
            id: "https://example.org/auth",
            type: "AuthCookieService1",
          },
        ],
      };

      const result = ExternalResourceSchema.safeParse(
        imageWithMultipleServices,
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.service).toHaveLength(2);
      }
    });
  });

  describe("TextualBodySchema (EmbeddedResource)", () => {
    it("should validate basic TextualBody with value", () => {
      const textualBody = {
        type: "TextualBody",
        value: "This is the transcription text.",
        format: "text/plain",
      };

      const result = TextualBodySchema.safeParse(textualBody);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.value).toBe("This is the transcription text.");
      }
    });

    it("should validate TextualBody with language", () => {
      const textualBody = {
        type: "TextualBody",
        value: "Bonjour le monde",
        format: "text/plain",
        language: "fr",
      };

      const result = TextualBodySchema.safeParse(textualBody);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.language).toBe("fr");
      }
    });

    it("should validate TextualBody with HTML content", () => {
      const textualBody = {
        type: "TextualBody",
        value: "<p>Formatted <strong>text</strong></p>",
        format: "text/html",
      };

      const result = TextualBodySchema.safeParse(textualBody);
      expect(result.success).toBe(true);
    });

    it("should validate TextualBody with purpose", () => {
      const textualBody = {
        type: "TextualBody",
        value: "Speaker: John Smith",
        purpose: "transcribing",
      };

      const result = TextualBodySchema.safeParse(textualBody);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purpose).toBe("transcribing");
      }
    });

    it("should validate TextualBody with optional id", () => {
      const textualBody = {
        id: "https://example.org/text/1",
        type: "TextualBody",
        value: "Text with ID",
      };

      const result = TextualBodySchema.safeParse(textualBody);
      expect(result.success).toBe(true);
    });

    it("should reject TextualBody without value", () => {
      const textualBody = {
        type: "TextualBody",
        format: "text/plain",
      };

      const result = TextualBodySchema.safeParse(textualBody);
      expect(result.success).toBe(false);
    });
  });

  describe("SpecificResourceSchema", () => {
    it("should validate SpecificResource with source", () => {
      const specificResource = {
        type: "SpecificResource",
        source: "https://example.org/image.jpg",
      };

      const result = SpecificResourceSchema.safeParse(specificResource);
      expect(result.success).toBe(true);
    });

    it("should validate SpecificResource with FragmentSelector", () => {
      const specificResource = {
        type: "SpecificResource",
        source: "https://example.org/image.jpg",
        selector: {
          type: "FragmentSelector",
          value: "xywh=100,100,200,200",
        },
      };

      const result = SpecificResourceSchema.safeParse(specificResource);
      expect(result.success).toBe(true);
    });

    it("should validate SpecificResource with purpose", () => {
      const specificResource = {
        type: "SpecificResource",
        source: "https://example.org/image.jpg",
        purpose: "painting",
      };

      const result = SpecificResourceSchema.safeParse(specificResource);
      expect(result.success).toBe(true);
    });

    it("should validate SpecificResource with object source", () => {
      const specificResource = {
        type: "SpecificResource",
        source: {
          id: "https://example.org/image.jpg",
          type: "Image",
          format: "image/jpeg",
        },
      };

      const result = SpecificResourceSchema.safeParse(specificResource);
      expect(result.success).toBe(true);
    });
  });

  describe("ChoiceBodySchema", () => {
    it("should validate Choice with multiple items", () => {
      const choice = {
        type: "Choice",
        items: [
          {
            id: "https://example.org/en.txt",
            type: "Text",
            format: "text/plain",
          },
          {
            id: "https://example.org/fr.txt",
            type: "Text",
            format: "text/plain",
          },
        ],
      };

      const result = ChoiceBodySchema.safeParse(choice);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
      }
    });

    it("should validate Choice with TextualBody items", () => {
      const choice = {
        type: "Choice",
        items: [
          {
            type: "TextualBody",
            value: "English text",
            language: "en",
          },
          {
            type: "TextualBody",
            value: "Texte français",
            language: "fr",
          },
        ],
      };

      const result = ChoiceBodySchema.safeParse(choice);
      expect(result.success).toBe(true);
    });

    it("should validate Choice with optional id", () => {
      const choice = {
        id: "https://example.org/choice/1",
        type: "Choice",
        items: [
          {
            type: "TextualBody",
            value: "Option 1",
          },
        ],
      };

      const result = ChoiceBodySchema.safeParse(choice);
      expect(result.success).toBe(true);
    });

    it("should reject Choice without items", () => {
      const choice = {
        type: "Choice",
      };

      const result = ChoiceBodySchema.safeParse(choice);
      expect(result.success).toBe(false);
    });
  });

  describe("AnnotationBodySchema (union of all body types)", () => {
    it("should accept ExternalResource (Image)", () => {
      const body = {
        id: "https://example.org/image.jpg",
        type: "Image",
      };

      const result = AnnotationBodySchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it("should accept TextualBody", () => {
      const body = {
        type: "TextualBody",
        value: "Transcription text",
      };

      const result = AnnotationBodySchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it("should accept SpecificResource", () => {
      const body = {
        type: "SpecificResource",
        source: "https://example.org/image.jpg",
      };

      const result = AnnotationBodySchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it("should accept Choice", () => {
      const body = {
        type: "Choice",
        items: [{ type: "TextualBody", value: "Text" }],
      };

      const result = AnnotationBodySchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it("should accept string body (ContentResourceString)", () => {
      const body = "https://example.org/simple-body";

      const result = AnnotationBodySchema.safeParse(body);
      expect(result.success).toBe(true);
    });
  });
});

describe("CanvasSchema poster canvases", () => {
  function manifestWithCanvasExtras(extras: Record<string, unknown>) {
    return {
      "@context": "http://iiif.io/api/presentation/3/context.json",
      id: "https://example.org/manifest",
      type: "Manifest",
      label: { en: ["Test"] },
      items: [
        {
          id: "https://example.org/canvas/1",
          type: "Canvas",
          width: 640,
          height: 360,
          duration: 100,
          items: [
            {
              id: "https://example.org/canvas/1/page",
              type: "AnnotationPage",
              items: [
                {
                  id: "https://example.org/canvas/1/anno",
                  type: "Annotation",
                  motivation: "painting",
                  body: {
                    id: "https://example.org/video.mp4",
                    type: "Video",
                    format: "video/mp4",
                    duration: 100,
                  },
                  target: "https://example.org/canvas/1",
                },
              ],
            },
          ],
          ...extras,
        },
      ],
    };
  }

  function imageAuxCanvas(suffix: string, imageId: string) {
    return {
      id: `https://example.org/canvas/1/${suffix}`,
      type: "Canvas",
      width: 640,
      height: 360,
      items: [
        {
          id: `https://example.org/canvas/1/${suffix}/page`,
          type: "AnnotationPage",
          items: [
            {
              id: `https://example.org/canvas/1/${suffix}/anno`,
              type: "Annotation",
              motivation: "painting",
              body: {
                id: imageId,
                type: "Image",
                format: "image/png",
                width: 640,
                height: 360,
              },
              target: `https://example.org/canvas/1/${suffix}`,
            },
          ],
        },
      ],
    };
  }

  it("should preserve placeholderCanvas with its image body after parsing", () => {
    const manifest = manifestWithCanvasExtras({
      placeholderCanvas: imageAuxCanvas(
        "placeholder",
        "https://example.org/poster.png",
      ),
    });

    const result = ManifestSchema.parse(manifest);
    const canvas = result.items[0]!;

    expect(canvas.placeholderCanvas).toBeDefined();
    expect(
      canvas.placeholderCanvas?.items?.[0]?.items?.[0]?.body,
    ).toMatchObject({ id: "https://example.org/poster.png", type: "Image" });
  });

  it("should preserve accompanyingCanvas with its image body after parsing", () => {
    const manifest = manifestWithCanvasExtras({
      accompanyingCanvas: imageAuxCanvas(
        "accompanying",
        "https://example.org/cover.png",
      ),
    });

    const result = ManifestSchema.parse(manifest);
    const canvas = result.items[0]!;

    expect(canvas.accompanyingCanvas).toBeDefined();
    expect(
      canvas.accompanyingCanvas?.items?.[0]?.items?.[0]?.body,
    ).toMatchObject({ id: "https://example.org/cover.png", type: "Image" });
  });
});

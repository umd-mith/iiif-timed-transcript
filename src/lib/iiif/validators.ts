import { z } from "zod";

// Common schemas for reuse
const IIIFLanguageMap = z
  .record(z.string(), z.array(z.string()))
  .describe(
    "IIIF language map with language codes as keys and string arrays as values",
  );

const IIIFIdentifier = z
  .string()
  .min(1)
  .describe("IIIF resource identifier (URI)");

const IIIFContext = z
  .union([
    z.literal("http://iiif.io/api/presentation/3/context.json"),
    z.literal("http://iiif.io/api/image/3/context.json"),
    z.array(z.string()),
  ])
  .describe("IIIF context URI or array");

// ============================================================================
// IIIF Annotation Body Types (per @iiif/presentation-3 and W3C Web Annotation)
// AnnotationBody = ChoiceBody | ContentResource | ContentResourceString
// ContentResource = EmbeddedResource | ExternalWebResource | SpecificResource
// ============================================================================

/**
 * Service reference - links to IIIF Image API, Auth, or other services
 * Flexible schema to support various service types (ImageService3, AuthCookieService1, etc.)
 */
const ServiceReferenceSchema = z
  .object({
    id: IIIFIdentifier.optional(),
    type: z
      .string()
      .describe("Service type (ImageService3, AuthCookieService1, etc.)"),
    profile: z.string().optional().describe("Service profile level"),
  })
  .passthrough() // Allow additional service-specific properties
  .describe("IIIF service reference");

/**
 * ExternalWebResource - External content (Image, Sound, Video, Text, Dataset)
 * Maps to IIIFExternalWebResource in @iiif/presentation-3
 */
export const ExternalResourceSchema = z
  .object({
    id: IIIFIdentifier,
    type: z
      .enum(["Image", "Sound", "Video", "Text", "Dataset"])
      .describe("Content resource type"),
    format: z.string().optional().describe("MIME type of the resource"),
    width: z.number().positive().optional().describe("Width in pixels"),
    height: z.number().positive().optional().describe("Height in pixels"),
    duration: z
      .number()
      .positive()
      .optional()
      .describe("Duration in seconds for time-based media"),
    service: z
      .array(ServiceReferenceSchema)
      .optional()
      .describe("IIIF Image API or other services"),
  })
  .describe("IIIF external web resource");

/**
 * TextualBody - Embedded text content (EmbeddedResource in @iiif/presentation-3)
 * Used for transcriptions, OCR, captions, comments
 */
export const TextualBodySchema = z
  .object({
    id: z
      .string()
      .optional()
      .describe("Optional identifier for the textual body"),
    type: z.literal("TextualBody"),
    value: z.string().describe("The text content"),
    format: z
      .string()
      .optional()
      .describe("MIME type (text/plain, text/html, etc.)"),
    language: z
      .string()
      .optional()
      .describe('Language code (e.g., "en", "fr")'),
    purpose: z
      .string()
      .optional()
      .describe('Annotation purpose (e.g., "transcribing", "commenting")'),
  })
  .describe("W3C Web Annotation TextualBody for embedded text");

/**
 * Selector for SpecificResource - fragment or state selectors
 */
const SelectorSchema = z
  .object({
    type: z
      .string()
      .describe("Selector type (FragmentSelector, PointSelector, etc.)"),
    value: z.string().optional().describe("Selector value"),
    conformsTo: z.string().optional().describe("Selector specification URI"),
  })
  .passthrough() // Allow additional selector-specific properties
  .describe("W3C Web Annotation Selector");

/**
 * SpecificResource - Resource with selector or state
 * Used for targeting specific regions or states of a resource
 */
export const SpecificResourceSchema = z
  .object({
    id: z.string().optional().describe("Optional identifier"),
    type: z.literal("SpecificResource"),
    source: z
      .union([z.string(), ExternalResourceSchema])
      .describe("Source resource or URI"),
    selector: SelectorSchema.optional().describe("Fragment or state selector"),
    purpose: z.string().optional().describe("Resource purpose"),
  })
  .describe("W3C Web Annotation SpecificResource");

/**
 * Base body types (non-Choice) for use in Choice items
 */
const BaseBodySchema = z.union([
  ExternalResourceSchema,
  TextualBodySchema,
  SpecificResourceSchema,
]);

/**
 * ChoiceBody - Multiple alternative bodies (user/client picks one)
 * Used for multi-language transcriptions, quality options, etc.
 */
export const ChoiceBodySchema = z
  .object({
    id: z.string().optional().describe("Optional identifier for the choice"),
    type: z.literal("Choice"),
    items: z
      .array(BaseBodySchema)
      .min(1)
      .describe("Array of alternative body options"),
  })
  .describe("W3C Web Annotation Choice for alternative bodies");

/**
 * ContentResourceString - Simple string body (just a URI)
 */
const ContentResourceStringSchema = z
  .string()
  .describe("Simple string body (URI reference)");

/**
 * AnnotationBody - Union of all valid annotation body types
 * Per IIIF Presentation 3.0 and W3C Web Annotation Data Model
 */
export const AnnotationBodySchema = z
  .union([
    ExternalResourceSchema,
    TextualBodySchema,
    SpecificResourceSchema,
    ChoiceBodySchema,
    ContentResourceStringSchema,
  ])
  .describe("IIIF/W3C annotation body (any valid type)");

// Legacy alias for backwards compatibility
const ContentResourceSchema = ExternalResourceSchema;

// Annotation schema for painting annotations
const AnnotationSchema = z
  .object({
    id: IIIFIdentifier,
    type: z.literal("Annotation"),
    motivation: z
      .union([z.string(), z.array(z.string())])
      .describe('Annotation motivation (e.g., "painting" or ["commenting", "tagging"])'),
    body: AnnotationBodySchema.or(z.array(AnnotationBodySchema))
      .optional()
      .describe("Annotation body (single or array)"),
    target: z.string().describe("Annotation target (canvas ID)"),
  })
  .describe("IIIF annotation");

// Annotation Page schema
const AnnotationPageSchema = z
  .object({
    id: IIIFIdentifier,
    type: z.literal("AnnotationPage"),
    items: z
      .array(AnnotationSchema)
      .optional()
      .describe("Array of annotations"),
  })
  .describe("IIIF annotation page");

// Canvas schema with comprehensive validation
const CanvasSchema = z
  .object({
    id: IIIFIdentifier,
    type: z.literal("Canvas"),
    label: IIIFLanguageMap.optional().describe(
      "Canvas label in multiple languages",
    ),
    width: z.number().positive().optional().describe("Canvas width in pixels"),
    height: z
      .number()
      .positive()
      .optional()
      .describe("Canvas height in pixels"),
    duration: z
      .number()
      .positive()
      .optional()
      .describe("Canvas duration in seconds for time-based media"),
    items: z
      .array(AnnotationPageSchema)
      .optional()
      .describe("Array of annotation pages"),
  })
  .describe("IIIF canvas")
  .refine(
    (canvas) => {
      // Canvas should have either width/height OR duration, but not necessarily both
      const hasDimensions =
        canvas.width !== undefined && canvas.height !== undefined;
      const hasDuration = canvas.duration !== undefined;
      return hasDimensions || hasDuration;
    },
    {
      message:
        "Canvas must have either dimensions (width and height) or duration for time-based media",
    },
  );

// Manifest reference for Collections
const ManifestReferenceSchema = z
  .object({
    id: IIIFIdentifier,
    type: z.literal("Manifest"),
    label: IIIFLanguageMap.describe("Manifest label in multiple languages"),
    thumbnail: z
      .array(ContentResourceSchema)
      .optional()
      .describe("Thumbnail images"),
  })
  .describe("IIIF manifest reference");

// Main Manifest schema
export const ManifestSchema = z
  .object({
    "@context": IIIFContext,
    id: IIIFIdentifier,
    type: z.literal("Manifest"),
    label: IIIFLanguageMap.describe("Manifest label in multiple languages"),
    summary: IIIFLanguageMap.optional().describe(
      "Manifest summary/description",
    ),
    thumbnail: z
      .array(ContentResourceSchema)
      .optional()
      .describe("Manifest thumbnail images"),
    items: z
      .array(CanvasSchema)
      .min(1, "Manifest must contain at least one canvas")
      .describe("Array of canvases"),
  })
  .describe("IIIF Presentation API v3 Manifest")
  .refine((manifest) => Object.keys(manifest.label).length > 0, {
    message: "Manifest label must contain at least one language entry",
  });

// Collection schema
export const CollectionSchema = z
  .object({
    "@context": IIIFContext,
    id: IIIFIdentifier,
    type: z.literal("Collection"),
    label: IIIFLanguageMap.describe("Collection label in multiple languages"),
    summary: IIIFLanguageMap.optional().describe(
      "Collection summary/description",
    ),
    items: z
      .array(ManifestReferenceSchema)
      .describe("Array of manifest references"),
  })
  .describe("IIIF Collection")
  .refine((collection) => Object.keys(collection.label).length > 0, {
    message: "Collection label must contain at least one language entry",
  });

// Image Service schema for IIIF Image API
export const ImageServiceSchema = z
  .object({
    "@context": z.literal("http://iiif.io/api/image/3/context.json"),
    id: IIIFIdentifier,
    type: z.literal("ImageService3"),
    profile: z
      .enum(["level0", "level1", "level2"])
      .describe("IIIF Image API compliance level"),
    protocol: z
      .literal("http://iiif.io/api/image")
      .describe("IIIF Image API protocol"),
    width: z.number().positive().describe("Image width in pixels"),
    height: z.number().positive().describe("Image height in pixels"),
    tiles: z
      .array(
        z.object({
          width: z.number().positive(),
          height: z.number().positive().optional(),
          scaleFactors: z.array(z.number().positive()),
        }),
      )
      .optional()
      .describe("Tile configuration for deep zoom"),
    formats: z
      .array(z.string())
      .optional()
      .describe("Supported output formats"),
    qualities: z
      .array(z.string())
      .optional()
      .describe("Supported quality levels"),
  })
  .describe("IIIF Image Service");

// Union type for any IIIF resource
export const IIIFResourceSchema = z
  .union([ManifestSchema, CollectionSchema, ImageServiceSchema])
  .describe("Any IIIF resource (Manifest, Collection, or ImageService)");

// Export type definitions
export type ManifestData = z.infer<typeof ManifestSchema>;
export type CollectionData = z.infer<typeof CollectionSchema>;
export type ImageServiceData = z.infer<typeof ImageServiceSchema>;
export type CanvasData = z.infer<typeof CanvasSchema>;
export type ContentResourceData = z.infer<typeof ContentResourceSchema>;
export type AnnotationData = z.infer<typeof AnnotationSchema>;
export type TextualBodyData = z.infer<typeof TextualBodySchema>;
export type SpecificResourceData = z.infer<typeof SpecificResourceSchema>;
export type ChoiceBodyData = z.infer<typeof ChoiceBodySchema>;
export type AnnotationBodyData = z.infer<typeof AnnotationBodySchema>;

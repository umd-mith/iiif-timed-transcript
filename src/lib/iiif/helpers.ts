import type {
  ManifestData,
  CollectionData,
  CanvasData,
  ContentResourceData,
  AnnotationData,
  AnnotationBodyData,
  TextualBodyData,
  ChoiceBodyData,
} from "./validators";

/**
 * Helper functions for working with IIIF resources
 * Following functional light patterns with pure functions
 */

/**
 * Gets the label from any IIIF resource in the preferred language
 * @param resource - IIIF resource with label property
 * @param preferredLang - Preferred language code (default: 'en')
 * @returns Label string or empty string if not found
 */
export function getLabel(
  resource: { label: Record<string, string[]> },
  preferredLang = "en",
): string {
  const labels = resource.label;

  const preferred = labels[preferredLang];
  if (preferred && preferred.length > 0) {
    return preferred[0] ? preferred[0] : "";
  }

  for (const arr of Object.values(labels)) {
    if (arr.length > 0) return arr[0] ? arr[0] : "";
  }

  return "";
}

/**
 * Gets thumbnail URL from a IIIF resource
 * @param resource - IIIF resource with optional thumbnail property
 * @returns Thumbnail URL or undefined
 */
export function getThumbnail(resource: {
  thumbnail?: ContentResourceData[];
}): string | undefined {
  const thumbnails = resource.thumbnail;
  if (thumbnails && thumbnails.length > 0) {
    return thumbnails[0]?.id;
  }
  return undefined;
}

/**
 * Gets all canvases from a manifest
 * @param manifest - IIIF manifest
 * @returns Array of canvas objects
 */
export function getCanvases(manifest: ManifestData): CanvasData[] {
  return manifest.items || [];
}

/**
 * Gets the first canvas from a manifest (useful for single-item manifests)
 * @param manifest - IIIF manifest
 * @returns First canvas or undefined
 */
export function getFirstCanvas(manifest: ManifestData): CanvasData | undefined {
  return manifest.items?.[0];
}

/**
 * Gets manifest references from a collection
 * @param collection - IIIF collection
 * @returns Array of manifest reference objects
 */
export function getManifests(collection: CollectionData) {
  return collection.items || [];
}

/**
 * Gets painting annotations from a canvas
 * @param canvas - IIIF canvas
 * @returns Array of painting annotation objects
 */
export function getPaintingAnnotations(canvas: CanvasData): AnnotationData[] {
  const paintingAnnotations: AnnotationData[] = [];
  const annotationPages = canvas.items || [];

  for (const page of annotationPages) {
    if (page.items) {
      for (const annotation of page.items) {
        if (annotation.motivation === "painting") {
          paintingAnnotations.push(annotation);
        }
      }
    }
  }

  return paintingAnnotations;
}

/**
 * Type guard to check if an annotation body is an external resource (Image, Sound, Video, Text, Dataset)
 */
function isExternalResource(
  body: AnnotationBodyData,
): body is ContentResourceData {
  return (
    typeof body === "object" &&
    body !== null &&
    "id" in body &&
    "type" in body &&
    ["Image", "Sound", "Video", "Text", "Dataset"].includes(
      (body as ContentResourceData).type,
    )
  );
}

/**
 * Gets the primary content resource from a canvas (first painting annotation body)
 * @param canvas - IIIF canvas
 * @returns Content resource object or undefined
 */
export function getPrimaryResource(
  canvas: CanvasData,
): ContentResourceData | undefined {
  const paintingAnnotations = getPaintingAnnotations(canvas);
  const body = paintingAnnotations[0]?.body;

  if (!body) {
    return undefined;
  }

  // Handle array of bodies - find first external resource
  if (Array.isArray(body)) {
    return body.find(isExternalResource);
  }

  // Handle single body
  if (isExternalResource(body)) {
    return body;
  }

  return undefined;
}

/**
 * Checks if a canvas represents an image
 * @param canvas - IIIF canvas
 * @returns True if primary resource is an image
 */
export function isImageCanvas(canvas: CanvasData): boolean {
  const resource = getPrimaryResource(canvas);
  return resource?.type === "Image";
}

/**
 * Checks if a canvas represents audio content
 * @param canvas - IIIF canvas
 * @returns True if primary resource is sound
 */
export function isAudioCanvas(canvas: CanvasData): boolean {
  const resource = getPrimaryResource(canvas);
  return resource?.type === "Sound";
}

/**
 * Checks if a canvas represents video content
 * @param canvas - IIIF canvas
 * @returns True if primary resource is video
 */
export function isVideoCanvas(canvas: CanvasData): boolean {
  const resource = getPrimaryResource(canvas);
  return resource?.type === "Video";
}

/**
 * Checks if a canvas represents PDF content
 * @param canvas - IIIF canvas
 * @returns True if primary resource is a PDF
 */
export function isPDFCanvas(canvas: CanvasData): boolean {
  const resource = getPrimaryResource(canvas);
  return resource?.format === "application/pdf";
}

/**
 * Checks if a canvas is time-based media (audio or video)
 * @param canvas - IIIF canvas
 * @returns True if canvas has duration or is audio/video
 */
export function isTimeBasedCanvas(canvas: CanvasData): boolean {
  return !!(canvas.duration || isAudioCanvas(canvas) || isVideoCanvas(canvas));
}

/**
 * Gets canvas dimensions if available
 * @param canvas - IIIF canvas
 * @returns Object with width and height, or undefined
 */
export function getCanvasDimensions(
  canvas: CanvasData,
): { width: number; height: number } | undefined {
  if (canvas.width && canvas.height) {
    return {
      width: canvas.width,
      height: canvas.height,
    };
  }
  return undefined;
}

/**
 * Gets aspect ratio for a canvas
 * @param canvas - IIIF canvas
 * @returns Aspect ratio (width/height) or undefined
 */
export function getCanvasAspectRatio(canvas: CanvasData): number | undefined {
  const dims = getCanvasDimensions(canvas);
  if (dims && dims.height > 0) {
    return dims.width / dims.height;
  }
  return undefined;
}

/**
 * Gets all available language codes from a resource label
 * @param resource - IIIF resource with label property
 * @returns Array of language codes
 */
export function getAvailableLanguages(resource: {
  label: Record<string, string[]>;
}): string[] {
  return Object.keys(resource.label);
}

/**
 * Checks if a manifest has multiple canvases
 * @param manifest - IIIF manifest
 * @returns True if more than one canvas
 */
export function isMultiCanvas(manifest: ManifestData): boolean {
  return (manifest.items?.length || 0) > 1;
}

/**
 * Checks if a collection is empty
 * @param collection - IIIF collection
 * @returns True if no manifests
 */
export function isEmptyCollection(collection: CollectionData): boolean {
  return (collection.items?.length || 0) === 0;
}

/**
 * Gets manifest IDs from a collection for easy iteration
 * @param collection - IIIF collection
 * @returns Array of manifest ID strings
 */
export function getManifestIds(collection: CollectionData): string[] {
  return getManifests(collection).map((manifest) => manifest.id);
}

/**
 * Gets manifest labels from a collection for display purposes
 * @param collection - IIIF collection
 * @param preferredLang - Preferred language code (default: 'en')
 * @returns Array of manifest labels
 */
export function getManifestLabels(
  collection: CollectionData,
  preferredLang: string = "en",
): string[] {
  return getManifests(collection).map((manifest) =>
    getLabel(manifest, preferredLang),
  );
}

/**
 * Finds a manifest in a collection by ID
 * @param collection - IIIF collection
 * @param manifestId - The manifest ID to find
 * @returns Manifest reference or undefined
 */
export function findManifestInCollection(
  collection: CollectionData,
  manifestId: string,
) {
  return getManifests(collection).find(
    (manifest) => manifest.id === manifestId,
  );
}

/**
 * Validates basic IIIF resource structure
 * @param resource - Any IIIF resource
 * @returns True if resource has required IIIF fields
 */
export function isValidIIIFResource(
  resource: unknown,
): resource is { id: string; type: string; label: Record<string, string[]> } {
  return !!(
    resource &&
    typeof resource === "object" &&
    "id" in resource &&
    "type" in resource &&
    "label" in resource
  );
}

/**
 * Extracts identifier from IIIF resource URL using a configurable pattern
 *
 * The IIIF Presentation API specification places no restrictions on identifier form,
 * so URL-to-identifier extraction is inherently application-specific. This function
 * follows the node-iiif precedent of making the pattern configurable via RegExp.
 *
 * @param iiifUrl - IIIF resource URL to extract identifier from
 * @param pattern - Optional RegExp with a capture group for the identifier.
 *                  Defaults to `/\/api\/v1\/iiif\/([^/]+)$/` (Lakeland Archive pattern).
 *                  The first capture group is returned as the identifier.
 * @returns Identifier string from the first capture group, or undefined if no match
 *
 * @example
 * // Using default Lakeland pattern
 * extractIdentifierFromUrl('/api/v1/iiif/abc123')
 * // => 'abc123'
 *
 * @example
 * // Using custom pattern for node-iiif style URLs
 * const nodePattern = /\/iiif\/2\/([^/]+)\//;
 * extractIdentifierFromUrl('/iiif/2/my-id:resource/full/max/0/default.jpg', nodePattern)
 * // => 'my-id:resource'
 *
 * @example
 * // Using custom pattern for your server
 * const customPattern = /\/images\/([^/]+)\/manifest\.json$/;
 * extractIdentifierFromUrl('https://myserver.org/images/xyz789/manifest.json', customPattern)
 * // => 'xyz789'
 */
export function extractIdentifierFromUrl(
  iiifUrl: string,
  pattern: RegExp = /\/api\/v1\/iiif\/([^/]+)$/,
): string | undefined {
  const match = iiifUrl.match(pattern);
  return match?.[1];
}

/**
 * Type guard to check if an annotation body is a TextualBody
 */
function isTextualBody(body: AnnotationBodyData): body is TextualBodyData {
  return (
    typeof body === "object" &&
    body !== null &&
    "type" in body &&
    (body as TextualBodyData).type === "TextualBody"
  );
}

/**
 * Type guard to check if an annotation body is a Choice
 */
function isChoiceBody(body: AnnotationBodyData): body is ChoiceBodyData {
  return (
    typeof body === "object" &&
    body !== null &&
    "type" in body &&
    (body as ChoiceBodyData).type === "Choice"
  );
}

/**
 * Gets all TextualBody items from a canvas's painting annotations
 * Useful for extracting transcriptions, captions, or other text content
 * @param canvas - IIIF canvas
 * @returns Array of TextualBody objects
 */
export function getTextualBodies(canvas: CanvasData): TextualBodyData[] {
  const textualBodies: TextualBodyData[] = [];
  const paintingAnnotations = getPaintingAnnotations(canvas);

  for (const annotation of paintingAnnotations) {
    const body = annotation.body;
    if (!body) continue;

    // Handle array of bodies
    if (Array.isArray(body)) {
      for (const b of body) {
        if (isTextualBody(b)) {
          textualBodies.push(b);
        } else if (isChoiceBody(b)) {
          // Extract TextualBodies from Choice items
          for (const item of b.items) {
            if (isTextualBody(item)) {
              textualBodies.push(item);
            }
          }
        }
      }
    } else {
      // Handle single body
      if (isTextualBody(body)) {
        textualBodies.push(body);
      } else if (isChoiceBody(body)) {
        // Extract TextualBodies from Choice items
        for (const item of body.items) {
          if (isTextualBody(item)) {
            textualBodies.push(item);
          }
        }
      }
    }
  }

  return textualBodies;
}

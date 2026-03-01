import type { ManifestData } from "../iiif/validators";

/**
 * Module-level cache for manifest fetches.
 * Stores Promises so even concurrent mounts share the same in-flight request.
 * The raw (pre-Zod) manifest is preserved for parseRanges (Zod strips `structures`).
 */
export const manifestCache = new Map<
  string,
  Promise<{ validated: ManifestData; raw: unknown }>
>();

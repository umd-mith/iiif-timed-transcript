import type { ManifestData } from '../iiif/validators';

/**
 * Module-level cache for manifest fetches.
 * Stores Promises so even concurrent mounts share the same in-flight request.
 */
export const manifestCache = new Map<string, Promise<ManifestData>>();

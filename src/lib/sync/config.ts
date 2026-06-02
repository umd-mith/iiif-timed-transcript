/**
 * SyncController Configuration
 *
 * Default configuration values for the bidirectional sync system.
 */

import type { SyncConfig } from "./types.js";

/**
 * Default configuration values.
 * Provides sensible defaults for typical use cases.
 */
export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  debounceMs: 150,
  settleMs: 100,
  priorityLockDuration: 1000,
};

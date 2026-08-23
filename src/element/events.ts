import type { CanvasInfo, PlayerErrorSource, PlayerRef } from "../lib/index.js";

/** Root's sources plus "host" — raised only by the wrapper for a misused property. */
export type ElementErrorSource = PlayerErrorSource | "host";

export interface PlayerErrorDetail {
  error: Error;
  /** true: the player will not become usable; false: ancillary, no action needed. */
  fatal: boolean;
  source: ElementErrorSource;
}

export interface PlayerRefAvailableDetail {
  playerRef: PlayerRef;
}

export interface CanvasChangeDetail {
  index: number;
  canvas: CanvasInfo;
}

/** Same shape as Root's onError, with the wrapper-only "host" source added. */
export type ErrorCallback = (
  error: Error,
  info: { fatal: boolean; source: ElementErrorSource },
) => void;

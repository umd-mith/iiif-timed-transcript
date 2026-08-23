import type { CanvasInfo, PlayerErrorSource, PlayerRef } from "../lib/index.js";
import type { ElementErrorSource as PublicElementErrorSource } from "./public-types.js";

/** Root's sources plus "host" — raised only by the wrapper for a misused property. */
export type ElementErrorSource = PlayerErrorSource | "host";

// public-types.d.ts hand-maintains this same union as a literal (it is
// copied verbatim to dist/element/index.d.ts and cannot import from the
// compiled sources it describes). This assertion — checked whenever this
// file type-checks, i.e. every `pnpm typecheck` / test run — fails to
// compile if the two ever diverge, so the hand-written copy cannot drift
// silently. If it fails, update public-types.d.ts's ElementErrorSource to
// match.
type AssertBidirectionallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : never
  : never;
type ElementErrorSourceStaysInSyncWithPublicTypes =
  AssertBidirectionallyAssignable<ElementErrorSource, PublicElementErrorSource>;
// Forces the check above to be a compile error (not just an inert `never`
// type) if the two unions diverge: `never` cannot be assigned from `true`.
const elementErrorSourceStaysInSyncWithPublicTypes: ElementErrorSourceStaysInSyncWithPublicTypes = true;
void elementErrorSourceStaysInSyncWithPublicTypes;

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

/**
 * The element's own events, for a typed `addEventListener`. Mirrored in
 * public-types.d.ts, and exported from index.ts so the two surfaces stay
 * pinned by the postbuild probe.
 */
export interface IIIFTranscriptPlayerElementEventMap extends HTMLElementEventMap {
  playerrefavailable: CustomEvent<PlayerRefAvailableDetail>;
  playererror: CustomEvent<PlayerErrorDetail>;
  canvaschange: CustomEvent<CanvasChangeDetail>;
}

import type {
  Annotation,
  CanvasInfo,
  PlayerRef,
  TermKey,
} from "@umd-mith/svelte-iiif-transcript-player";

// Re-exported so `import type { Annotation } from
// "@umd-mith/svelte-iiif-transcript-player/element"` — which compiles fine
// against src/element/index.ts (see its own re-export of these three) —
// also compiles against the *published* types. Without this, the shipped
// .d.ts (this file, copied verbatim to dist/element/index.d.ts) only
// imports these names for local use below and never makes them available
// to importers.
export type { Annotation, CanvasInfo, PlayerRef };

export type ElementErrorSource =
  | "manifest"
  | "canvas"
  | "media"
  | "playback"
  | "transcript"
  | "auth"
  | "host";

export interface PlayerErrorDetail {
  error: Error;
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
/** Empty today; kept as an object (not `void`) so hosts can safely read `.detail` and future fields can be added non-breaking. */
export type PlaybackEventDetail = Record<string, never>;
export interface RateChangeDetail {
  rate: number;
}
export type ErrorCallback = (
  error: Error,
  info: { fatal: boolean; source: ElementErrorSource },
) => void;

export declare const DEFAULT_TAG: "iiif-transcript-player";

/** The custom element class (not registered on import — call `register()`). */
export declare class IIIFTranscriptPlayerElement extends HTMLElement {
  /** `manifest-url` attribute. Set before connection; replace the node to load another manifest. */
  manifestUrl: string;
  /**
   * `canvas-index` attribute. Reactive and reflected. A value that is not a
   * non-negative integer falls back to 0 (and the attribute is repaired to
   * 0) and an out-of-range index is ignored; either is a non-fatal `host`
   * error, reported once per value per connection. Removing the attribute is
   * not an error — it silently means the default, canvas 0.
   */
  canvasIndex: number;
  /**
   * `initial-time` attribute. Init-only, and only on the first connection.
   * A value that is not a non-negative finite number is ignored with a
   * non-fatal `host` error and does not consume that one application.
   */
  initialTime: number | undefined;
  /** `autoplay` attribute. */
  autoplay: boolean;
  /**
   * `label` attribute. Host-settable accessible name for the element's
   * top-level region (`role="region"`), for distinguishing multiple
   * players on one page to assistive technology. Default is the
   * localized generic name.
   */
  label: string;
  /** `crossorigin` attribute. Forwarded to the underlying media element. */
  crossorigin: string;
  /** Property only. Default `"auto"`. */
  annotations: Annotation[] | "auto";
  /** Property only. Runs on the parsed manifest JSON before validation. */
  preprocessManifest: ((raw: unknown) => unknown) | undefined;
  /** Property only. Same payload as the `iiif-player-error` event. */
  errorCallback: ErrorCallback | undefined;
  /**
   * Read-only. Nullish until `iiif-player-ready` — `undefined` before the
   * inner component exists (the accessor reads through it), `null` after.
   * It stays nullish if the fatal error is a manifest or first-canvas
   * failure; a fatal *media* error can arrive after `iiif-player-ready`, in
   * which case `playerRef` is already set and stays set.
   */
  readonly playerRef: PlayerRef | null | undefined;
  addEventListener<K extends keyof IIIFTranscriptPlayerElementEventMap>(
    type: K,
    listener: (
      this: IIIFTranscriptPlayerElement,
      ev: IIIFTranscriptPlayerElementEventMap[K],
    ) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

export interface IIIFTranscriptPlayerElementEventMap extends HTMLElementEventMap {
  "iiif-player-ready": CustomEvent<PlayerRefAvailableDetail>;
  "iiif-player-error": CustomEvent<PlayerErrorDetail>;
  "iiif-player-canvas-change": CustomEvent<CanvasChangeDetail>;
  "iiif-player-play": CustomEvent<PlaybackEventDetail>;
  "iiif-player-pause": CustomEvent<PlaybackEventDetail>;
  "iiif-player-ended": CustomEvent<PlaybackEventDetail>;
  "iiif-player-seeked": CustomEvent<PlaybackEventDetail>;
  "iiif-player-rate-change": CustomEvent<RateChangeDetail>;
}

/** Defines the element as `tagName` (default `"iiif-transcript-player"`). Warns and no-ops if already defined. */
export declare function register(tagName?: string): void;

/** Merges `terms` into whatever is already registered for `locale` (hardening spec 4.2). */
export declare function registerTranslation(
  locale: string,
  terms: Partial<Record<TermKey, string>>,
): void;

declare global {
  interface HTMLElementTagNameMap {
    "iiif-transcript-player": IIIFTranscriptPlayerElement;
  }
}

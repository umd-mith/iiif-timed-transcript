import type {
  Annotation,
  CanvasInfo,
  PlayerRef,
} from "@umd-mith/svelte-iiif-transcript-player";

export type ElementErrorSource =
  | "manifest"
  | "canvas"
  | "media"
  | "playback"
  | "transcript"
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
export type ErrorCallback = (
  error: Error,
  info: { fatal: boolean; source: ElementErrorSource },
) => void;

export declare const DEFAULT_TAG: "iiif-transcript-player";

/** The custom element class (not registered on import — call `register()`). */
export declare class IIIFTranscriptPlayerElement extends HTMLElement {
  /** `manifest-url` attribute. Set before connection; replace the node to load another manifest. */
  manifestUrl: string;
  /** `canvas-index` attribute. Reactive and reflected. */
  canvasIndex: number;
  /** `initial-time` attribute. Init-only. */
  initialTime: number | undefined;
  /** `autoplay` attribute. */
  autoplay: boolean;
  /** Property only. Default `"auto"`. */
  annotations: Annotation[] | "auto";
  /** Property only. Runs on the parsed manifest JSON before validation. */
  preprocessManifest: ((raw: unknown) => unknown) | undefined;
  /** Property only. Same payload as the `playererror` event. */
  errorCallback: ErrorCallback | undefined;
  /** Read-only. Nullish until `playerrefavailable`; stays nullish after a fatal `playererror`. */
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
  playerrefavailable: CustomEvent<PlayerRefAvailableDetail>;
  playererror: CustomEvent<PlayerErrorDetail>;
  canvaschange: CustomEvent<CanvasChangeDetail>;
}

/** Defines the element as `tagName` (default `"iiif-transcript-player"`). Warns and no-ops if already defined. */
export declare function register(tagName?: string): void;

declare global {
  interface HTMLElementTagNameMap {
    "iiif-transcript-player": IIIFTranscriptPlayerElement;
  }
}

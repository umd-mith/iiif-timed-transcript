import type { HlsConstructor } from "../lib/media/hlsUtils.js";

/**
 * Module-level default for hls.js. A custom element is instantiated by the
 * browser, so there is no per-instance constructor channel; the IIFE entry
 * sets this once at load and every element instance reads it. The ESM entry
 * never sets it (hosts get Root's dynamic-import resolution of the peer dep).
 */
let defaultHlsConstructor: HlsConstructor | undefined;

export function setDefaultHlsConstructor(ctor: HlsConstructor): void {
  defaultHlsConstructor = ctor;
}

export function getDefaultHlsConstructor(): HlsConstructor | undefined {
  return defaultHlsConstructor;
}

/** Test hook. */
export function resetDefaultHlsConstructor(): void {
  defaultHlsConstructor = undefined;
}

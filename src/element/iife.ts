// The <script src> drop-in: hls.js is bundled and installed as the
// module-level default, then the element is registered. Loading this file
// twice (or next to the ESM build) is a warning, not a throw — see register().
import Hls from "hls.js";
import type { HlsConstructor } from "../lib/media/hlsUtils.js";
import { setDefaultHlsConstructor } from "./mediaDefaults.js";
import {
  register,
  DEFAULT_TAG,
  IIIFTranscriptPlayerElement,
} from "./register.js";

setDefaultHlsConstructor(Hls as unknown as HlsConstructor);
register();

// These are NOT module exports of the shipped file. Vite's `build.lib.name`
// (IIIFTranscriptPlayer, see vite.config.element.ts) turns an IIFE entry's
// exports into properties of that global, and the emitted bundle is a classic
// script with no `export` statements — which is exactly why the IIFE's
// published types (src/element/iife-global.d.ts, shipped as
// dist/element/iiif-transcript-player.iife.d.ts — not reachable via the
// package's `exports` map, see README) declare `window.IIIFTranscriptPlayer`
// and nothing else. Keep this list and that declaration in step.
export { register, DEFAULT_TAG, IIIFTranscriptPlayerElement };

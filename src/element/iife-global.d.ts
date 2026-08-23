/**
 * Types for the `<script src>` (IIFE) build, shipped as
 * dist/element/iiif-transcript-player.iife.d.ts and pointed at by the
 * `./element/iife` export.
 *
 * The IIFE has NO module exports. Vite's `build.lib.name` turns the entry's
 * exports into properties of a single global (`window.IIIFTranscriptPlayer`),
 * and the emitted file is a classic script — so `import { register } from
 * "…/element/iife"` is a runtime SyntaxError in this `"type": "module"`
 * package. Declaring the global (and nothing else) is what makes the types
 * describe what actually ships.
 *
 * Loading the file registers `<iiif-transcript-player>` as a side effect; the
 * global is there for a host that wants a second tag name or the class.
 */
import type {
  register,
  DEFAULT_TAG,
  IIIFTranscriptPlayerElement,
} from "./index.js";

declare global {
  interface Window {
    IIIFTranscriptPlayer: {
      register: typeof register;
      DEFAULT_TAG: typeof DEFAULT_TAG;
      IIIFTranscriptPlayerElement: typeof IIIFTranscriptPlayerElement;
    };
  }
}

export {};

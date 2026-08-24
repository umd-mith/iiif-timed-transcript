/**
 * Types for the `<script src>` (IIFE) build, shipped as
 * dist/element/iiif-transcript-player.iife.d.ts. Not resolvable through the
 * package's `exports` map — there is no `./element/iife` entry (removed;
 * design 2026-08-23-element-hardening-design.md §1.4) — so a TS host
 * references this file by its concrete dist path (README, "Script tag
 * (IIFE)").
 *
 * The IIFE has NO module exports. Vite's `build.lib.name` turns the entry's
 * exports into properties of a single global (`window.IIIFTranscriptPlayer`),
 * and the emitted file is a classic script — so `import { register } from
 * "…/dist/element/iiif-transcript-player.iife.js"` fails at link time ("does
 * not provide an export named 'register'"), before a line of it runs.
 * Declaring the global (and nothing else) is what makes the types describe
 * what actually ships.
 *
 * Loading the file registers `<iiif-transcript-player>` as a side effect; the
 * global is there for a host that wants a second tag name or the class.
 *
 * The global is optional because it exists only on the path this file is
 * written for: a classic `<script src>`. A bundler-side
 * `import "…/dist/element/iiif-transcript-player.iife.js"` runs the same
 * file as a module, where the top-level `var IIIFTranscriptPlayer` is a
 * module-scope binding and never becomes a property of `window` — so the
 * element registers but the global does not appear. Use the ESM entry
 * (`…/element`) from a bundler.
 */
import type {
  register,
  DEFAULT_TAG,
  IIIFTranscriptPlayerElement,
} from "./index.js";

declare global {
  interface Window {
    IIIFTranscriptPlayer?: {
      register: typeof register;
      DEFAULT_TAG: typeof DEFAULT_TAG;
      IIIFTranscriptPlayerElement: typeof IIIFTranscriptPlayerElement;
    };
  }
}

export {};

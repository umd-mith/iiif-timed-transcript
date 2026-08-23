import Wrapper from "./IIIFTranscriptPlayerElement.svelte";

export const DEFAULT_TAG = "iiif-transcript-player";

/**
 * The custom element class generated from the wrapper (Svelte sets
 * `Component.element` when a component is compiled in custom-element mode).
 * Not registered on import — call `register()`.
 */
export const IIIFTranscriptPlayerElement = (() => {
  const cls = (Wrapper as unknown as { element?: CustomElementConstructor })
    .element;
  if (!cls) {
    throw new Error(
      "[iiif-transcript-player] wrapper was not compiled as a custom element",
    );
  }
  return cls;
})();

/**
 * Defines `<iiif-transcript-player>` (or `tagName`). Safe to call twice and
 * safe when both the IIFE and the ESM build are on one page: an already
 * defined tag is a console warning, not a throw. A fresh subclass is defined
 * per tag because the registry rejects reusing one constructor for two names.
 */
export function register(tagName: string = DEFAULT_TAG): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tagName)) {
    console.warn(
      `[iiif-transcript-player] <${tagName}> is already defined; register() ignored`,
    );
    return;
  }
  customElements.define(tagName, class extends IIIFTranscriptPlayerElement {});
}

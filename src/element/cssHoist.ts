/**
 * Constructable-stylesheet hoist for CSP-safe shadow-root styling (hardening
 * spec 2.1). Svelte's custom-element runtime injects a `<style id={hash}>`
 * text node directly into the shadow root for every distinct component
 * style block (svelte/src/internal/client/dom/css.js:10-33) and never
 * removes it — its only dedupe check is `shadowRoot.querySelector('#' +
 * css.hash)` (css.js:21), so removing a hoisted node would make a later
 * mount of the same component re-inject the same styles: permanent
 * inject/observe/remove churn and one CSP violation report per cycle.
 *
 * This module reads the currently non-empty `<style>` nodes' `textContent`,
 * concatenates them, builds one `CSSStyleSheet` from the concatenation via
 * `replaceSync` (CSSOM construction — exempt from `style-src`, unlike the
 * inline `<style>` text itself), pushes it onto
 * `shadowRoot.adoptedStyleSheets`, and empties each node's `textContent` in
 * place. The nodes stay in the DOM (so the dedupe check above still finds
 * them and skips re-injection) but are inert under a strict `style-src`.
 *
 * Sheets are cached at module scope, keyed by the exact concatenated text
 * of each pass. Every `<iiif-transcript-player>` instance mounts the same
 * components in the same order, so the Nth pass across instances produces
 * the same text and they all adopt the same `CSSStyleSheet` object — N
 * players share parsed sheets instead of N copies.
 */

const sheetCache = new Map<string, CSSStyleSheet>();

/**
 * Hoists every currently non-empty `<style>` child of `shadowRoot` into
 * `adoptedStyleSheets`, then empties it. Safe to call repeatedly — already-
 * emptied nodes are skipped, so call it once up front and again from a
 * `MutationObserver` for late-mounted components (a canvas switch mounts
 * new lib components lazily). Returns the count of `<style>` nodes hoisted
 * this pass (0 when there is nothing new).
 */
export function hoistShadowStyles(shadowRoot: ShadowRoot): number {
  const nodes = Array.from(shadowRoot.querySelectorAll("style")).filter(
    (node): node is HTMLStyleElement =>
      node instanceof HTMLStyleElement && (node.textContent?.length ?? 0) > 0,
  );
  if (nodes.length === 0) return 0;

  const text = nodes.map((node) => node.textContent).join("\n");
  let sheet = sheetCache.get(text);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    sheetCache.set(text, sheet);
  }
  if (!shadowRoot.adoptedStyleSheets.includes(sheet)) {
    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, sheet];
  }
  for (const node of nodes) node.textContent = "";
  return nodes.length;
}

/**
 * Svelte-shape canary (2.1's pinned test c): call once, generously deferred
 * past the element's first render, with the shadow root's *total* `<style>`
 * count (hoisted or not). Zero means Svelte's injection shape changed
 * (`css.js`'s `style.id = css.hash` / `target.appendChild(style)` no longer
 * hold) and the hoist is silently finding nothing — fail loudly instead of
 * letting the element regress to unhoisted inline styles under CSP.
 */
export function warnIfNoStylesFound(
  shadowRoot: ShadowRoot,
  log: (message: string) => void = console.error,
): void {
  if (shadowRoot.querySelectorAll("style").length > 0) return;
  log(
    "[iiif-transcript-player] no <style> nodes found in the shadow root — " +
      "the CSS hoist (cssHoist.ts) found nothing to adopt. If Svelte's " +
      "style-injection shape changed, styles are not applying under a " +
      "strict CSP.",
  );
}

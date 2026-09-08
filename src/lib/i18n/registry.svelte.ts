/**
 * shoelace-localize-style term registry: a reactive `locale` ($state,
 * module-level — one shared value, like shoelace-localize's own global),
 * an English built-in, and `registerTranslation` for hosts to add
 * languages. `t()` is a plain function call, not a component — reading it
 * from a template or a $derived tracks `locale` (and any newly registered
 * translation) the same way reading any other reactive value does.
 *
 * Known limitation of the shared-state design: two independent players on
 * one page do not get independent locales — the last `setLocale` (or Root's
 * `locale` prop, or the element's DOM-lang resolution) wins for both. A
 * single global embed is the common case this ships for; per-instance
 * locale scoping is not built because nothing today asks for two
 * differently-localized players sharing a page.
 */
import { SvelteMap } from "svelte/reactivity";
import { EN_TERMS, type TermKey } from "./terms.js";

type TermMap = Partial<Record<TermKey, string>>;

// SvelteMap (not a plain Map): `registerTranslation` must be able to update
// a term the current locale already rendered with — e.g. a host that
// registers a locale after the player has already fallen back to English —
// and have `t()` pick it up without a separate `setLocale` nudge.
const translations = new SvelteMap<string, TermMap>([["en", EN_TERMS]]);

let locale = $state<string>("en");

export function getLocale(): string {
  return locale;
}

export function setLocale(next: string): void {
  locale = next;
}

/**
 * Merges `terms` into whatever is already registered for `locale` — a
 * second call for the same locale adds keys, it does not replace the
 * locale's whole term map. Missing keys keep falling back to English.
 */
export function registerTranslation(locale: string, terms: TermMap): void {
  const existing = translations.get(locale) ?? {};
  translations.set(locale, { ...existing, ...terms });
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** Missing-term fallback is English, per-key (not per-locale). */
export function t(
  key: TermKey,
  params?: Record<string, string | number>,
): string {
  const localeTerms = translations.get(locale);
  const template = localeTerms?.[key] ?? EN_TERMS[key];
  return interpolate(template, params);
}

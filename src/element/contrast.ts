/**
 * WCAG 2.x contrast-ratio math (no library — the formula is short and
 * stable; see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance and
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio).
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function srgbChannelToLinear(channel255: number): number {
  const c = channel255 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * WCAG contrast ratio between two colors, order-independent. 1:1 is no
 * contrast (identical colors); 21:1 is the maximum (black on white).
 */
export function computeContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type ContrastPairKind = "text" | "non-text";

export interface ContrastPair {
  /** Human-readable description, including the CSS custom property names. */
  name: string;
  /** Foreground hex. */
  fg: string;
  /** Background hex. */
  bg: string;
  kind: ContrastPairKind;
  /** WCAG AA minimum for this pair's kind: 4.5 for text, 3 for non-text/state/focus. */
  minRatio: number;
}

/**
 * Documented default token pairs from the wrapper's `:host` theming
 * contract (IIIFTranscriptPlayerElement.svelte, `.iiif-tp` style block —
 * see the "Theming contract" comment there). Each pair's `fg`/`bg` are the
 * `var(--iiif-player-*, <fallback>)` defaults as shipped; if a default
 * changes, update the hex here in the same commit — this table is the
 * regression guard, not a description of intent.
 *
 * Deliberately excluded for now: `--iiif-player-border` (currently
 * `#e5e7eb`, ~1.24:1 against white — the 1.4.11 defect the a11y spec's A3
 * fixes) and any focus-outline pair (A3 introduces `--iiif-player-focus`;
 * today's outline uses `currentColor`, which resolves to
 * `--iiif-player-accent-fg` and is white-on-white on the active canvas
 * button). A3 adds both once fixed — do not add them here ahead of that
 * fix or this test fails on the very defect it exists to catch.
 */
export const TOKEN_CONTRAST_PAIRS: ContrastPair[] = [
  {
    name: "base text on player background (--iiif-player-fg / --iiif-player-bg)",
    fg: "#1a1a1a",
    bg: "#ffffff",
    kind: "text",
    minRatio: 4.5,
  },
  {
    name: "control button text on accent (--iiif-player-accent-fg / --iiif-player-accent)",
    fg: "#ffffff",
    bg: "#1d4ed8",
    kind: "text",
    minRatio: 4.5,
  },
  {
    name: "segment text on active-segment background (--iiif-player-segment-fg / --iiif-player-segment-active-bg)",
    fg: "#1a1a1a",
    bg: "#fef3c7",
    kind: "text",
    minRatio: 4.5,
  },
  {
    name: "segment text on highlighted-segment background (--iiif-player-segment-fg / --iiif-player-segment-highlight-bg)",
    fg: "#1a1a1a",
    bg: "#dbeafe",
    kind: "text",
    minRatio: 4.5,
  },
];

import type { TermKey } from "../i18n/terms.js";
import type { PlayerErrorSource } from "./context.js";

/**
 * Maps an error source to the i18n keys for its user-facing headline and
 * detail. Fatal manifest/canvas failures share the "item" message; media and
 * auth are distinct; everything else (playback, or an unknown/null source)
 * falls back to a generic message. Pure — the caller applies `t()`.
 */
export function resolveErrorMessageKeys(source: PlayerErrorSource | null): {
  headline: TermKey;
  detail: TermKey;
} {
  switch (source) {
    case "manifest":
    case "canvas":
      return {
        headline: "player.error.item.headline",
        detail: "player.error.item.detail",
      };
    case "media":
      return {
        headline: "player.error.media.headline",
        detail: "player.error.media.detail",
      };
    case "auth":
      return {
        headline: "player.error.auth.headline",
        detail: "player.error.auth.detail",
      };
    default:
      return {
        headline: "player.error.generic.headline",
        detail: "player.error.generic.detail",
      };
  }
}

import { describe, test, expect } from "vitest";
import { resolveErrorMessageKeys } from "../../lib/player/errorMessages.js";

describe("resolveErrorMessageKeys", () => {
  test("manifest and canvas share the item message", () => {
    expect(resolveErrorMessageKeys("manifest").headline).toBe(
      "player.error.item.headline",
    );
    expect(resolveErrorMessageKeys("canvas").headline).toBe(
      "player.error.item.headline",
    );
  });

  test("media and auth are distinct", () => {
    expect(resolveErrorMessageKeys("media").headline).toBe(
      "player.error.media.headline",
    );
    expect(resolveErrorMessageKeys("auth").headline).toBe(
      "player.error.auth.headline",
    );
  });

  test("playback and null fall back to generic", () => {
    expect(resolveErrorMessageKeys("playback").headline).toBe(
      "player.error.generic.headline",
    );
    expect(resolveErrorMessageKeys(null).headline).toBe(
      "player.error.generic.headline",
    );
  });
});

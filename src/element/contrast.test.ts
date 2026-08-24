import { describe, test, expect } from "vitest";
import { computeContrastRatio, TOKEN_CONTRAST_PAIRS } from "./contrast";

describe("computeContrastRatio", () => {
  test("black on white is the maximum ratio, 21:1", () => {
    expect(computeContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  test("identical colors have a ratio of exactly 1", () => {
    expect(computeContrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  test("is symmetric in argument order", () => {
    expect(computeContrastRatio("#1a1a1a", "#ffffff")).toBeCloseTo(
      computeContrastRatio("#ffffff", "#1a1a1a"),
      10,
    );
  });

  test("white text on the default accent blue clears 4.5:1", () => {
    expect(computeContrastRatio("#ffffff", "#1d4ed8")).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  test("the currently-broken default border is well under 3:1 (documents the A3 defect this table does not yet assert on)", () => {
    // --iiif-player-border defaults to #e5e7eb against a #ffffff
    // background today (IIIFTranscriptPlayerElement.svelte:436). This is
    // the 1.4.11 defect the a11y spec's A3 fixes; TOKEN_CONTRAST_PAIRS
    // deliberately excludes it until A3 lands the fix (see the comment in
    // contrast.ts). This test pins the current numeric defect so the
    // exclusion reads as deliberate, not forgotten.
    expect(computeContrastRatio("#e5e7eb", "#ffffff")).toBeLessThan(3);
  });
});

describe("documented default token pairs meet their WCAG minimum", () => {
  for (const pair of TOKEN_CONTRAST_PAIRS) {
    test(`${pair.name} clears ${pair.minRatio}:1 (${pair.kind})`, () => {
      const ratio = computeContrastRatio(pair.fg, pair.bg);
      expect(ratio).toBeGreaterThanOrEqual(pair.minRatio);
    });
  }
});

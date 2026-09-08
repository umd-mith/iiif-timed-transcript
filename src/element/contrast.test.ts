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

  test("the pre-fix default border (#e5e7eb) was well under 3:1 (pins the 1.4.11 defect the token fix replaced)", () => {
    // --iiif-player-border used to default to #e5e7eb against a #ffffff
    // background — the 1.4.11 defect fixed by darkening the token to
    // #767676 (asserted in the token-pairs block below). This test pins
    // the old value's numeric failure so the history reads as a fixed
    // defect, not an untested assumption.
    expect(computeContrastRatio("#e5e7eb", "#ffffff")).toBeLessThan(3);
  });
});

describe("A3 token pairs (element-hardening/a11y spec)", () => {
  test("--iiif-player-border (#767676) clears 3:1 against bg and control-bg", () => {
    expect(computeContrastRatio("#767676", "#ffffff")).toBeGreaterThanOrEqual(
      3,
    );
    expect(computeContrastRatio("#767676", "#f3f4f6")).toBeGreaterThanOrEqual(
      3,
    );
  });

  test("--iiif-player-focus (#1d4ed8) clears 3:1 against every surface it can outline over", () => {
    expect(computeContrastRatio("#1d4ed8", "#ffffff")).toBeGreaterThanOrEqual(
      3,
    );
    expect(computeContrastRatio("#1d4ed8", "#f3f4f6")).toBeGreaterThanOrEqual(
      3,
    );
    expect(computeContrastRatio("#1d4ed8", "#fef3c7")).toBeGreaterThanOrEqual(
      3,
    );
    expect(computeContrastRatio("#1d4ed8", "#dbeafe")).toBeGreaterThanOrEqual(
      3,
    );
  });

  test("--iiif-player-segment-indicator (#1d4ed8) clears 3:1 against its own state backgrounds", () => {
    expect(computeContrastRatio("#1d4ed8", "#fef3c7")).toBeGreaterThanOrEqual(
      3,
    );
    expect(computeContrastRatio("#1d4ed8", "#dbeafe")).toBeGreaterThanOrEqual(
      3,
    );
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

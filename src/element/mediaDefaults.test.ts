import { describe, test, expect, afterEach } from "vitest";
import {
  getDefaultHlsConstructor,
  setDefaultHlsConstructor,
  resetDefaultHlsConstructor,
} from "./mediaDefaults";
import type { HlsConstructor } from "../lib/media/hlsUtils";

const FakeHls = Object.assign(
  function () {
    return {};
  },
  {
    isSupported: () => true,
    Events: { MANIFEST_PARSED: "p", ERROR: "e" },
  },
) as unknown as HlsConstructor;

describe("mediaDefaults", () => {
  afterEach(() => {
    resetDefaultHlsConstructor();
  });

  test("has no default hls constructor until one is set", () => {
    expect(getDefaultHlsConstructor()).toBeUndefined();
  });

  test("returns the constructor that was set", () => {
    setDefaultHlsConstructor(FakeHls);
    expect(getDefaultHlsConstructor()).toBe(FakeHls);
  });
});

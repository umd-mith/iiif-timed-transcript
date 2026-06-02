import { describe, test, expect } from "vitest";
import * as publicApi from "../lib/index";

describe("public API surface", () => {
  test("exports getPosterUrl from the package root", () => {
    expect(typeof publicApi.getPosterUrl).toBe("function");
  });
});

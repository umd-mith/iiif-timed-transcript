import { describe, it, expect } from "vitest";
import { formatTimestamp, getAnnotationById } from "../../lib/transcript/utils";

describe("formatTimestamp", () => {
  it("formats seconds to MM:SS", () => {
    expect(formatTimestamp(65)).toBe("1:05");
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(3661)).toBe("61:01"); // Over hour
  });
});

describe("getAnnotationById", () => {
  const annotations = [
    { id: "a1", startTime: 0, endTime: 5, text: "First" },
    { id: "a2", startTime: 5, endTime: 10, text: "Second" },
  ];

  it("finds annotation by id", () => {
    const result = getAnnotationById(annotations, "a2");
    expect(result?.text).toBe("Second");
  });

  it("returns null when not found", () => {
    const result = getAnnotationById(annotations, "a99");
    expect(result).toBeNull();
  });
});

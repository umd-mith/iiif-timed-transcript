import { describe, it, expect } from "vitest";
import { formatTimestamp, getAnnotationById } from "../../lib/transcript/utils";

describe("formatTimestamp", () => {
  it("formats seconds to MM:SS for durations under an hour", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(5)).toBe("0:05");
    expect(formatTimestamp(65)).toBe("1:05");
    expect(formatTimestamp(599)).toBe("9:59");
    expect(formatTimestamp(3599)).toBe("59:59");
  });

  it("formats seconds to H:MM:SS for durations of an hour or more", () => {
    expect(formatTimestamp(3600)).toBe("1:00:00");
    expect(formatTimestamp(3661)).toBe("1:01:01");
    expect(formatTimestamp(7200)).toBe("2:00:00");
    expect(formatTimestamp(7384)).toBe("2:03:04");
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

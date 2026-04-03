// src/lib/sync/annotationUtils.test.ts
import { describe, it, expect } from "vitest";
import {
  getActiveAnnotation,
  getActiveAnnotationWithIndex,
  timeToScrollProgress,
  scrollProgressToTime,
} from "../../lib/sync/annotationUtils";
import type { Annotation } from "../../lib/sync/types";

describe("annotationUtils", () => {
  const mockAnnotations: Annotation[] = [
    { id: "a1", startTime: 0, endTime: 5, text: "First" },
    { id: "a2", startTime: 5, endTime: 10, text: "Second" },
    { id: "a3", startTime: 10, endTime: 15, text: "Third" },
  ];

  describe("getActiveAnnotation", () => {
    it("returns null when time is before first annotation", () => {
      const result = getActiveAnnotation(-1, mockAnnotations);
      expect(result).toBeNull();
    });

    it("returns null when time is after last annotation", () => {
      const result = getActiveAnnotation(20, mockAnnotations);
      expect(result).toBeNull();
    });

    it("returns annotation when time exactly at startTime", () => {
      const result = getActiveAnnotation(5, mockAnnotations);
      expect(result?.id).toBe("a2");
    });

    it("at boundary, matches annotation whose startTime equals the time (half-open interval)", () => {
      // time=5 is endTime of a1 and startTime of a2
      // [startTime, endTime) means a1 excludes 5, a2 includes 5
      const result = getActiveAnnotation(5, mockAnnotations);
      expect(result?.id).toBe("a2");
    });

    it("returns first annotation when time is in first range", () => {
      const result = getActiveAnnotation(2.5, mockAnnotations);
      expect(result?.id).toBe("a1");
    });

    it("returns middle annotation when time is in middle range", () => {
      const result = getActiveAnnotation(7, mockAnnotations);
      expect(result?.id).toBe("a2");
    });

    it("returns last annotation when time is in last range", () => {
      const result = getActiveAnnotation(12, mockAnnotations);
      expect(result?.id).toBe("a3");
    });

    it("returns null when annotations array is empty", () => {
      const result = getActiveAnnotation(5, []);
      expect(result).toBeNull();
    });

    it("handles single annotation", () => {
      const single: Annotation[] = [
        { id: "only", startTime: 10, endTime: 20, text: "Only one" },
      ];
      expect(getActiveAnnotation(15, single)?.id).toBe("only");
      expect(getActiveAnnotation(5, single)).toBeNull();
      expect(getActiveAnnotation(25, single)).toBeNull();
    });

    it("returns null when time is in gap between annotations", () => {
      const withGaps: Annotation[] = [
        { id: "a1", startTime: 0, endTime: 5, text: "First" },
        { id: "a2", startTime: 10, endTime: 15, text: "Second" }, // Gap from 5-10
      ];
      const result = getActiveAnnotation(7, withGaps);
      expect(result).toBeNull();
    });

    it("returns narrowest annotation when multiple overlap", () => {
      const overlapping: Annotation[] = [
        { id: "a1", startTime: 0, endTime: 10, text: "First" }, // 10s span
        { id: "a2", startTime: 5, endTime: 8, text: "Second" }, // 3s span — narrower
      ];
      const result = getActiveAnnotation(6, overlapping);
      expect(result?.id).toBe("a2");
    });

    it("returns first match when overlapping annotations have equal span", () => {
      const overlapping: Annotation[] = [
        { id: "a1", startTime: 0, endTime: 10, text: "First" },
        { id: "a2", startTime: 5, endTime: 15, text: "Second" },
      ];
      const result = getActiveAnnotation(7, overlapping);
      // Both have 10s span — first in array wins for stable highlighting
      expect(result?.id).toBe("a1");
    });

    it("handles diarization overlaps (issue #40 SSCCE)", () => {
      const annotations: Annotation[] = [
        { id: "544", startTime: 3717.56, endTime: 3722.45, text: "last question" },
        { id: "545", startTime: 3722.45, endTime: 3723.80, text: "home mean to you?" },
        { id: "546", startTime: 3723.00, endTime: 3729.85, text: "I think home is the foundation" },
        { id: "547", startTime: 3723.00, endTime: 3836.01, text: "All right. That was all the questions" },
        { id: "548", startTime: 3729.99, endTime: 3739.17, text: "denominator for who we are" },
      ];

      // At 3735s: only seg 548 covers this time
      expect(getActiveAnnotation(3735, annotations)?.id).toBe("548");

      // At 3730s: segs 547 and 548 both match — 548 is narrower (9.18s vs 113.01s)
      expect(getActiveAnnotation(3730, annotations)?.id).toBe("548");

      // At 3800s: only seg 547 covers this time
      expect(getActiveAnnotation(3800, annotations)?.id).toBe("547");
    });

    it("selects narrowest match when its startTime equals the query time", () => {
      const annotations: Annotation[] = [
        { id: "broad", startTime: 0, endTime: 20, text: "Broad" },
        { id: "narrow", startTime: 5, endTime: 8, text: "Narrow" },
      ];
      // time === narrow's startTime — early-break must not skip it
      expect(getActiveAnnotation(5, annotations)?.id).toBe("narrow");
    });
  });

  describe("getActiveAnnotationWithIndex", () => {
    it("returns correct index for overlapping annotations", () => {
      const annotations: Annotation[] = [
        { id: "broad", startTime: 0, endTime: 20, text: "Broad" },   // index 0
        { id: "narrow", startTime: 5, endTime: 8, text: "Narrow" },  // index 1
      ];
      const result = getActiveAnnotationWithIndex(6, annotations);
      expect(result?.annotation.id).toBe("narrow");
      expect(result?.index).toBe(1);
    });

    it("returns correct index in diarization data", () => {
      const annotations: Annotation[] = [
        { id: "544", startTime: 3717.56, endTime: 3722.45, text: "last question" },
        { id: "545", startTime: 3722.45, endTime: 3723.80, text: "home mean to you?" },
        { id: "546", startTime: 3723.00, endTime: 3729.85, text: "I think home is the foundation" },
        { id: "547", startTime: 3723.00, endTime: 3836.01, text: "All right. That was all the questions" },
        { id: "548", startTime: 3729.99, endTime: 3739.17, text: "denominator for who we are" },
      ];

      // At 3730s: seg 548 wins (narrower) — verify it returns index 4
      const result = getActiveAnnotationWithIndex(3730, annotations);
      expect(result?.annotation.id).toBe("548");
      expect(result?.index).toBe(4);
    });
  });

  describe("timeToScrollProgress", () => {
    it("returns 0 when duration is 0 (avoids division by zero)", () => {
      expect(timeToScrollProgress(5, 0)).toBe(0);
    });

    it("returns 0 when time is 0", () => {
      expect(timeToScrollProgress(0, 100)).toBe(0);
    });

    it("returns 1 when time equals duration", () => {
      expect(timeToScrollProgress(100, 100)).toBe(1);
    });

    it("returns 0.5 when time is half of duration", () => {
      expect(timeToScrollProgress(50, 100)).toBe(0.5);
    });

    it("clamps negative time to 0", () => {
      expect(timeToScrollProgress(-10, 100)).toBe(0);
    });

    it("clamps time > duration to 1", () => {
      expect(timeToScrollProgress(150, 100)).toBe(1);
    });

    it("handles fractional times correctly", () => {
      expect(timeToScrollProgress(33.333, 100)).toBeCloseTo(0.33333, 5);
    });

    it("handles very small durations", () => {
      expect(timeToScrollProgress(0.5, 1)).toBe(0.5);
    });

    it("handles very large durations", () => {
      const duration = 10000; // 2.7 hours
      expect(timeToScrollProgress(5000, duration)).toBe(0.5);
    });
  });

  describe("scrollProgressToTime", () => {
    it("returns 0 when annotations array is empty", () => {
      expect(scrollProgressToTime(0.5, [])).toBe(0);
    });

    it("returns start time of first annotation at 0% scroll", () => {
      expect(scrollProgressToTime(0, mockAnnotations)).toBe(0);
    });

    it("returns end time of last annotation at 100% scroll", () => {
      expect(scrollProgressToTime(1.0, mockAnnotations)).toBe(15);
    });

    it("clamps negative scroll progress to 0", () => {
      expect(scrollProgressToTime(-0.5, mockAnnotations)).toBe(0);
    });

    it("clamps scroll progress > 1 to last annotation end", () => {
      expect(scrollProgressToTime(1.5, mockAnnotations)).toBe(15);
    });

    it("maps 50% scroll to middle of second annotation (3 annotations)", () => {
      // 3 annotations: 0%, 33.33%, 66.66%, 100%
      // 50% scroll => middle of second annotation (index 1)
      // Exact calculation: 0.5 * 3 = 1.5 => base index 1, local progress 0.5
      // Annotation 2: startTime 5, endTime 10 (range 5s)
      // Result: 5 + (0.5 * 5) = 7.5s
      expect(scrollProgressToTime(0.5, mockAnnotations)).toBe(7.5);
    });

    it("handles single annotation", () => {
      const single: Annotation[] = [
        { id: "only", startTime: 10, endTime: 20, text: "Only" },
      ];

      expect(scrollProgressToTime(0, single)).toBe(10); // Start
      expect(scrollProgressToTime(0.5, single)).toBe(15); // Middle
      expect(scrollProgressToTime(1.0, single)).toBe(20); // End
    });

    it("handles uneven annotation durations correctly", () => {
      const uneven: Annotation[] = [
        { id: "a1", startTime: 0, endTime: 5, text: "Short" }, // 5s
        { id: "a2", startTime: 5, endTime: 55, text: "Long" }, // 50s!
        { id: "a3", startTime: 55, endTime: 60, text: "Short" }, // 5s
      ];

      // Scroll progress maps to annotation index, not duration
      // 0% => ann[0] start = 0s
      // 33.33% => ann[1] start = 5s
      // 66.66% => ann[2] start = 55s
      // 100% => ann[2] end = 60s

      expect(scrollProgressToTime(0, uneven)).toBe(0);
      expect(scrollProgressToTime(1 / 3, uneven)).toBeCloseTo(5, 1); // Start of ann[1]
      expect(scrollProgressToTime(0.5, uneven)).toBeCloseTo(30, 1); // Middle of ann[1]
      expect(scrollProgressToTime(2 / 3, uneven)).toBeCloseTo(55, 1); // Start of ann[2]
      expect(scrollProgressToTime(1.0, uneven)).toBe(60);
    });

    it("handles 24 annotations spanning 0-120s (real-world case from docs)", () => {
      const annotations: Annotation[] = Array.from({ length: 24 }, (_, i) => ({
        id: `seg-${i}`,
        startTime: i * 5,
        endTime: (i + 1) * 5,
        text: `Segment ${i}`,
      }));

      expect(scrollProgressToTime(0, annotations)).toBe(0);
      expect(scrollProgressToTime(0.5, annotations)).toBe(60); // Middle
      expect(scrollProgressToTime(1.0, annotations)).toBe(120); // End
    });

    it("interpolates within annotation range", () => {
      // 3 annotations, scroll 25% => index 0.75
      // Base index: 0, local progress: 0.75
      // Annotation 1: startTime 0, endTime 5 (range 5s)
      // Result: 0 + (0.75 * 5) = 3.75s
      expect(scrollProgressToTime(0.25, mockAnnotations)).toBe(3.75);
    });

    it("handles annotation without endTime gracefully (should not happen)", () => {
      const broken = [
        { id: "broken", startTime: 0, text: "No end time" },
      ] as unknown as Annotation[];
      // endTime is undefined => NaN in calculation
      const result = scrollProgressToTime(0.5, broken);
      expect(Number.isNaN(result)).toBe(true);
    });

    it("returns 0 when annotation at calculated index is undefined (defensive)", () => {
      // This should never happen with valid inputs, but function has defensive check
      const result = scrollProgressToTime(5.0, mockAnnotations); // Way beyond 1.0
      // Clamped to 1.0 => returns last annotation endTime
      expect(result).toBe(15);
    });
  });

  describe("Edge Cases: Boundary Conditions", () => {
    it("getActiveAnnotation: time exactly between annotations", () => {
      // Time 5s is endTime of a1, startTime of a2
      // Condition is time >= startTime && time < endTime
      // So time=5 should match a2 (not a1)
      const result = getActiveAnnotation(5, mockAnnotations);
      expect(result?.id).toBe("a2");
    });

    it("scrollProgressToTime: very small scroll increments", () => {
      const result1 = scrollProgressToTime(0.001, mockAnnotations);
      const result2 = scrollProgressToTime(0.002, mockAnnotations);
      // Should produce slightly different times
      expect(result2).toBeGreaterThan(result1);
    });

    it("scrollProgressToTime: exactly at annotation boundaries", () => {
      // 1/3 of way through 3 annotations = exactly between ann[0] and ann[1]
      const result = scrollProgressToTime(1 / 3, mockAnnotations);
      // exactIndex = 1.0 => base index 1, local progress 0.0
      // Annotation 2: startTime 5, result = 5 + 0 = 5
      expect(result).toBe(5);
    });

    it("timeToScrollProgress: handles Infinity gracefully", () => {
      // time = Infinity, duration = 100
      // Should clamp to 1
      expect(timeToScrollProgress(Infinity, 100)).toBe(1);
    });

    it("scrollProgressToTime: handles NaN scroll progress", () => {
      const result = scrollProgressToTime(NaN, mockAnnotations);
      // NaN clamped via Math.max(0, Math.min(1, NaN)) => 0
      expect(result).toBe(0);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { IIIFManifestCache, type CacheLogger } from "../../lib/iiif/cache";
import type { ManifestData } from "../../lib/iiif/validators";

describe("IIIFManifestCache", () => {
  let cache: IIIFManifestCache;

  const mockManifest: ManifestData = {
    "@context": "http://iiif.io/api/presentation/3/context.json",
    id: "test-manifest",
    type: "Manifest",
    label: { en: ["Test Manifest"] },
    items: [
      {
        id: "test-canvas",
        type: "Canvas",
        width: 800,
        height: 600,
      },
    ],
  };

  beforeEach(() => {
    cache = new IIIFManifestCache({
      maxSize: 10,
      maxAge: 1000,
      enableMemoryMonitoring: true,
    });
  });

  describe("Basic Operations", () => {
    it("should set and get manifest", () => {
      const key = "test-key";
      cache.set(key, mockManifest);

      const retrieved = cache.get(key);
      expect(retrieved).toEqual(mockManifest);
    });

    it("should return undefined for non-existent key", () => {
      const retrieved = cache.get("non-existent");
      expect(retrieved).toBeUndefined();
    });

    it("should clear all entries", () => {
      cache.set("key1", mockManifest);
      cache.set("key2", mockManifest);

      cache.clear();

      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBeUndefined();
    });
  });

  describe("Memory Management", () => {
    it("should track cache metrics", () => {
      cache.set("key1", mockManifest);
      cache.get("key1"); // Hit
      cache.get("key2"); // Miss

      const metrics = cache.getCacheMetrics();

      expect(metrics.size).toBe(1);
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBe(0.5);
      expect(metrics.memoryUsage).toBeGreaterThan(0);
    });

    it("should reject manifests that are too large", () => {
      const largeManifest = {
        ...mockManifest,
        // Create a large manifest by adding many items (should exceed 1MB)
        items: Array(100000).fill(mockManifest.items[0]),
      };

      cache.set("large-key", largeManifest as ManifestData);

      // Should not be cached due to size limit
      const retrieved = cache.get("large-key");
      expect(retrieved).toBeUndefined();
    });

    it("should report health status", () => {
      cache.set("key1", mockManifest);
      // Generate a cache hit to improve hit rate
      cache.get("key1");

      const isHealthy = cache.isHealthy();
      expect(isHealthy).toBe(true);
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate consistent cache keys", () => {
      const key1 = IIIFManifestCache.generateCacheKey("test-id", "manifest");
      const key2 = IIIFManifestCache.generateCacheKey("test-id", "manifest");

      expect(key1).toBe(key2);
      expect(key1).toBe("test-id-manifest");
    });

    it("should generate different keys for different resource types", () => {
      const manifestKey = IIIFManifestCache.generateCacheKey(
        "test-id",
        "manifest",
      );
      const collectionKey = IIIFManifestCache.generateCacheKey(
        "test-id",
        "collection",
      );

      expect(manifestKey).not.toBe(collectionKey);
    });

    it("should generate pending cache keys", () => {
      const pendingKey = IIIFManifestCache.generatePendingCacheKey(
        "test-id",
        "manifest",
      );

      expect(pendingKey).toBe("test-id-manifest-pending");
    });
  });

  describe("Resize Functionality", () => {
    it("should resize cache successfully", () => {
      expect(() => cache.resize(20)).not.toThrow();
    });

    it("should throw error for invalid size", () => {
      expect(() => cache.resize(0)).toThrow(
        "Cache size must be a positive integer",
      );
      expect(() => cache.resize(-5)).toThrow(
        "Cache size must be a positive integer",
      );
      expect(() => cache.resize(1.5)).toThrow(
        "Cache size must be a positive integer",
      );
    });
  });

  describe("Eviction Handling", () => {
    it("should call eviction callback", () => {
      const evictionCallback = vi.fn();
      const testCache = new IIIFManifestCache({
        maxSize: 2,
        onEviction: evictionCallback,
        enableMemoryMonitoring: false, // Disable memory monitoring to focus on size eviction
      });

      testCache.set("key1", mockManifest);
      testCache.set("key2", mockManifest);
      // Force eviction by accessing key1 to make key2 oldest
      testCache.get("key1");
      testCache.set("key3", mockManifest); // Should trigger eviction

      expect(evictionCallback).toHaveBeenCalled();
    });

    it("should track eviction count in metrics", () => {
      const testCache = new IIIFManifestCache({
        maxSize: 2,
        enableMemoryMonitoring: false, // Disable memory monitoring to focus on size eviction
      });

      testCache.set("key1", mockManifest);
      testCache.set("key2", mockManifest);
      // Force eviction by accessing key1 to make key2 oldest
      testCache.get("key1");
      testCache.set("key3", mockManifest); // Should trigger eviction

      const metrics = testCache.getCacheMetrics();
      expect(metrics.evictions).toBeGreaterThan(0);
    });
  });

  describe("Memory Pressure Handling", () => {
    it("should handle memory pressure gracefully", () => {
      const testCache = new IIIFManifestCache({
        maxSize: 100,
        enableMemoryMonitoring: true,
        memoryWarningThreshold: 1, // Very low threshold to trigger pressure
      });

      // Add many entries to trigger memory pressure
      for (let i = 0; i < 50; i++) {
        testCache.set(`key-${i}`, mockManifest);
      }

      // Should not crash and should maintain functionality
      const metrics = testCache.getCacheMetrics();
      expect(metrics.size).toBeLessThanOrEqual(100);
    });

    it("evicts the oldest entries first under memory pressure", () => {
      // Size one entry, then pick a threshold that only the final insert
      // crosses, so a single bulk pressure eviction runs over all 9 prior
      // entries at once — the scenario that distinguishes oldest-first from
      // newest-first eviction.
      const probe = new IIIFManifestCache({ enableMemoryMonitoring: false });
      probe.set("key-0", mockManifest);
      const perEntry = probe.getCacheMetrics().memoryUsage;

      const testCache = new IIIFManifestCache({
        maxSize: 100,
        enableMemoryMonitoring: true,
        memoryWarningThreshold: perEntry * 8.5,
      });

      // Insert oldest -> newest. Pressure trips only when adding key-9.
      for (let i = 0; i < 10; i++) {
        testCache.set(`key-${i}`, mockManifest);
      }

      // Oldest must be gone; a recent (but not the very last) key must survive.
      // With newest-first eviction this assertion inverts. `has()` does not
      // re-trigger the pressure check, so it observes state without disturbing it.
      expect(testCache.has("key-0")).toBe(false);
      expect(testCache.has("key-8")).toBe(true);
      expect(testCache.has("key-9")).toBe(true);
    });
  });

  describe("Logger Integration", () => {
    it("should call logger for cache events when provided", () => {
      const mockLogger: CacheLogger = {
        logEvent: vi.fn(),
        logError: vi.fn(),
      };

      const loggedCache = new IIIFManifestCache({
        maxSize: 10,
        logger: mockLogger,
      });

      loggedCache.set("key1", mockManifest);
      loggedCache.clear();

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        "cache_cleared",
        undefined,
      );
    });

    it("should work without logger", () => {
      const noLoggerCache = new IIIFManifestCache({
        maxSize: 10,
      });

      // Should not throw when no logger is provided
      expect(() => {
        noLoggerCache.set("key1", mockManifest);
        noLoggerCache.get("key1");
        noLoggerCache.clear();
      }).not.toThrow();
    });

    it("should log eviction events", () => {
      const mockLogger: CacheLogger = {
        logEvent: vi.fn(),
        logError: vi.fn(),
      };

      const loggedCache = new IIIFManifestCache({
        maxSize: 2,
        logger: mockLogger,
        enableMemoryMonitoring: false,
      });

      loggedCache.set("key1", mockManifest);
      loggedCache.set("key2", mockManifest);
      loggedCache.get("key1"); // Access key1 to make key2 oldest
      loggedCache.set("key3", mockManifest); // Triggers eviction

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        "cache_eviction",
        expect.objectContaining({ key: "key2" }),
      );
    });
  });
});

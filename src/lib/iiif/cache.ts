import QuickLRU from "quick-lru";
import type { ManifestData } from "./validators.js";

/**
 * Logger interface for cache events
 * Apps can provide their own logging implementation
 */
export interface CacheLogger {
  logEvent: (action: string, data?: Record<string, unknown>) => void;
  logError: (
    action: string,
    error: Error,
    data?: Record<string, unknown>,
  ) => void;
}

/**
 * Configuration options for the IIIF manifest cache
 */
export interface IIIFCacheConfig {
  maxSize?: number;
  maxAge?: number;
  onEviction?: (key: string, value: ManifestData) => void;
  enableMemoryMonitoring?: boolean;
  memoryWarningThreshold?: number; // bytes
  emergencyEvictionEnabled?: boolean;
  /** Optional logger for cache events - if not provided, logging is disabled */
  logger?: CacheLogger;
}

/**
 * Metrics about cache performance and memory usage
 */
export interface CacheMetrics {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
  hitRate: number;
  averageManifestSize: number;
  lastAccess: number;
}

const DEFAULT_CACHE_SIZE = 100;
const DEFAULT_MAX_AGE = 1000 * 60 * 15; // 15 minutes
const DEFAULT_MEMORY_WARNING_THRESHOLD = 50 * 1024 * 1024; // 50MB
const EMERGENCY_EVICTION_THRESHOLD = 0.8; // Evict when 80% full
const MAX_SAFE_MANIFEST_SIZE = 1024 * 1024; // 1MB per manifest

/**
 * Safely converts unknown values to Error objects
 */
function ensureError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  return new Error(String(value));
}

/**
 * LRU cache specialized for IIIF manifests with memory monitoring and metrics tracking.
 *
 * Features:
 * - LRU eviction with configurable max size and TTL
 * - Memory usage estimation and pressure handling
 * - Hit/miss metrics tracking
 * - Optional logging via callback interface (framework-agnostic)
 *
 * @example
 * ```typescript
 * const cache = new IIIFManifestCache({
 *   maxSize: 50,
 *   maxAge: 1000 * 60 * 10, // 10 minutes
 *   logger: {
 *     logEvent: (action, data) => console.log(action, data),
 *     logError: (action, error, data) => console.error(action, error, data)
 *   }
 * });
 *
 * cache.set('manifest-123', manifestData);
 * const manifest = cache.get('manifest-123');
 * ```
 */
export class IIIFManifestCache extends QuickLRU<string, ManifestData> {
  private readonly config: Required<
    Omit<IIIFCacheConfig, "onEviction" | "logger">
  > &
    Pick<IIIFCacheConfig, "onEviction" | "logger">;
  private metrics: CacheMetrics;
  private memoryMonitoringEnabled: boolean;

  constructor(config: IIIFCacheConfig = {}) {
    const fullConfig: Required<Omit<IIIFCacheConfig, "onEviction" | "logger">> &
      Pick<IIIFCacheConfig, "onEviction" | "logger"> = {
      maxSize: config.maxSize ?? DEFAULT_CACHE_SIZE,
      maxAge: config.maxAge ?? DEFAULT_MAX_AGE,
      enableMemoryMonitoring: config.enableMemoryMonitoring ?? true,
      memoryWarningThreshold:
        config.memoryWarningThreshold ?? DEFAULT_MEMORY_WARNING_THRESHOLD,
      emergencyEvictionEnabled: config.emergencyEvictionEnabled ?? true,
      ...(config.onEviction ? { onEviction: config.onEviction } : {}),
      ...(config.logger ? { logger: config.logger } : {}),
    };

    super({
      maxSize: fullConfig.maxSize,
      maxAge: fullConfig.maxAge,
      onEviction: (key, value) => {
        this.metrics.evictions++;
        this.logCacheEvent("cache_eviction", {
          key,
          size: this.estimateManifestSize(value),
        });
        fullConfig.onEviction?.(key, value);
      },
    });

    this.config = fullConfig;
    this.memoryMonitoringEnabled = fullConfig.enableMemoryMonitoring;
    this.metrics = {
      size: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0,
      hitRate: 0,
      averageManifestSize: 0,
      lastAccess: Date.now(),
    };
  }

  /**
   * Logs a cache event if logger is configured
   */
  private logCacheEvent(action: string, data?: Record<string, unknown>) {
    this.config.logger?.logEvent(action, data);
  }

  /**
   * Logs a cache error if logger is configured
   */
  private logCacheError(
    action: string,
    error: unknown,
    data?: Record<string, unknown>,
  ) {
    this.config.logger?.logError(action, ensureError(error), data);
  }

  /**
   * Enhanced get with memory monitoring and circuit breaker
   */
  get(key: string): ManifestData | undefined {
    this.metrics.lastAccess = Date.now();

    // Check memory usage before operation
    if (this.memoryMonitoringEnabled && this.checkMemoryPressure()) {
      this.handleMemoryPressure();
    }

    const result = super.get(key);

    if (result) {
      this.metrics.hits++;
    } else {
      this.metrics.misses++;
    }

    this.updateMetrics();
    return result;
  }

  /**
   * Enhanced set with size validation and memory monitoring
   */
  set(key: string, value: ManifestData): this {
    // Validate manifest size before caching
    const manifestSize = this.estimateManifestSize(value);
    if (manifestSize > MAX_SAFE_MANIFEST_SIZE) {
      this.logCacheEvent("cache_manifest_too_large", { key, manifestSize });
      return this;
    }

    // Check memory pressure before adding
    if (this.memoryMonitoringEnabled && this.checkMemoryPressure()) {
      this.handleMemoryPressure();
    }

    super.set(key, value);
    this.updateMetrics();
    return this;
  }

  /**
   * Estimates the memory footprint of a manifest
   */
  private estimateManifestSize(manifest: ManifestData): number {
    try {
      // Rough estimate: JSON.stringify size * 2 (for object overhead)
      return JSON.stringify(manifest).length * 2;
    } catch (error) {
      this.logCacheError("cache_manifest_size_estimation_failed", error);
      return MAX_SAFE_MANIFEST_SIZE; // Conservative fallback
    }
  }

  /**
   * Checks if memory usage is above threshold
   */
  private checkMemoryPressure(): boolean {
    if (!this.memoryMonitoringEnabled) return false;

    const currentMemory = this.estimateMemoryUsage();
    return currentMemory > this.config.memoryWarningThreshold;
  }

  /**
   * Handles memory pressure by emergency eviction
   */
  private handleMemoryPressure(): void {
    if (!this.config.emergencyEvictionEnabled) return;

    const currentSize = this.size;
    const targetSize = Math.floor(
      currentSize * (1 - EMERGENCY_EVICTION_THRESHOLD),
    );
    const itemsToEvict = currentSize - targetSize;

    this.logCacheEvent("cache_memory_pressure", {
      itemsToEvict,
      currentSize,
      targetSize,
    });

    // Evict oldest items first
    const keysToEvict = [...this.keys()].slice(0, itemsToEvict);
    for (const key of keysToEvict) {
      this.delete(key);
    }
  }

  /**
   * Estimates current memory usage
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, value] of this.entries()) {
      totalSize += key.length * 2; // String overhead
      totalSize += this.estimateManifestSize(value);
    }
    return totalSize;
  }

  /**
   * Updates cache metrics
   */
  private updateMetrics(): void {
    this.metrics.size = this.size;
    this.metrics.hitRate =
      this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0;
    this.metrics.memoryUsage = this.estimateMemoryUsage();
    this.metrics.averageManifestSize =
      this.metrics.size > 0 ? this.metrics.memoryUsage / this.metrics.size : 0;
  }

  /**
   * Gets comprehensive cache metrics
   */
  getCacheMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Checks if cache is healthy (size within limits, memory OK, reasonable hit rate)
   */
  isHealthy(): boolean {
    const metrics = this.getCacheMetrics();
    return (
      metrics.size <= this.config.maxSize &&
      metrics.memoryUsage <= this.config.memoryWarningThreshold &&
      metrics.hitRate >= 0.3 // Minimum 30% hit rate
    );
  }

  /**
   * Resizes the cache to a new maximum size
   */
  resize(newSize: number): void {
    if (!Number.isInteger(newSize) || newSize <= 0) {
      throw new Error("Cache size must be a positive integer");
    }
    if (newSize > 1000) {
      this.logCacheEvent("cache_large_size_requested", { newSize });
    }
    super.resize(newSize);
    this.logCacheEvent("cache_resized", { newSize });
  }

  /**
   * Clears cache and resets metrics
   */
  clear(): void {
    super.clear();
    this.metrics = {
      size: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      memoryUsage: 0,
      hitRate: 0,
      averageManifestSize: 0,
      lastAccess: Date.now(),
    };
    this.logCacheEvent("cache_cleared");
  }

  /**
   * Generates a cache key for IIIF resources
   * @param identifier - The IIIF resource identifier (asset or ingest GUID)
   * @param resourceType - The type of resource ('manifest' or 'collection')
   * @returns A deterministic cache key
   */
  static generateCacheKey(
    identifier: string,
    resourceType: "manifest" | "collection",
  ): string {
    return `${identifier}-${resourceType}`;
  }

  /**
   * Generates a cache key for in-flight requests
   * @param identifier - The IIIF resource identifier
   * @param resourceType - The type of resource
   * @returns A deterministic cache key for pending requests
   */
  static generatePendingCacheKey(
    identifier: string,
    resourceType: "manifest" | "collection",
  ): string {
    return `${identifier}-${resourceType}-pending`;
  }
}

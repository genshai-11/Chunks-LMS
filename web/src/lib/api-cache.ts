/**
 * In-memory API and query caching layer with:
 * - Time-to-live (TTL) expiration
 * - Concurrent in-flight request deduplication
 * - Stale-while-revalidate / cache invalidation helpers
 * - Zero network overhead on frequent page/tab navigation
 */

type CacheEntry<T> = {
  data: T
  cachedAt: number
  expiresAt: number
}

class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private inFlight = new Map<string, Promise<unknown>>()

  /**
   * Fetches data with in-flight deduplication and caching.
   */
  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttlMs?: number; force?: boolean } = {},
  ): Promise<T> {
    const { ttlMs = 30_000, force = false } = options
    const now = Date.now()

    if (!force) {
      const entry = this.cache.get(key)
      if (entry && entry.expiresAt > now) {
        return entry.data as T
      }

      // Check if there is an identical in-flight request
      const pending = this.inFlight.get(key)
      if (pending) {
        return pending as Promise<T>
      }
    }

    const requestPromise = (async () => {
      try {
        const data = await fetcher()
        this.cache.set(key, {
          data,
          cachedAt: Date.now(),
          expiresAt: Date.now() + ttlMs,
        })
        return data
      } finally {
        this.inFlight.delete(key)
      }
    })()

    this.inFlight.set(key, requestPromise)
    return requestPromise
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key)
      return undefined
    }
    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs = 30_000): void {
    this.cache.set(key, {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    })
  }

  invalidate(keyOrPrefix?: string): void {
    if (!keyOrPrefix) {
      this.cache.clear()
      return
    }
    for (const key of this.cache.keys()) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.cache.delete(key)
      }
    }
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    return entry.expiresAt > Date.now()
  }

  size(): number {
    return this.cache.size
  }
}

export const globalApiCache = new ApiCache()

export async function cachedApi<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttlMs?: number; force?: boolean },
): Promise<T> {
  return globalApiCache.fetch(key, fetcher, options)
}

export function invalidateApiCache(keyOrPrefix?: string): void {
  globalApiCache.invalidate(keyOrPrefix)
}

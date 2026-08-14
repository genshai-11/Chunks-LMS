import { describe, expect, it, vi } from 'vitest'
import { cachedApi, globalApiCache, invalidateApiCache } from './api-cache'

describe('api-cache', () => {
  it('caches data within TTL and avoids duplicate fetcher executions', async () => {
    invalidateApiCache()
    const fetcher = vi.fn().mockResolvedValue({ id: 'test-1', value: 42 })

    const res1 = await cachedApi('test:key:1', fetcher, { ttlMs: 5000 })
    const res2 = await cachedApi('test:key:1', fetcher, { ttlMs: 5000 })

    expect(res1).toEqual({ id: 'test-1', value: 42 })
    expect(res2).toEqual({ id: 'test-1', value: 42 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('deduplicates concurrent in-flight requests for the same key', async () => {
    invalidateApiCache()
    let resolvePromise: (val: string) => void
    const slowFetcher = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolvePromise = resolve
        }),
    )

    const req1 = cachedApi('slow:key', slowFetcher, { ttlMs: 5000 })
    const req2 = cachedApi('slow:key', slowFetcher, { ttlMs: 5000 })

    resolvePromise!('done')
    const [val1, val2] = await Promise.all([req1, req2])

    expect(val1).toBe('done')
    expect(val2).toBe('done')
    expect(slowFetcher).toHaveBeenCalledTimes(1)
  })

  it('invalidates cache by exact key or prefix', async () => {
    invalidateApiCache()
    globalApiCache.set('class:1', 'class-1-data', 5000)
    globalApiCache.set('class:2', 'class-2-data', 5000)
    globalApiCache.set('user:1', 'user-1-data', 5000)

    invalidateApiCache('class:')
    expect(globalApiCache.get('class:1')).toBeUndefined()
    expect(globalApiCache.get('class:2')).toBeUndefined()
    expect(globalApiCache.get('user:1')).toBe('user-1-data')

    invalidateApiCache()
    expect(globalApiCache.get('user:1')).toBeUndefined()
  })
})

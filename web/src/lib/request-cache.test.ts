import { afterEach, describe, expect, it } from 'vitest'
import { cachedQuery, clearRequestCache } from './request-cache'

afterEach(() => clearRequestCache())

describe('request cache coalescing', () => {
  it('coalesces StrictMode-style concurrent aggregate loads into one request', async () => {
    let requests = 0
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const fetcher = async () => {
      requests += 1
      await gate
      return { items: Array.from({ length: 49 }) }
    }

    const first = cachedQuery('standalone:assignment-view:a1', fetcher, { ttlMs: 10_000 })
    const second = cachedQuery('standalone:assignment-view:a1', fetcher, { ttlMs: 10_000 })
    release()

    const [a, b] = await Promise.all([first, second])
    expect(requests).toBe(1)
    expect(a).toBe(b)
    expect(a.items).toHaveLength(49)
  })
})

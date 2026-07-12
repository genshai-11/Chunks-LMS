import { describe, expect, it } from 'vitest'
import { aggregateProbeMetrics, attemptNDepth } from './probe-metrics'

describe('probe metrics (n count / n depth)', () => {
  it('treats Green entry as n count and probeCount as n depth', () => {
    // Green + 8 Pass + Done → probeCount 9, enteredProbeFlow true
    const deep = { enteredProbeFlow: true, probeCount: 9 }
    expect(attemptNDepth(deep)).toBe(9)

    const none = { enteredProbeFlow: false, probeCount: 0 }
    expect(attemptNDepth(none)).toBeNull()
  })

  it('aggregates n count, n depth max, and n depth avg from real attempts', () => {
    const agg = aggregateProbeMetrics([
      { enteredProbeFlow: true, probeCount: 9 },
      { enteredProbeFlow: true, probeCount: 1 },
      { enteredProbeFlow: false, probeCount: 0 },
      { enteredProbeFlow: true, probeCount: 2 },
    ])
    expect(agg.nCount).toBe(3)
    expect(agg.nDepthMax).toBe(9)
    expect(agg.nDepthAvg).toBeCloseTo((9 + 1 + 2) / 3, 5)
    expect(agg.probedCount).toBe(3)
  })

  it('returns null depth stats when no probe entries', () => {
    const agg = aggregateProbeMetrics([
      { enteredProbeFlow: false, probeCount: 0 },
      { enteredProbeFlow: false, probeCount: 0 },
    ])
    expect(agg.nCount).toBe(0)
    expect(agg.nDepthMax).toBeNull()
    expect(agg.nDepthAvg).toBeNull()
  })
})

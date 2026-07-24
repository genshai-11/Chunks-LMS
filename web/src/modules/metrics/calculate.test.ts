import { describe, expect, it } from 'vitest'
import { calculateMetrics, compareEqualDurationWindows, type FinalizedAttempt } from './calculate'

function attempts(colors: Array<FinalizedAttempt['effectiveColor']>): FinalizedAttempt[] {
  return colors.map((effectiveColor) => ({
    effectiveColor,
    enteredProbeFlow: false,
    probeEventCount: 0,
  }))
}

describe('metric calculations', () => {
  it('calculates RFC and RAC for 27 red/yellow and 73 green/purple', () => {
    const finalized = [
      ...Array.from({ length: 20 }, () => ({
        effectiveColor: 'red' as const,
        enteredProbeFlow: false,
        probeEventCount: 0,
      })),
      ...Array.from({ length: 7 }, () => ({
        effectiveColor: 'yellow' as const,
        enteredProbeFlow: false,
        probeEventCount: 0,
      })),
      ...Array.from({ length: 50 }, () => ({
        effectiveColor: 'green' as const,
        enteredProbeFlow: false,
        probeEventCount: 0,
      })),
      ...Array.from({ length: 23 }, () => ({
        effectiveColor: 'purple' as const,
        enteredProbeFlow: false,
        probeEventCount: 0,
      })),
    ]
    const metrics = calculateMetrics(finalized)
    const rfc = metrics.find((m) => m.key === 'rfc')!
    const rac = metrics.find((m) => m.key === 'rac')!
    expect(rfc.value).toBeCloseTo(0.27)
    expect(rac.value).toBeCloseTo(0.73)
    expect(rfc.sampleSize).toBe(100)
  })

  it('returns null for empty windows, never zero', () => {
    const metrics = calculateMetrics([])
    for (const m of metrics) {
      if (m.key === 'clarification_depth' || m.key === 'awareness_recovery') {
        expect(m.value).toBeNull()
      } else if (m.key === 'focus_stability') {
        expect(m.value).toBeNull()
      } else {
        expect(m.value).toBeNull()
      }
    }
  })

  it('clarification rate is zero when none probed; depth and recovery null', () => {
    const metrics = calculateMetrics(attempts(['red', 'green', 'purple']))
    expect(metrics.find((m) => m.key === 'clarification_rate')!.value).toBe(0)
    expect(metrics.find((m) => m.key === 'clarification_depth')!.value).toBeNull()
    expect(metrics.find((m) => m.key === 'awareness_recovery')!.value).toBeNull()
  })

  it('excludes non-finalized attempts by construction (caller only passes finalized)', () => {
    // Open probes must not be in the array — domain invariant at call site
    const metrics = calculateMetrics(
      attempts(['green']).map((a) => ({ ...a, enteredProbeFlow: true, probeEventCount: 2 })),
    )
    expect(metrics.find((m) => m.key === 'clarification_rate')!.value).toBe(1)
    expect(metrics.find((m) => m.key === 'clarification_depth')!.value).toBe(3)
    expect(metrics.find((m) => m.key === 'n_count')!.value).toBe(1)
    expect(metrics.find((m) => m.key === 'n_depth_max')!.value).toBe(3)
    expect(metrics.find((m) => m.key === 'n_depth_avg')!.value).toBe(3)
    expect(metrics.find((m) => m.key === 'awareness_recovery')!.value).toBe(1)
  })

  it('chunks number max and avg start at 1 for Green and use real probe depths only', () => {
    const metrics = calculateMetrics([
      { effectiveColor: 'green', enteredProbeFlow: true, probeEventCount: 9 },
      { effectiveColor: 'green', enteredProbeFlow: true, probeEventCount: 1 },
      { effectiveColor: 'red', enteredProbeFlow: false, probeEventCount: 0 },
    ])
    expect(metrics.find((m) => m.key === 'n_count')!.value).toBe(2)
    expect(metrics.find((m) => m.key === 'n_depth_max')!.value).toBe(10)
    expect(metrics.find((m) => m.key === 'n_depth_avg')!.value).toBeCloseTo(6)
  })

  it('compares equal-duration windows with percentage-point deltas', () => {
    const current = attempts(['green', 'green', 'red', 'red'])
    const previous = attempts(['green', 'red', 'red', 'red'])
    const cmp = compareEqualDurationWindows(current, previous)
    // current RAC 0.5, previous RAC 0.25 → +25 pp
    expect(cmp.deltas.rac).toBeCloseTo(25)
    expect(compareEqualDurationWindows(current, null).previous).toBeNull()
  })
})

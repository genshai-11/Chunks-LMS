import { describe, expect, it } from 'vitest'
import {
  calculateMetrics,
  calculateQuestionCpd,
  compareEqualDurationWindows,
  type ColorWeights,
  type FinalizedAttempt,
} from './calculate'

function attempts(colors: Array<FinalizedAttempt['effectiveColor']>): FinalizedAttempt[] {
  return colors.map((effectiveColor) => ({
    effectiveColor,
    enteredProbeFlow: false,
    probeEventCount: 0,
    recordedColors: [effectiveColor],
  }))
}

describe('metric calculations', () => {
  it('calculates RFC and RAC for 27 red/yellow and 73 green/purple', () => {
    const finalized: FinalizedAttempt[] = [
      ...Array.from({ length: 20 }, () => ({
        effectiveColor: 'red' as const,
        enteredProbeFlow: false,
        probeEventCount: 0,
        recordedColors: ['red' as const],
      })),
      ...Array.from({ length: 7 }, () => ({
        effectiveColor: 'yellow' as const,
        enteredProbeFlow: false,
        probeEventCount: 0,
        recordedColors: ['yellow' as const],
      })),
      ...Array.from({ length: 50 }, () => ({
        effectiveColor: 'green' as const,
        enteredProbeFlow: false,
        probeEventCount: 0,
        recordedColors: ['green' as const],
      })),
      ...Array.from({ length: 23 }, () => ({
        effectiveColor: 'purple' as const,
        enteredProbeFlow: false,
        probeEventCount: 0,
        recordedColors: ['purple' as const],
      })),
    ]
    const metrics = calculateMetrics(finalized)
    const rfc = metrics.find((m) => m.key === 'rfc')!
    const rac = metrics.find((m) => m.key === 'rac')!
    expect(rfc.value).toBeCloseTo(0.27)
    expect(rac.value).toBeCloseTo(0.73)
    expect(rfc.sampleSize).toBe(100)
  })

  it('keeps probe steps outside the finalized-main metric denominator', () => {
    const regularAttempts: FinalizedAttempt[] = Array.from({ length: 48 }, () => ({
      effectiveColor: 'green' as const,
      enteredProbeFlow: false,
      probeEventCount: 0,
      recordedColors: ['green' as const],
    }))
    const probedAttempt: FinalizedAttempt = {
      effectiveColor: 'indigo',
      enteredProbeFlow: true,
      probeEventCount: 3,
      recordedColors: ['green', 'blue', 'blue', 'indigo'],
    }

    const metrics = calculateMetrics([...regularAttempts, probedAttempt])
    const rfc = metrics.find((m) => m.key === 'rfc')!
    const rac = metrics.find((m) => m.key === 'rac')!

    expect(rfc.sampleSize).toBe(49)
    expect(rac.sampleSize).toBe(49)
    expect(rfc.value).toBeCloseTo(0)
    expect(rac.value).toBeCloseTo(1)
  })

  it('uses warm effective results for RFC and defines RAC as its exact complement', () => {
    const finalized: FinalizedAttempt[] = [
      { effectiveColor: 'red', enteredProbeFlow: false, probeEventCount: 0 },
      { effectiveColor: 'orange', enteredProbeFlow: false, probeEventCount: 0 },
      {
        effectiveColor: 'yellow',
        enteredProbeFlow: true,
        probeEventCount: 2,
        recordedColors: ['green', 'blue', 'yellow'],
      },
      { effectiveColor: 'green', enteredProbeFlow: false, probeEventCount: 0 },
      { effectiveColor: 'blue', enteredProbeFlow: false, probeEventCount: 0 },
      { effectiveColor: 'indigo', enteredProbeFlow: false, probeEventCount: 0 },
      { effectiveColor: 'purple', enteredProbeFlow: false, probeEventCount: 0 },
    ]
    const metrics = calculateMetrics(finalized)
    const rfc = metrics.find((m) => m.key === 'rfc')!
    const rac = metrics.find((m) => m.key === 'rac')!

    expect(rfc.sampleSize).toBe(7)
    expect(rfc.value).toBeCloseTo(3 / 7)
    expect(rac.value).toBeCloseTo(4 / 7)
    expect(rac.value! + rfc.value!).toBeCloseTo(1)
  })

  it('calculates question-level and average CPD from only the finalized effective result', () => {
    const attempt: FinalizedAttempt = {
      effectiveColor: 'indigo',
      enteredProbeFlow: true,
      probeEventCount: 3,
      recordedColors: ['green', 'blue', 'blue', 'indigo'],
      cvr: 10,
      cci: 6, // Base CPD = 60
    }

    const result = calculateQuestionCpd(attempt)
    expect(result.baseCpd).toBe(60)
    expect(result.colors).toEqual(['indigo'])
    expect(result.questionCpd).toBeCloseTo(60 * (5 / 6))

    // Custom weight test
    const customWeights: ColorWeights = {
      red: 0,
      orange: 0.1,
      yellow: 0.2,
      green: 0.4,
      blue: 0.6,
      indigo: 0.8,
      purple: 1.0,
    }
    const customResult = calculateQuestionCpd(attempt, customWeights)
    expect(customResult.questionCpd).toBeCloseTo(60 * 0.8)
  })

  it('returns null for empty windows, never zero', () => {
    const metrics = calculateMetrics([])
    for (const m of metrics) {
      expect(m.value).toBeNull()
    }
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

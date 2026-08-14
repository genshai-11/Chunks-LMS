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

  it('expands sample size with multi-step probe sequence: 49 base + 3 probe = 52 total', () => {
    // 48 single-question attempts
    const regularAttempts: FinalizedAttempt[] = Array.from({ length: 48 }, () => ({
      effectiveColor: 'green' as const,
      enteredProbeFlow: false,
      probeEventCount: 0,
      recordedColors: ['green' as const],
    }))

    // 1 probed attempt with 3 probe steps: green (start) -> blue -> blue -> indigo (done)
    const probedAttempt: FinalizedAttempt = {
      effectiveColor: 'indigo',
      enteredProbeFlow: true,
      probeEventCount: 3,
      recordedColors: ['green', 'blue', 'blue', 'indigo'],
    }

    const allAttempts = [...regularAttempts, probedAttempt] // 49 questions
    const metrics = calculateMetrics(allAttempts)

    const rfc = metrics.find((m) => m.key === 'rfc')!
    const rac = metrics.find((m) => m.key === 'rac')!

    // Total sample = 48 + 4 = 52
    expect(rfc.sampleSize).toBe(52)
    // All 52 are cool colors (green, blue, indigo)
    expect(rfc.value).toBeCloseTo(0)
    expect(rac.value).toBeCloseTo(1.0)
  })

  it('counts warm colors (Red, Orange, Yellow) correctly across probe sequences', () => {
    const attemptsWithWarm: FinalizedAttempt[] = [
      {
        effectiveColor: 'red',
        enteredProbeFlow: false,
        probeEventCount: 0,
        recordedColors: ['red'],
      },
      {
        effectiveColor: 'orange',
        enteredProbeFlow: false,
        probeEventCount: 0,
        recordedColors: ['orange'],
      },
      // Green probe that failed -> [green, blue, yellow]
      {
        effectiveColor: 'yellow',
        enteredProbeFlow: true,
        probeEventCount: 2,
        recordedColors: ['green', 'blue', 'yellow'],
      },
    ]
    // Total sample = 1 + 1 + 3 = 5 records.
    // Warm colors = red (1) + orange (1) + yellow (1) = 3 warm records.
    // Cool colors = green (1) + blue (1) = 2 cool records.
    const metrics = calculateMetrics(attemptsWithWarm)
    const rfc = metrics.find((m) => m.key === 'rfc')!
    const rac = metrics.find((m) => m.key === 'rac')!

    expect(rfc.sampleSize).toBe(5)
    expect(rfc.value).toBeCloseTo(3 / 5) // 0.6
    expect(rac.value).toBeCloseTo(2 / 5) // 0.4
    expect(rac.value! + rfc.value!).toBeCloseTo(1.0)
  })

  it('calculates question-level and average CPD with dynamic color weights', () => {
    const attempt: FinalizedAttempt = {
      effectiveColor: 'indigo',
      enteredProbeFlow: true,
      probeEventCount: 3,
      recordedColors: ['green', 'blue', 'blue', 'indigo'],
      cvr: 10,
      cci: 6, // Base CPD = 60
    }

    // Default linear weights: green: 0.5, blue: 4/6 (~0.667), indigo: 5/6 (~0.833)
    const result = calculateQuestionCpd(attempt)
    expect(result.baseCpd).toBe(60)

    const expectedMeanWeight = (3 / 6 + 4 / 6 + 4 / 6 + 5 / 6) / 4 // 16/24 = 2/3 ≈ 0.6667
    expect(result.questionCpd).toBeCloseTo(60 * expectedMeanWeight) // 40

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
    // Mean weight: (0.4 + 0.6 + 0.6 + 0.8) / 4 = 2.4 / 4 = 0.6
    expect(customResult.questionCpd).toBeCloseTo(60 * 0.6) // 36
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

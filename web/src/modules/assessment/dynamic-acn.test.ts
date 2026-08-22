import { describe, it, expect } from 'vitest'
import { calculateDynamicAcn, type DynamicAcnInput } from './dynamic-acn'
import { type SpectrumStepBreakdown } from '../metrics/calculate'

function createMockSpectrum(overrides: Partial<SpectrumStepBreakdown> = {}): SpectrumStepBreakdown {
  return {
    byColor: {
      red: 0,
      orange: 0,
      yellow: 0,
      green: 5,
      blue: 2,
      indigo: 1,
      purple: 0
    },
    primaryRecords: 10,
    probeRecords: 3,
    totalRecords: 13,
    warmSteps: 0,
    coolSteps: 8,
    rfc: 0,
    rac: 8 / 13,
    ...overrides
  }
}

describe('calculateDynamicAcn', () => {
  const baseInput: DynamicAcnInput = {
    spectrum: createMockSpectrum(),
    finalizedCount: 10,
    probedCount: 5,
    legacyProbeDepthSum: 15,
    totalItemsCount: 49
  }

  it('calculates v2_completed correctly', () => {
    // totalN = green(5) + blue(2) + indigo(1) = 8
    // nTotal = 13
    // acn = 8 / 10 = 0.8
    const result = calculateDynamicAcn(baseInput, { preset: 'v2_completed' })
    expect(result.acn).toBe(0.8)
    expect(result.formulaDescription).toContain('v2:')
    expect(result.acnTitle).toContain('8 / 10')
  })

  it('calculates v2_completed correctly with 0 finalized items', () => {
    const input = { ...baseInput, finalizedCount: 0 }
    const result = calculateDynamicAcn(input, { preset: 'v2_completed' })
    expect(result.acn).toBe(0)
  })

  it('calculates v2_fixed49 correctly', () => {
    // 8 / 49 ≈ 0.163
    const result = calculateDynamicAcn(baseInput, { preset: 'v2_fixed49' })
    expect(result.acn).toBeCloseTo(8 / 49)
    expect(result.formulaDescription).toContain('v2:')
    expect(result.acnTitle).toContain('8 / 49')
  })

  it('calculates v1_legacy_probe_avg correctly', () => {
    // legacyProbeDepthSum(15) / probedCount(5) = 3
    const result = calculateDynamicAcn(baseInput, { preset: 'v1_legacy_probe_avg' })
    expect(result.acn).toBe(3)
    expect(result.formulaDescription).toContain('v1:')
  })

  it('calculates v1_legacy_probe_avg correctly with 0 probed items', () => {
    const input = { ...baseInput, probedCount: 0 }
    const result = calculateDynamicAcn(input, { preset: 'v1_legacy_probe_avg' })
    expect(result.acn).toBe(0)
  })

  it('calculates custom formula correctly', () => {
    // "totalN * 2" -> 8 * 2 = 16
    const result = calculateDynamicAcn(baseInput, {
      preset: 'custom',
      customFormula: 'totalN * 2'
    })
    expect(result.acn).toBe(16)
  })

  it('handles invalid custom formula safely', () => {
    const result = calculateDynamicAcn(baseInput, {
      preset: 'custom',
      customFormula: 'invalid syntax + -'
    })
    expect(result.acn).toBe(0)
    expect(result.acnTitle).toContain('Error')
  })
})

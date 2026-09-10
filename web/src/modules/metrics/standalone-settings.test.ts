import { describe, expect, it } from 'vitest'
import { mergeMetricSettings } from './settings'
import {
  DEFAULT_STANDALONE_TEST_METRICS,
  evaluateStandaloneFormula,
  mergeStandaloneTestMetrics,
  standaloneMetricLabel,
  type StandaloneFormulaContext,
} from './standalone-settings'

const context: StandaloneFormulaContext = {
  rfc: 35,
  rac: 65,
  avgPercentX: 52.5,
  legacyRac: 65,
  avgCvr: 8,
  avgCci: 4,
  avgCpd: 32,
  acn: 1.25,
  nTotal: 20,
  warmSteps: 7,
  coolSteps: 13,
  finalized: 10,
  total: 12,
}

describe('standalone test metric settings', () => {
  it('defaults package percent to Avg %x and keeps legacy RAC disabled', () => {
    const settings = mergeMetricSettings(null)
    const packagePercent = settings.standaloneTestMetrics.find((metric) => metric.key === 'package_percent')
    const legacyRac = settings.standaloneTestMetrics.find((metric) => metric.key === 'legacy_rac')

    expect(packagePercent?.enabled).toBe(true)
    expect(packagePercent?.formula).toBe('avgPercentX')
    expect(legacyRac?.enabled).toBe(false)
    expect(legacyRac?.formula).toBe('legacyRac')
  })

  it('evaluates runtime formulas with whitelisted variables only', () => {
    expect(evaluateStandaloneFormula('(avgPercentX + legacyRac) / 2', context)).toBe(58.75)
    expect(evaluateStandaloneFormula('warmSteps / nTotal * 100', context)).toBe(35)
    expect(evaluateStandaloneFormula('window.location', context)).toBeNull()
    expect(evaluateStandaloneFormula('avgPercentX / 0', context)).toBeNull()
  })

  it('merges custom standalone metrics after defaults', () => {
    const merged = mergeStandaloneTestMetrics([
      { key: 'package_percent', enabled: true, label: 'Wrong label', formula: 'avgPercentX', unit: 'percent' },
      { key: 'custom_balance', enabled: true, label: 'Balance', formula: '(avgPercentX + legacyRac) / 2', unit: 'percent' },
    ])

    expect(merged.slice(0, DEFAULT_STANDALONE_TEST_METRICS.length).map((metric) => metric.key)).toEqual(
      DEFAULT_STANDALONE_TEST_METRICS.map((metric) => metric.key),
    )
    expect(merged.at(-1)).toMatchObject({
      key: 'custom_balance',
      label: 'Balance',
      formula: '(avgPercentX + legacyRac) / 2',
      custom: true,
    })
  })

  it('auto-labels package percent as %r for R packages and %c otherwise', () => {
    const metric = DEFAULT_STANDALONE_TEST_METRICS.find((item) => item.key === 'package_percent')!

    expect(standaloneMetricLabel(metric, 'R-Pretest')).toBe('%r')
    expect(standaloneMetricLabel(metric, 'G-Posttest')).toBe('%c')
    expect(standaloneMetricLabel(metric, 'General package')).toBe('%c')
  })
})

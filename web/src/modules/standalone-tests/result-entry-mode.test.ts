import { describe, expect, it } from 'vitest'
import {
  correctionColorForShortcut,
  isStandaloneCorrectionMode,
  optimisticStandaloneProbePatch,
  standaloneResultColorChoices,
} from './result-entry-mode'

describe('standalone result entry mode', () => {
  it('keeps unanswered initial scoring on the four primary observation colors', () => {
    expect(standaloneResultColorChoices('draft')).toEqual([
      'red',
      'orange',
      'green',
      'purple',
    ])
    expect(correctionColorForShortcut('draft', 'f')).toBeNull()
    expect(correctionColorForShortcut('probe_open', 'd')).toBeNull()
  })

  it('exposes all seven colors and F/C/D shortcuts for finalized corrections', () => {
    expect(standaloneResultColorChoices('finalized')).toEqual([
      'red',
      'orange',
      'yellow',
      'green',
      'blue',
      'indigo',
      'purple',
    ])
    expect(correctionColorForShortcut('finalized', 'f')).toBe('yellow')
    expect(correctionColorForShortcut('corrected', 'c')).toBe('blue')
    expect(correctionColorForShortcut('corrected', 'd')).toBe('indigo')
  })

  it('switches optimistic Done/Indigo to correction mode before persistence resolves', () => {
    const optimistic = optimisticStandaloneProbePatch('done', 0, 2)
    expect(optimistic).toMatchObject({
      status: 'finalized',
      effective_color: 'indigo',
      client_revision: 2,
    })
    expect(isStandaloneCorrectionMode(optimistic.status)).toBe(true)
    expect(correctionColorForShortcut(optimistic.status, 'f')).toBe('yellow')
  })
})

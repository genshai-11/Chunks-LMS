import { describe, expect, it } from 'vitest'
import { PROBE_ACTIONS } from './probe-actions'

describe('probe action presentation', () => {
  it('maps neutral Fail, Pass, Done labels to existing lifecycle outcomes', () => {
    expect(PROBE_ACTIONS.map(({ label, outcome }) => [label, outcome])).toEqual([
      ['Fail', 'fail'],
      ['Pass', 'continue'],
      ['Done', 'done'],
    ])
  })

  it('uses visible-label keyboard shortcuts', () => {
    expect(PROBE_ACTIONS.map(({ label, shortcut }) => [label, shortcut])).toEqual([
      ['Fail', 'F'],
      ['Pass', 'P'],
      ['Done', 'D'],
    ])
  })
})

import { describe, expect, it } from 'vitest'
import {
  LIVE_TEST_RAIL_DEFAULT,
  LIVE_TEST_RAIL_MAX,
  LIVE_TEST_RAIL_MIN,
  resolveLiveTestAudioPanelOpen,
  resolveLiveTestRailWidth,
} from './live-test-layout'

describe('live-test layout defaults', () => {
  it('uses a balanced desktop rail by default and clamps legacy oversized values', () => {
    expect(resolveLiveTestRailWidth(null)).toBe(LIVE_TEST_RAIL_DEFAULT)
    expect(resolveLiveTestRailWidth('not-a-number')).toBe(LIVE_TEST_RAIL_DEFAULT)
    expect(resolveLiveTestRailWidth('460')).toBe(LIVE_TEST_RAIL_MAX)
    expect(resolveLiveTestRailWidth('100')).toBe(LIVE_TEST_RAIL_MIN)
    expect(resolveLiveTestRailWidth('320')).toBe(320)
  })

  it('starts audio collapsed for new users while respecting an explicit saved choice', () => {
    expect(resolveLiveTestAudioPanelOpen(null)).toBe(false)
    expect(resolveLiveTestAudioPanelOpen('false')).toBe(false)
    expect(resolveLiveTestAudioPanelOpen('true')).toBe(true)
  })
})

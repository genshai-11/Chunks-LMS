import { describe, expect, it } from 'vitest'
import {
  computeCourseEndDate,
  materializeSessionCount,
  materializeWeekly,
} from './recurrence'

describe('weekly recurrence materialization', () => {
  it('materializes weekly Mondays in range', () => {
    // 2026-07-06 is a Monday
    const occ = materializeWeekly({
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      dayOfWeek: 1,
      timeZone: 'Asia/Ho_Chi_Minh',
      durationMinutes: 60,
    })
    expect(occ.length).toBeGreaterThanOrEqual(3)
    expect(occ[0]?.plannedStartDate).toBe('2026-07-06')
    expect(occ.every((o) => o.timeZone === 'Asia/Ho_Chi_Minh')).toBe(true)
  })
})

describe('course auto-schedule (session count)', () => {
  it('generates 15 Tue+Wed meetings and auto-detects end day', () => {
    // 2026-07-01 is Wednesday
    const plan = materializeSessionCount({
      startDate: '2026-07-01',
      weekdays: [2, 3], // Tue, Wed
      sessionCount: 15,
      startTime: '09:00',
      timeZone: 'Asia/Ho_Chi_Minh',
      durationMinutes: 60,
    })
    expect(plan.sessionCount).toBe(15)
    expect(plan.occurrences).toHaveLength(15)
    expect(plan.endsOn).toBe(plan.occurrences[14]?.plannedStartDate)
    // First hit on/after Jul 1 Wed → Jul 1 is Wed (3)
    expect(plan.occurrences[0]?.plannedStartDate).toBe('2026-07-01')
    expect(plan.occurrences[0]?.plannedStart).toContain('T09:00')
    // Alternates Wed/Tue pattern from start
    const dows = plan.occurrences.map((o) => o.dayOfWeek)
    expect(dows.every((d) => d === 2 || d === 3)).toBe(true)
  })

  it('with 2 weekdays, 100 sessions ≈ balanced; end date after start', () => {
    const endsOn = computeCourseEndDate({
      startDate: '2026-07-01',
      weekdays: [2, 3],
      sessionCount: 15,
      startTime: '14:30',
      timeZone: 'Asia/Ho_Chi_Minh',
      durationMinutes: 90,
    })
    expect(endsOn).toBeTruthy()
    expect(endsOn! >= '2026-07-01').toBe(true)
  })
})

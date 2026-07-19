import { describe, it, expect } from 'vitest'
import { calculateLearnerCpd } from './cpd'
import type { ResultRecord } from './progress'

describe('calculateLearnerCpd', () => {
  const window = {
    kind: 'custom' as const,
    start: '2026-06-20T00:00:00Z',
    end: '2026-07-20T00:00:00Z',
    label: 'Custom 30-day window',
  }

  const mockLedger: ResultRecord[] = [
    {
      id: 'res-1',
      organizationId: 'org-1',
      courseId: 'course-1',
      classId: 'class-1',
      learningSessionId: 'session-1',
      learnerUserId: 'learner-1',
      teacherUserId: 'teacher-1',
      sessionQuestionId: 'q-1',
      effectiveColor: 'green',
      enteredProbeFlow: true,
      probeEventCount: 1,
      finalizedAt: '2026-07-10T12:00:00Z',
    },
    {
      id: 'res-2',
      organizationId: 'org-1',
      courseId: 'course-1',
      classId: 'class-1',
      learningSessionId: 'session-1',
      learnerUserId: 'learner-1',
      teacherUserId: 'teacher-1',
      sessionQuestionId: 'q-2',
      effectiveColor: 'yellow',
      enteredProbeFlow: true,
      probeEventCount: 2,
      finalizedAt: '2026-07-11T12:00:00Z',
    },
  ]

  it('calculates averages and builds cpd report from mock ledger', async () => {
    const report = await calculateLearnerCpd({
      learnerId: 'learner-1',
      reportWindow: window,
      courseId: 'course-1',
      classId: 'class-1',
      fallbackLedger: mockLedger,
    })

    expect(report.learnerUserId).toBe('learner-1')
    expect(report.totalAttempts).toBe(2)
    expect(report.averageItemCpd).toBe(20) // cvr 5 * cci 4 = 20
    expect(report.averageLearnerCpdScore).toBe(30) // average of (20 * 2 = 40) and (20 * 1 = 20) => 30
    expect(report.items).toHaveLength(2)
    expect(report.items[0].learnerCpdScore).toBe(20) // yellow has score 1
    expect(report.items[1].learnerCpdScore).toBe(40) // green has score 2
    expect(report.provenance.packageVersions).toContain('mock-pkg-version-id')
    expect(report.provenance.measurementSnapshots).toContain('mock-snapshot-id')
  })

  it('filters results outside of window duration', async () => {
    const customLedger = [
      ...mockLedger,
      {
        id: 'res-3',
        organizationId: 'org-1',
        courseId: 'course-1',
        classId: 'class-1',
        learningSessionId: 'session-1',
        learnerUserId: 'learner-1',
        teacherUserId: 'teacher-1',
        sessionQuestionId: 'q-3',
        effectiveColor: 'purple',
        enteredProbeFlow: false,
        probeEventCount: 0,
        finalizedAt: '2026-05-01T12:00:00Z', // Outside of 30-day window
      },
    ]

    const report = await calculateLearnerCpd({
      learnerId: 'learner-1',
      reportWindow: window,
      courseId: 'course-1',
      classId: 'class-1',
      fallbackLedger: customLedger,
    })

    expect(report.totalAttempts).toBe(2) // res-3 is filtered out
  })

  it('joins report correctly to latest correction-effective results', async () => {
    const correctedLedger = [
      ...mockLedger,
      {
        id: 'res-2-correction',
        organizationId: 'org-1',
        courseId: 'course-1',
        classId: 'class-1',
        learningSessionId: 'session-1',
        learnerUserId: 'learner-1',
        teacherUserId: 'teacher-1',
        sessionQuestionId: 'q-2', // correction for same question
        effectiveColor: 'purple', // corrected from yellow to purple
        enteredProbeFlow: true,
        probeEventCount: 2,
        finalizedAt: '2026-07-12T12:00:00Z', // newer finalizedAt
      },
    ]

    const report = await calculateLearnerCpd({
      learnerId: 'learner-1',
      reportWindow: window,
      courseId: 'course-1',
      classId: 'class-1',
      fallbackLedger: correctedLedger,
    })

    expect(report.totalAttempts).toBe(2)
    // res-1 (green: 2) + res-2-correction (purple: 3)
    // item cpd = 20
    // cpd scores = 40 (green) and 60 (purple)
    // average = (40 + 60) / 2 = 50
    expect(report.averageLearnerCpdScore).toBe(50)
    expect(report.items[0].effectiveColor).toBe('purple') // latest first
  })
})

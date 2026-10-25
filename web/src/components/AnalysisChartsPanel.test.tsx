import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AnalysisChartsPanel } from './AnalysisChartsPanel'
import type { ResultRecord } from '../modules/reporting/progress'

const sessions = [
  { id: 's-1', sessionNumber: 1, startedAt: '2026-07-01T09:00:00.000Z', completedAt: '2026-07-01T10:00:00.000Z' },
  { id: 's-2', sessionNumber: 2, startedAt: '2026-07-02T09:00:00.000Z', completedAt: '2026-07-02T10:00:00.000Z' },
]

function makeRecord(id: string, overrides: Partial<ResultRecord> = {}): ResultRecord {
  return {
    id,
    organizationId: 'org-1',
    courseId: 'crs-1',
    classId: 'cls-1',
    teacherUserId: 't-1',
    learningSessionId: 's-1',
    learnerUserId: 'l-1',
    sessionQuestionId: `q-${id}`,
    effectiveColor: 'green',
    enteredProbeFlow: false,
    probeEventCount: 0,
    finalizedAt: '2026-07-01T09:10:00.000Z',
    ...overrides,
  }
}

const ledger: ResultRecord[] = [
  // Session 1: 2 questions for learner 1
  makeRecord('rec-1', { learningSessionId: 's-1', learnerUserId: 'l-1', finalizedAt: '2026-07-01T09:10:00.000Z' }),
  makeRecord('rec-2', { learningSessionId: 's-1', learnerUserId: 'l-1', finalizedAt: '2026-07-01T09:20:00.000Z' }),
  // Session 2: 2 questions for learner 1, 1 question for learner 2
  makeRecord('rec-3', { learningSessionId: 's-2', learnerUserId: 'l-1', finalizedAt: '2026-07-02T09:10:00.000Z' }),
  makeRecord('rec-4', { learningSessionId: 's-2', learnerUserId: 'l-1', finalizedAt: '2026-07-02T09:20:00.000Z' }),
  makeRecord('rec-5', { learningSessionId: 's-2', learnerUserId: 'l-2', finalizedAt: '2026-07-02T09:30:00.000Z' }),
]

describe('AnalysisChartsPanel day and learner isolation', () => {
  it('numbers questions from Q1 within each session instead of continuing from previous session', () => {
    render(
      <AnalysisChartsPanel
        ledger={ledger}
        learningSessions={sessions}
        courseId="crs-1"
        classId="cls-1"
        selectedSessionNumber={2}
        selectedSessionId="s-2"
        selectedLearnerIds={['l-1']}
      />,
    )

    // Only session 2 for learner 1 has 2 attempts
    // Only session 2 for learner 1 has 2 attempts out of 4 total for learner 1
    expect(screen.getByText('2/4 attempts')).toBeInTheDocument()

    // Question labels for Day 2 must start from Q1 and Q2, NOT Q3 and Q4!
    expect(screen.getByText('Q1')).toBeInTheDocument()
    expect(screen.getByText('Q2')).toBeInTheDocument()
    expect(screen.queryByText('Q3')).not.toBeInTheDocument()
    expect(screen.queryByText('A3')).not.toBeInTheDocument()
  })

  it('filters strictly by selectedLearnerIds and does not output full class', () => {
    render(
      <AnalysisChartsPanel
        ledger={ledger}
        learningSessions={sessions}
        courseId="crs-1"
        classId="cls-1"
        selectedLearnerIds={['l-2']}
        learnerName="Learner Two"
      />,
    )

    // Learner 2 has only 1 attempt in the entire ledger
    expect(screen.getByText('1/1 attempts')).toBeInTheDocument()
    expect(screen.getByText('Learner Two')).toBeInTheDocument()
  })

  it('filters to the selected session when selectedSessionNumber is provided', () => {
    render(
      <AnalysisChartsPanel
        ledger={ledger}
        learningSessions={sessions}
        courseId="crs-1"
        classId="cls-1"
        selectedSessionNumber={1}
        selectedSessionId="s-1"
      />,
    )

    // Session 1 has only 2 attempts
    // Session 1 has only 2 attempts out of 5 total in the class
    expect(screen.getByText('2/5 attempts')).toBeInTheDocument()
  })
})

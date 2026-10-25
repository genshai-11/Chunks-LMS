import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressAnalysisView } from './ProgressAnalysisView'
import type { ResultRecord } from '../modules/reporting/progress'
import type { DomainUser } from '../modules/roster/types'

const users: DomainUser[] = ['One', 'Two', 'Three'].map((name, i) => ({
  id: `learner-${i + 1}`,
  displayName: `Learner ${name}`,
  email: null,
  avatarUrl: null,
  roles: ['learner'],
  accountStatus: 'active',
}))
const learningSessions = [3, 6].map((day) => ({
  id: `day-${day}`,
  sessionNumber: day,
  startedAt: '2026-07-10T09:00:00.000Z',
  completedAt: '2026-07-10T11:00:00.000Z',
}))
function result(id: string, overrides: Partial<ResultRecord> = {}): ResultRecord {
  return {
    id,
    organizationId: 'org',
    courseId: 'course',
    classId: 'class',
    teacherUserId: 'teacher',
    learningSessionId: 'day-3',
    learnerUserId: 'learner-2',
    sessionQuestionId: `question-${id}`,
    effectiveColor: 'purple',
    enteredProbeFlow: false,
    probeEventCount: 0,
    finalizedAt: '2026-07-10T10:00:00.000Z',
    ...overrides,
  }
}
const ledger = [
  result('direct'),
  result('probe', { effectiveColor: 'indigo', enteredProbeFlow: true, probeEventCount: 2 }),
  result('other-day', { learningSessionId: 'day-6', effectiveColor: 'orange' }),
  result('other-person', { learnerUserId: 'learner-1', effectiveColor: 'red' }),
  result('third-person', { learnerUserId: 'learner-3', effectiveColor: 'red' }),
  result('other-class', { classId: 'other-class', effectiveColor: 'red' }),
  result('other-course', { courseId: 'other-course', effectiveColor: 'red' }),
]
const props = {
  mode: 'teacher' as const,
  courseId: 'course',
  courseCode: 'ME-QA',
  courseStart: '2026-07-01',
  courseEnd: '2026-08-01',
  classId: 'class',
  learnerUserId: 'learner-2',
  users,
  ledger,
  learningSessions,
}

beforeEach(() => {
  // jsdom has no layout observer; reporting and chart components remain real.
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('ProgressAnalysisView day reports', () => {
  it('opens only the selected learner and session even when different days share timestamps', async () => {
    const user = userEvent.setup()
    render(<ProgressAnalysisView {...props} />)
    await user.click(screen.getByRole('button', { name: 'By day' }))
    const dayTable = screen.getByRole('table', { name: 'Progress by day' })
    const day3 = within(dayTable).getByRole('row', { name: /Day 3/ })
    expect(within(day3).getAllByRole('cell')[0]).toHaveTextContent(/^2$/)
    await user.click(within(day3).getByRole('button', { name: 'Open' }))

    expect(screen.getByRole('button', { name: 'One day' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('combobox')).toHaveValue('day-3')
    expect(screen.getByText('2 finalized')).toBeInTheDocument()
    expect(screen.getAllByText(/N_total\s*=\s*4/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Results' }))
    const results = screen.getByRole('table', { name: 'Assessment results ledger' })
    expect(within(results).getAllByRole('row')).toHaveLength(3)
    expect(within(results).queryByText(/Day 6/)).not.toBeInTheDocument()
    expect(within(results).queryByText('Red')).not.toBeInTheDocument()
    expect(within(results).queryByText('Orange')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'By day' }))
    const day6 = within(screen.getByRole('table', { name: 'Progress by day' }))
      .getByRole('row', { name: /Day 6/ })
    await user.click(within(day6).getByRole('button', { name: 'Open' }))
    expect(screen.getByText('1 finalized')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('day-6')
  }, 15000)

  it('uses only the selected learners for aggregate metrics and keeps selection on a users refresh', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<ProgressAnalysisView {...props} initialSessionId="day-3" />)
    await user.click(screen.getByRole('button', { name: 'Learner Two' }))
    await user.click(screen.getByRole('checkbox', { name: 'Learner One' }))
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByText('3 finalized')).toBeInTheDocument()
    // One red step among five steps; Learner Three's red must not affect RFC.
    expect(screen.getAllByText('20.0%').length).toBeGreaterThan(0)
    rerender(<ProgressAnalysisView {...props} users={users.map((u) => ({ ...u }))} initialSessionId="day-3" />)
    expect(screen.getByRole('button', { name: '2 learners' })).toBeInTheDocument()
    expect(screen.getByText('3 finalized')).toBeInTheDocument()
  }, 15000)

  it('does not substitute another day when an explicit session is missing', async () => {
    const user = userEvent.setup()
    render(<ProgressAnalysisView {...props} initialSessionId="missing-session" />)
    await user.click(screen.getByRole('button', { name: 'Results' }))
    expect(screen.queryByRole('table', { name: 'Assessment results ledger' })).not.toBeInTheDocument()
    expect(screen.queryByText(/\d+ finalized/)).not.toHaveTextContent(/[1-9]\d* finalized/)
  })
})

describe('ProgressAnalysisView Edit Day persistence feedback', () => {
  it('keeps the edit open while saving, retains failures, and closes only after a successful retry', async () => {
    const user = userEvent.setup()
    let finishSave: (result?: SessionNumberSaveResult) => void = () => { throw new Error('Save has not started') }
    let failSave: (error: Error) => void = () => { throw new Error('Save has not started') }
    const save = () => new Promise<SessionNumberSaveResult>((resolve, reject) => {
      finishSave = (res) => resolve(res ?? { ok: true, persistence: 'cloud' })
      failSave = reject
    })
    render(<ProgressAnalysisView {...props} onEditSessionNumber={save} />)
    await user.click(screen.getByRole('button', { name: 'By day' }))
    const day3 = within(screen.getByRole('table', { name: 'Progress by day' }))
      .getByRole('row', { name: /Day 3/ })
    await user.click(within(day3).getByRole('button', { name: 'Edit Day' }))
    await user.clear(screen.getByRole('spinbutton'))
    await user.type(screen.getByRole('spinbutton'), '7')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(screen.getByRole('heading', { name: 'Edit Session Day' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Saving/ })).toBeDisabled()
    await act(async () => failSave(new Error('Cloud rejected the day change')))
    expect(screen.getByRole('alert')).toHaveTextContent('Cloud rejected the day change')
    expect(screen.getByRole('spinbutton')).toHaveValue(7)
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))
    await act(async () => finishSave())
    expect(screen.queryByRole('heading', { name: 'Edit Session Day' })).not.toBeInTheDocument()
  }, 15000)
})

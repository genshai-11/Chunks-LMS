import { describe, expect, it, vi } from 'vitest'
import type { RosterState } from '../modules/roster/types'
import { loadLiveLedger, SUPABASE_IN_FILTER_BATCH_SIZE } from './live-assessment'

const mocked = vi.hoisted(() => ({
  supabase: null as unknown,
}))

vi.mock('./supabase', () => ({
  getSupabase: () => mocked.supabase,
}))

type QueryState = {
  table: string
  select: string
  filters: Array<{ column: string; values: string[] }>
}

describe('loadLiveLedger', () => {
  it('batches large snapshot attempt_id filters so Supabase URLs stay bounded', async () => {
    const attemptIds = Array.from(
      { length: SUPABASE_IN_FILTER_BATCH_SIZE * 2 + 5 },
      (_, index) => `attempt-${index}`,
    )
    const attemptIdBatchSizes: number[] = []

    mocked.supabase = {
      from(table: string) {
        const state: QueryState = { table, select: '', filters: [] }
        const builder = {
          select(select: string) {
            state.select = select
            return builder
          },
          in(column: string, values: string[]) {
            state.filters.push({ column, values: [...values] })
            if (table === 'assessment_attempt_snapshots' && column === 'attempt_id') {
              attemptIdBatchSizes.push(values.length)
            }
            return builder
          },
          then(resolve: (value: { data: unknown[]; error: null }) => void) {
            resolve({ data: rowsFor(state), error: null })
          },
        }
        return builder
      },
    }

    const roster = {
      organization: { id: 'org-1' },
      classes: [{ id: 'class-1', courseId: 'course-1' }],
      users: [],
      courses: [],
      enrollments: [],
    } as unknown as RosterState

    const result = await loadLiveLedger(roster)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toHaveLength(attemptIds.length)
    expect(attemptIdBatchSizes).toEqual([100, 100, 5])

    function rowsFor(state: QueryState): unknown[] {
      if (state.table === 'learning_sessions') return [{ id: 'session-1', class_id: 'class-1' }]
      if (state.table === 'assessment_attempts') {
        return attemptIds.map((id) => ({
          id,
          learning_session_id: 'session-1',
          session_question_id: `question-${id}`,
          learner_user_id: `learner-${id}`,
          teacher_user_id: 'teacher-1',
        }))
      }
      if (state.table === 'assessment_attempt_snapshots') {
        const batch = state.filters.find((filter) => filter.column === 'attempt_id')?.values ?? []
        return batch.map((attemptId) => ({
          attempt_id: attemptId,
          status: 'finalized',
          provisional_color: 'green',
          effective_color: 'green',
          effective_score: 2,
          probe_count: 0,
          max_probe_count: 2,
          entered_probe_flow: false,
          finalized_at: '2026-07-16T04:00:00.000Z',
          updated_at: '2026-07-16T04:00:00.000Z',
        }))
      }
      return []
    }
  })
})

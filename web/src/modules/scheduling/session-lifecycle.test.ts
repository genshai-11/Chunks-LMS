import { describe, expect, it } from 'vitest'
import {
  cancelScheduledSession,
  completeLearningSession,
  createScheduledSession,
  emptySchedulingState,
  recordAttendance,
  rescheduleSession,
  startLearningSession,
} from './session-lifecycle'

const classId = 'class-1'
const learners = ['l1', 'l2', 'l3']

describe('session lifecycle and attendance', () => {
  it('starts a session from schedule without changing planned start', () => {
    let state = emptySchedulingState()
    const created = createScheduledSession(state, {
      classId,
      plannedStart: '2026-07-15T09:00:00.000Z',
      durationMinutes: 60,
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    state = created.state
    const planned = created.value.plannedStart

    const started = startLearningSession(state, {
      classId,
      scheduledSessionId: created.value.id,
      at: '2026-07-15T09:05:00.000Z',
    })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(started.state.scheduledSessions[0]?.plannedStart).toBe(planned)
    expect(started.value.status).toBe('open')
  })

  it('rejects duplicate starts for same occurrence / open class session', () => {
    let state = emptySchedulingState()
    const created = createScheduledSession(state, {
      classId,
      plannedStart: '2026-07-15T09:00:00.000Z',
      durationMinutes: 60,
    })
    if (!created.ok) throw new Error(created.error)
    state = created.state

    const first = startLearningSession(state, {
      classId,
      scheduledSessionId: created.value.id,
    })
    if (!first.ok) throw new Error(first.error)
    state = first.state

    const dup = startLearningSession(state, {
      classId,
      scheduledSessionId: created.value.id,
    })
    expect(dup.ok).toBe(false)

    const secondOpen = startLearningSession(state, { classId })
    expect(secondOpen.ok).toBe(false)
  })

  it('requires attendance for all expected learners before completion', () => {
    let state = emptySchedulingState()
    const started = startLearningSession(state, { classId })
    if (!started.ok) throw new Error(started.error)
    state = started.state

    const incomplete = completeLearningSession(state, started.value.id, learners)
    expect(incomplete.ok).toBe(false)

    for (const learnerId of learners) {
      const att = recordAttendance(state, {
        learningSessionId: started.value.id,
        learnerUserId: learnerId,
        status: 'present',
      })
      if (!att.ok) throw new Error(att.error)
      state = att.state
    }

    const done = completeLearningSession(state, started.value.id, learners)
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.value.status).toBe('completed')

    const after = recordAttendance(state, {
      learningSessionId: started.value.id,
      learnerUserId: learners[0]!,
      status: 'late',
    })
    // state still open until we use done.state
    const afterDone = recordAttendance(done.state, {
      learningSessionId: started.value.id,
      learnerUserId: learners[0]!,
      status: 'late',
    })
    expect(afterDone.ok).toBe(false)
    expect(after.ok).toBe(true)
  })

  it('cancels and reschedules without deleting original history', () => {
    let state = emptySchedulingState()
    const created = createScheduledSession(state, {
      classId,
      plannedStart: '2026-07-20T09:00:00.000Z',
      durationMinutes: 45,
    })
    if (!created.ok) throw new Error(created.error)
    state = created.state

    const rescheduled = rescheduleSession(
      state,
      created.value.id,
      '2026-07-21T09:00:00.000Z',
    )
    expect(rescheduled.ok).toBe(true)
    if (!rescheduled.ok) return
    state = rescheduled.state
    expect(state.scheduledSessions).toHaveLength(2)
    expect(rescheduled.value.original.status).toBe('rescheduled')
    expect(rescheduled.value.replacement.rescheduledFromId).toBe(created.value.id)
    expect(rescheduled.value.original.plannedStart).toBe('2026-07-20T09:00:00.000Z')

    const cancel = cancelScheduledSession(state, rescheduled.value.replacement.id)
    expect(cancel.ok).toBe(true)
    if (!cancel.ok) return
    expect(cancel.state.scheduledSessions.find((s) => s.id === created.value.id)).toBeTruthy()
  })
})

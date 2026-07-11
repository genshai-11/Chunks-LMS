import { activeEnrollmentsForClass } from '../roster/service'
import type { RosterState } from '../roster/types'
import type { SchedulingState } from '../scheduling/types'
import type { AttendanceMatrix, AttendanceMatrixCell } from './types'

/** Class × learning-session attendance grid. */
export function buildAttendanceMatrix(
  roster: RosterState,
  scheduling: SchedulingState,
  classId: string,
): AttendanceMatrix | null {
  const classRow = roster.classes.find((c) => c.id === classId)
  if (!classRow) return null

  const sessions = scheduling.learningSessions
    .filter((s) => s.classId === classId)
    .slice()
    .sort((a, b) => {
      const an = a.sessionNumber ?? 9999
      const bn = b.sessionNumber ?? 9999
      if (an !== bn) return an - bn
      return a.startedAt.localeCompare(b.startedAt)
    })

  const enrollments = activeEnrollmentsForClass(roster, classId)
  // Include learners who have attendance history even if enrollment ended
  const learnerIds = new Set(enrollments.map((e) => e.learnerUserId))
  for (const a of scheduling.attendance) {
    if (sessions.some((s) => s.id === a.learningSessionId)) {
      learnerIds.add(a.learnerUserId)
    }
  }

  const rows = [...learnerIds]
    .map((learnerUserId) => {
      const user = roster.users.find((u) => u.id === learnerUserId)
      const cells: AttendanceMatrixCell[] = sessions.map((s) => {
        const rec = scheduling.attendance.find(
          (a) => a.learningSessionId === s.id && a.learnerUserId === learnerUserId,
        )
        return {
          learningSessionId: s.id,
          status: rec?.status ?? 'missing',
        }
      })
      return {
        learnerUserId,
        displayName: user?.displayName ?? learnerUserId.slice(0, 8),
        cells,
      }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  return {
    classId,
    className: classRow.name,
    sessions: sessions.map((s) => ({
      id: s.id,
      sessionNumber: s.sessionNumber,
      startedAt: s.startedAt,
      status: s.status,
    })),
    rows,
  }
}

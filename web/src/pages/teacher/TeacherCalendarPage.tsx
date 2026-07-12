import { useMemo, useState } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListOrdered,
  Play,
  Radio,
  Ban,
  Timer,
  Trash2,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { createCaptureSession } from '../../modules/assessment/session-capture'
import { activeEnrollmentsForClass } from '../../modules/roster/service'
import {
  applyCourseScheduleToClass,
  cancelScheduledSession,
  createScheduledSession,
  deleteScheduledSession,
  startLearningSession,
} from '../../modules/scheduling/session-lifecycle'
import {
  formatSessionClock,
  formatSessionDateLabel,
  formatSessionTimeRange,
  isSameWallClockDay,
  wallClockIsoFromLocal,
} from '../../modules/scheduling/session-time'
import type { ScheduledSession } from '../../modules/scheduling/types'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { useAppState } from '../../state/useAppState'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function startOfWeek(d: Date): Date {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day // Monday start
  date.setDate(date.getDate() + diff)
  return date
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function weekRangeLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const y = weekStart.getFullYear() !== end.getFullYear()
  const left = weekStart.toLocaleDateString([], {
    ...opts,
    year: y ? 'numeric' : undefined,
  })
  const right = end.toLocaleDateString([], { ...opts, year: 'numeric' })
  return `${left} – ${right}`
}

function statusClass(status: ScheduledSession['status']): string {
  switch (status) {
    case 'scheduled':
      return 'sched-card is-scheduled'
    case 'completed':
      return 'sched-card is-completed'
    case 'cancelled':
      return 'sched-card is-cancelled'
    case 'rescheduled':
      return 'sched-card is-rescheduled'
    default:
      return 'sched-card'
  }
}

export function TeacherCalendarPage() {
  const {
    roster,
    scheduling,
    setScheduling,
    setCapture,
    metricSettings,
    activeLearnerUserId,
    setActiveLearnerUserId,
  } = useAppState()
  const { message, error, ok, err } = useFlash()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [duration, setDuration] = useState(60)
  const [slotHour, setSlotHour] = useState(9)

  const { classRow, course, teacher } = useTeacherClassContext()
  const preferredLearnerId = searchParams.get('learner') ?? activeLearnerUserId
  const activeLearners = useMemo(() => {
    const ids = classRow
      ? activeEnrollmentsForClass(roster, classRow.id).map((e) => e.learnerUserId)
      : []
    if (!preferredLearnerId || !ids.includes(preferredLearnerId)) return ids
    return [preferredLearnerId, ...ids.filter((id) => id !== preferredLearnerId)]
  }, [classRow, roster, preferredLearnerId])
  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )
  const [listFilter, setListFilter] = useState<'active' | 'all'>('active')

  const sessions = useMemo(
    () =>
      scheduling.scheduledSessions
        .filter((s) => s.classId === classRow?.id)
        .slice()
        .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart)),
    [scheduling.scheduledSessions, classRow?.id],
  )

  const listSessions = useMemo(() => {
    if (listFilter === 'all') return sessions
    return sessions.filter((s) => s.status === 'scheduled' || s.status === 'completed')
  }, [sessions, listFilter])

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor],
  )

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, ScheduledSession[]>()
    for (const day of weekDays) {
      map.set(day.toDateString(), [])
    }
    for (const s of sessions) {
      for (const day of weekDays) {
        if (isSameWallClockDay(s.plannedStart, day)) {
          map.get(day.toDateString())?.push(s)
          break
        }
      }
    }
    return map
  }, [sessions, weekDays])

  const selectedSessions = useMemo(() => {
    return sessions
      .filter((s) => isSameWallClockDay(s.plannedStart, selectedDay))
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
  }, [sessions, selectedDay])

  const upcomingCount = sessions.filter((s) => s.status === 'scheduled').length

  if (!classRow || !teacher) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No class assigned"
        description="You need a class before scheduling sessions."
      />
    )
  }

  function startSession(scheduledSessionId?: string) {
    if (activeLearners.length === 0) {
      return err('Seat at least one learner before starting a live session')
    }
    const maxProbe = metricSettings.defaultMaxProbeCount
    const r = startLearningSession(scheduling, {
      classId: classRow!.id,
      scheduledSessionId,
      maxProbeCount: maxProbe,
      ownerUserId: teacher!.id,
    })
    if (!r.ok) return err(r.error)
    setScheduling(r.state)
    if (preferredLearnerId) setActiveLearnerUserId(preferredLearnerId)
    setCapture(
      createCaptureSession({
        learningSessionId: r.value.id,
        teacherUserId: teacher!.id,
        learnerIds: activeLearners,
        maxProbeCount: maxProbe,
      }),
    )
    ok('Live session started')
    // Open live classroom immediately (attendance + observe)
    navigate('/teacher/session')
  }

  function resumeLive() {
    navigate('/teacher/session')
  }

  function scheduleAt(day: Date, hour: number, minutes = 0) {
    const plannedStart = wallClockIsoFromLocal(day, hour, minutes)
    const r = createScheduledSession(scheduling, {
      classId: classRow!.id,
      plannedStart,
      durationMinutes: duration,
    })
    if (!r.ok) return err(r.error)
    setScheduling(r.state)
    setSelectedDay(day)
    ok(`Scheduled ${formatSessionClock(r.value.plannedStart)} · ${duration}m`)
  }

  function removeSession(s: ScheduledSession) {
    if (
      !window.confirm(
        `Delete ${s.sessionNumber != null ? `Day ${s.sessionNumber}` : 'this session'} (${formatSessionDateLabel(s.plannedStart)} ${formatSessionClock(s.plannedStart)})?`,
      )
    ) {
      return
    }
    const r = deleteScheduledSession(scheduling, s.id)
    if (!r.ok) return err(r.error)
    setScheduling(r.state)
    ok('Session removed from list')
  }

  function cancelSession(s: ScheduledSession) {
    const r = cancelScheduledSession(scheduling, s.id)
    if (!r.ok) return err(r.error)
    setScheduling(r.state)
    ok('Session cancelled')
  }

  function goThisWeek() {
    const w = startOfWeek(new Date())
    setWeekAnchor(w)
    setSelectedDay(new Date())
  }

  return (
    <>
      <PageHeader
        icon={CalendarDays}
        kicker={classRow.name}
        title="Schedule"
        subtitle="Week view · plan sessions and start class live."
        actions={
          <div className="page-actions">
            {course?.schedule && course.startsOn ? (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const r = applyCourseScheduleToClass(scheduling, {
                    classId: classRow.id,
                    course,
                  })
                  if (!r.ok) return err(r.error)
                  setScheduling(r.state)
                  ok(
                    r.value.length === 0
                      ? 'Schedule already applied (no new slots)'
                      : `Applied course schedule · ${r.value.length} sessions added`,
                  )
                  if (course.startsOn) {
                    const d = new Date(course.startsOn + 'T12:00:00')
                    setWeekAnchor(startOfWeek(d))
                    setSelectedDay(d)
                  }
                }}
              >
                <CalendarRange className="h-4 w-4" aria-hidden />
                <span>Apply course plan</span>
              </button>
            ) : null}
            {openSession ? (
              <button type="button" className="primary" onClick={resumeLive}>
                <Radio className="h-4 w-4" aria-hidden />
                <span>Resume live</span>
              </button>
            ) : (
              <button type="button" className="primary" onClick={() => startSession()}>
                <Play className="h-4 w-4" aria-hidden />
                <span>Start session</span>
              </button>
            )}
          </div>
        }
      />
      <Flash message={message} error={error} />

      <div className="sched-stats">
        <div className="sched-stat">
          <span className="sched-stat-label">Upcoming</span>
          <strong className="sched-stat-value">{upcomingCount}</strong>
        </div>
        <div className="sched-stat">
          <span className="sched-stat-label">This week</span>
          <strong className="sched-stat-value">
            {weekDays.reduce((n, d) => n + (sessionsByDay.get(d.toDateString())?.length ?? 0), 0)}
          </strong>
        </div>
        <div className="sched-stat">
          <span className="sched-stat-label">Live</span>
          <strong className="sched-stat-value">{openSession ? 'Open' : '—'}</strong>
        </div>
        <div className="sched-stat">
          <span className="sched-stat-label">Duration</span>
          <strong className="sched-stat-value font-mono">{duration}m</strong>
        </div>
      </div>

      <Panel
        icon={CalendarDays}
        title="Week calendar"
        description={weekRangeLabel(weekAnchor)}
        defaultOpen
        actions={
          <div className="sched-toolbar">
            <button
              type="button"
              className="ghost"
              aria-label="Previous week"
              onClick={() => setWeekAnchor((w) => addDays(w, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="ghost" onClick={goThisWeek}>
              Today
            </button>
            <button
              type="button"
              className="ghost"
              aria-label="Next week"
              onClick={() => setWeekAnchor((w) => addDays(w, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="sched-week" role="grid" aria-label="Week schedule">
          {weekDays.map((day, i) => {
            const daySessions = sessionsByDay.get(day.toDateString()) ?? []
            const isToday = sameDay(day, today)
            const isSelected = sameDay(day, selectedDay)
            return (
              <button
                key={day.toISOString()}
                type="button"
                role="gridcell"
                className={`sched-day${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <header className="sched-day-head">
                  <span className="sched-day-name">{WEEKDAY_LABELS[i]}</span>
                  <span className="sched-day-date">{formatDayHeader(day)}</span>
                </header>
                <div className="sched-day-body">
                  {daySessions.length === 0 ? (
                    <span className="sched-day-empty">—</span>
                  ) : (
                    daySessions.map((s) => (
                      <div key={s.id} className={statusClass(s.status)}>
                        <span className="sched-card-time">
                          {s.sessionNumber != null ? `D${s.sessionNumber} · ` : ''}
                          {formatSessionClock(s.plannedStart)}
                        </span>
                        <span className="sched-card-meta">{s.durationMinutes}m</span>
                      </div>
                    ))
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="sched-legend">
          <span>
            <i className="sched-dot is-scheduled" /> Scheduled
          </span>
          <span>
            <i className="sched-dot is-completed" /> Completed
          </span>
          <span>
            <i className="sched-dot is-cancelled" /> Cancelled
          </span>
          <span>
            <i className="sched-dot is-rescheduled" /> Rescheduled
          </span>
        </div>
      </Panel>

      <div className="sched-split">
        <Panel
          icon={Clock3}
          title={selectedDay.toLocaleDateString([], {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
          })}
          description={`${selectedSessions.length} session${selectedSessions.length === 1 ? '' : 's'}`}
          defaultOpen
        >
          {selectedSessions.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No sessions this day"
              description="Use the quick add form to place a slot on this day."
            />
          ) : (
            <ul className="sched-agenda">
              {selectedSessions.map((s) => (
                <li key={s.id} className={`sched-agenda-item ${statusClass(s.status)}`}>
                  <div className="sched-agenda-time">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    <span>
                      {s.sessionNumber != null ? `Day ${s.sessionNumber} · ` : ''}
                      {formatSessionTimeRange(s.plannedStart, s.durationMinutes)}
                    </span>
                  </div>
                  <div className="sched-agenda-body">
                    <strong>{classRow.name}</strong>
                    <span className="badge">{s.status}</span>
                    <span className="meta mt-0">
                      <Timer className="inline h-3 w-3" aria-hidden /> {s.durationMinutes} min
                    </span>
                  </div>
                  <div className="sched-agenda-actions">
                    {s.status === 'scheduled' && (
                      <>
                        {openSession ? (
                          <button type="button" className="primary" onClick={resumeLive}>
                            <Radio className="h-3.5 w-3.5" aria-hidden />
                            <span>Resume live</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="primary"
                            onClick={() => startSession(s.id)}
                          >
                            <Play className="h-3.5 w-3.5" aria-hidden />
                            <span>Start</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="ghost danger"
                          disabled={Boolean(openSession)}
                          onClick={() => cancelSession(s)}
                        >
                          <Ban className="h-3.5 w-3.5" aria-hidden />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}
                    {s.status !== 'completed' ? (
                      <button
                        type="button"
                        className="ghost danger"
                        title="Remove from list"
                        onClick={() => removeSession(s)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span>Delete</span>
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          icon={CalendarPlus}
          title="Quick schedule"
          description="Add a slot on the selected day"
          defaultOpen
        >
          <form
            className="form-grid"
            onSubmit={(e) => {
              e.preventDefault()
              scheduleAt(selectedDay, slotHour, 0)
            }}
          >
            <label>
              Day
              <input
                type="date"
                value={`${selectedDay.getFullYear()}-${String(selectedDay.getMonth() + 1).padStart(2, '0')}-${String(selectedDay.getDate()).padStart(2, '0')}`}
                onChange={(e) => {
                  const [y, m, d] = e.target.value.split('-').map(Number)
                  if (!y || !m || !d) return
                  const next = new Date(y, m - 1, d)
                  setSelectedDay(next)
                  setWeekAnchor(startOfWeek(next))
                }}
              />
            </label>
            <label>
              Start hour
              <select value={slotHour} onChange={(e) => setSlotHour(Number(e.target.value))}>
                {Array.from({ length: 14 }, (_, i) => i + 7).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </label>
            <label>
              Duration
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="primary">
              <CalendarPlus className="h-4 w-4" aria-hidden />
              <span>Add to day</span>
            </button>
          </form>

          <div className="sched-quick-slots">
            <p className="panel-title mb-2">Quick slots</p>
            <div className="btn-row my-0">
              {[9, 10, 14, 16].map((h) => (
                <button
                  key={h}
                  type="button"
                  className="ghost"
                  onClick={() => scheduleAt(selectedDay, h)}
                >
                  {String(h).padStart(2, '0')}:00
                </button>
              ))}
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  const start = new Date()
                  start.setMinutes(0, 0, 0)
                  start.setHours(start.getHours() + 1)
                  scheduleAt(start, start.getHours(), start.getMinutes())
                }}
              >
                Next hour
              </button>
            </div>
          </div>
        </Panel>
      </div>

      {/* Full session list — manage / delete */}
      <Panel
        icon={ListOrdered}
        title="All sessions"
        description={`${listSessions.length} in list · Day numbers reindex after delete`}
        defaultOpen
        actions={
          <div className="btn-row my-0">
            <button
              type="button"
              className={listFilter === 'active' ? 'active' : 'ghost'}
              onClick={() => setListFilter('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={listFilter === 'all' ? 'active' : 'ghost'}
              onClick={() => setListFilter('all')}
            >
              All
            </button>
          </div>
        }
      >
        {listSessions.length === 0 ? (
          <EmptyState
            icon={ListOrdered}
            title="No sessions yet"
            description="Apply the course plan or add slots on the calendar."
          />
        ) : (
          <div className="table-wrap">
            <table aria-label="Class session list">
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">When</th>
                  <th scope="col">Time</th>
                  <th scope="col">Dur</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {listSessions.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs font-bold">
                      {s.sessionNumber != null ? `Day ${s.sessionNumber}` : '—'}
                    </td>
                    <td className="text-sm">{formatSessionDateLabel(s.plannedStart)}</td>
                    <td className="font-mono text-xs">
                      {formatSessionTimeRange(s.plannedStart, s.durationMinutes)}
                    </td>
                    <td className="font-mono text-xs">{s.durationMinutes}m</td>
                    <td>
                      <span className="badge">{s.status}</span>
                    </td>
                    <td>
                      <div className="btn-row my-0">
                        {s.status === 'scheduled' && !openSession ? (
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => startSession(s.id)}
                          >
                            <Play className="h-3.5 w-3.5" aria-hidden />
                            Start
                          </button>
                        ) : null}
                        {s.status === 'scheduled' ? (
                          <button
                            type="button"
                            className="ghost danger"
                            disabled={Boolean(openSession)}
                            onClick={() => cancelSession(s)}
                          >
                            <Ban className="h-3.5 w-3.5" aria-hidden />
                            Cancel
                          </button>
                        ) : null}
                        {s.status !== 'completed' ? (
                          <button
                            type="button"
                            className="ghost danger"
                            onClick={() => removeSession(s)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}

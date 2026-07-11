import { useMemo, useState } from 'react'
import {
  Archive,
  BookOpen,
  CalendarRange,
  Check,
  ChevronDown,
  Clock3,
  Pencil,
  Plus,
  RotateCcw,
  School,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ClassStudentsPanel } from '../../components/ClassStudentsPanel'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import {
  activeEnrollmentsForClass,
  archiveCourse,
  createCourse,
  defaultCourseSchedule,
  deleteCourse,
  previewCourseSchedule,
  restoreCourse,
  updateCourse,
} from '../../modules/roster/service'
import type { Course, CourseSchedule } from '../../modules/roster/types'
import { formatWeekdaysLabel } from '../../modules/scheduling/recurrence'
import { useAppState } from '../../state/useAppState'

const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
]

type Draft = {
  code: string
  name: string
  startsOn: string
  endsOn: string
  useAutoSchedule: boolean
  weekdays: number[]
  startTime: string
  durationMinutes: number
  sessionCount: number
}

function emptyDraft(): Draft {
  const s = defaultCourseSchedule()
  return {
    code: 'ERE-Level-A',
    name: 'ERE Level A',
    startsOn: '2026-07-01',
    endsOn: '',
    useAutoSchedule: true,
    weekdays: [...s.weekdays],
    startTime: s.startTime,
    durationMinutes: s.durationMinutes,
    sessionCount: s.sessionCount,
  }
}

function courseToDraft(c: Course): Draft {
  const s = c.schedule ?? defaultCourseSchedule()
  return {
    code: c.code,
    name: c.name,
    startsOn: c.startsOn ?? '',
    endsOn: c.endsOn ?? '',
    useAutoSchedule: Boolean(c.schedule),
    weekdays: [...s.weekdays],
    startTime: s.startTime,
    durationMinutes: s.durationMinutes,
    sessionCount: s.sessionCount,
  }
}

function draftToSchedule(d: Draft): CourseSchedule | null {
  if (!d.useAutoSchedule) return null
  return defaultCourseSchedule({
    weekdays: d.weekdays,
    startTime: d.startTime,
    durationMinutes: d.durationMinutes,
    sessionCount: d.sessionCount,
  })
}

function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b)
}

function ScheduleFields({
  draft,
  setDraft,
  idPrefix,
}: {
  draft: Draft
  setDraft: (fn: (d: Draft) => Draft) => void
  idPrefix: string
}) {
  const preview = useMemo(() => {
    if (!draft.useAutoSchedule || !draft.startsOn || draft.weekdays.length === 0) {
      return null
    }
    return previewCourseSchedule({
      startsOn: draft.startsOn,
      schedule: draftToSchedule(draft),
    })
  }, [draft])

  return (
    <div className="course-schedule">
      <label className="course-schedule-toggle">
        <input
          type="checkbox"
          checked={draft.useAutoSchedule}
          onChange={(e) =>
            setDraft((d) => ({
              ...d,
              useAutoSchedule: e.target.checked,
              endsOn: e.target.checked ? '' : d.endsOn,
            }))
          }
        />
        <span>Auto-schedule ({draft.sessionCount || 15} class days)</span>
      </label>

      {draft.useAutoSchedule ? (
        <>
          <div className="form-grid">
            <label>
              Start day
              <input
                type="date"
                value={draft.startsOn}
                onChange={(e) => setDraft((d) => ({ ...d, startsOn: e.target.value }))}
                required
              />
            </label>
            <label>
              Time
              <input
                type="time"
                value={draft.startTime}
                onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}
              />
            </label>
            <label>
              Duration (min)
              <select
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, durationMinutes: Number(e.target.value) }))
                }
              >
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Class days
              <input
                type="number"
                min={1}
                max={60}
                value={draft.sessionCount}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, sessionCount: Number(e.target.value) || 15 }))
                }
              />
            </label>
          </div>

          <fieldset className="weekday-field">
            <legend>Meets on</legend>
            <div className="weekday-pills" role="group" aria-label="Weekdays">
              {WEEKDAYS.map((wd) => {
                const on = draft.weekdays.includes(wd.value)
                return (
                  <button
                    key={wd.value}
                    type="button"
                    className={on ? 'weekday-pill is-on' : 'weekday-pill'}
                    aria-pressed={on}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        weekdays: toggleDay(d.weekdays, wd.value),
                      }))
                    }
                  >
                    {wd.short}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="course-schedule-preview" aria-live="polite">
            <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <span>
              {preview?.sessionCount ? (
                <>
                  <strong>{preview.sessionCount}</strong> sessions ·{' '}
                  {formatWeekdaysLabel(draft.weekdays)} · {draft.startTime} · ends{' '}
                  <strong className="font-mono">{preview.endsOn}</strong> (auto)
                </>
              ) : (
                'Pick start day + weekdays to auto-detect end day'
              )}
            </span>
          </div>
        </>
      ) : (
        <div className="form-grid">
          <label>
            Starts
            <input
              id={`${idPrefix}-start`}
              type="date"
              value={draft.startsOn}
              onChange={(e) => setDraft((d) => ({ ...d, startsOn: e.target.value }))}
            />
          </label>
          <label>
            Ends
            <input
              id={`${idPrefix}-end`}
              type="date"
              value={draft.endsOn}
              onChange={(e) => setDraft((d) => ({ ...d, endsOn: e.target.value }))}
            />
          </label>
        </div>
      )}
    </div>
  )
}

export function AdminCoursesPage() {
  const { roster, setRoster } = useAppState()
  const { message, error, ok, err } = useFlash()
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)
  const [studentsOpenClassId, setStudentsOpenClassId] = useState<string | null>(null)

  function startEdit(c: Course) {
    setEditingId(c.id)
    setStudentsOpenClassId(null)
    setEditDraft(courseToDraft(c))
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft(emptyDraft())
  }

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Courses"
        subtitle="Program schedule first — then open a class under the course to add students."
      />
      <Flash message={message} error={error} />

      <Panel
        icon={BookOpen}
        title="Course catalog"
        description="Auto-schedule computes end date. Expand a class to seat students (new or directory)."
      >
        {roster.courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet"
            description="Create a course with Tue/Wed (or your days) and 15 sessions."
          />
        ) : (
          <div className="course-cards">
            {roster.courses.map((c) => {
              const classes = roster.classes.filter((cl) => cl.courseId === c.id)
              const isEditing = editingId === c.id

              if (isEditing) {
                return (
                  <article key={c.id} className="course-card">
                    <div className="course-edit-card">
                      <div className="form-grid">
                        <label>
                          Code
                          <input
                            className="row-input"
                            value={editDraft.code}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, code: e.target.value }))
                            }
                          />
                        </label>
                        <label>
                          Name
                          <input
                            className="row-input"
                            value={editDraft.name}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, name: e.target.value }))
                            }
                          />
                        </label>
                      </div>
                      <ScheduleFields
                        draft={editDraft}
                        setDraft={setEditDraft}
                        idPrefix={`edit-${c.id}`}
                      />
                      <div className="row-actions mt-2">
                        <button
                          type="button"
                          className="primary"
                          onClick={() => {
                            const schedule = draftToSchedule(editDraft)
                            const r = updateCourse(roster, c.id, {
                              code: editDraft.code,
                              name: editDraft.name,
                              startsOn: editDraft.startsOn || null,
                              endsOn: schedule ? null : editDraft.endsOn || null,
                              schedule,
                            })
                            if (!r.ok) return err(r.error)
                            setRoster(r.state)
                            ok(
                              `Course ${r.value.code} updated` +
                                (r.value.endsOn ? ` · ends ${r.value.endsOn}` : ''),
                            )
                            cancelEdit()
                          }}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden />
                          <span>Save</span>
                        </button>
                        <button type="button" className="ghost" onClick={cancelEdit}>
                          <X className="h-3.5 w-3.5" aria-hidden />
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  </article>
                )
              }

              return (
                <article key={c.id} className="course-card">
                  <div className="course-card-main">
                    <div className="course-card-identity">
                      <span className="class-card-icon" aria-hidden>
                        <BookOpen className="h-4 w-4" strokeWidth={1.75} />
                      </span>
                      <div>
                        <h3 className="class-card-name">
                          {c.code}{' '}
                          <span className="course-card-name-muted">{c.name}</span>
                        </h3>
                        <p className="class-card-meta">
                          {c.schedule ? (
                            <span className="font-mono">
                              {formatWeekdaysLabel(c.schedule.weekdays)} · {c.schedule.startTime} ·{' '}
                              {c.schedule.sessionCount}d
                            </span>
                          ) : (
                            <span className="badge">manual</span>
                          )}
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <CalendarRange className="h-3 w-3" aria-hidden />
                            {c.startsOn ?? '—'} → {c.endsOn ?? '—'}
                          </span>
                          <span aria-hidden>·</span>
                          <span className={`badge${c.status === 'active' ? ' success' : ''}`}>
                            {c.status}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="row-actions">
                      <button type="button" className="ghost" onClick={() => startEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        <span>Edit</span>
                      </button>
                      {c.status === 'active' ? (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            const r = archiveCourse(roster, c.id)
                            if (!r.ok) return err(r.error)
                            setRoster(r.state)
                            ok(`Course ${c.code} archived`)
                          }}
                        >
                          <Archive className="h-3.5 w-3.5" aria-hidden />
                          <span>Archive</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            const r = restoreCourse(roster, c.id)
                            if (!r.ok) return err(r.error)
                            setRoster(r.state)
                            ok(`Course ${c.code} restored`)
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                          <span>Restore</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Delete course ${c.code}? Only works if it has no classes.`,
                            )
                          ) {
                            return
                          }
                          const r = deleteCourse(roster, c.id)
                          if (!r.ok) return err(r.error)
                          setRoster(r.state)
                          ok(`Course ${c.code} deleted`)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="course-classes">
                    <div className="course-classes-head">
                      <p className="panel-title">Classes &amp; students</p>
                      <Link to="/admin/classes" className="btn ghost">
                        <School className="h-3.5 w-3.5" aria-hidden />
                        <span>Manage classes</span>
                      </Link>
                    </div>

                    {classes.length === 0 ? (
                      <EmptyState
                        icon={School}
                        title="No classes under this course"
                        description="Create a class on Admin → Classes, then add students there or here."
                        action={
                          <Link to="/admin/classes" className="btn primary">
                            <Plus className="h-4 w-4" aria-hidden />
                            <span>Go to Classes</span>
                          </Link>
                        }
                      />
                    ) : (
                      <div className="course-class-list">
                        {classes.map((cl) => {
                          const seats = activeEnrollmentsForClass(roster, cl.id).length
                          const open = studentsOpenClassId === cl.id
                          const teacher = roster.users.find((u) => u.id === cl.teacherUserId)
                          return (
                            <div key={cl.id} className="course-class-row">
                              <div className="course-class-row-main">
                                <div>
                                  <strong>{cl.name}</strong>
                                  <p className="meta">
                                    {teacher?.displayName ?? 'No teacher'} · {seats}/
                                    {cl.capacity} seats · {cl.status}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className={open ? 'primary' : 'ghost'}
                                  aria-expanded={open}
                                  onClick={() =>
                                    setStudentsOpenClassId((id) =>
                                      id === cl.id ? null : cl.id,
                                    )
                                  }
                                >
                                  <Users className="h-3.5 w-3.5" aria-hidden />
                                  <span>Students</span>
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 transition-transform${open ? ' rotate-180' : ''}`}
                                    aria-hidden
                                  />
                                </button>
                              </div>
                              {open ? (
                                <div className="class-card-students">
                                  <ClassStudentsPanel
                                    classId={cl.id}
                                    compact
                                    onMessage={ok}
                                    onError={err}
                                  />
                                </div>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        <div className="panel-footer-form">
          <p className="panel-title mb-3">Create course</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const schedule = draftToSchedule(createDraft)
              const r = createCourse(roster, {
                code: createDraft.code,
                name: createDraft.name,
                startsOn: createDraft.startsOn || null,
                endsOn: schedule ? null : createDraft.endsOn || null,
                schedule,
              })
              if (!r.ok) return err(r.error)
              setRoster(r.state)
              ok(
                `Course ${r.value.code} created` +
                  (r.value.endsOn
                    ? ` · ${r.value.schedule?.sessionCount ?? ''} days · ends ${r.value.endsOn}`
                    : ''),
              )
              setCreateDraft(emptyDraft())
            }}
          >
            <div className="form-grid">
              <label>
                Code
                <input
                  value={createDraft.code}
                  onChange={(e) => setCreateDraft((d) => ({ ...d, code: e.target.value }))}
                  required
                />
              </label>
              <label>
                Name
                <input
                  value={createDraft.name}
                  onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))}
                  required
                />
              </label>
            </div>
            <ScheduleFields
              draft={createDraft}
              setDraft={setCreateDraft}
              idPrefix="create"
            />
            <div className="btn-row">
              <button type="submit" className="primary">
                <Plus className="h-4 w-4" aria-hidden />
                <span>Create course</span>
              </button>
            </div>
          </form>
        </div>
      </Panel>
    </>
  )
}

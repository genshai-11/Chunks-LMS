import { useMemo, useState } from 'react'
import {
  Archive,
  BookOpen,
  CalendarRange,
  Check,
  Clock3,
  Pencil,
  Plus,
  RotateCcw,
  School,
  Trash2,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import {
  activeEnrollmentsForClass,
  archiveCourse,
  createCourse,
  defaultCourseSchedule,
  deleteCourse,
  formatScheduleLabel,
  previewCourseSchedule,
  restoreCourse,
  updateCourse,
} from '../../modules/roster/service'
import { normalizeCourseSchedule } from '../../modules/roster/schedule'
import type { Course, CourseDaySlot, CourseSchedule } from '../../modules/roster/types'
import { useAppState } from '../../state/useAppState'

const WEEKDAYS = [
  { value: 1, short: 'Mon' },
  { value: 2, short: 'Tue' },
  { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' },
  { value: 5, short: 'Fri' },
  { value: 6, short: 'Sat' },
  { value: 0, short: 'Sun' },
] as const

type Draft = {
  code: string
  name: string
  startsOn: string
  endsOn: string
  useAutoSchedule: boolean
  /** Dynamic per-day times (multi-time per day allowed) */
  slots: CourseDaySlot[]
  durationMinutes: number
  sessionCount: number
}

function emptyDraft(): Draft {
  const s = defaultCourseSchedule()
  return {
    code: '',
    name: '',
    startsOn: new Date().toISOString().slice(0, 10),
    endsOn: '',
    useAutoSchedule: true,
    slots: s.slots.map((x) => ({ ...x })),
    durationMinutes: s.durationMinutes,
    sessionCount: s.sessionCount,
  }
}

function courseToDraft(c: Course): Draft {
  const s = normalizeCourseSchedule(c.schedule) ?? defaultCourseSchedule()
  return {
    code: c.code,
    name: c.name,
    startsOn: c.startsOn ?? '',
    endsOn: c.endsOn ?? '',
    useAutoSchedule: Boolean(c.schedule),
    slots: s.slots.map((x) => ({ ...x })),
    durationMinutes: s.durationMinutes,
    sessionCount: s.sessionCount,
  }
}

function draftToSchedule(d: Draft): CourseSchedule | null {
  if (!d.useAutoSchedule) return null
  return defaultCourseSchedule({
    slots: d.slots,
    durationMinutes: d.durationMinutes,
    sessionCount: d.sessionCount,
  })
}

function dayEnabled(slots: CourseDaySlot[], day: number): boolean {
  return slots.some((s) => s.weekday === day)
}

function timesForDay(slots: CourseDaySlot[], day: number): string[] {
  return slots.filter((s) => s.weekday === day).map((s) => s.startTime)
}

function toggleDay(slots: CourseDaySlot[], day: number): CourseDaySlot[] {
  if (dayEnabled(slots, day)) {
    return slots.filter((s) => s.weekday !== day)
  }
  return [...slots, { weekday: day, startTime: '09:00' }]
}

function setDayTimes(slots: CourseDaySlot[], day: number, times: string[]): CourseDaySlot[] {
  const others = slots.filter((s) => s.weekday !== day)
  const next = times
    .filter(Boolean)
    .map((startTime) => ({ weekday: day, startTime }))
  return [...others, ...next]
}

function CourseForm({
  draft,
  setDraft,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: Draft
  setDraft: (fn: (d: Draft) => Draft) => void
  submitLabel: string
  onSubmit: () => void
  onCancel: () => void
}) {
  const preview = useMemo(() => {
    if (!draft.useAutoSchedule || !draft.startsOn || draft.slots.length === 0) return null
    return previewCourseSchedule({
      startsOn: draft.startsOn,
      schedule: draftToSchedule(draft),
    })
  }, [draft])

  return (
    <form
      className="course-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div className="course-form-grid">
        <label>
          Code
          <input
            value={draft.code}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
            placeholder="ERE-Level-A"
            required
          />
        </label>
        <label className="course-form-span2">
          Name
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="ERE Level A"
            required
          />
        </label>
      </div>

      <div className="course-form-section">
        <div className="course-form-section-head">
          <span className="course-form-section-title">Schedule</span>
          <label className="course-switch">
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
            <span>Auto</span>
          </label>
        </div>

        {draft.useAutoSchedule ? (
          <>
            <div className="course-form-grid">
              <label>
                Start
                <input
                  type="date"
                  value={draft.startsOn}
                  onChange={(e) => setDraft((d) => ({ ...d, startsOn: e.target.value }))}
                  required
                />
              </label>
              <label>
                Meetings
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={draft.sessionCount}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, sessionCount: Number(e.target.value) || 15 }))
                  }
                />
              </label>
              <label>
                Default length
                <select
                  value={draft.durationMinutes}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, durationMinutes: Number(e.target.value) }))
                  }
                >
                  {[30, 45, 60, 90, 120].map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="course-form-hint course-form-hint-static">
              Turn on each day and set its own time(s). Same day can have multiple times.
            </p>

            <div className="day-slot-list" role="group" aria-label="Days and times">
              {WEEKDAYS.map((wd) => {
                const on = dayEnabled(draft.slots, wd.value)
                const times = timesForDay(draft.slots, wd.value)
                return (
                  <div key={wd.value} className={`day-slot-row${on ? ' is-on' : ''}`}>
                    <button
                      type="button"
                      className={on ? 'weekday-pill is-on' : 'weekday-pill'}
                      aria-pressed={on}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          slots: toggleDay(d.slots, wd.value),
                        }))
                      }
                    >
                      {wd.short}
                    </button>
                    {on ? (
                      <div className="day-slot-times">
                        {times.map((t, idx) => (
                          <div key={`${wd.value}-${idx}`} className="day-slot-time">
                            <input
                              type="time"
                              value={t}
                              aria-label={`${wd.short} time ${idx + 1}`}
                              onChange={(e) => {
                                const next = [...times]
                                next[idx] = e.target.value
                                setDraft((d) => ({
                                  ...d,
                                  slots: setDayTimes(d.slots, wd.value, next),
                                }))
                              }}
                            />
                            {times.length > 1 ? (
                              <button
                                type="button"
                                className="ghost danger"
                                aria-label="Remove time"
                                onClick={() => {
                                  const next = times.filter((_, i) => i !== idx)
                                  setDraft((d) => ({
                                    ...d,
                                    slots: setDayTimes(d.slots, wd.value, next),
                                  }))
                                }}
                              >
                                <X className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                        ))}
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              slots: setDayTimes(d.slots, wd.value, [
                                ...times,
                                times[times.length - 1] ?? '14:00',
                              ]),
                            }))
                          }
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          <span>Add time</span>
                        </button>
                      </div>
                    ) : (
                      <span className="meta">Off</span>
                    )}
                  </div>
                )
              })}
            </div>

            {preview?.sessionCount ? (
              <p className="course-form-hint">
                <Clock3 className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {formatScheduleLabel(draftToSchedule(draft))} · {preview.sessionCount} meetings ·
                  ends <strong className="font-mono">{preview.endsOn}</strong>
                </span>
              </p>
            ) : null}
          </>
        ) : (
          <div className="course-form-grid">
            <label>
              Starts
              <input
                type="date"
                value={draft.startsOn}
                onChange={(e) => setDraft((d) => ({ ...d, startsOn: e.target.value }))}
              />
            </label>
            <label>
              Ends
              <input
                type="date"
                value={draft.endsOn}
                onChange={(e) => setDraft((d) => ({ ...d, endsOn: e.target.value }))}
              />
            </label>
          </div>
        )}
      </div>

      <div className="course-form-actions">
        <button type="button" className="ghost" onClick={onCancel}>
          <X className="h-3.5 w-3.5" aria-hidden />
          Cancel
        </button>
        <button type="submit" className="primary">
          <Check className="h-3.5 w-3.5" aria-hidden />
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

export function AdminCoursesPage() {
  const { roster, setRoster } = useAppState()
  const { message, error, ok, err } = useFlash()
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  function openCreate() {
    setDraft(emptyDraft())
    setEditingId(null)
    setMode('create')
  }

  function openEdit(c: Course) {
    setDraft(courseToDraft(c))
    setEditingId(c.id)
    setMode('edit')
  }

  function closeForm() {
    setMode('list')
    setEditingId(null)
    setDraft(emptyDraft())
  }

  function saveCreate() {
    const schedule = draftToSchedule(draft)
    const r = createCourse(roster, {
      code: draft.code,
      name: draft.name,
      startsOn: draft.startsOn || null,
      endsOn: schedule ? null : draft.endsOn || null,
      schedule,
    })
    if (!r.ok) return err(r.error)
    setRoster(r.state)
    ok(`Course ${r.value.code} created` + (r.value.endsOn ? ` · ends ${r.value.endsOn}` : ''))
    closeForm()
  }

  function saveEdit() {
    if (!editingId) return
    const schedule = draftToSchedule(draft)
    const r = updateCourse(roster, editingId, {
      code: draft.code,
      name: draft.name,
      startsOn: draft.startsOn || null,
      endsOn: schedule ? null : draft.endsOn || null,
      schedule,
    })
    if (!r.ok) return err(r.error)
    setRoster(r.state)
    ok(`Course ${r.value.code} updated`)
    closeForm()
  }

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Courses"
        subtitle="Programs and meeting patterns."
        actions={
          mode === 'list' ? (
            <button type="button" className="primary" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              New course
            </button>
          ) : null
        }
      />
      <Flash message={message} error={error} />

      {mode !== 'list' ? (
        <section className="course-sheet">
          <header className="course-sheet-head">
            <h2 className="course-sheet-title">
              {mode === 'create' ? 'New course' : 'Edit course'}
            </h2>
            <button type="button" className="ghost" onClick={closeForm} aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </header>
          <CourseForm
            draft={draft}
            setDraft={setDraft}
            submitLabel={mode === 'create' ? 'Create' : 'Save'}
            onSubmit={mode === 'create' ? saveCreate : saveEdit}
            onCancel={closeForm}
          />
        </section>
      ) : null}

      {roster.courses.length === 0 && mode === 'list' ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet"
          description="Create a program with start day, weekdays, and session count."
          action={
            <button type="button" className="primary" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              New course
            </button>
          }
        />
      ) : mode === 'list' || roster.courses.length > 0 ? (
        <div className="course-list">
          {roster.courses.map((c) => {
            const classCount = roster.classes.filter((cl) => cl.courseId === c.id).length
            const seats = roster.classes
              .filter((cl) => cl.courseId === c.id)
              .reduce((n, cl) => n + activeEnrollmentsForClass(roster, cl.id).length, 0)

            return (
              <article
                key={c.id}
                className={`course-row${editingId === c.id ? ' is-active' : ''}`}
              >
                <div className="course-row-icon" aria-hidden>
                  <BookOpen className="h-4 w-4" strokeWidth={1.75} />
                </div>

                <div className="course-row-body">
                  <div className="course-row-title">
                    <strong>{c.code}</strong>
                    <span>{c.name}</span>
                    <span className={`badge${c.status === 'active' ? ' success' : ''}`}>
                      {c.status}
                    </span>
                  </div>
                  <p className="course-row-meta">
                    {c.schedule ? (
                      <>
                        {formatScheduleLabel(c.schedule)} · {c.schedule.sessionCount} meetings
                      </>
                    ) : (
                      'Manual dates'
                    )}
                    <span aria-hidden> · </span>
                    <CalendarRange className="inline h-3 w-3" aria-hidden />{' '}
                    {c.startsOn ?? '—'} → {c.endsOn ?? '—'}
                    <span aria-hidden> · </span>
                    {classCount} class{classCount === 1 ? '' : 'es'} · {seats} seats
                  </p>
                </div>

                <div className="course-row-actions">
                  <Link to="/admin/classes" className="btn ghost" title="Classes">
                    <School className="h-3.5 w-3.5" aria-hidden />
                    <span className="course-row-action-label">Classes</span>
                  </Link>
                  <button type="button" className="ghost" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    <span className="course-row-action-label">Edit</span>
                  </button>
                  {c.status === 'active' ? (
                    <button
                      type="button"
                      className="ghost"
                      title="Archive"
                      onClick={() => {
                        const r = archiveCourse(roster, c.id)
                        if (!r.ok) return err(r.error)
                        setRoster(r.state)
                        ok(`Archived ${c.code}`)
                      }}
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ghost"
                      title="Restore"
                      onClick={() => {
                        const r = restoreCourse(roster, c.id)
                        if (!r.ok) return err(r.error)
                        setRoster(r.state)
                        ok(`Restored ${c.code}`)
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    className="ghost danger"
                    title="Delete"
                    onClick={() => {
                      if (!window.confirm(`Delete ${c.code}?`)) return
                      const r = deleteCourse(roster, c.id)
                      if (!r.ok) return err(r.error)
                      setRoster(r.state)
                      ok(`Deleted ${c.code}`)
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </>
  )
}

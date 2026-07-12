import { Archive, Check, Pencil, Plus, School, UserMinus, UserPlus, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import {
  activeEnrollmentsForClass,
  createClass,
  createCourse,
  createLearnerAndEnroll,
  defaultCourseSchedule,
  endClass,
  endEnrollment,
  enrollLearner,
  learnersAvailableForClass,
  listActiveLearners,
  listLearners,
  updateClass,
} from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'
import { useStaffSession } from '../../auth/useStaffSession'

type Draft = { name: string; courseId: string; capacity: number }
type CourseDraft = {
  code: string
  name: string
  startsOn: string
  sessionCount: number
}

export function TeacherClassesPage() {
  const { roster, setRoster, setActiveClassId } = useAppState()
  const staffSession = useStaffSession()
  const teacher =
    roster.users.find(
      (user) =>
        user.roles.includes('teacher') &&
        user.email?.toLowerCase() === staffSession.email?.toLowerCase(),
    ) ??
    (staffSession.canAccess('admin')
      ? roster.users.find((user) => user.roles.includes('teacher'))
      : undefined)
  const courses = roster.courses.filter((course) => course.status === 'active')
  const classes = roster.classes.filter((row) => row.teacherUserId === teacher?.id)
  const { message, error, ok, err } = useFlash()
  const [draft, setDraft] = useState<Draft>({
    name: '',
    courseId: courses[0]?.id ?? '',
    capacity: 3,
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCapacity, setEditCapacity] = useState(3)
  const [courseDraft, setCourseDraft] = useState<CourseDraft>({
    code: '',
    name: '',
    startsOn: new Date().toISOString().slice(0, 10),
    sessionCount: 15,
  })
  const activeClassRows = useMemo(
    () => classes.filter((c) => c.status === 'active'),
    [classes],
  )
  const [seatClassId, setSeatClassId] = useState<string | null>(null)
  const [seatLearnerId, setSeatLearnerId] = useState('')
  const [newLearnerName, setNewLearnerName] = useState('')
  const [newLearnerEmail, setNewLearnerEmail] = useState('')

  const effectiveSeatClassId = seatClassId ?? activeClassRows[0]?.id ?? null
  const availableToSeat = useMemo(
    () =>
      effectiveSeatClassId
        ? learnersAvailableForClass(roster, effectiveSeatClassId)
        : listActiveLearners(roster),
    [roster, effectiveSeatClassId],
  )
  const seatedInClass = useMemo(() => {
    if (!effectiveSeatClassId) return []
    return activeEnrollmentsForClass(roster, effectiveSeatClassId).map((e) => {
      const u = roster.users.find((x) => x.id === e.learnerUserId)
      return {
        enrollmentId: e.id,
        learnerId: e.learnerUserId,
        name: u?.displayName ?? e.learnerUserId,
        email: u?.email ?? null,
        avatarUrl: u?.avatarUrl ?? null,
      }
    })
  }, [roster, effectiveSeatClassId])
  const allLearners = useMemo(() => listLearners(roster), [roster])

  if (!teacher) {
    return (
      <EmptyState
        icon={School}
        title="Teacher profile missing"
        description="Ask Admin to create your Teacher account and mark it active."
      />
    )
  }

  return (
    <>
      <PageHeader
        icon={School}
        kicker="Teacher"
        title="Classes & programs"
        subtitle="Teacher owns programs (course labels), classes, seating, and session count — Admin only manages accounts and metrics."
      />
      <Flash message={message} error={error} />

      <Panel
        icon={Plus}
        title="Create program (course)"
        description="Label + start date + planned sessions (Day 1…N). Used on the learner tree."
      >
        <div className="form-grid teacher-class-form">
          <label>
            Code
            <input
              value={courseDraft.code}
              onChange={(e) => setCourseDraft((c) => ({ ...c, code: e.target.value }))}
              placeholder="ERES"
            />
          </label>
          <label>
            Name
            <input
              value={courseDraft.name}
              onChange={(e) => setCourseDraft((c) => ({ ...c, name: e.target.value }))}
              placeholder="ERE Level B"
            />
          </label>
          <label>
            Start date
            <input
              type="date"
              value={courseDraft.startsOn}
              onChange={(e) => setCourseDraft((c) => ({ ...c, startsOn: e.target.value }))}
            />
          </label>
          <label>
            Planned sessions
            <input
              type="number"
              min={1}
              value={courseDraft.sessionCount}
              onChange={(e) =>
                setCourseDraft((c) => ({ ...c, sessionCount: Number(e.target.value) || 15 }))
              }
            />
          </label>
        </div>
        <button
          type="button"
          className="primary"
          disabled={!courseDraft.code.trim() || !courseDraft.name.trim()}
          onClick={() => {
            const result = createCourse(roster, {
              code: courseDraft.code,
              name: courseDraft.name,
              startsOn: courseDraft.startsOn || null,
              schedule: defaultCourseSchedule({
                sessionCount: courseDraft.sessionCount,
                timeZone: 'Asia/Ho_Chi_Minh',
              }),
            })
            if (!result.ok) return err(result.error)
            setRoster(result.state)
            setDraft((d) => ({ ...d, courseId: result.value.id }))
            setCourseDraft((c) => ({ ...c, code: '', name: '' }))
            ok(`Program ${result.value.code} created`)
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> Create program
        </button>
      </Panel>

      <Panel
        icon={Plus}
        title="Create class"
        description="The new class is assigned to your Teacher profile."
      >
        <div className="form-grid teacher-class-form">
          <label>
            Class name
            <input
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
            />
          </label>
          <label>
            Course
            <select
              value={draft.courseId}
              onChange={(event) =>
                setDraft((current) => ({ ...current, courseId: event.target.value }))
              }
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} · {course.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Capacity
            <input
              type="number"
              min={1}
              value={draft.capacity}
              onChange={(event) =>
                setDraft((current) => ({ ...current, capacity: Number(event.target.value) }))
              }
            />
          </label>
        </div>
        <button
          type="button"
          className="primary"
          disabled={!draft.name.trim() || !draft.courseId}
          onClick={() => {
            const result = createClass(roster, {
              courseId: draft.courseId,
              name: draft.name,
              teacherUserId: teacher.id,
              capacity: draft.capacity,
            })
            if (!result.ok) return err(result.error)
            setRoster(result.state)
            setActiveClassId(result.value.id)
            setDraft((current) => ({ ...current, name: '' }))
            ok(`Created ${result.value.name}`)
          }}
        >
          <Plus className="h-4 w-4" aria-hidden /> Create class
        </button>
      </Panel>

      <Panel
        icon={School}
        title="Assigned classes"
        description={`${classes.length} class${classes.length === 1 ? '' : 'es'}`}
      >
        {classes.length === 0 ? (
          <EmptyState
            icon={School}
            title="No classes"
            description="Create your first class above."
          />
        ) : (
          <div className="list-cards">
            {classes.map((row) => {
              const course = roster.courses.find((item) => item.id === row.courseId)
              const editing = editingId === row.id
              return (
                <article key={row.id} className="teacher-class-card">
                  {editing ? (
                    <div className="form-grid teacher-class-edit">
                      <label>
                        Name
                        <input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                      </label>
                      <label>
                        Capacity
                        <input
                          type="number"
                          min={1}
                          value={editCapacity}
                          onChange={(event) => setEditCapacity(Number(event.target.value))}
                        />
                      </label>
                    </div>
                  ) : (
                    <div>
                      <h3>{row.name}</h3>
                      <p>
                        {course?.code ?? 'Course'} · capacity {row.capacity} · {row.status}
                      </p>
                    </div>
                  )}
                  <div className="row-actions">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => {
                            const result = updateClass(roster, row.id, {
                              name: editName,
                              capacity: editCapacity,
                            })
                            if (!result.ok) return err(result.error)
                            setRoster(result.state)
                            setEditingId(null)
                            ok('Class updated')
                          }}
                        >
                          <Check className="h-4 w-4" aria-hidden /> Save
                        </button>
                        <button type="button" className="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4" aria-hidden /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => {
                            setEditingId(row.id)
                            setEditName(row.name)
                            setEditCapacity(row.capacity)
                          }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden /> Edit
                        </button>
                        {row.status === 'active' ? (
                          <button
                            type="button"
                            className="ghost danger"
                            onClick={() => {
                              if (!window.confirm(`End ${row.name}? History will be preserved.`))
                                return
                              const result = endClass(roster, row.id)
                              if (!result.ok) return err(result.error)
                              setRoster(result.state)
                              ok('Class ended; history preserved')
                            }}
                          >
                            <Archive className="h-4 w-4" aria-hidden /> End class
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel
        icon={UserPlus}
        title="Seat learners"
        description="Pick a free account, or create a new learner. Already-seated names are listed below (not in the free list)."
      >
        {!effectiveSeatClassId ? (
          <EmptyState
            icon={School}
            title="Create a class first"
            description="Then you can seat learners into it."
          />
        ) : (
          <>
            <div className="form-grid teacher-class-form">
              <label>
                Class
                <select
                  value={effectiveSeatClassId}
                  onChange={(e) => {
                    setSeatClassId(e.target.value || null)
                    setSeatLearnerId('')
                  }}
                >
                  {activeClassRows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Existing learner (not yet in this class)
                <select
                  value={seatLearnerId}
                  onChange={(e) => setSeatLearnerId(e.target.value)}
                  disabled={availableToSeat.length === 0}
                >
                  <option value="">
                    {availableToSeat.length === 0
                      ? allLearners.length === 0
                        ? '— no learner accounts —'
                        : '— all learners already seated —'
                      : '— pick —'}
                  </option>
                  {availableToSeat.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                      {u.email ? ` · ${u.email}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {availableToSeat.length === 0 && allLearners.length > 0 ? (
              <p className="meta" role="status" style={{ marginTop: 8 }}>
                All <strong>{allLearners.length}</strong> learner account
                {allLearners.length === 1 ? '' : 's'} already sit in this class. Use{' '}
                <strong>Create + enroll</strong> for someone new, or go to{' '}
                <Link to="/teacher/session" className="underline font-semibold">
                  Live session
                </Link>{' '}
                to teach seated learners.
              </p>
            ) : null}

            {allLearners.length === 0 ? (
              <p className="meta" role="status" style={{ marginTop: 8 }}>
                No learner profiles in roster yet — create one below, or ask Admin → Accounts to add
                learners first.
              </p>
            ) : null}

            <button
              type="button"
              className="primary"
              disabled={!seatLearnerId || !effectiveSeatClassId}
              onClick={() => {
                if (!effectiveSeatClassId) return err('Create a class first')
                if (!seatLearnerId) return err('Pick a learner')
                const result = enrollLearner(roster, effectiveSeatClassId, seatLearnerId)
                if (!result.ok) return err(result.error)
                setRoster(result.state)
                setSeatLearnerId('')
                ok('Learner seated')
              }}
            >
              <UserPlus className="h-4 w-4" aria-hidden /> Enroll selected
            </button>

            <div className="form-grid teacher-class-form" style={{ marginTop: '1rem' }}>
              <label>
                New learner name
                <input
                  value={newLearnerName}
                  onChange={(e) => setNewLearnerName(e.target.value)}
                  placeholder="Display name"
                />
              </label>
              <label>
                Email (portal invite)
                <input
                  type="email"
                  value={newLearnerEmail}
                  onChange={(e) => setNewLearnerEmail(e.target.value)}
                  placeholder="learner@school.edu"
                />
              </label>
            </div>
            <button
              type="button"
              className="ghost"
              disabled={!newLearnerName.trim() || !effectiveSeatClassId}
              onClick={() => {
                if (!effectiveSeatClassId) return err('Create a class first')
                if (!newLearnerEmail.trim()) return err('Email required for learner invite')
                const result = createLearnerAndEnroll(roster, effectiveSeatClassId, {
                  displayName: newLearnerName,
                  email: newLearnerEmail.trim(),
                })
                if (!result.ok) return err(result.error)
                setRoster(result.state)
                setNewLearnerName('')
                setNewLearnerEmail('')
                ok(`Seated ${result.value.learner.displayName}`)
              }}
            >
              <Plus className="h-4 w-4" aria-hidden /> Create + enroll
            </button>

            <div style={{ marginTop: '1.25rem' }}>
              <p className="panel-title" style={{ marginBottom: 8 }}>
                <Users className="inline h-4 w-4" aria-hidden /> Seated now ({seatedInClass.length})
              </p>
              {seatedInClass.length === 0 ? (
                <p className="meta">Nobody seated in this class yet.</p>
              ) : (
                <ul className="person-list">
                  {seatedInClass.map((row) => (
                    <li key={row.enrollmentId} className="person-row">
                      <span className="cell-with-avatar">
                        <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
                        <span>
                          <strong>{row.name}</strong>
                          <span className="meta" style={{ display: 'block', margin: 0 }}>
                            {row.email ?? 'No email'}
                          </span>
                        </span>
                      </span>
                      <button
                        type="button"
                        className="ghost"
                        title="End enrollment (keeps history)"
                        onClick={() => {
                          if (!window.confirm(`Remove ${row.name} from this class?`)) return
                          const result = endEnrollment(roster, row.enrollmentId)
                          if (!result.ok) return err(result.error)
                          setRoster(result.state)
                          ok(`${row.name} enrollment ended — they reappear in Existing learner`)
                        }}
                      >
                        <UserMinus className="h-3.5 w-3.5" aria-hidden />
                        <span>Remove</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </Panel>
    </>
  )
}

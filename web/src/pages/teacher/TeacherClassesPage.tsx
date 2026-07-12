import { Archive, Check, Pencil, Plus, School, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import {
  createClass,
  createCourse,
  createLearnerAndEnroll,
  defaultCourseSchedule,
  endClass,
  enrollLearner,
  learnersAvailableForClass,
  listActiveLearners,
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
  const [seatClassId, setSeatClassId] = useState<string | null>(null)
  const [seatLearnerId, setSeatLearnerId] = useState('')
  const [newLearnerName, setNewLearnerName] = useState('')
  const [newLearnerEmail, setNewLearnerEmail] = useState('')
  const activeLearners = listActiveLearners(roster)

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
        description="Enroll an active learner account into one of your classes (or create + enroll)."
      >
        <div className="form-grid teacher-class-form">
          <label>
            Class
            <select
              value={seatClassId ?? classes[0]?.id ?? ''}
              onChange={(e) => setSeatClassId(e.target.value || null)}
            >
              {classes
                .filter((c) => c.status === 'active')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Existing learner
            <select
              value={seatLearnerId}
              onChange={(e) => setSeatLearnerId(e.target.value)}
            >
              <option value="">— pick —</option>
              {(seatClassId || classes[0]?.id
                ? learnersAvailableForClass(roster, seatClassId || classes[0]!.id)
                : activeLearners
              ).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="primary"
          disabled={!seatLearnerId || !(seatClassId || classes[0]?.id)}
          onClick={() => {
            const classId = seatClassId || classes[0]?.id
            if (!classId) return err('Create a class first')
            const result = enrollLearner(roster, classId, seatLearnerId)
            if (!result.ok) return err(result.error)
            setRoster(result.state)
            setSeatLearnerId('')
            ok('Learner seated')
          }}
        >
          <UserPlus className="h-4 w-4" aria-hidden /> Enroll
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
          disabled={!newLearnerName.trim() || !(seatClassId || classes[0]?.id)}
          onClick={() => {
            const classId = seatClassId || classes[0]?.id
            if (!classId) return err('Create a class first')
            if (!newLearnerEmail.trim()) return err('Email required for learner invite')
            const result = createLearnerAndEnroll(roster, classId, {
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
      </Panel>
    </>
  )
}

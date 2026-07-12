import { Archive, Check, Pencil, Plus, School, X } from 'lucide-react'
import { useState } from 'react'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { createClass, endClass, updateClass } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'
import { useStaffSession } from '../../auth/useStaffSession'

type Draft = { name: string; courseId: string; capacity: number }

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

  if (!teacher) {
    return (
      <EmptyState
        icon={School}
        title="Teacher profile missing"
        description="Ask Admin to assign your Teacher profile."
      />
    )
  }

  return (
    <>
      <PageHeader
        icon={School}
        kicker="Teacher"
        title="My classes"
        subtitle="Create, update, or safely end classes assigned to you."
      />
      <Flash message={message} error={error} />

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
    </>
  )
}

import {
  CalendarDays,
  ChartColumn,
  Home,
  Radio,
  School,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, NavTile, Panel, PersonRow, StatCard } from '../../components/ui'
import { activeEnrollmentsForClass } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'

export function TeacherOverviewPage() {
  const { roster, scheduling, capture, ledger } = useAppState()
  const teacher = roster.users.find((u) => u.roles.includes('teacher'))
  const classRow = roster.classes.find((c) => c.teacherUserId === teacher?.id) ?? roster.classes[0]
  const course = roster.courses.find((c) => c.id === classRow?.courseId)
  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )
  const scheduled = scheduling.scheduledSessions.filter((s) => s.classId === classRow?.id).length
  const seats = classRow ? activeEnrollmentsForClass(roster, classRow.id).length : 0
  const learners = classRow
    ? activeEnrollmentsForClass(roster, classRow.id).map((e) => {
        const u = roster.users.find((x) => x.id === e.learnerUserId)
        return {
          id: e.learnerUserId,
          name: u?.displayName ?? e.learnerUserId,
          avatarUrl: u?.avatarUrl ?? null,
        }
      })
    : []

  if (!classRow || !teacher) {
    return (
      <>
        <PageHeader
          icon={School}
          kicker="Teacher"
          title="No class"
          subtitle="Ask admin to assign you a class."
        />
        <EmptyState
          icon={School}
          title="Nothing assigned yet"
          description="Create a class and assign yourself as teacher from Admin."
          action={
            <Link to="/admin/classes" className="btn primary">
              <School className="h-4 w-4" aria-hidden />
              <span>Admin · Classes</span>
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        icon={Home}
        kicker={course?.code ?? 'Class'}
        title={classRow.name}
        subtitle={`${seats} enrolled · capacity ${classRow.capacity} · ${teacher.displayName}`}
      />

      <div className="stat-grid">
        <StatCard icon={CalendarDays} label="Scheduled" value={scheduled} hint="Sessions planned" />
        <StatCard
          icon={Radio}
          label="Live session"
          value={openSession ? 'In progress' : 'Idle'}
          hint={openSession ? 'Capture is open' : 'Start from Schedule'}
        />
        <StatCard icon={ChartColumn} label="Results logged" value={ledger.length} hint="Finalized" />
        <StatCard icon={Users} label="Roster" value={seats} hint={`of ${classRow.capacity} seats`} />
      </div>

      <Panel icon={Home} title="Today’s workflow" description="How teaching works in this LMS.">
        <div className="list-cards">
          <NavTile
            to="/teacher/calendar"
            title="Schedule"
            description="Plan sessions or start an ad-hoc class meeting."
            icon={CalendarDays}
            cta="Go"
          />
          <NavTile
            to="/teacher/session"
            title="Live session"
            description={
              openSession
                ? 'Take attendance and record Focus / Awareness colors.'
                : capture?.sessionStatus === 'completed'
                  ? 'Last session finished — start a new one from Schedule.'
                  : 'Start from Schedule first.'
            }
            icon={Radio}
            cta="Go"
          />
          <NavTile
            to="/teacher/progress"
            title="Reports"
            description="Course-level metrics (RFC, RAC, sample sizes)."
            icon={ChartColumn}
            cta="Go"
          />
        </div>
      </Panel>

      <Panel icon={Users} title="Roster" description="Learners enrolled in this class.">
        {learners.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No learners enrolled"
            description="Ask admin to seat learners into this class."
            action={
              <Link to="/admin/enrollments" className="btn ghost">
                Open enrollments
              </Link>
            }
          />
        ) : (
          <ul className="person-list">
            {learners.map((l) => (
              <PersonRow key={l.id} name={l.name} meta="Learner" avatarUrl={l.avatarUrl} />
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

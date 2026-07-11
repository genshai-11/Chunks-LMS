import { useMemo } from 'react'
import {
  BookMarked,
  ChartColumn,
  ClipboardCheck,
  GraduationCap,
  Home,
  ListChecks,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, NavTile, Panel, StatCard } from '../../components/ui'
import { useAppState } from '../../state/useAppState'

export function LearnerOverviewPage() {
  const { roster, scheduling, capture, ledger } = useAppState()
  const learner = roster.users.find((u) => u.roles.includes('learner'))
  const myEnrollments = useMemo(
    () => roster.enrollments.filter((e) => e.learnerUserId === learner?.id && e.status === 'active'),
    [roster.enrollments, learner?.id],
  )
  const myAttendance = useMemo(
    () => scheduling.attendance.filter((a) => a.learnerUserId === learner?.id),
    [scheduling.attendance, learner?.id],
  )
  const myResults = useMemo(() => {
    if (!capture || !learner) return []
    return capture.attempts.filter((a) => a.learnerUserId === learner.id)
  }, [capture, learner])

  if (!learner) {
    return (
      <>
        <PageHeader icon={GraduationCap} kicker="Learner" title="No profile" />
        <EmptyState
          icon={GraduationCap}
          title="No learner profile"
          description="Add a learner in Admin → People (you can upload a photo there)."
        />
      </>
    )
  }

  return (
    <>
      <div className="learner-dash-head">
        <UserAvatar
          name={learner.displayName}
          avatarUrl={learner.avatarUrl}
          size="xl"
          className="learner-dash-avatar"
        />
        <PageHeader
          icon={Home}
          kicker="Learner"
          title={`Hi, ${learner.displayName.split(' ')[0]}`}
          subtitle="Your classes, attendance, and progress — read only."
        />
      </div>

      <div className="stat-grid">
        <StatCard icon={BookMarked} label="My classes" value={myEnrollments.length} />
        <StatCard icon={ClipboardCheck} label="Attendance" value={myAttendance.length} />
        <StatCard icon={ListChecks} label="Session results" value={myResults.length} />
        <StatCard
          icon={ChartColumn}
          label="History"
          value={ledger.filter((r) => r.learnerUserId === learner.id).length}
        />
      </div>

      <Panel
        icon={BookMarked}
        title="Your classes"
        description="Active enrollments."
        actions={
          <Link to="/learner/enrollments" className="btn ghost">
            View all
          </Link>
        }
      >
        {myEnrollments.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="Not enrolled yet"
            description="When admin seats you in a class, it will show up here."
          />
        ) : (
          <div className="list-cards">
            {myEnrollments.map((e) => {
              const cl = roster.classes.find((c) => c.id === e.classId)
              const course = roster.courses.find((c) => c.id === cl?.courseId)
              return (
                <NavTile
                  key={e.id}
                  to="/learner/progress"
                  title={cl?.name ?? 'Class'}
                  description={course?.name ?? course?.code ?? 'Course'}
                  icon={BookMarked}
                  cta="Progress"
                />
              )
            })}
          </div>
        )}
      </Panel>

      <Panel icon={Home} title="Shortcuts" description="Jump to your records.">
        <div className="list-cards">
          <NavTile
            to="/learner/attendance"
            title="Attendance"
            description="Present, late, absent, or excused."
            icon={ClipboardCheck}
            cta="Open"
          />
          <NavTile
            to="/learner/results"
            title="Results"
            description="Observation outcomes from sessions."
            icon={ListChecks}
            cta="Open"
          />
          <NavTile
            to="/learner/progress"
            title="Progress"
            description="Your operational metrics over a window."
            icon={ChartColumn}
            cta="Open"
          />
        </div>
      </Panel>
    </>
  )
}

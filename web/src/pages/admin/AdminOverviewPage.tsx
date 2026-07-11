import {
  BookOpen,
  ChartColumn,
  Gauge,
  History,
  LayoutDashboard,
  Link2,
  Radio,
  RotateCcw,
  School,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { NavTile, Panel, StatCard } from '../../components/ui'
import { inviteCoverage } from '../../modules/roster/class-context'
import {
  activeEnrollmentsForClass,
  listTeachers,
} from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'

export function AdminOverviewPage() {
  const { roster, scheduling, ledger, resetAll } = useAppState()
  const teachers = listTeachers(roster).length
  const activeSeats = roster.classes.reduce(
    (n, cl) => n + activeEnrollmentsForClass(roster, cl.id).length,
    0,
  )
  const openSessions = scheduling.learningSessions.filter((s) => s.status === 'open').length
  const coverage = inviteCoverage(roster)
  const activeCourses = roster.courses.filter((c) => c.status === 'active').length

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        kicker="Admin"
        title="Dashboard"
        subtitle="What needs attention next — setup, invites, live sessions, progress."
        actions={
          <button
            type="button"
            className="ghost"
            onClick={() => {
              if (!window.confirm('Clear all local data?')) return
              resetAll()
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            <span>Clear data</span>
          </button>
        }
      />

      <div className="stat-grid">
        <StatCard
          icon={BookOpen}
          label="Courses"
          value={activeCourses}
          hint={`${roster.courses.length} total`}
        />
        <StatCard
          icon={School}
          label="Classes"
          value={roster.classes.filter((c) => c.status === 'active').length}
          hint={`${activeSeats} active seats`}
        />
        <StatCard
          icon={Link2}
          label="Invite coverage"
          value={`${coverage.percent}%`}
          hint={`${coverage.withEmail}/${coverage.seats} seats with email`}
        />
        <StatCard
          icon={Radio}
          label="Live now"
          value={openSessions}
          hint={openSessions ? 'Open learning sessions' : 'No open sessions'}
        />
        <StatCard icon={Users} label="Teachers" value={teachers} hint="Directory" />
        <StatCard
          icon={ChartColumn}
          label="Results"
          value={ledger.length}
          hint="Finalized observations"
        />
      </div>

      {coverage.seats > 0 && coverage.percent < 100 ? (
        <p className="banner err" role="status">
          {coverage.seats - coverage.withEmail} seated learner(s) missing email — add email on
          class roster to share portal links.{' '}
          <Link to="/admin/classes" className="underline font-semibold">
            Open classes
          </Link>
        </p>
      ) : null}

      <Panel
        icon={LayoutDashboard}
        title="Do next"
        description="Primary admin workflow."
      >
        <div className="list-cards">
          <NavTile
            to="/admin/courses"
            step="1"
            title="Courses"
            description="Programs and auto-schedule."
            icon={BookOpen}
          />
          <NavTile
            to="/admin/classes"
            step="2"
            title="Classes + invites"
            description="Teacher, capacity, seat learners, copy portal links."
            icon={School}
          />
          <NavTile
            to="/admin/ops"
            step="3"
            title="Ops board"
            description="Live sessions, attendance rates, open probes."
            icon={Radio}
            cta="Open"
          />
          <NavTile
            to="/admin/audit"
            step="4"
            title="Audit & correct"
            description="History + post-session corrections."
            icon={History}
            cta="Open"
          />
          <NavTile
            to="/admin/analysis"
            title="Analysis"
            description="Progress for any course/class."
            icon={ChartColumn}
            cta="Open"
          />
          <NavTile
            to="/admin/metrics"
            title="Metrics"
            description="Show/hide indicators, min sample, probe max."
            icon={Gauge}
            cta="Open"
          />
          <NavTile
            to="/admin/people"
            title="People"
            description="Teacher and learner directory."
            icon={Users}
          />
          <NavTile
            to="/admin/enrollments"
            title="Enrollments"
            description="Global enrollment history."
            icon={UserPlus}
          />
        </div>
      </Panel>
    </>
  )
}

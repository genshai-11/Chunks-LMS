import {
  BookOpen,
  Gauge,
  LayoutDashboard,
  RotateCcw,
  School,
  UserPlus,
  Users,
} from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { NavTile, StatCard } from '../../components/ui'
import {
  activeEnrollmentsForClass,
  listLearners,
  listTeachers,
} from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'

export function AdminOverviewPage() {
  const { roster, resetAll } = useAppState()
  const teachers = listTeachers(roster).length
  const learners = listLearners(roster).length
  const activeSeats = roster.classes.reduce(
    (n, cl) => n + activeEnrollmentsForClass(roster, cl.id).length,
    0,
  )

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        kicker="Admin"
        title="Dashboard"
        subtitle="Organization setup: courses → classes → people → enrollments."
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
          value={roster.courses.length}
          hint="Active programs"
        />
        <StatCard
          icon={School}
          label="Classes"
          value={roster.classes.length}
          hint="With capacity"
        />
        <StatCard icon={Users} label="Teachers" value={teachers} hint="Directory" />
        <StatCard
          icon={UserPlus}
          label="Active seats"
          value={
            <>
              {activeSeats}
              <span className="ml-1 font-sans text-sm font-medium text-slate-500">
                / {learners}
              </span>
            </>
          }
          hint="Seated learners"
        />
      </div>

      <section className="panel">
        <div className="panel-header">
          <div className="panel-header-main">
            <span className="panel-icon" aria-hidden>
              <LayoutDashboard className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="panel-title">Setup workflow</h2>
              <p className="panel-desc">
                Course → class (teacher + capacity) → add students on the class roster.
              </p>
            </div>
          </div>
        </div>
        <div className="list-cards">
          <NavTile
            to="/admin/courses"
            step="1"
            title="Courses"
            description="Define programs and schedule (e.g. ERE-Level-B)."
            icon={BookOpen}
          />
          <NavTile
            to="/admin/classes"
            step="2"
            title="Classes + students"
            description="Assign teacher, capacity, then seat learners (new or directory)."
            icon={School}
          />
          <NavTile
            to="/admin/people"
            step="3"
            title="People"
            description="Directory for teachers and extra learner profiles."
            icon={Users}
          />
          <NavTile
            to="/admin/enrollments"
            step="4"
            title="Enrollments"
            description="Global enrollment history (optional; can seat from Classes)."
            icon={UserPlus}
          />
          <NavTile
            to="/admin/metrics"
            step="5"
            title="Metrics"
            description="Turn metrics on/off, min sample, experimental labels."
            icon={Gauge}
            cta="Open"
          />
        </div>
      </section>
    </>
  )
}

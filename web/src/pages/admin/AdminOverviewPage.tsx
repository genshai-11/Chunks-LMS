import { ChartColumn, Gauge, LayoutDashboard, Link2, RotateCcw, Users } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { NavTile, Panel, StatCard } from '../../components/ui'
import { listLearners, listTeachers } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'

export function AdminOverviewPage() {
  const { roster, ledger, resetAll, metricSettings } = useAppState()
  const teachers = listTeachers(roster)
  const learners = listLearners(roster)
  const activeTeachers = teachers.filter((u) => (u.accountStatus ?? 'active') === 'active').length
  const activeLearners = learners.filter((u) => (u.accountStatus ?? 'active') === 'active').length
  const inviteReady = learners.filter(
    (u) => u.email && (u.accountStatus ?? 'active') === 'active',
  ).length
  const metricsOn = metricSettings.metrics.filter((m) => m.enabled).length

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        kicker="Admin"
        title="Accounts & metrics"
        subtitle="Manage teacher/learner accounts and which metrics appear on Analysis charts. Courses and live sessions are owned by Teacher."
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
          icon={Users}
          label="Teachers"
          value={`${activeTeachers}/${teachers.length}`}
          hint="Active / total"
        />
        <StatCard
          icon={Users}
          label="Learners"
          value={`${activeLearners}/${learners.length}`}
          hint="Active / total"
        />
        <StatCard
          icon={Link2}
          label="Invites ready"
          value={inviteReady}
          hint="Active learners with email"
        />
        <StatCard
          icon={Gauge}
          label="Metrics on"
          value={metricsOn}
          hint="Shown on learner/teacher charts"
        />
        <StatCard
          icon={ChartColumn}
          label="Results"
          value={ledger.length}
          hint="Finalized observations (real ledger)"
        />
      </div>

      <Panel
        icon={LayoutDashboard}
        title="Do next"
        description="Admin scope: accounts + metric catalog only."
      >
        <div className="list-cards">
          <NavTile
            to="/admin/people"
            step="1"
            title="Accounts"
            description="Add teacher/learner, active/inactive, copy or email invites."
            icon={Users}
          />
          <NavTile
            to="/admin/metrics"
            step="2"
            title="Metrics"
            description="Enable RFC, RAC, n count / n depth max / n depth avg for charts."
            icon={Gauge}
          />
          <NavTile
            to="/admin/analysis"
            title="Analysis"
            description="Org-wide progress from finalized ledger (no mock data)."
            icon={ChartColumn}
            cta="Open"
          />
        </div>
      </Panel>
    </>
  )
}

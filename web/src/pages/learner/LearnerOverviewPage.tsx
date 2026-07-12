import { useMemo } from 'react'
import {
  BookMarked,
  ChartColumn,
  GraduationCap,
  Home,
  ListChecks,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { EditableAvatar } from '../../components/EditableAvatar'
import { EmptyState, NavTile, Panel, StatCard } from '../../components/ui'
import { useLearnerClassContext } from '../../hooks/useLearnerClassContext'
import { useAppState } from '../../state/useAppState'
import { updateUserProfile } from '../../modules/roster/service'

export function LearnerOverviewPage() {
  const { roster, setRoster, syncNow, scheduling, ledger } = useAppState()
  const { learner, options, classRow, course, hasMultiple } = useLearnerClassContext()

  const myResults = useMemo(() => {
    if (!learner) return []
    return ledger.filter(
      (r) =>
        r.learnerUserId === learner.id && (!classRow || r.classId === classRow.id),
    )
  }, [ledger, learner, classRow])

  const nextSession = useMemo(() => {
    if (!classRow) return null
    return scheduling.scheduledSessions
      .filter((s) => s.classId === classRow.id && s.status === 'scheduled')
      .slice()
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))[0]
  }, [scheduling.scheduledSessions, classRow])

  if (!learner) {
    return (
      <>
        <PageHeader icon={GraduationCap} kicker="Learner" title="No profile" />
        <EmptyState
          icon={GraduationCap}
          title="Open your portal"
          description="Use the invite link from your teacher or enter your registered email."
          action={
            <Link to="/access" className="btn primary">
              Open portal
            </Link>
          }
        />
      </>
    )
  }

  return (
    <>
      <div className="learner-dash-head">
        <EditableAvatar
          name={learner.displayName}
          avatarUrl={learner.avatarUrl}
          size="xl"
          className="learner-dash-avatar"
          onSave={async (url) => {
            const r = updateUserProfile(roster, learner.id, { avatarUrl: url })
            if (r.ok) {
              setRoster(r.state)
              await syncNow({ roster: r.state })
            }
          }}
        />
        <PageHeader
          icon={Home}
          kicker="Learner"
          title={`Hi, ${learner.displayName.split(' ')[0]}`}
          subtitle={
            classRow
              ? `${classRow.name}${course?.code ? ` · ${course.code}` : ''}${
                  hasMultiple ? ` · ${options.length} classes` : ''
                }`
              : 'Your classes and progress — read only.'
          }
        />
      </div>

      <div className="stat-grid">
        <StatCard icon={BookMarked} label="My classes" value={options.length} />
        <StatCard icon={ListChecks} label="Results" value={myResults.length} hint="Finalized" />
        <StatCard
          icon={ChartColumn}
          label="Next session"
          value={
            nextSession
              ? new Date(nextSession.plannedStart).toLocaleDateString()
              : '—'
          }
          hint={
            nextSession
              ? new Date(nextSession.plannedStart).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'None scheduled'
          }
        />
      </div>

      <Panel
        icon={BookMarked}
        title="Your classes"
        description={hasMultiple ? 'Switch class in the sidebar.' : 'Active enrollments.'}
        actions={
          <Link to="/learner/enrollments" className="btn ghost">
            View all
          </Link>
        }
      >
        {options.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="Not enrolled yet"
            description="When staff seats you in a class, it will show up here."
          />
        ) : (
          <div className="list-cards">
            {options.map((o) => (
              <NavTile
                key={o.enrollment.id}
                to="/learner/analysis"
                title={o.classRow.name}
                description={o.course?.name ?? o.course?.code ?? 'Course'}
                icon={BookMarked}
                cta="Progress"
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel icon={Home} title="Shortcuts" description="Jump to your records.">
        <div className="list-cards">
          <NavTile
            to="/learner/analysis"
            title="Analysis"
            description="Your operational metrics for the selected class."
            icon={ChartColumn}
            cta="Open"
          />
          <NavTile
            to="/learner/enrollments"
            title="My classes"
            description="Enrollment details."
            icon={BookMarked}
            cta="Open"
          />
        </div>
      </Panel>
    </>
  )
}

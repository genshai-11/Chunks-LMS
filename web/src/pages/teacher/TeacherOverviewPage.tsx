import {
  CalendarDays,
  ChartColumn,
  ClipboardCopy,
  Home,
  Link2,
  Radio,
  School,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, NavTile, Panel, PersonRow, StatCard } from '../../components/ui'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { useFlash } from '../../hooks/useFlash'
import { Flash } from '../../components/Flash'
import {
  activeEnrollmentsForClass,
  formatClassInviteClipboard,
  learnerInviteUrl,
} from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'

export function TeacherOverviewPage() {
  const { roster, scheduling, capture, ledger } = useAppState()
  const { options, classRow, course, teacher, seats, hasMultiple } = useTeacherClassContext()
  const { message, error, ok, err } = useFlash()

  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )
  const scheduled = scheduling.scheduledSessions.filter((s) => s.classId === classRow?.id).length
  const classResults = classRow
    ? ledger.filter((r) => r.classId === classRow.id).length
    : 0

  const learners = classRow
    ? activeEnrollmentsForClass(roster, classRow.id).map((e) => {
        const u = roster.users.find((x) => x.id === e.learnerUserId)
        return {
          id: e.learnerUserId,
          name: u?.displayName ?? e.learnerUserId,
          avatarUrl: u?.avatarUrl ?? null,
          email: u?.email ?? null,
          invite: u ? learnerInviteUrl(u) : null,
        }
      })
    : []

  const inviteReady = learners.filter((l) => l.invite).length

  const nextScheduled = scheduling.scheduledSessions
    .filter((s) => s.classId === classRow?.id && s.status === 'scheduled')
    .slice()
    .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))[0]

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
          description="Create a class and assign a teacher from Admin → Classes."
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
        subtitle={`${seats} enrolled · capacity ${classRow.capacity} · ${teacher.displayName}${
          hasMultiple ? ` · ${options.length} classes` : ''
        }`}
      />
      <Flash message={message} error={error} />

      <div className="stat-grid">
        <StatCard icon={CalendarDays} label="Scheduled" value={scheduled} hint="Sessions planned" />
        <StatCard
          icon={Radio}
          label="Live session"
          value={openSession ? 'In progress' : 'Idle'}
          hint={
            openSession
              ? 'Capture is open'
              : nextScheduled
                ? `Next ${new Date(nextScheduled.plannedStart).toLocaleString()}`
                : 'Start from Schedule'
          }
        />
        <StatCard
          icon={ChartColumn}
          label="Results"
          value={classResults}
          hint="Finalized for this class"
        />
        <StatCard
          icon={Link2}
          label="Invites ready"
          value={`${inviteReady}/${learners.length}`}
          hint="Seats with portal email"
        />
      </div>

      <Panel icon={Home} title="Do next" description="Primary teaching path for this class.">
        <div className="list-cards">
          <NavTile
            to="/teacher/calendar"
            title="Schedule"
            description={
              nextScheduled
                ? `Next session ${new Date(nextScheduled.plannedStart).toLocaleString()}`
                : 'Plan sessions or start ad-hoc.'
            }
            icon={CalendarDays}
            cta="Go"
          />
          <NavTile
            to="/teacher/session"
            title={openSession ? 'Resume live session' : 'Live session'}
            description={
              openSession
                ? 'Attendance and Observe are open.'
                : capture?.sessionStatus === 'completed'
                  ? 'Last session finished — start a new one from Schedule.'
                  : 'Start from Schedule first.'
            }
            icon={Radio}
            cta="Go"
          />
          <NavTile
            to="/teacher/analysis"
            title="Analysis"
            description="RFC, RAC, and day-by-day progress for this class."
            icon={ChartColumn}
            cta="Go"
          />
        </div>
      </Panel>

      <Panel
        icon={Users}
        title="Roster & invites"
        description="Copy portal links for learners (no Clerk)."
        actions={
          inviteReady > 0 ? (
            <button
              type="button"
              className="ghost"
              onClick={async () => {
                const text = formatClassInviteClipboard(roster, classRow.id)
                try {
                  await navigator.clipboard.writeText(text)
                  ok(`Copied ${inviteReady} invite link(s)`)
                } catch {
                  err('Could not copy — copy links from the list')
                }
              }}
            >
              <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
              <span>Copy all links</span>
            </button>
          ) : undefined
        }
      >
        {learners.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No learners enrolled"
            description="Ask admin to seat learners into this class."
            action={
              <Link to="/admin/classes" className="btn ghost">
                Open classes
              </Link>
            }
          />
        ) : (
          <ul className="person-list">
            {learners.map((l) => (
              <PersonRow
                key={l.id}
                name={l.name}
                meta={l.email ?? 'No email — no invite link'}
                avatarUrl={l.avatarUrl}
                actions={
                  l.invite ? (
                    <button
                      type="button"
                      className="ghost"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(l.invite!)
                          ok(`Invite copied for ${l.name}`)
                        } catch {
                          ok(l.invite!)
                        }
                      }}
                    >
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
                      <span>Copy</span>
                    </button>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

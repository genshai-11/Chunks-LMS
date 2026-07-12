import {
  CalendarDays,
  ChartColumn,
  ClipboardCopy,
  Eye,
  Home,
  Link2,
  Play,
  Radio,
  School,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
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
  const { roster, scheduling, capture, ledger, activeLearnerUserId, setActiveLearnerUserId } =
    useAppState()
  const { options, classRow, course, teacher, seats, hasMultiple } = useTeacherClassContext()
  const { message, error, ok, err } = useFlash()

  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )
  const scheduled = scheduling.scheduledSessions.filter((s) => s.classId === classRow?.id).length
  const classResults = classRow ? ledger.filter((r) => r.classId === classRow.id).length : 0

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
  const selectedLearner =
    learners.find((learner) => learner.id === activeLearnerUserId) ?? learners[0] ?? null
  const selectedResults = selectedLearner
    ? ledger.filter(
        (result) => result.classId === classRow?.id && result.learnerUserId === selectedLearner.id,
      )
    : []
  const selectedRisk = selectedResults.filter(
    (result) => result.effectiveColor === 'red' || result.effectiveColor === 'yellow',
  ).length
  const selectedRfc =
    selectedResults.length > 0 ? Math.round((selectedRisk / selectedResults.length) * 100) : null
  const selectedRac = selectedRfc == null ? null : 100 - selectedRfc
  const selectedAttendance = selectedLearner
    ? scheduling.attendance.filter(
        (record) =>
          record.learnerUserId === selectedLearner.id &&
          scheduling.learningSessions.some(
            (session) =>
              session.id === record.learningSessionId && session.classId === classRow?.id,
          ),
      )
    : []

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
        <StatCard
          icon={Users}
          label="Learners"
          value={`${seats} / ${classRow.capacity}`}
          hint="Enrolled in this class"
        />
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

      <Panel
        icon={Home}
        title="Do next"
        description={`Course ${course?.code ?? '—'} is shared; this class has its own roster, capacity, and calendar.`}
      >
        <div className="list-cards">
          <NavTile
            to="/teacher/calendar"
            title="Schedule"
            description={
              nextScheduled
                ? `Next planned ${new Date(nextScheduled.plannedStart).toLocaleString()} · or add a flexible slot`
                : 'Apply course plan and/or add flexible days for this class only.'
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
                  ? 'Last day finished — start the next teaching day.'
                  : 'Start Day 1…N here, or from a Schedule slot.'
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

      {selectedLearner ? (
        <Panel
          icon={Users}
          title="Learner profile"
          description="Finalized Focus & Awareness indicators for the selected learner."
        >
          <div className="teacher-learner-profile">
            <div className="teacher-learner-identity">
              <UserAvatar
                name={selectedLearner.name}
                avatarUrl={selectedLearner.avatarUrl}
                size="xl"
              />
              <div>
                <h3>{selectedLearner.name}</h3>
                <p>{selectedLearner.email ?? 'No email'}</p>
              </div>
            </div>
            <div className="teacher-learner-metrics" aria-label="Learner progress summary">
              <span>
                <strong>{selectedResults.length}</strong>
                <small>Finalized</small>
              </span>
              <span>
                <strong>{selectedRfc == null ? '—' : `${selectedRfc}%`}</strong>
                <small>RFC</small>
              </span>
              <span>
                <strong>{selectedRac == null ? '—' : `${selectedRac}%`}</strong>
                <small>RAC</small>
              </span>
              <span>
                <strong>{selectedAttendance.length}</strong>
                <small>Attendance</small>
              </span>
            </div>
            <div className="btn-row teacher-learner-actions">
              <Link
                to={`/teacher/calendar?learner=${encodeURIComponent(selectedLearner.id)}`}
                className="btn primary"
                onClick={() => setActiveLearnerUserId(selectedLearner.id)}
              >
                <Play className="h-4 w-4" aria-hidden />
                {openSession ? 'Resume session' : 'Start session'}
              </Link>
              <Link
                to={`/teacher/analysis?learner=${encodeURIComponent(selectedLearner.id)}`}
                className="btn ghost"
                onClick={() => setActiveLearnerUserId(selectedLearner.id)}
              >
                <Eye className="h-4 w-4" aria-hidden />
                View report
              </Link>
              {selectedLearner.invite ? (
                <button
                  type="button"
                  className="ghost"
                  onClick={async () => {
                    await navigator.clipboard.writeText(selectedLearner.invite!)
                    ok(`Invite copied for ${selectedLearner.name}`)
                  }}
                >
                  <Link2 className="h-4 w-4" aria-hidden />
                  Copy invite
                </button>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}

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
                  <div className="row-actions">
                    <button
                      type="button"
                      className={selectedLearner?.id === l.id ? 'primary' : 'ghost'}
                      onClick={() => setActiveLearnerUserId(l.id)}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      <span>{selectedLearner?.id === l.id ? 'Selected' : 'Profile'}</span>
                    </button>
                    {l.invite ? (
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
                    ) : null}
                  </div>
                }
              />
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

import {
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
import { EmptyState, Panel, StatCard } from '../../components/ui'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { useFlash } from '../../hooks/useFlash'
import { Flash } from '../../components/Flash'
import {
  activeEnrollmentsForClass,
  formatClassInviteClipboard,
  learnerInviteUrl,
} from '../../modules/roster/service'
import { calculateMetrics } from '../../modules/metrics/calculate'
import { useAppState } from '../../state/useAppState'

/**
 * Teacher home is learner-first: roster tree with program labels (course),
 * start date, planned sessions, quick RFC progress — then start session.
 */
export function TeacherOverviewPage() {
  const { roster, scheduling, capture, ledger, activeLearnerUserId, setActiveLearnerUserId } =
    useAppState()
  const { options, classRow, course, teacher, seats, hasMultiple } = useTeacherClassContext()
  const { message, error, ok, err } = useFlash()

  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )
  const plannedSessions =
    course?.schedule?.sessionCount ??
    scheduling.scheduledSessions.filter(
      (s) =>
        s.classId === classRow?.id && s.status !== 'cancelled' && s.status !== 'rescheduled',
    ).length ??
    0
  const taughtDays = scheduling.learningSessions.filter(
    (s) => s.classId === classRow?.id && (s.status === 'completed' || s.status === 'open'),
  ).length
  const classResults = classRow ? ledger.filter((r) => r.classId === classRow.id) : []

  const learners = classRow
    ? activeEnrollmentsForClass(roster, classRow.id).map((e) => {
        const u = roster.users.find((x) => x.id === e.learnerUserId)
        const learnerLedger = classResults.filter((r) => r.learnerUserId === e.learnerUserId)
        const metrics =
          learnerLedger.length > 0
            ? calculateMetrics(
                learnerLedger.map((r) => ({
                  effectiveColor: r.effectiveColor,
                  enteredProbeFlow: r.enteredProbeFlow,
                  probeEventCount: r.probeEventCount,
                  learnerId: r.learnerUserId,
                })),
              )
            : null
        const rfc = metrics?.find((m) => m.key === 'rfc')
        const rac = metrics?.find((m) => m.key === 'rac')
        const nCount = metrics?.find((m) => m.key === 'n_count')
        return {
          id: e.learnerUserId,
          name: u?.displayName ?? e.learnerUserId,
          avatarUrl: u?.avatarUrl ?? null,
          email: u?.email ?? null,
          invite: u ? learnerInviteUrl(u) : null,
          accountStatus: u?.accountStatus ?? 'active',
          enrolledAt: e.startedAt,
          sample: learnerLedger.length,
          rfc: rfc?.value ?? null,
          rac: rac?.value ?? null,
          nCount: nCount?.value ?? null,
        }
      })
    : []

  const inviteReady = learners.filter((l) => l.invite).length
  const selectedLearner =
    learners.find((learner) => learner.id === activeLearnerUserId) ?? learners[0] ?? null

  if (!classRow || !teacher) {
    return (
      <>
        <PageHeader
          icon={Users}
          kicker="Teacher"
          title="Learners"
          subtitle="Create a class and seat learners to start teaching."
        />
        <EmptyState
          icon={School}
          title="No class yet"
          description="Teacher owns classes and programs. Create a class, then seat learners."
          action={
            <Link to="/teacher/classes" className="btn primary">
              <School className="h-4 w-4" aria-hidden />
              <span>My classes</span>
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
        kicker={course?.code ?? 'Program'}
        title="Learners"
        subtitle={`${seats} learners · ${course?.name ?? classRow.name} · start ${
          course?.startsOn ?? '—'
        } · ${taughtDays}/${plannedSessions || '—'} sessions${
          hasMultiple ? ` · ${options.length} classes` : ''
        }`}
      />
      <Flash message={message} error={error} />

      <div className="stat-grid">
        <StatCard
          icon={Radio}
          label="Live"
          value={openSession ? `Day ${openSession.sessionNumber ?? '—'}` : 'Idle'}
          hint={
            openSession
              ? openSession.sessionKind !== 'regular'
                ? openSession.sessionKind
                : 'Capture open'
              : 'Start with selected learners'
          }
        />
        <StatCard
          icon={ChartColumn}
          label="Finalized"
          value={classResults.length}
          hint="Real ledger rows"
        />
        <StatCard
          icon={Link2}
          label="Invites"
          value={`${inviteReady}/${learners.length}`}
          hint="Portal email ready"
        />
      </div>

      <Panel
        icon={Users}
        title="Learner tree"
        description={`${course?.code ?? 'Program'} · started ${course?.startsOn ?? '—'} · planned ${
          plannedSessions || '—'
        } sessions. Progress uses finalized observations only.`}
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
            title="No learners seated"
            description="Seat learners from Classes."
            action={
              <Link to="/teacher/classes" className="btn ghost">
                Open classes
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table aria-label="Learner tree">
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  <th scope="col" title="(Red+Yellow)/finalized from real ledger">
                    RFC
                  </th>
                  <th scope="col" title="(Green+Purple)/finalized">
                    RAC
                  </th>
                  <th scope="col" title="Times teacher selected Green (2) / entered probe">
                    n count
                  </th>
                </tr>
              </thead>
              <tbody>
                {learners.map((l) => {
                  const selected = selectedLearner?.id === l.id
                  return (
                    <tr
                      key={l.id}
                      style={{ cursor: 'pointer' }}
                      className={`transition-colors hover:bg-slate-100/50 ${selected ? 'bg-slate-100/80 font-medium' : ''}`}
                      onClick={() => setActiveLearnerUserId(l.id)}
                    >
                      <td>
                        <span className="cell-with-avatar">
                          <UserAvatar name={l.name} avatarUrl={l.avatarUrl} size="sm" />
                          <span>
                            <strong>{l.name}</strong>
                            {l.accountStatus === 'inactive' ? (
                              <span className="badge" style={{ marginLeft: 6 }}>
                                inactive
                              </span>
                            ) : null}
                            <div className="meta" style={{ margin: 0 }}>
                              {l.email ?? 'No email'}
                            </div>
                          </span>
                        </span>
                      </td>
                      <td className="font-mono text-xs tabular-nums">
                        {l.rfc == null ? '—' : `${Math.round(l.rfc * 100)}%`}
                        <div className="meta" style={{ margin: 0 }}>
                          sample={l.sample}
                        </div>
                      </td>
                      <td className="font-mono text-xs tabular-nums">
                        {l.rac == null ? '—' : `${Math.round(l.rac * 100)}%`}
                      </td>
                      <td className="font-mono text-xs tabular-nums">
                        {l.nCount == null ? '—' : Math.round(l.nCount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selectedLearner ? (
        <Panel
          icon={Users}
          title={selectedLearner.name}
          description="Quick progress from finalized ledger only — no mock values."
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
                <p className="meta">
                  {course?.code ?? '—'} · start {course?.startsOn ?? '—'} · {taughtDays}/
                  {plannedSessions || '—'} sessions · sample={selectedLearner.sample}
                </p>
              </div>
            </div>
            <div className="teacher-learner-metrics" aria-label="Learner progress summary">
              <span>
                <strong>
                  {selectedLearner.rfc == null
                    ? '—'
                    : `${Math.round(selectedLearner.rfc * 100)}%`}
                </strong>
                <small>RFC</small>
              </span>
              <span>
                <strong>
                  {selectedLearner.rac == null
                    ? '—'
                    : `${Math.round(selectedLearner.rac * 100)}%`}
                </strong>
                <small>RAC</small>
              </span>
              <span>
                <strong>
                  {selectedLearner.nCount == null ? '—' : Math.round(selectedLearner.nCount)}
                </strong>
                <small>n count</small>
              </span>
              <span>
                <strong>{selectedLearner.sample}</strong>
                <small>Finalized</small>
              </span>
            </div>
            <div className="btn-row teacher-learner-actions">
              <Link
                to={`/teacher/session?learner=${encodeURIComponent(selectedLearner.id)}`}
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
                  className="btn ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedLearner.invite!)
                      ok(`Invite copied for ${selectedLearner.name}`)
                    } catch {
                      ok(selectedLearner.invite!)
                    }
                  }}
                >
                  <Link2 className="h-4 w-4" aria-hidden />
                  <span>Copy invite</span>
                </button>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}

      {capture?.sessionStatus === 'open' ? (
        <p className="meta">
          Capture board is open —{' '}
          <Link to="/teacher/observe" className="underline font-semibold">
            continue Observe
          </Link>
          .
        </p>
      ) : null}
    </>
  )
}

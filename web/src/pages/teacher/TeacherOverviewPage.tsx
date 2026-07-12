import { useMemo, useState } from 'react'
import {
  ChartColumn,
  ClipboardCopy,
  Eye,
  Home,
  LayoutGrid,
  Link2,
  List,
  Play,
  Radio,
  School,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel, StatCard } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import {
  activeEnrollmentsForClass,
  createLearnerAndEnroll,
  formatClassInviteClipboard,
  learnerInviteUrl,
} from '../../modules/roster/service'
import {
  formatPercent,
  learnerRfcStats,
  summarizeLearnerSessions,
} from '../../modules/teacher/learner-insights'
import { useAppState } from '../../state/useAppState'

type ViewMode = 'grid' | 'list'

export function TeacherOverviewPage() {
  const {
    roster,
    setRoster,
    scheduling,
    capture,
    ledger,
    activeLearnerUserId,
    setActiveLearnerUserId,
    syncNow,
  } = useAppState()
  const { options, classRow, course, teacher, seats, hasMultiple } = useTeacherClassContext()
  const { message, error, ok, err } = useFlash()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )
  const plannedSessions =
    course?.schedule?.sessionCount ??
    scheduling.scheduledSessions.filter(
      (s) => s.classId === classRow?.id && s.status !== 'cancelled' && s.status !== 'rescheduled',
    ).length ??
    0
  const taughtDays = scheduling.learningSessions.filter(
    (s) => s.classId === classRow?.id && (s.status === 'completed' || s.status === 'open'),
  ).length

  const learners = useMemo(() => {
    if (!classRow) return []
    return activeEnrollmentsForClass(roster, classRow.id).map((enrollment) => {
      const user = roster.users.find((x) => x.id === enrollment.learnerUserId)
      const sessionRows = summarizeLearnerSessions({
        ledger,
        scheduling,
        learnerUserId: enrollment.learnerUserId,
        classId: classRow.id,
      })
      const rfcStats = learnerRfcStats(sessionRows)
      return {
        id: enrollment.learnerUserId,
        name: user?.displayName ?? enrollment.learnerUserId,
        avatarUrl: user?.avatarUrl ?? null,
        email: user?.email ?? null,
        invite: user ? learnerInviteUrl(user) : null,
        accountStatus: user?.accountStatus ?? 'active',
        enrolledAt: enrollment.startedAt,
        sessions: rfcStats.count,
        finalized: sessionRows.reduce((sum, row) => sum + row.total, 0),
        rfcMin: rfcStats.min,
        rfcMax: rfcStats.max,
        rfcAvg: rfcStats.avg,
      }
    })
  }, [classRow, ledger, roster, scheduling])

  const inviteReady = learners.filter((learner) => learner.invite).length
  const selectedLearner =
    learners.find((learner) => learner.id === activeLearnerUserId) ?? learners[0] ?? null

  async function addLearner() {
    if (!classRow) return
    const result = createLearnerAndEnroll(roster, classRow.id, {
      displayName: newName,
      email: newEmail,
    })
    if (!result.ok) return err(result.error)
    setRoster(result.state)
    setActiveLearnerUserId(result.value.learner.id)
    setNewName('')
    setNewEmail('')
    await syncNow({ roster: result.state })
    ok(`Added ${result.value.learner.displayName}`)
  }

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
          description="Teacher owns classes and programs. Create a class, then add learners."
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
        title="Learner dashboard"
        subtitle={`${seats} learners · ${course?.name ?? classRow.name} · start ${
          course?.startsOn ?? '—'
        } · ${taughtDays}/${plannedSessions || '—'} sessions${
          hasMultiple ? ` · ${options.length} classes` : ''
        }`}
        actions={
          <div className="page-actions">
            <button
              type="button"
              className={viewMode === 'grid' ? 'active' : 'ghost'}
              onClick={() => setViewMode('grid')}
              title="Grid card view"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              <span>Grid</span>
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'active' : 'ghost'}
              onClick={() => setViewMode('list')}
              title="Compact list view"
            >
              <List className="h-4 w-4" aria-hidden />
              <span>List</span>
            </button>
          </div>
        }
      />
      <Flash message={message} error={error} />

      <div className="stat-grid">
        <StatCard
          icon={Radio}
          label="Live"
          value={openSession ? `Day ${openSession.sessionNumber ?? '—'}` : 'Idle'}
          hint={openSession ? 'Capture open' : 'Choose learner then start'}
        />
        <StatCard
          icon={ChartColumn}
          label="Finalized"
          value={ledger.length}
          hint="Real ledger rows"
        />
        <StatCard
          icon={Link2}
          label="Invites"
          value={`${inviteReady}/${learners.length}`}
          hint="Portal links ready"
        />
      </div>

      <Panel
        icon={UserPlus}
        title="Add learner"
        description="Simple teacher workflow: add name/email, then start session or open profile."
      >
        <div className="teacher-add-learner">
          <label>
            Learner name
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Nguyen An"
            />
          </label>
          <label>
            Email
            <input
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="learner@example.com"
            />
          </label>
          <button type="button" className="primary" onClick={addLearner}>
            <UserPlus className="h-4 w-4" aria-hidden />
            Add learner
          </button>
        </div>
      </Panel>

      <Panel
        icon={Users}
        title="Learners"
        description="Manage learner list, open profile, track RFC progress, or start a session for one learner."
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
                  err('Could not copy — copy links from the learner cards')
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
            title="No learners yet"
            description="Add the first learner above."
          />
        ) : viewMode === 'grid' ? (
          <div className="teacher-learner-grid">
            {learners.map((learner) => (
              <LearnerCard
                key={learner.id}
                learner={learner}
                selected={selectedLearner?.id === learner.id}
                openSession={Boolean(openSession)}
                onSelect={() => setActiveLearnerUserId(learner.id)}
                onCopied={(text) => ok(text)}
              />
            ))}
          </div>
        ) : (
          <div className="table-wrap learner-list-table">
            <table aria-label="Learner list">
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  <th scope="col" title="Minimum RFC across sessions">
                    RFC min
                  </th>
                  <th scope="col" title="Maximum RFC across sessions">
                    RFC max
                  </th>
                  <th scope="col" title="Average RFC across sessions">
                    RFC avg
                  </th>
                  <th scope="col">Sessions</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {learners.map((learner) => (
                  <tr
                    key={learner.id}
                    className={selectedLearner?.id === learner.id ? 'bg-slate-100/80' : ''}
                  >
                    <td>
                      <button
                        type="button"
                        className="learner-inline-button"
                        onClick={() => setActiveLearnerUserId(learner.id)}
                      >
                        <UserAvatar name={learner.name} avatarUrl={learner.avatarUrl} size="sm" />
                        <span>
                          <strong>{learner.name}</strong>
                          <small>{learner.email ?? 'No email'}</small>
                        </span>
                      </button>
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {formatPercent(learner.rfcMin)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {formatPercent(learner.rfcMax)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">
                      {formatPercent(learner.rfcAvg)}
                    </td>
                    <td className="font-mono text-xs tabular-nums">{learner.sessions}</td>
                    <td>
                      <div className="btn-row my-0">
                        <Link
                          to={`/teacher/learner/${encodeURIComponent(learner.id)}`}
                          className="btn ghost"
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                          Profile
                        </Link>
                        <Link
                          to={`/teacher/session?learner=${encodeURIComponent(learner.id)}`}
                          className="btn primary"
                          onClick={() => setActiveLearnerUserId(learner.id)}
                        >
                          <Play className="h-4 w-4" aria-hidden />
                          Start
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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

function LearnerCard({
  learner,
  selected,
  openSession,
  onSelect,
  onCopied,
}: {
  learner: {
    id: string
    name: string
    avatarUrl: string | null
    email: string | null
    invite: string | null
    sessions: number
    finalized: number
    rfcMin: number | null
    rfcMax: number | null
    rfcAvg: number | null
  }
  selected: boolean
  openSession: boolean
  onSelect: () => void
  onCopied: (message: string) => void
}) {
  return (
    <article className={`teacher-learner-card${selected ? ' is-selected' : ''}`}>
      <button type="button" className="teacher-learner-card-main" onClick={onSelect}>
        <UserAvatar name={learner.name} avatarUrl={learner.avatarUrl} size="lg" />
        <span>
          <strong>{learner.name}</strong>
          <small>{learner.email ?? 'No email'}</small>
        </span>
      </button>
      <div className="teacher-learner-mini-stats">
        <span title="Minimum RFC across sessions">
          <strong>{formatPercent(learner.rfcMin)}</strong>
          <small>Min</small>
        </span>
        <span title="Maximum RFC across sessions">
          <strong>{formatPercent(learner.rfcMax)}</strong>
          <small>Max</small>
        </span>
        <span title="Average RFC across sessions">
          <strong>{formatPercent(learner.rfcAvg)}</strong>
          <small>Avg</small>
        </span>
      </div>
      <p className="meta my-0">
        {learner.sessions} session(s) · {learner.finalized} finalized observations
      </p>
      <div className="btn-row teacher-learner-card-actions">
        <Link to={`/teacher/learner/${encodeURIComponent(learner.id)}`} className="btn ghost">
          <Eye className="h-4 w-4" aria-hidden />
          Profile
        </Link>
        <Link
          to={`/teacher/session?learner=${encodeURIComponent(learner.id)}`}
          className="btn primary"
          onClick={onSelect}
        >
          <Play className="h-4 w-4" aria-hidden />
          {openSession ? 'Resume' : 'Start'}
        </Link>
        {learner.invite ? (
          <button
            type="button"
            className="ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(learner.invite!)
                onCopied(`Invite copied for ${learner.name}`)
              } catch {
                onCopied(learner.invite!)
              }
            }}
            title="Copy learner portal invite link"
          >
            <Link2 className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  )
}

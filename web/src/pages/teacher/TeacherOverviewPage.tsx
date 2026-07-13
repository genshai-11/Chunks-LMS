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
  addLearnerProfile,
  enrollLearner,
  formatClassInviteClipboard,
  learnerInviteUrl,
  listActiveLearners,
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
    setActiveClassId,
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
    classRow?.schedule?.sessionCount ??
    scheduling.scheduledSessions.filter(
      (s) => s.classId === classRow?.id && s.status !== 'cancelled' && s.status !== 'rescheduled',
    ).length ??
    0
  const taughtDays = scheduling.learningSessions.filter(
    (s) => s.classId === classRow?.id && (s.status === 'completed' || s.status === 'open'),
  ).length

  const learners = useMemo(() => {
    return listActiveLearners(roster).map((user) => {
      const activeEnrollmentRows = roster.enrollments.filter(
        (e) => e.learnerUserId === user.id && e.status === 'active',
      )
      const matchingOpenSession = scheduling.learningSessions.find(
        (session) =>
          session.status === 'open' &&
          activeEnrollmentRows.some((enrollment) => enrollment.classId === session.classId) &&
          Boolean(session.participantLearnerIds?.includes(user.id)),
      )
      const assignedToActiveClass = classRow
        ? activeEnrollmentRows.some((e) => e.classId === classRow.id)
        : false
      const sessionRows = summarizeLearnerSessions({
        ledger,
        scheduling,
        learnerUserId: user.id,
        classId: classRow?.id,
      })
      const rfcStats = learnerRfcStats(sessionRows)
      return {
        id: user.id,
        name: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        email: user.email ?? null,
        invite: learnerInviteUrl(user),
        accountStatus: user.accountStatus ?? 'active',
        classIds: activeEnrollmentRows.map((e) => e.classId),
        assignedToActiveClass,
        sessions: rfcStats.count,
        finalized: sessionRows.reduce((sum, row) => sum + row.total, 0),
        hasMatchingOpenSession: Boolean(matchingOpenSession),
        preferredClassId:
          matchingOpenSession?.classId ??
          (assignedToActiveClass ? classRow?.id : null) ??
          activeEnrollmentRows[0]?.classId ??
          null,
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
    const result = addLearnerProfile(roster, {
      displayName: newName,
      email: newEmail,
    })
    if (!result.ok) return err(result.error)
    setRoster(result.state)
    setActiveLearnerUserId(result.value.id)
    setNewName('')
    setNewEmail('')
    await syncNow({ roster: result.state })
    ok(`Added ${result.value.displayName}. Assign a class label when ready.`)
  }

  async function assignActiveClass(learnerId: string) {
    if (!classRow) return err('Create or select a class label first')
    const result = enrollLearner(roster, classRow.id, learnerId)
    if (!result.ok) return err(result.error)
    setRoster(result.state)
    await syncNow({ roster: result.state })
    ok('Class label assigned')
  }

  if (!teacher) {
    return (
      <>
        <PageHeader
          icon={Users}
          kicker="Teacher"
          title="Learners"
          subtitle="Create learners first. Class labels can be assigned later."
        />
        <EmptyState
          icon={School}
          title="Teacher profile missing"
          description="Ask Admin to create your Teacher account and mark it active."
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
        kicker={course?.code ?? 'Learners'}
        title="Learner dashboard"
        subtitle={`${learners.length} learners · ${
          classRow
            ? `${course?.name ?? classRow.name} · ${seats} in class`
            : 'no class label selected yet'
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
        description="Create the learner profile first. Assign a class label later when needed."
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
          inviteReady > 0 && classRow ? (
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
                openSession={learner.hasMatchingOpenSession}
                activeClassName={classRow?.name ?? null}
                canAssignActiveClass={Boolean(classRow) && !learner.assignedToActiveClass}
                onAssignActiveClass={() => assignActiveClass(learner.id)}
                onSelect={() => {
                  setActiveLearnerUserId(learner.id)
                  if (learner.preferredClassId) setActiveClassId(learner.preferredClassId)
                }}
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
                        {classRow && !learner.assignedToActiveClass ? (
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => assignActiveClass(learner.id)}
                          >
                            Assign {classRow.name}
                          </button>
                        ) : null}
                        <Link
                          to={`/teacher/session?learner=${encodeURIComponent(learner.id)}`}
                          className="btn primary"
                          onClick={() => {
                            setActiveLearnerUserId(learner.id)
                            if (learner.preferredClassId) setActiveClassId(learner.preferredClassId)
                          }}
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
  activeClassName,
  canAssignActiveClass,
  onAssignActiveClass,
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
    classIds: string[]
    hasMatchingOpenSession: boolean
    preferredClassId: string | null
  }
  selected: boolean
  openSession: boolean
  activeClassName: string | null
  canAssignActiveClass: boolean
  onAssignActiveClass: () => void
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
        {learner.sessions} session(s) · {learner.finalized} finalized observations ·{' '}
        {learner.classIds.length ? `${learner.classIds.length} class label(s)` : 'No class label'}
      </p>
      <div className="btn-row teacher-learner-card-actions">
        {canAssignActiveClass && activeClassName ? (
          <button type="button" className="ghost" onClick={onAssignActiveClass}>
            Assign {activeClassName}
          </button>
        ) : null}
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

import { useMemo, useState } from 'react'
import {
  ClipboardCopy,
  Eye,
  Home,
  LayoutGrid,
  Link2,
  List,
  Play,
  School,
  Users,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import {
  enrollLearner,
  formatClassInviteClipboard,
  learnerInviteUrl,
  listActiveLearners,
} from '../../modules/roster/service'
import {
  formatPercent,
  learnerRfcStats,
  nextLearnerSessionNumber,
  summarizeLearnerSessions,
} from '../../modules/teacher/learner-insights'
import { createCaptureSession } from '../../modules/assessment/session-capture'
import {
  closeOrphanOpenSessions,
  openSessionParticipantNames,
} from '../../modules/scheduling/orphan-sessions'
import { startLearningSession } from '../../modules/scheduling/session-lifecycle'
import { useAppState } from '../../state/useAppState'

type ViewMode = 'grid' | 'list'

export function TeacherOverviewPage() {
  const {
    roster,
    setRoster,
    scheduling,
    setScheduling,
    capture,
    setCapture,
    ledger,
    metricSettings,
    activeLearnerUserId,
    setActiveLearnerUserId,
    setActiveClassId,
    syncNow,
  } = useAppState()
  const { options, classRow, course, teacher, seats, hasMultiple, selectedClassIds, mode } = useTeacherClassContext()
  const navigate = useNavigate()
  const { message, error, ok, err } = useFlash()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [startingLearnerId, setStartingLearnerId] = useState<string | null>(null)

  const selectedOptions = options.filter((o) => selectedClassIds.includes(o.classRow.id))
  const totalSeats = selectedOptions.reduce((sum, o) => sum + o.seats, 0)

  const plannedSessions = selectedClassIds.reduce((sum, cid) => {
    const crow = options.find((o) => o.classRow.id === cid)?.classRow
    const count = crow?.schedule?.sessionCount ??
      scheduling.scheduledSessions.filter(
        (s) => s.classId === cid && s.status !== 'cancelled' && s.status !== 'rescheduled',
      ).length ?? 0
    return sum + count
  }, 0)
  const taughtDays = scheduling.learningSessions.filter(
    (s) => selectedClassIds.includes(s.classId) && (s.status === 'completed' || s.status === 'open'),
  ).length

  const learners = useMemo(() => {
    const activeLearners = listActiveLearners(roster)
    const mapped = activeLearners.map((user) => {
      const activeEnrollmentRows = roster.enrollments.filter(
        (e) => e.learnerUserId === user.id && e.status === 'active',
      )
      const matchingOpenSession = scheduling.learningSessions.find(
        (session) =>
          session.status === 'open' &&
          activeEnrollmentRows.some((enrollment) => enrollment.classId === session.classId) &&
          (session.participantLearnerIds?.length
            ? session.participantLearnerIds.includes(user.id)
            : true),
      )
      const assignedToSelectedClasses = selectedClassIds.some((cid) =>
        activeEnrollmentRows.some((e) => e.classId === cid)
      )
      const assignedToActiveClass = classRow
        ? activeEnrollmentRows.some((e) => e.classId === classRow.id)
        : assignedToSelectedClasses
      const allSessionRows = summarizeLearnerSessions({
        ledger,
        scheduling,
        learnerUserId: user.id,
      })
      const sessionRows = allSessionRows.filter((row) => {
        const session = scheduling.learningSessions.find((s) => s.id === row.learningSessionId)
        return session && selectedClassIds.includes(session.classId)
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
        assignedToSelectedClasses,
        sessions: rfcStats.count,
        finalized: sessionRows.reduce((sum, row) => sum + row.total, 0),
        hasMatchingOpenSession: Boolean(matchingOpenSession),
        preferredClassId:
          matchingOpenSession?.classId ??
          (classRow && assignedToActiveClass ? classRow?.id : null) ??
          activeEnrollmentRows.find((e) => selectedClassIds.includes(e.classId))?.classId ??
          activeEnrollmentRows[0]?.classId ??
          null,
        rfcMin: rfcStats.min,
        rfcMax: rfcStats.max,
        rfcAvg: rfcStats.avg,
      }
    })

    if (selectedClassIds.length === 0) return []
    return mapped.filter((learner) => learner.assignedToSelectedClasses)
  }, [classRow, ledger, roster, scheduling, selectedClassIds])

  const inviteReady = learners.filter((learner) => learner.invite).length
  const selectedLearner =
    learners.find((learner) => learner.id === activeLearnerUserId) ?? learners[0] ?? null

  async function assignActiveClass(learnerId: string) {
    if (!classRow) return err('Create or select a class label first')
    const result = enrollLearner(roster, classRow.id, learnerId)
    if (!result.ok) return err(result.error)
    setRoster(result.state)
    await syncNow({ roster: result.state })
    ok('Class label assigned')
  }

  async function startFastSession(learnerId: string, preferredClassId: string | null) {
    if (!preferredClassId || !teacher) {
      return err('Assign this learner to a class before starting a session')
    }

    let effectiveScheduling = scheduling
    const cleanup = closeOrphanOpenSessions(roster, effectiveScheduling)
    if (cleanup.changed) {
      effectiveScheduling = cleanup.state
      setScheduling(cleanup.state)
      await syncNow({ scheduling: cleanup.state })
      ok(`Closed ${cleanup.closed.length} stale live session(s). Start again when ready.`)
    }

    const open = effectiveScheduling.learningSessions.find(
      (session) => session.classId === preferredClassId && session.status === 'open',
    )
    if (open) {
      const participants = open.participantLearnerIds?.length ? open.participantLearnerIds : []
      const includesLearner = participants.length === 0 || participants.includes(learnerId)
      if (!includesLearner) {
        const participantInfo = openSessionParticipantNames(roster, open)
        const names = participantInfo.names.join(', ')
        return err(
          `A live session is already open for ${names || 'another learner'}. Finish it before starting ${
            roster.users.find((user) => user.id === learnerId)?.displayName ?? 'this learner'
          }.`,
        )
      }
      setActiveLearnerUserId(learnerId)
      setActiveClassId(preferredClassId)
      if (
        !capture ||
        capture.learningSessionId !== open.id ||
        (participants.length > 0 &&
          (capture.learnerIds.length !== participants.length ||
            participants.some((id) => !capture.learnerIds.includes(id))))
      ) {
        setCapture(
          createCaptureSession({
            learningSessionId: open.id,
            teacherUserId: teacher.id,
            learnerIds: participants.length ? participants : [learnerId],
            maxProbeCount: open.maxProbeCount ?? metricSettings.defaultMaxProbeCount,
          }),
        )
      }
      navigate('/teacher/observe')
      return
    }

    setStartingLearnerId(learnerId)
    try {
      const maxProbeCount = metricSettings.defaultMaxProbeCount
      const started = startLearningSession(effectiveScheduling, {
        classId: preferredClassId,
        maxProbeCount,
        ownerUserId: teacher.id,
        sessionKind: 'regular',
        participantLearnerIds: [learnerId],
        sessionNumber: nextLearnerSessionNumber({
          ledger,
          scheduling: effectiveScheduling,
          learnerUserId: learnerId,
        }),
      })
      if (!started.ok) return err(started.error)

      const nextCapture = createCaptureSession({
        learningSessionId: started.value.id,
        teacherUserId: teacher.id,
        learnerIds: [learnerId],
        maxProbeCount,
      })
      setActiveLearnerUserId(learnerId)
      setActiveClassId(preferredClassId)
      setScheduling(started.state)
      setCapture(nextCapture)

      const { ensureLearningSessionOnServer } = await import('../../lib/live-assessment')
      await Promise.all([
        ensureLearningSessionOnServer(started.value),
        syncNow({ scheduling: started.state }),
      ])
      navigate('/teacher/observe')
    } finally {
      setStartingLearnerId(null)
    }
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
            : mode === 'all'
            ? `All classes · ${totalSeats} total learners`
            : selectedClassIds.length > 0
            ? `${selectedClassIds.length} classes · ${totalSeats} total learners`
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
                starting={startingLearnerId === learner.id}
                activeClassName={classRow?.name ?? null}
                canAssignActiveClass={Boolean(classRow) && !learner.assignedToActiveClass}
                onAssignActiveClass={() => assignActiveClass(learner.id)}
                onSelect={() => {
                  setActiveLearnerUserId(learner.id)
                  if (learner.preferredClassId) setActiveClassId(learner.preferredClassId)
                }}
                onStart={() => void startFastSession(learner.id, learner.preferredClassId)}
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
                        {learner.hasMatchingOpenSession ? (
                          <Link
                            to="/teacher/observe"
                            className="btn primary"
                            onClick={() => {
                              setActiveLearnerUserId(learner.id)
                              if (learner.preferredClassId) setActiveClassId(learner.preferredClassId)
                            }}
                          >
                            <Play className="h-4 w-4" aria-hidden />
                            Open live
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="primary"
                            onClick={() => void startFastSession(learner.id, learner.preferredClassId)}
                            disabled={startingLearnerId === learner.id || !learner.preferredClassId}
                          >
                            <Play className="h-4 w-4" aria-hidden />
                            {startingLearnerId === learner.id ? 'Starting…' : 'Start now'}
                          </button>
                        )}
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
  starting,
  activeClassName,
  canAssignActiveClass,
  onAssignActiveClass,
  onSelect,
  onStart,
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
  starting: boolean
  activeClassName: string | null
  canAssignActiveClass: boolean
  onAssignActiveClass: () => void
  onSelect: () => void
  onStart: () => void
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
        {openSession ? (
          <Link to="/teacher/observe" className="btn primary" onClick={onSelect}>
            <Play className="h-4 w-4" aria-hidden />
            Open live
          </Link>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={onStart}
            disabled={starting || !learner.preferredClassId}
          >
            <Play className="h-4 w-4" aria-hidden />
            {starting ? 'Starting…' : 'Start now'}
          </button>
        )}
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

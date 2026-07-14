import { useEffect, useMemo, useState } from 'react'
import {
  Eye,
  Gauge,
  Info,
  Layers,
  Play,
  Plus,
  Radio,
  Users,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel, StatCard } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import {
  addSessionQuestion,
  createCaptureSession,
  sessionColorSummary,
} from '../../modules/assessment/session-capture'
import {
  aggregateProbeMetrics,
  PROBE_METRIC_LABELS,
  PROBE_METRIC_TOOLTIPS,
} from '../../modules/assessment/probe-metrics'
import { attemptNDepth } from '../../modules/assessment/probe-metrics'

import type { PolicyActor } from '../../modules/identity/access-policy'
import { getSupabase } from '../../lib/supabase'
import {
  activeEnrollmentsForClass,
  enrollLearner,
  listActiveLearners,
} from '../../modules/roster/service'
import { subscribeToClassSnapshots } from '../../modules/realtime/snapshot-channel'
import { startLearningSession } from '../../modules/scheduling/session-lifecycle'
import type { SessionKind } from '../../modules/scheduling/types'
import {
  resolveSessionDayNumber,
  sessionDayBadge,
  sessionDayHash,
  sessionLabel,
} from '../../modules/reporting/session-series'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { nextLearnerSessionNumber } from '../../modules/teacher/learner-insights'
import { useAppState } from '../../state/useAppState'

const SESSION_KINDS: { id: SessionKind; label: string; hint: string }[] = [
  { id: 'regular', label: 'Regular day', hint: 'Normal teaching day' },
  { id: 'pretest', label: 'Pretest', hint: 'Baseline RFC (start of program)' },
  { id: 'posttest', label: 'Posttest', hint: 'Exit RFC (end of program)' },
]

export function TeacherSessionPage() {
  const {
    roster,
    setRoster,
    scheduling,
    setScheduling,
    capture,
    setCapture,
    ledger,
    metricSettings,
    syncNow,
  } = useAppState()
  const { message, error, ok, err } = useFlash()
  const { classRow, teacher } = useTeacherClassContext()
  const [searchParams] = useSearchParams()
  const preselect = searchParams.get('learner')

  const enrolledIds = useMemo(
    () =>
      classRow ? activeEnrollmentsForClass(roster, classRow.id).map((e) => e.learnerUserId) : [],
    [classRow, roster],
  )
  const activeLearnerIds = useMemo(() => listActiveLearners(roster).map((u) => u.id), [roster])

  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )

  /** Learners in this capture: session participants or full roster */
  const sessionLearnerIds = useMemo(() => {
    if (openSession?.participantLearnerIds?.length) {
      return openSession.participantLearnerIds.filter((id) => activeLearnerIds.includes(id))
    }
    return activeLearnerIds
  }, [openSession, activeLearnerIds])

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sessionKind, setSessionKind] = useState<SessionKind>('regular')

  // Default multi-select: preselect query learner, else all enrolled
  useEffect(() => {
    if (openSession) return
    if (activeLearnerIds.length === 0) {
      setSelectedIds([])
      return
    }
    if (preselect && activeLearnerIds.includes(preselect)) {
      setSelectedIds([preselect])
    } else {
      setSelectedIds(enrolledIds)
    }
  }, [activeLearnerIds, enrolledIds, preselect, openSession])

  const totalDays =
    classRow?.schedule?.sessionCount ??
    scheduling.scheduledSessions.filter(
      (s) => s.classId === classRow?.id && s.status !== 'cancelled' && s.status !== 'rescheduled',
    ).length ??
    null
  const dayNumber = openSession
    ? resolveSessionDayNumber(openSession, {
        scheduledSessions: scheduling.scheduledSessions,
        learningSessions: scheduling.learningSessions,
      })
    : null
  const dayBadge = sessionDayBadge(dayNumber, totalDays || null)
  const dayLabel = sessionLabel(dayNumber, openSession?.startedAt, totalDays || null)
  const observeTo =
    dayNumber != null ? `/teacher/observe${sessionDayHash(dayNumber)}` : '/teacher/observe'
  const learnerCount = sessionLearnerIds.length
  const captureSummary = capture ? sessionColorSummary(capture) : null
  const probeAgg = capture
    ? aggregateProbeMetrics(
        capture.attempts.map((a) => ({
          enteredProbeFlow: a.snapshot.enteredProbeFlow,
          probeCount: a.snapshot.probeCount,
        })),
      )
    : null

  const teacherActor = useMemo<PolicyActor | null>(
    () =>
      teacher
        ? {
            userId: teacher.id,
            organizationIds: [roster.organization.id],
            rolesByOrg: { [roster.organization.id]: ['teacher'] },
          }
        : null,
    [teacher, roster.organization.id],
  )

  useEffect(() => {
    if (!classRow || !teacherActor) return
    const sub = subscribeToClassSnapshots({
      client: getSupabase(),
      classId: classRow.id,
      actor: teacherActor,
      classScope: {
        organizationId: roster.organization.id,
        teacherUserId: classRow.teacherUserId,
        learnerUserIds: sessionLearnerIds,
      },
      onChange: () => {},
    })
    return () => sub.unsubscribe()
  }, [classRow, teacherActor, roster.organization.id, sessionLearnerIds])

  // Resume capture board if learning session is still open but capture was lost
  useEffect(() => {
    if (!openSession || !teacher) return
    if (
      capture &&
      capture.sessionStatus === 'open' &&
      capture.learningSessionId === openSession.id
    ) {
      return
    }
    const ids = openSession.participantLearnerIds?.length
      ? openSession.participantLearnerIds
      : activeLearnerIds
    setCapture(
      createCaptureSession({
        learningSessionId: openSession.id,
        teacherUserId: teacher.id,
        learnerIds: ids,
        maxProbeCount: openSession.maxProbeCount ?? metricSettings.defaultMaxProbeCount,
      }),
    )
  }, [
    openSession,
    teacher,
    capture,
    activeLearnerIds,
    metricSettings.defaultMaxProbeCount,
    setCapture,
  ])

  function toggleLearner(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function startLiveNow() {
    if (!classRow || !teacher) return
    if (selectedIds.length === 0) {
      return err('Select at least one learner before starting')
    }
    let rosterForSession = roster
    for (const learnerId of selectedIds) {
      if (enrolledIds.includes(learnerId)) continue
      const enrolled = enrollLearner(rosterForSession, classRow.id, learnerId)
      if (!enrolled.ok) return err(enrolled.error)
      rosterForSession = enrolled.state
    }
    if (rosterForSession !== roster) setRoster(rosterForSession)

    const maxProbe = metricSettings.defaultMaxProbeCount
    const r = startLearningSession(scheduling, {
      classId: classRow.id,
      maxProbeCount: maxProbe,
      ownerUserId: teacher.id,
      sessionKind,
      participantLearnerIds: selectedIds,
      sessionNumber:
        selectedIds.length === 1
          ? nextLearnerSessionNumber({ ledger, scheduling, learnerUserId: selectedIds[0]! })
          : undefined,
    })
    if (!r.ok) return err(r.error)
    const sched = r.state
    setScheduling(sched)
    setCapture(
      createCaptureSession({
        learningSessionId: r.value.id,
        teacherUserId: teacher.id,
        learnerIds: selectedIds,
        maxProbeCount: maxProbe,
      }),
    )
    // Best-effort cloud push (full workspace + dedicated session upsert).
    // Observe works local-first even if this fails.
    const { ensureLearningSessionOnServer } = await import('../../lib/live-assessment')
    const ensured = await ensureLearningSessionOnServer(r.value)
    const pushed = await syncNow({ scheduling: sched, roster: rosterForSession })
    if (ensured.ok || pushed) {
      ok(
        `Live session started · ${selectedIds.length} learner(s)${
          sessionKind !== 'regular' ? ` · ${sessionKind}` : ''
        }`,
      )
    } else {
      ok(
        `Live session started offline · ${selectedIds.length} learner(s) — Observe works locally; Sync when ready`,
      )
    }
  }

  if (!classRow || !teacher) {
    return (
      <EmptyState
        icon={Radio}
        title="No class assigned"
        description="Create a class and seat learners under Teacher → Classes."
      />
    )
  }

  if (!openSession || !capture || capture.sessionStatus !== 'open') {
    return (
      <>
        <PageHeader
          icon={Radio}
          kicker="Teacher"
          title="Start session"
          subtitle="Choose learners (1 or many), optional pretest/posttest for RFC baseline, then start Day N."
        />
        <Flash message={message} error={error} />

        <Panel
          icon={Users}
          title="Learners in this session"
          description="Each question maps to exactly one learner (round-robin). 100 Q / 2 HV ≈ 50 each. Multi-column observe uses this list."
          actions={
            <div className="btn-row">
              <button
                type="button"
                className="ghost"
                onClick={() => setSelectedIds(activeLearnerIds)}
                disabled={activeLearnerIds.length === 0}
              >
                Select all
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => setSelectedIds([])}
                disabled={selectedIds.length === 0}
              >
                Clear
              </button>
            </div>
          }
        >
          {activeLearnerIds.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No learners yet"
              description="Create learner profiles from Teacher → Learners first."
              action={
                <Link to="/teacher" className="btn ghost">
                  Learners
                </Link>
              }
            />
          ) : (
            <ul className="person-list">
              {activeLearnerIds.map((id) => {
                const user = roster.users.find((u) => u.id === id)
                const checked = selectedIds.includes(id)
                return (
                  <li key={id}>
                    <label className="person-row-check">
                      <input type="checkbox" checked={checked} onChange={() => toggleLearner(id)} />
                      <UserAvatar
                        name={user?.displayName ?? id}
                        avatarUrl={user?.avatarUrl}
                        size="sm"
                      />
                      <span>
                        <strong>{user?.displayName ?? id}</strong>
                        <span className="meta" style={{ display: 'block', margin: 0 }}>
                          {user?.email ?? 'No email'} ·{' '}
                          {enrolledIds.includes(id)
                            ? 'Class assigned'
                            : 'Will assign class on start'}
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel
          icon={Layers}
          title="Session label"
          description="Pretest / posttest mark baseline windows for RFC change over time."
        >
          <div className="btn-row" role="group" aria-label="Session kind">
            {SESSION_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                className={sessionKind === k.id ? 'primary' : 'ghost'}
                onClick={() => setSessionKind(k.id)}
                title={k.hint}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="meta mt-2">{SESSION_KINDS.find((k) => k.id === sessionKind)?.hint}</p>
        </Panel>

        <EmptyState
          icon={Radio}
          title={
            selectedIds.length ? `Ready · ${selectedIds.length} learner(s)` : 'Select learners'
          }
          description="Start the next teaching day."
          action={
            <div className="btn-row">
              <button
                type="button"
                className="primary"
                onClick={startLiveNow}
                disabled={selectedIds.length === 0}
              >
                <Play className="h-4 w-4" aria-hidden />
                <span>Start next day</span>
              </button>
            </div>
          }
        />
      </>
    )
  }

  const finalizedCount = capture.attempts.filter(
    (a) => a.snapshot.status === 'finalized' || a.snapshot.status === 'corrected',
  ).length

  // Column matrix by learner for multi-HV view
  const byLearner = sessionLearnerIds.map((lid) => {
    const user = roster.users.find((u) => u.id === lid)
    const attempts = capture.attempts.filter((a) => a.learnerUserId === lid)
    const finalized = attempts.filter(
      (a) => a.snapshot.status === 'finalized' || a.snapshot.status === 'corrected',
    )
    const agg = aggregateProbeMetrics(
      attempts.map((a) => ({
        enteredProbeFlow: a.snapshot.enteredProbeFlow,
        probeCount: a.snapshot.probeCount,
      })),
    )
    return {
      id: lid,
      name: user?.displayName ?? lid,
      avatarUrl: user?.avatarUrl ?? null,
      qCount: attempts.length,
      done: finalized.length,
      nCount: agg.nCount,
      nDepthMax: agg.nDepthMax,
      nDepthAvg: agg.nDepthAvg,
    }
  })

  return (
    <>
      <PageHeader
        icon={Radio}
        kicker={dayBadge}
        title="Classroom"
        subtitle={`${classRow.name} · ${dayLabel}${
          openSession.sessionKind && openSession.sessionKind !== 'regular'
            ? ` · ${openSession.sessionKind}`
            : ''
        } · ${learnerCount} learner(s)`}
        actions={
          <div className="page-actions">
            <Link to={observeTo} className="btn primary">
              <Eye className="h-4 w-4" aria-hidden />
              <span>{finalizedCount > 0 ? `Resume ${dayBadge}` : `Observe ${dayBadge}`}</span>
            </Link>
          </div>
        }
      />
      <Flash message={message} error={error} />

      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <StatCard
          icon={Users}
          label="In session"
          value={learnerCount}
          hint="Selected for this capture"
        />
        <StatCard
          icon={Gauge}
          label={PROBE_METRIC_LABELS.nCount}
          value={probeAgg?.nCount ?? 0}
          hint={PROBE_METRIC_TOOLTIPS.nCount}
        />
        <StatCard
          icon={Layers}
          label={PROBE_METRIC_LABELS.nDepthMax}
          value={probeAgg?.nDepthMax ?? '—'}
          hint={PROBE_METRIC_TOOLTIPS.nDepthMax}
        />
        <StatCard
          icon={Layers}
          label={PROBE_METRIC_LABELS.nDepthAvg}
          value={probeAgg?.nDepthAvg == null ? '—' : probeAgg.nDepthAvg.toFixed(1)}
          hint={PROBE_METRIC_TOOLTIPS.nDepthAvg}
        />
      </div>

      <Panel
        icon={Users}
        title="By learner (columns)"
        description="Each question is assigned to one learner only. Tracking splits by learner — Q count and probe n stats are real capture data."
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Q assigned</th>
                <th scope="col">Finalized</th>
                <th scope="col" title={PROBE_METRIC_TOOLTIPS.nCount}>
                  {PROBE_METRIC_LABELS.nCount}
                </th>
                <th scope="col" title={PROBE_METRIC_TOOLTIPS.nDepthMax}>
                  {PROBE_METRIC_LABELS.nDepthMax}
                </th>
                <th scope="col" title={PROBE_METRIC_TOOLTIPS.nDepthAvg}>
                  {PROBE_METRIC_LABELS.nDepthAvg}
                </th>
              </tr>
            </thead>
            <tbody>
              {byLearner.map((col) => (
                <tr key={col.id}>
                  <td>
                    <span className="cell-with-avatar">
                      <UserAvatar name={col.name} avatarUrl={col.avatarUrl} size="sm" />
                      <span>{col.name}</span>
                    </span>
                  </td>
                  <td className="font-mono text-xs tabular-nums">{col.qCount}</td>
                  <td className="font-mono text-xs tabular-nums">{col.done}</td>
                  <td className="font-mono text-xs tabular-nums">{col.nCount}</td>
                  <td className="font-mono text-xs tabular-nums">{col.nDepthMax ?? '—'}</td>
                  <td className="font-mono text-xs tabular-nums">
                    {col.nDepthAvg == null ? '—' : col.nDepthAvg.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        icon={Eye}
        title="Observe Focus / Awareness"
        description="Full-screen focus mode — switch learner-first for column-style tracking per HV."
      >
        <div className="observe-entry">
          <div className="observe-entry-info">
            <Info className="observe-entry-icon" aria-hidden />
            <p className="observe-entry-copy">
              Leave this page anytime — use <strong>Resume live</strong> to continue. Observation is
              full-screen. Use learner-first mode to walk each learner’s questions in turn.
            </p>
          </div>
          <div className="btn-row">
            <Link to={observeTo} className="btn primary observe-entry-cta">
              <Eye className="h-4 w-4" aria-hidden />
              <span>{finalizedCount > 0 ? `Resume ${dayBadge}` : `Enter ${dayBadge}`}</span>
            </Link>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                const r = addSessionQuestion(capture)
                if (!r.ok) return err(r.error)
                setCapture(r.state)
                ok(`Question #${r.value.sequenceNumber} ready`)
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span>Prep next question</span>
            </button>
          </div>
          <p className="meta">
            Mode {capture.position.mode.replace('_', '-')} · Q {capture.position.questionIndex + 1}/
            {Math.max(capture.questions.length, 1)} · {finalizedCount}/
            {capture.attempts.length || '—'} finalized · Peak {PROBE_METRIC_LABELS.nDepth}=
            {captureSummary?.maxProbeDepth ?? 0}
          </p>
        </div>

        {capture.questions.length > 0 && (
          <div className="table-wrap mt-4">
            <table aria-label="Capture log" className="capture-matrix">
              <thead>
                <tr>
                  <th scope="col">Q#</th>
                  <th scope="col">Learner</th>
                  <th scope="col">Result</th>
                  <th scope="col" title={PROBE_METRIC_TOOLTIPS.nDepth}>
                    {PROBE_METRIC_LABELS.nDepth}
                  </th>
                </tr>
              </thead>
              <tbody>
                {capture.questions.map((q) => {
                  const a = capture.attempts.find((x) => x.sessionQuestionId === q.id)
                  const snap = a?.snapshot
                  const color = snap?.effectiveColor ?? snap?.provisionalColor ?? null
                  const user = roster.users.find((u) => u.id === q.assignedLearnerUserId)
                  const name = user?.displayName ?? q.assignedLearnerUserId
                  const n =
                    snap && (snap.enteredProbeFlow || snap.probeCount > 0)
                      ? attemptNDepth(snap)
                      : null
                  return (
                    <tr key={q.id}>
                      <th scope="row" className="font-mono text-xs">
                        {q.sequenceNumber}
                      </th>
                      <td className="text-left font-medium text-slate-800">
                        <span className="cell-with-avatar">
                          <UserAvatar name={name} avatarUrl={user?.avatarUrl} size="sm" />
                          <span>{name}</span>
                        </span>
                      </td>
                      <td>
                        {color ? (
                          <span className={`capture-dot ${color}`}>{color}</span>
                        ) : (
                          <span className="capture-dot">·</span>
                        )}
                      </td>
                      <td className="font-mono text-xs tabular-nums">{n != null ? n : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="meta mt-2">
              <strong>{PROBE_METRIC_LABELS.nDepth}</strong> = {PROBE_METRIC_TOOLTIPS.nDepth}{' '}
              <strong>{PROBE_METRIC_LABELS.nCount}</strong> this session = {probeAgg?.nCount ?? 0}.
              Sample/finalized counts are never labeled “n”.
            </p>
          </div>
        )}
      </Panel>
    </>
  )
}

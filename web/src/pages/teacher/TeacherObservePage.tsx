import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Activity,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Keyboard,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  advancePosition,
  currentAttempt,
  jumpToQuestion,
  markSessionCompleted,
  retreatPosition,
  sessionColorSummary,
  type CaptureSessionState,
} from '../../modules/assessment/session-capture'
import { ObserveHeatmap } from '../../components/ObserveHeatmap'
import { UserAvatar } from '../../components/UserAvatar'
import type { ResultColor } from '../../modules/result-lifecycle/types'
import {
  resolveSessionDayNumber,
  sessionDayBadge,
  sessionDayHash,
  sessionLabel,
} from '../../modules/reporting/session-series'
import {
  completeLearningSession,
  recordAttendance,
} from '../../modules/scheduling/session-lifecycle'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { useAppState } from '../../state/useAppState'
import {
  createLiveQuestion,
  loadLiveCapture,
  recordLiveColor,
  replaceLiveAttempt,
  resolveLiveProbe,
} from '../../lib/live-assessment'
import { getSupabase } from '../../lib/supabase'

const COLORS: { key: ResultColor; label: string; shortcut: string }[] = [
  { key: 'red', label: 'Red', shortcut: '0' },
  { key: 'yellow', label: 'Yellow', shortcut: '1' },
  { key: 'green', label: 'Green', shortcut: '2' },
  { key: 'purple', label: 'Purple', shortcut: '3' },
]

type ReactionKind = 'celebrate' | 'happy' | 'fight'
type Reaction = { kind: ReactionKind; color: ResultColor; id: number } | null

function reactionFor(color: ResultColor): ReactionKind {
  if (color === 'purple') return 'celebrate'
  if (color === 'green') return 'happy'
  return 'fight'
}

const RAIL_W_KEY = 'chunks-lms:observe-rail-w'
const RAIL_MIN = 152
const RAIL_MAX = 440
const RAIL_DEFAULT = 224
const RAIL_COLLAPSED = 48

function readSavedRailWidth(): number {
  try {
    const n = Number(window.localStorage.getItem(RAIL_W_KEY))
    if (Number.isFinite(n)) return Math.min(RAIL_MAX, Math.max(RAIL_MIN, n))
  } catch {
    /* ignore */
  }
  return RAIL_DEFAULT
}

/**
 * Observe: left rail (avatar + collapsible map), big name, large bottom color dock,
 * happy/fight reaction flash. Phone-friendly. Rail is drag-resizable when open.
 */
export function TeacherObservePage() {
  const navigate = useNavigate()
  const {
    roster,
    capture,
    setCapture,
    appendFinalizedFromCapture,
    scheduling,
    setScheduling,
    syncNow,
  } = useAppState()
  const [toast, setToast] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [liveLoading, setLiveLoading] = useState(true)
  const [liveSaving, setLiveSaving] = useState(false)
  const [showConfirmFinish, setShowConfirmFinish] = useState(false)
  /** Desktop: open by default. Phone: closed so stage + colors stay primary. */
  const [mapOpen, setMapOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : true,
  )
  const [reaction, setReaction] = useState<Reaction>(null)
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT)
  const [resizing, setResizing] = useState(false)
  const [isPhone, setIsPhone] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)').matches : false,
  )
  const railWidthRef = useRef(railWidth)

  useEffect(() => {
    setRailWidth(readSavedRailWidth())
    const mq = window.matchMedia('(max-width: 639px)')
    const onChange = () => {
      setIsPhone(mq.matches)
      // When switching to phone, collapse map so dock stays visible
      if (mq.matches) setMapOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    railWidthRef.current = railWidth
  }, [railWidth])

  const startRailResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!mapOpen) return
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = railWidthRef.current
      setResizing(true)

      const onMove = (ev: PointerEvent) => {
        const next = Math.min(RAIL_MAX, Math.max(RAIL_MIN, startW + (ev.clientX - startX)))
        railWidthRef.current = next
        setRailWidth(next)
      }
      const onUp = () => {
        setResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        try {
          window.localStorage.setItem(RAIL_W_KEY, String(railWidthRef.current))
        } catch {
          /* ignore */
        }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [mapOpen],
  )

  const railSizeClass = !mapOpen
    ? 'is-narrow'
    : railWidth < 190
      ? 'is-compact'
      : railWidth > 300
        ? 'is-wide'
        : 'is-mid'

  const avatarSize = !mapOpen ? 'sm' : railWidth > 300 ? 'xl' : railWidth > 200 ? 'lg' : 'md'

  const { classRow, course, teacher } = useTeacherClassContext()
  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )
  const activeLearnerIds = useMemo(
    () =>
      classRow
        ? roster.enrollments
            .filter(
              (enrollment) => enrollment.classId === classRow.id && enrollment.status === 'active',
            )
            .map((enrollment) => enrollment.learnerUserId)
        : [],
    [classRow, roster.enrollments],
  )

  const refreshLiveCapture = useCallback(async () => {
    if (!openSession || !teacher) {
      setLiveLoading(false)
      return
    }
    const result = await loadLiveCapture({
      learningSessionId: openSession.id,
      teacherUserId: teacher.id,
      learnerIds: activeLearnerIds,
      sessionStatus: openSession.status,
      maxProbeCount: openSession.maxProbeCount,
    })
    if (result.ok) {
      setCapture(result.data)
    } else {
      setToast(result.error)
      window.setTimeout(() => setToast(null), 1800)
    }
    setLiveLoading(false)
  }, [openSession, teacher, activeLearnerIds, setCapture])

  useEffect(() => {
    void refreshLiveCapture()
  }, [refreshLiveCapture])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase || !openSession) return
    const channel = supabase
      .channel(`observe-session:${openSession.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assessment_attempt_snapshots' },
        () => void refreshLiveCapture(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [openSession, refreshLiveCapture])

  const attempt = capture ? currentAttempt(capture) : null
  const learner = attempt ? roster.users.find((u) => u.id === attempt.learnerUserId) : null

  const plannedCount = scheduling.scheduledSessions.filter(
    (s) => s.classId === classRow?.id && s.status !== 'cancelled' && s.status !== 'rescheduled',
  ).length
  const totalDays =
    course?.schedule?.sessionCount && course.schedule.sessionCount > 0
      ? course.schedule.sessionCount
      : plannedCount > 0
        ? plannedCount
        : null

  const dayNumber = openSession
    ? resolveSessionDayNumber(openSession, {
        scheduledSessions: scheduling.scheduledSessions,
        learningSessions: scheduling.learningSessions,
      })
    : null
  const dayLabel = sessionLabel(dayNumber, openSession?.startedAt, totalDays)
  const dayBadge = sessionDayBadge(dayNumber, totalDays)

  // Keep browser URL in sync: /teacher/observe#day-3
  useEffect(() => {
    if (dayNumber == null) return
    const hash = sessionDayHash(dayNumber)
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${hash}`)
    }
    document.title = `${dayBadge} · Observe · Chunks LMS`
  }, [dayNumber, dayBadge])

  const qNum = capture ? capture.position.questionIndex + 1 : 0
  const qTotal = capture?.questions.length ?? 0
  const probeDepth = attempt?.snapshot.probeCount ?? 0
  const isFinalized =
    attempt?.snapshot.status === 'finalized' || attempt?.snapshot.status === 'corrected'
  const probeOpen =
    attempt?.snapshot.status === 'probe_open' || attempt?.snapshot.status === 'resolution_required'
  const summary = capture ? sessionColorSummary(capture) : null
  const ry = summary ? summary.byColor.red + summary.byColor.yellow : 0
  const done = summary ? summary.done : 0
  const rfcPct = done > 0 ? Math.round((ry / done) * 100) : 0

  const learnerName = useCallback(
    (id: string) => roster.users.find((u) => u.id === id)?.displayName ?? id.slice(0, 6),
    [roster.users],
  )

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 900)
  }, [])

  const playReaction = useCallback((color: ResultColor) => {
    const id = Date.now()
    setReaction({ kind: reactionFor(color), color, id })
    window.setTimeout(() => setReaction((current) => (current?.id === id ? null : current)), 1200)
  }, [])

  const advanceAfterFinal = useCallback(
    async (state: CaptureSessionState): Promise<CaptureSessionState> => {
      if (state.position.questionIndex < state.questions.length - 1) {
        return advancePosition(state)
      }
      const created = await createLiveQuestion({ capture: state })
      if (!created.ok) {
        flash(created.error)
        return state
      }
      return created.data
    },
    [flash],
  )

  const recordColor = useCallback(
    async (color: ResultColor) => {
      if (!capture || !attempt || liveSaving) return
      const wasFinal = isFinalized
      setLiveSaving(true)
      try {
        const result = await recordLiveColor(attempt, color)
        if (!result.ok) {
          flash(result.error)
          return
        }
        let next = replaceLiveAttempt(capture, result.data)
        setCapture(next)
        appendFinalizedFromCapture(next)
        if (
          result.data.snapshot.status === 'finalized' ||
          result.data.snapshot.status === 'corrected'
        ) {
          playReaction(color)
          if (!wasFinal) {
            next = await advanceAfterFinal(next)
            setCapture(next)
            appendFinalizedFromCapture(next)
          }
          flash(color)
        }
      } finally {
        setLiveSaving(false)
      }
    },
    [
      capture,
      attempt,
      liveSaving,
      isFinalized,
      setCapture,
      appendFinalizedFromCapture,
      playReaction,
      advanceAfterFinal,
      flash,
    ],
  )

  const resolveProbe = useCallback(
    async (outcome: 'fail' | 'continue' | 'done') => {
      if (!capture || !attempt || liveSaving) return
      setLiveSaving(true)
      try {
        const result = await resolveLiveProbe(attempt, outcome)
        if (!result.ok) {
          flash(result.error)
          return
        }
        let next = replaceLiveAttempt(capture, result.data)
        setCapture(next)
        appendFinalizedFromCapture(next)
        if (
          result.data.snapshot.status === 'finalized' ||
          result.data.snapshot.status === 'corrected'
        ) {
          const color: ResultColor = outcome === 'fail' ? 'yellow' : 'green'
          playReaction(color)
          next = await advanceAfterFinal(next)
          setCapture(next)
          appendFinalizedFromCapture(next)
          flash(color)
        } else if (outcome === 'continue') {
          flash(`n=${result.data.snapshot.probeCount}`)
        }
      } finally {
        setLiveSaving(false)
      }
    },
    [
      capture,
      attempt,
      liveSaving,
      setCapture,
      appendFinalizedFromCapture,
      playReaction,
      advanceAfterFinal,
      flash,
    ],
  )

  const startFirst = useCallback(async () => {
    if (!capture || liveSaving) return
    setLiveSaving(true)
    try {
      const result = await createLiveQuestion({ capture })
      if (!result.ok) {
        flash(result.error)
        return
      }
      setCapture(result.data)
    } finally {
      setLiveSaving(false)
    }
  }, [capture, liveSaving, setCapture, flash])

  const prevCell = useCallback(() => {
    if (!capture || capture.questions.length === 0) return
    setCapture(retreatPosition(capture))
  }, [capture, setCapture])

  const nextCell = useCallback(() => {
    if (!capture || capture.questions.length === 0) return
    if (capture.position.questionIndex < capture.questions.length - 1) {
      setCapture(advancePosition(capture))
    }
  }, [capture, setCapture])

  const selectQuestion = useCallback(
    (questionIndex: number) => {
      if (!capture) return
      setCapture(jumpToQuestion(capture, questionIndex))
    },
    [capture, setCapture],
  )

  /**
   * Finish live session + persist:
   * - marks missing attendance as present (required by completeLearningSession)
   * - sets learning session completedAt
   * - freezes capture (sessionStatus completed)
   * - ledger already has finalized results via appendFinalizedFromCapture
   */
  const handleConfirmFinish = useCallback(async () => {
    if (!capture || !openSession || finishing) return
    setShowConfirmFinish(false)
    setFinishing(true)
    try {
      const learnerIds = capture.learnerIds
      let sched = scheduling
      // Ensure every rostered learner has attendance so complete can succeed
      for (const learnerId of learnerIds) {
        const has = sched.attendance.some(
          (a) => a.learningSessionId === openSession.id && a.learnerUserId === learnerId,
        )
        if (!has) {
          const att = recordAttendance(sched, {
            learningSessionId: openSession.id,
            learnerUserId: learnerId,
            status: 'present',
          })
          if (!att.ok) {
            flash(att.error)
            return
          }
          sched = att.state
        }
      }

      const done = completeLearningSession(sched, openSession.id, learnerIds)
      if (!done.ok) {
        flash(done.error)
        return
      }

      const completedCapture = markSessionCompleted(capture)
      setScheduling(done.state)
      setCapture(completedCapture)
      appendFinalizedFromCapture(completedCapture)
      try {
        await syncNow()
      } catch {
        /* local persist still holds; backend may be offline */
      }
      flash('Session saved')
      navigate('/teacher/session')
    } finally {
      setFinishing(false)
    }
  }, [
    capture,
    openSession,
    finishing,
    scheduling,
    setScheduling,
    setCapture,
    appendFinalizedFromCapture,
    syncNow,
    navigate,
    flash,
  ])

  const finishSessionAndSave = useCallback(() => {
    if (!capture || !openSession || finishing) return
    setShowConfirmFinish(true)
  }, [capture, openSession, finishing])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        navigate('/teacher/session')
        return
      }
      if (k === '?' || (e.shiftKey && k === '/')) {
        e.preventDefault()
        setShowKeys((v) => !v)
        return
      }
      if (k === 'h' || k === 'm') {
        e.preventDefault()
        setMapOpen((v) => !v)
        return
      }
      if (k === 'arrowleft' || k === 'b') {
        e.preventDefault()
        prevCell()
        return
      }
      if (k === 'arrowright') {
        e.preventDefault()
        nextCell()
        return
      }
      if (k === 'n' && capture?.questions.length === 0) {
        e.preventDefault()
        startFirst()
        return
      }
      if (k === '0') {
        e.preventDefault()
        recordColor('red')
        return
      }
      if (k === '1') {
        e.preventDefault()
        recordColor('yellow')
        return
      }
      if (k === '2') {
        e.preventDefault()
        recordColor('green')
        return
      }
      if (k === '3') {
        e.preventDefault()
        recordColor('purple')
        return
      }
      if (probeOpen) {
        if (k === 'f') {
          e.preventDefault()
          resolveProbe('fail')
        } else if (k === 'c') {
          e.preventDefault()
          resolveProbe('continue')
        } else if (k === 'd' || k === 'enter') {
          e.preventDefault()
          resolveProbe('done')
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, prevCell, nextCell, recordColor, resolveProbe, probeOpen, capture, startFirst])

  const openProbes = summary ? summary.byColor.open : 0
  const drafts = summary ? summary.byColor.draft : 0

  if (!openSession) {
    return <Navigate to="/teacher/session" replace />
  }

  if (liveLoading || !capture || capture.learningSessionId !== openSession.id) {
    return (
      <div className="observe-root flex items-center justify-center" role="status">
        <p className="text-sm font-semibold text-slate-300">Loading live session…</p>
      </div>
    )
  }

  if (capture.sessionStatus !== 'open') {
    return <Navigate to="/teacher/session" replace />
  }

  return (
    <div
      className={`observe-root${reaction ? ` is-react-${reaction.kind} is-react-${reaction.color}` : ''}${
        isPhone ? ' is-phone' : ''
      }${mapOpen ? ' is-map-open' : ''}`}
      role="application"
      aria-label={`${dayLabel} · Focus and Awareness observation`}
    >
      <header className="observe-bar observe-bar-slim">
        <Link to="/teacher/session" className="observe-nav-exit" aria-label="Exit observe">
          <X aria-hidden strokeWidth={2.5} />
        </Link>
        <div className="observe-bar-center">
          <span className="observe-day-badge" title={dayLabel}>
            {dayNumber ? `Day ${dayNumber}` : 'Day —'}
          </span>
          {qTotal > 0 ? (
            <>
              <span className="observe-sep">·</span>
              <span className="observe-mode">
                Q{qNum}
                <span className="observe-meta-muted">/{qTotal}</span>
              </span>
            </>
          ) : null}
          <span className="observe-sep observe-hide-phone">·</span>
          <span className="observe-class observe-hide-phone">{classRow?.name ?? 'Class'}</span>
        </div>
        <div className="observe-nav-group" role="toolbar" aria-label="Observe tools">
          {capture.questions.length > 0 ? (
            <button
              type="button"
              className={`observe-nav-btn${mapOpen ? ' is-active' : ''}`}
              onClick={() => setMapOpen((v) => !v)}
              aria-pressed={mapOpen}
              aria-label={mapOpen ? 'Hide question map' : 'Show question map'}
              title="Map (H)"
            >
              {/* Grid = question map (clearer than panel icons on phone) */}
              <LayoutGrid aria-hidden strokeWidth={2.25} />
            </button>
          ) : null}
          <button
            type="button"
            className={`observe-nav-btn observe-hide-phone${showKeys ? ' is-active' : ''}`}
            onClick={() => setShowKeys((v) => !v)}
            aria-pressed={showKeys}
            aria-label="Keyboard shortcuts"
            title="Keys (?)"
          >
            <Keyboard aria-hidden strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className="observe-nav-finish"
            onClick={() => void finishSessionAndSave()}
            disabled={finishing}
            aria-label="Finish session and save"
            title="Finish & save"
          >
            <CheckCircle2 aria-hidden strokeWidth={2.25} />
            <span className="observe-nav-finish-label">{finishing ? 'Saving…' : 'Finish'}</span>
          </button>
        </div>
      </header>

      {/* Desktop left rail (resizable). Phone uses bottom map sheet instead. */}
      {capture.questions.length > 0 && !isPhone ? (
        <aside
          className={`observe-rail ${mapOpen ? 'is-open' : 'is-closed'} ${railSizeClass}${
            resizing ? ' is-resizing' : ''
          }`}
          style={
            {
              ['--observe-rail-w']: mapOpen ? `${railWidth}px` : `${RAIL_COLLAPSED}px`,
            } as CSSProperties
          }
          aria-label="Learner and progress map"
        >
          <div className="observe-rail-person">
            <UserAvatar
              name={learner?.displayName ?? 'Learner'}
              avatarUrl={learner?.avatarUrl}
              size={avatarSize}
              className="observe-rail-avatar"
            />
            {mapOpen ? (
              <>
                <p className="observe-rail-name">{learner?.displayName ?? 'Learner'}</p>
                {probeOpen ? <p className="observe-rail-n">n={probeDepth}</p> : null}
              </>
            ) : null}
          </div>

          {mapOpen ? (
            <div className="observe-rail-map">
              <ObserveHeatmap
                capture={capture}
                currentQuestionIndex={capture.position.questionIndex}
                learnerName={learnerName}
                onSelectQuestion={selectQuestion}
                layout="column"
              />
            </div>
          ) : (
            <button
              type="button"
              className="observe-rail-peek"
              onClick={() => setMapOpen(true)}
              aria-label="Expand sidebar"
              title="Expand"
            >
              <PanelLeftOpen className="h-4 w-4" aria-hidden strokeWidth={1.75} />
            </button>
          )}

          {mapOpen ? (
            <div className="observe-rail-footer">
              <button
                type="button"
                className="observe-rail-collapse"
                onClick={() => setMapOpen(false)}
                aria-label="Collapse sidebar"
                title="Collapse"
              >
                <PanelLeftClose className="h-4 w-4" aria-hidden strokeWidth={1.75} />
              </button>
            </div>
          ) : null}

          {mapOpen ? (
            <div
              className="observe-rail-resize"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize sidebar"
              aria-valuemin={RAIL_MIN}
              aria-valuemax={RAIL_MAX}
              aria-valuenow={Math.round(railWidth)}
              tabIndex={0}
              onPointerDown={startRailResize}
              onDoubleClick={() => {
                setRailWidth(RAIL_DEFAULT)
                try {
                  window.localStorage.setItem(RAIL_W_KEY, String(RAIL_DEFAULT))
                } catch {
                  /* ignore */
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') {
                  e.preventDefault()
                  setRailWidth((w) => {
                    const next = Math.max(RAIL_MIN, w - 16)
                    try {
                      window.localStorage.setItem(RAIL_W_KEY, String(next))
                    } catch {
                      /* ignore */
                    }
                    return next
                  })
                }
                if (e.key === 'ArrowRight') {
                  e.preventDefault()
                  setRailWidth((w) => {
                    const next = Math.min(RAIL_MAX, w + 16)
                    try {
                      window.localStorage.setItem(RAIL_W_KEY, String(next))
                    } catch {
                      /* ignore */
                    }
                    return next
                  })
                }
              }}
            >
              <GripVertical className="observe-rail-resize-grip" aria-hidden strokeWidth={1.5} />
            </div>
          ) : null}
        </aside>
      ) : null}

      {/* Center: name + fixed color dock (phone-first stack) */}
      <main className="observe-stage observe-stage-tight">
        {capture.questions.length === 0 ? (
          <div className="observe-empty">
            <p className="observe-day-empty">{dayLabel}</p>
            <p className="observe-empty-title">Observe</p>
            <button type="button" className="observe-cta" onClick={startFirst}>
              <Plus className="h-5 w-5" aria-hidden />
              Start
            </button>
          </div>
        ) : (
          <>
            <div className="observe-stage-hero">
              <div className="observe-phone-avatar" aria-hidden={false}>
                <UserAvatar
                  name={learner?.displayName ?? 'Learner'}
                  avatarUrl={learner?.avatarUrl}
                  size="md"
                />
              </div>
              <p className="observe-day-line observe-hide-phone">{dayLabel}</p>
              <h1 className="observe-learner observe-learner-solo">
                {learner?.displayName ?? 'Learner'}
              </h1>
              <div className="observe-meta-row">
                {done > 0 ? (
                  <span
                    className="observe-learner-rfc"
                    title={`Focus Coefficient: ${rfcPct}% Red/Yellow`}
                  >
                    <Activity className="h-3.5 w-3.5" aria-hidden />
                    RFC {rfcPct}%
                  </span>
                ) : (
                  <span className="observe-meta-muted observe-phone-only observe-hint-phone">
                    Tap a color
                  </span>
                )}
                {/* Counts live in map on phone — keep pills on tablet/desktop only */}
                <div
                  className="observe-heat-counts observe-color-pills observe-hide-phone"
                  aria-label="Color counts"
                >
                  {COLORS.map((c) => (
                    <span
                      key={c.key}
                      className={`observe-heat-count is-${c.key}`}
                      title={`${c.label}: ${summary ? summary.byColor[c.key] : 0}`}
                    >
                      <i aria-hidden />
                      {summary ? summary.byColor[c.key] : 0}
                    </span>
                  ))}
                </div>
              </div>
              {probeOpen ? (
                <p className="observe-depth-inline">
                  Probe n=<strong>{probeDepth}</strong>
                </p>
              ) : null}
            </div>

            {reaction ? (
              <div
                key={reaction.id}
                className={`observe-react observe-react-${reaction.kind}`}
                aria-hidden
              >
                <span className="observe-react-symbol">
                  {reaction.kind === 'celebrate' ? (
                    <Trophy aria-hidden />
                  ) : reaction.kind === 'happy' ? (
                    <Check aria-hidden />
                  ) : (
                    <Zap aria-hidden />
                  )}
                </span>
                <span className="observe-react-label">
                  {reaction.kind === 'celebrate'
                    ? 'Xuất sắc!'
                    : reaction.kind === 'happy'
                      ? 'Tập trung tốt!'
                      : 'Tiếp tục cố gắng!'}
                </span>
                {reaction.kind !== 'fight' ? (
                  <Sparkles className="observe-react-sparkles" aria-hidden />
                ) : null}
                {reaction.kind === 'celebrate' ? (
                  <span className="observe-react-confetti" aria-hidden>
                    {Array.from({ length: 10 }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                ) : null}
                <span className="observe-react-burst" />
              </div>
            ) : null}

            <div
              className={`observe-dock observe-dock-lg${reaction ? ` is-glowing is-${reaction.color}` : ''}`}
            >
              {probeOpen ? (
                <div className="observe-dock-probe" role="group" aria-label="Resolve green">
                  <button
                    type="button"
                    className="observe-dock-probe-btn fail"
                    onClick={() => resolveProbe('fail')}
                    disabled={liveSaving}
                  >
                    Fail
                  </button>
                  <button
                    type="button"
                    className="observe-dock-probe-btn cont"
                    onClick={() => resolveProbe('continue')}
                    disabled={liveSaving}
                  >
                    Cont
                  </button>
                  <button
                    type="button"
                    className="observe-dock-probe-btn done"
                    onClick={() => resolveProbe('done')}
                    disabled={liveSaving}
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="observe-dock-colors" role="group" aria-label="Result color">
                  {COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`observe-dock-color is-${c.key}${
                        isFinalized && attempt?.snapshot.effectiveColor === c.key
                          ? ' is-selected'
                          : ''
                      }`}
                      onClick={() => recordColor(c.key)}
                      disabled={!attempt || liveSaving}
                      aria-label={c.label}
                    >
                      <span className="observe-dock-num">{c.shortcut}</span>
                      <span className="observe-dock-label">{c.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="observe-dock-tools">
                <button
                  type="button"
                  className="observe-tool"
                  onClick={prevCell}
                  disabled={capture.position.questionIndex <= 0}
                  aria-label="Previous question"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                  <span className="observe-tool-text">Prev</span>
                </button>
                <span className="observe-dock-q" aria-live="polite">
                  Q{qNum}/{qTotal}
                </span>
                <button
                  type="button"
                  className="observe-tool"
                  onClick={nextCell}
                  disabled={capture.position.questionIndex >= capture.questions.length - 1}
                  aria-label="Next question"
                >
                  <span className="observe-tool-text">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Phone: question map as bottom sheet (not a side rail) */}
      {isPhone && mapOpen && capture.questions.length > 0 ? (
        <>
          <button
            type="button"
            className="observe-sheet-backdrop"
            aria-label="Close map"
            onClick={() => setMapOpen(false)}
          />
          <div className="observe-map-sheet" role="dialog" aria-label="Question map">
            <div className="observe-map-sheet-handle" aria-hidden />
            <div className="observe-map-sheet-head">
              <span className="observe-map-sheet-title">Questions</span>
              <button
                type="button"
                className="observe-nav-btn"
                onClick={() => setMapOpen(false)}
                aria-label="Close map"
              >
                <X aria-hidden strokeWidth={2.5} />
              </button>
            </div>
            <ObserveHeatmap
              capture={capture}
              currentQuestionIndex={capture.position.questionIndex}
              learnerName={learnerName}
              onSelectQuestion={(i) => {
                selectQuestion(i)
                setMapOpen(false)
              }}
              layout="column"
            />
          </div>
        </>
      ) : null}

      {showKeys && !isPhone && (
        <div className="observe-keys-panel" role="dialog" aria-label="Keyboard shortcuts">
          <div className="observe-keys-header">
            <h3 className="observe-keys-title">Keyboard Commands</h3>
            <button
              type="button"
              className="observe-keys-close"
              onClick={() => setShowKeys(false)}
              aria-label="Close shortcuts"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="observe-keys-grid">
            <div className="observe-keys-group">
              <span className="observe-keys-group-title">Assessment</span>
              <div className="observe-key-row">
                <span>
                  <kbd>0</kbd>–<kbd>3</kbd> Assess Color
                </span>
              </div>
              <div className="observe-key-row">
                <span>
                  <kbd>F</kbd>/<kbd>C</kbd>/<kbd>D</kbd> Probe Action
                </span>
              </div>
            </div>
            <div className="observe-keys-group">
              <span className="observe-keys-group-title">Navigation</span>
              <div className="observe-key-row">
                <span>
                  <kbd>←</kbd> / <kbd>→</kbd> Prev / Next
                </span>
              </div>
              <div className="observe-key-row">
                <span>
                  <kbd>H</kbd> / <kbd>M</kbd> Toggle Map
                </span>
              </div>
              <div className="observe-key-row">
                <span>
                  <kbd>Esc</kbd> Exit Observe
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="observe-toast" role="status">
          {toast}
        </div>
      )}

      {showConfirmFinish && (
        <div className="observe-modal-container">
          <div
            className="observe-modal-backdrop"
            onClick={() => setShowConfirmFinish(false)}
            aria-hidden="true"
          />
          <div
            className="observe-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-finish-title"
          >
            <div className="observe-modal-icon">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <h2 id="modal-finish-title" className="observe-modal-title">
              Finish Session?
            </h2>
            <p className="observe-modal-desc">
              Save and freeze the observation data for {dayBadge}. Once closed, this session cannot
              be modified.
            </p>
            <div className="observe-modal-summary-box">
              <div className="summary-row">
                <span className="summary-label">Total Sentences</span>
                <span className="summary-val font-mono">{qTotal}</span>
              </div>
              <div className="summary-divider" />
              <div className="summary-row">
                <span className="summary-label">Focus Coefficient (RFC)</span>
                <span className="summary-val text-amber-300 font-mono font-bold">
                  {done > 0 ? `${rfcPct}%` : '—'}
                </span>
              </div>
              <div className="summary-divider" />
              <div className="summary-colors-grid">
                <div className="color-item">
                  <span className="dot bg-red-500" />
                  <span className="count">{summary ? summary.byColor.red : 0} Red</span>
                </div>
                <div className="color-item">
                  <span className="dot bg-yellow-400" />
                  <span className="count">{summary ? summary.byColor.yellow : 0} Yellow</span>
                </div>
                <div className="color-item">
                  <span className="dot bg-green-500" />
                  <span className="count">{summary ? summary.byColor.green : 0} Green</span>
                </div>
                <div className="color-item">
                  <span className="dot bg-purple-500" />
                  <span className="count">{summary ? summary.byColor.purple : 0} Purple</span>
                </div>
              </div>
              <div className="summary-row footer-row">
                <div className="footer-col">
                  <span className="label">Open Probes</span>
                  <span
                    className={`val ${openProbes > 0 ? 'text-yellow-400 font-bold' : 'text-slate-400'}`}
                  >
                    {openProbes}
                  </span>
                </div>
                <div className="footer-col">
                  <span className="label">Drafts</span>
                  <span
                    className={`val ${drafts > 0 ? 'text-slate-200 font-bold' : 'text-slate-500'}`}
                  >
                    {drafts}
                  </span>
                </div>
              </div>
            </div>
            <div className="observe-modal-actions">
              <button
                type="button"
                className="observe-modal-btn observe-modal-cancel"
                onClick={() => setShowConfirmFinish(false)}
              >
                Go Back
              </button>
              <button
                type="button"
                className="observe-modal-btn observe-modal-confirm"
                onClick={() => void handleConfirmFinish()}
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

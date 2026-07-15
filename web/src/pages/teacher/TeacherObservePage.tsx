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
  X,
} from 'lucide-react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  advancePosition,
  createCaptureSession,
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
import { PROBE_ACTIONS } from '../../modules/assessment/probe-actions'
import {
  resolveSessionDayNumber,
  sessionDayBadge,
  sessionDayHash,
  sessionLabel,
} from '../../modules/reporting/session-series'
import { completeLearningSession } from '../../modules/scheduling/session-lifecycle'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { useAppState } from '../../state/useAppState'
import {
  createLiveQuestion,
  ensureLearningSessionOnServer,
  loadLiveCapture,
  recordLiveColor,
  replaceLiveAttempt,
  resolveLiveProbe,
} from '../../lib/live-assessment'
import { getSupabase } from '../../lib/supabase'
import { triggerConfetti } from '../../lib/confetti'

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

function formatFinishSummary(
  capture: CaptureSessionState,
  className: string | null,
  dayLabel: string,
): string {
  const summary = sessionColorSummary(capture)
  const unresolved = summary.byColor.open + summary.byColor.draft
  return [
    'Session finished',
    '',
    `${dayLabel}${className ? ` · ${className}` : ''}`,
    `Learners: ${capture.learnerIds.length}`,
    `Questions: ${capture.questions.length}`,
    `Finalized: ${summary.done}/${summary.total}`,
    `0 Red: ${summary.byColor.red}`,
    `1 Yellow: ${summary.byColor.yellow}`,
    `2 Green: ${summary.byColor.green}`,
    `3 Purple: ${summary.byColor.purple}`,
    `Max probe depth: ${summary.maxProbeDepth}`,
    unresolved > 0
      ? `Left unfinalized when session closed: ${unresolved}`
      : 'All captured attempts finalized.',
  ].join('\n')
}

function currentAttemptForLearner(capture: CaptureSessionState, learnerUserId: string) {
  const attempts = capture.attempts.filter((a) => a.learnerUserId === learnerUserId)
  return (
    attempts.find(
      (a) =>
        a.snapshot.status === 'draft' ||
        a.snapshot.status === 'probe_open' ||
        a.snapshot.status === 'resolution_required',
    ) ??
    attempts.at(-1) ??
    null
  )
}

/**
 * Observe: left rail (avatar + collapsible map), big name, large bottom color dock,
 * happy/fight reaction flash. Phone-friendly. Rail is drag-resizable when open.
 */
export function TeacherObservePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromChunker = searchParams.get('from') === 'chunker'
  const exitPath = fromChunker ? '/chunker' : '/teacher/session'
  const {
    roster,
    capture,
    setCapture,
    appendFinalizedFromCapture,
    scheduling,
    setScheduling,
    activeLearnerUserId,
    syncNow,
  } = useAppState()
  const [toast, setToast] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [liveLoading, setLiveLoading] = useState(true)
  const [liveSaving, setLiveSaving] = useState(false)
  const [finishSummary, setFinishSummary] = useState<string | null>(null)
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
  const [activeSplitLearnerId, setActiveSplitLearnerId] = useState<string | null>(null)
  const railWidthRef = useRef(railWidth)
  const captureRef = useRef(capture)
  const liveRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    captureRef.current = capture
  }, [capture])

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

  const { classRow, teacher } = useTeacherClassContext()
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
    const learnerIds = openSession.participantLearnerIds?.length
      ? openSession.participantLearnerIds
      : activeLearnerIds

    // Push open day to server (best-effort) so RPC can work when online
    void ensureLearningSessionOnServer(openSession)

    // Prefer existing capture board only when it belongs to the same live session and same learners.
    // Never reuse a richer board from another learner/session — that opens Observe on the wrong learner.
    const existing = captureRef.current
    const compatibleExisting =
      existing &&
      existing.learningSessionId === openSession.id &&
      existing.learnerIds.length === learnerIds.length &&
      learnerIds.every((id) => existing.learnerIds.includes(id))
        ? existing
        : null
    const localFallback =
      compatibleExisting ??
      createCaptureSession({
        learningSessionId: openSession.id,
        teacherUserId: teacher.id,
        learnerIds,
        maxProbeCount: openSession.maxProbeCount,
      })

    // Render immediately. Supabase can reconcile in the background, but Day 1 Observe
    // must never stay on a blank loading screen while the network/database warms up.
    if (!compatibleExisting) setCapture(localFallback)
    setLiveLoading(false)

    const result = await loadLiveCapture({
      learningSessionId: openSession.id,
      teacherUserId: teacher.id,
      learnerIds,
      sessionStatus: openSession.status,
      maxProbeCount: openSession.maxProbeCount,
      fallback: localFallback,
    })
    if (!result.ok) return

    // Don't overwrite a richer compatible local board with an empty/older cloud board.
    const latest = captureRef.current
    const latestCompatible =
      latest &&
      latest.learningSessionId === openSession.id &&
      latest.learnerIds.length === learnerIds.length &&
      learnerIds.every((id) => latest.learnerIds.includes(id))
        ? latest
        : localFallback
    if (
      latestCompatible.questions.length > 0 &&
      result.data.questions.length < latestCompatible.questions.length
    ) {
      return
    }
    setCapture(result.data)
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
        () => {
          if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current)
          liveRefreshTimer.current = window.setTimeout(() => void refreshLiveCapture(), 150)
        },
      )
      .subscribe()
    return () => {
      if (liveRefreshTimer.current) clearTimeout(liveRefreshTimer.current)
      void supabase.removeChannel(channel)
    }
  }, [openSession, refreshLiveCapture])

  const attempt = capture ? currentAttempt(capture) : null
  const learner = attempt ? roster.users.find((u) => u.id === attempt.learnerUserId) : null

  const plannedCount = scheduling.scheduledSessions.filter(
    (s) => s.classId === classRow?.id && s.status !== 'cancelled' && s.status !== 'rescheduled',
  ).length
  const totalDays =
    classRow?.schedule?.sessionCount && classRow.schedule.sessionCount > 0
      ? classRow.schedule.sessionCount
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
  const openParticipants = openSession?.participantLearnerIds?.length
    ? openSession.participantLearnerIds
    : activeLearnerIds
  const activeLearnerMismatch = Boolean(
    activeLearnerUserId && openSession && !openParticipants.includes(activeLearnerUserId),
  )
  const activeLearnerName = activeLearnerUserId
    ? (roster.users.find((user) => user.id === activeLearnerUserId)?.displayName ??
      activeLearnerUserId.slice(0, 6))
    : null
  const openLearnerNames = openParticipants
    .map((id) => roster.users.find((user) => user.id === id)?.displayName ?? id.slice(0, 6))
    .join(', ')

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
  const splitMode = capture?.learnerIds.length === 2

  const learnerName = useCallback(
    (id: string) => roster.users.find((u) => u.id === id)?.displayName ?? id.slice(0, 6),
    [roster.users],
  )

  useEffect(() => {
    if (!capture || capture.learnerIds.length !== 2) return
    if (!activeSplitLearnerId || !capture.learnerIds.includes(activeSplitLearnerId)) {
      setActiveSplitLearnerId(capture.learnerIds[0] ?? null)
    }
  }, [capture, activeSplitLearnerId])

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 900)
  }, [])

  const playReaction = useCallback((color: ResultColor) => {
    const id = Date.now()
    setReaction({ kind: reactionFor(color), color, id })
    if (color === 'purple') {
      triggerConfetti()
    }

    try {
      const audio = new Audio(`/audio/${color}.wav`)
      void audio.play().catch((err) => {
        console.warn('[observe] audio play failed:', err)
      })
    } catch (e) {
      console.warn('[observe] audio init failed:', e)
    }

    window.setTimeout(() => setReaction((current) => (current?.id === id ? null : current)), 1200)
  }, [])

  const advanceAfterFinal = useCallback(
    async (state: CaptureSessionState): Promise<CaptureSessionState> => {
      if (state.position.questionIndex < state.questions.length - 1) {
        return advancePosition(state)
      }
      const created = await createLiveQuestion({
        capture: state,
        openSession: openSession ?? null,
      })
      if (!created.ok) {
        flash(created.error)
        return state
      }
      return created.data
    },
    [flash, openSession],
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

  const advanceLearnerPane = useCallback(
    async (state: CaptureSessionState, learnerUserId: string): Promise<CaptureSessionState> => {
      const created = await createLiveQuestion({
        capture: state,
        openSession: openSession ?? null,
        learnerUserId,
      })
      if (!created.ok) {
        flash(created.error)
        return state
      }
      return created.data
    },
    [flash, openSession],
  )

  const recordColorForLearner = useCallback(
    async (learnerUserId: string, color: ResultColor) => {
      if (!capture || liveSaving) return
      const learnerAttempt = currentAttemptForLearner(capture, learnerUserId)
      if (!learnerAttempt) return
      const wasFinal =
        learnerAttempt.snapshot.status === 'finalized' ||
        learnerAttempt.snapshot.status === 'corrected'
      setLiveSaving(true)
      try {
        const result = await recordLiveColor(learnerAttempt, color)
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
            next = await advanceLearnerPane(next, learnerUserId)
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
      liveSaving,
      setCapture,
      appendFinalizedFromCapture,
      playReaction,
      advanceLearnerPane,
      flash,
    ],
  )

  const resolveProbeForLearner = useCallback(
    async (learnerUserId: string, outcome: 'fail' | 'continue' | 'done') => {
      if (!capture || liveSaving) return
      const learnerAttempt = currentAttemptForLearner(capture, learnerUserId)
      if (!learnerAttempt) return
      setLiveSaving(true)
      try {
        const result = await resolveLiveProbe(learnerAttempt, outcome)
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
          next = await advanceLearnerPane(next, learnerUserId)
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
      liveSaving,
      setCapture,
      appendFinalizedFromCapture,
      playReaction,
      advanceLearnerPane,
      flash,
    ],
  )

  const startFirst = useCallback(async () => {
    if (!capture || liveSaving) return
    setLiveSaving(true)
    try {
      if (openSession) {
        const ensured = await ensureLearningSessionOnServer(openSession)
        if (!ensured.ok) {
          // Local observe still works; surface soft warning once
          console.warn('[observe] session push:', ensured.error)
        }
      }
      const firstLearners = capture.learnerIds.length === 2 ? capture.learnerIds : [null]
      let next = capture
      for (const learnerUserId of firstLearners) {
        const result = await createLiveQuestion({
          capture: next,
          openSession: openSession ?? null,
          learnerUserId,
        })
        if (!result.ok) {
          flash(result.error)
          return
        }
        next = result.data
      }
      setCapture(next)
      flash(capture.learnerIds.length === 2 ? '2 learners ready' : 'Q1 ready')
    } finally {
      setLiveSaving(false)
    }
  }, [capture, liveSaving, setCapture, flash, openSession])

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
   * - sets learning session completedAt so it cannot be resumed
   * - freezes capture (sessionStatus completed)
   * - persists the completed scheduling snapshot explicitly (avoids stale React state)
   * - ledger already has finalized results via appendFinalizedFromCapture
   */
  const handleConfirmFinish = useCallback(async () => {
    if (!capture || !openSession || finishing) return
    setFinishing(true)
    try {
      const done = completeLearningSession(scheduling, openSession.id, capture.learnerIds)
      if (!done.ok) {
        flash(done.error)
        return
      }

      const completedCapture = markSessionCompleted(capture)
      setScheduling(done.state)
      setCapture(completedCapture)
      appendFinalizedFromCapture(completedCapture)
      try {
        await syncNow({ scheduling: done.state })
      } catch {
        /* local persist still holds; backend may be offline */
      }
      flash('Session saved')
      setFinishSummary(null)
      navigate(exitPath)
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
    exitPath,
    flash,
  ])

  const finishSessionAndSave = useCallback(() => {
    if (!capture || !openSession || finishing) return
    setFinishSummary(formatFinishSummary(capture, classRow?.name ?? null, dayLabel))
  }, [capture, openSession, finishing, classRow?.name, dayLabel])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        e.preventDefault()
        if (finishSummary) setFinishSummary(null)
        else navigate(exitPath)
        return
      }
      if (finishSummary) {
        e.preventDefault()
        return
      }
      if (k === '?' || (e.shiftKey && k === '/')) {
        e.preventDefault()
        setShowKeys((v) => !v)
        return
      }
      const splitLearnerId = splitMode ? activeSplitLearnerId : null
      const splitAttempt =
        splitLearnerId && capture ? currentAttemptForLearner(capture, splitLearnerId) : null
      const splitProbeOpen = Boolean(
        splitAttempt?.snapshot.status === 'probe_open' ||
        splitAttempt?.snapshot.status === 'resolution_required',
      )
      if (k === 'f' && !(splitMode ? splitProbeOpen : probeOpen)) {
        e.preventDefault()
        finishSessionAndSave()
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
      if (splitMode && splitLearnerId) {
        if (k === 'tab') {
          e.preventDefault()
          const [a, b] = capture?.learnerIds ?? []
          setActiveSplitLearnerId(splitLearnerId === a ? (b ?? a ?? null) : (a ?? null))
          return
        }
        if (k === '0') {
          e.preventDefault()
          recordColorForLearner(splitLearnerId, 'red')
          return
        }
        if (k === '1') {
          e.preventDefault()
          recordColorForLearner(splitLearnerId, 'yellow')
          return
        }
        if (k === '2') {
          e.preventDefault()
          recordColorForLearner(splitLearnerId, 'green')
          return
        }
        if (k === '3') {
          e.preventDefault()
          recordColorForLearner(splitLearnerId, 'purple')
          return
        }
        if (splitProbeOpen) {
          if (k === 'f') {
            e.preventDefault()
            resolveProbeForLearner(splitLearnerId, 'fail')
          } else if (k === 'p' || k === 'c') {
            e.preventDefault()
            resolveProbeForLearner(splitLearnerId, 'continue')
          } else if (k === 'd' || k === 'enter') {
            e.preventDefault()
            resolveProbeForLearner(splitLearnerId, 'done')
          }
        }
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
        } else if (k === 'p' || k === 'c') {
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
  }, [
    navigate,
    exitPath,
    prevCell,
    nextCell,
    recordColor,
    resolveProbe,
    probeOpen,
    capture,
    startFirst,
    finishSessionAndSave,
    finishSummary,
    splitMode,
    activeSplitLearnerId,
    recordColorForLearner,
    resolveProbeForLearner,
  ])

  if (!openSession) {
    return <Navigate to={exitPath} replace />
  }

  if (activeLearnerMismatch) {
    return (
      <div className="observe-root flex items-center justify-center">
        <div className="observe-modal-card" role="alert">
          <h2 className="observe-modal-title">Wrong live session</h2>
          <p className="observe-modal-desc">
            {activeLearnerName} is selected, but the open live session is for{' '}
            {openLearnerNames || 'another learner'}. Finish that live session before starting a new
            one.
          </p>
          <div className="observe-modal-actions">
            <button
              type="button"
              className="observe-modal-btn observe-modal-confirm"
              onClick={() => navigate('/teacher')}
            >
              Back to learners
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (liveLoading || !capture || capture.learningSessionId !== openSession.id) {
    return (
      <div className="observe-root flex items-center justify-center" role="status">
        <p className="text-sm font-semibold text-slate-300">Loading live session…</p>
      </div>
    )
  }

  if (capture.sessionStatus !== 'open') {
    return <Navigate to={exitPath} replace />
  }

  const renderLearnerPane = (learnerId: string) => {
    const paneAttempt = currentAttemptForLearner(capture, learnerId)
    const user = roster.users.find((u) => u.id === learnerId)
    const learnerQuestions = capture.questions.filter((q) => q.assignedLearnerUserId === learnerId)
    const learnerQuestionIds = new Set(learnerQuestions.map((q) => q.id))
    const learnerAttempts = capture.attempts.filter((a) => a.learnerUserId === learnerId)
    const paneProbeOpen =
      paneAttempt?.snapshot.status === 'probe_open' ||
      paneAttempt?.snapshot.status === 'resolution_required'
    const paneFinalized =
      paneAttempt?.snapshot.status === 'finalized' || paneAttempt?.snapshot.status === 'corrected'
    const paneProbeDepth = paneAttempt?.snapshot.probeCount ?? 0
    const learnerQuestionIndex = paneAttempt
      ? Math.max(
          0,
          learnerQuestions.findIndex((q) => q.id === paneAttempt.sessionQuestionId),
        )
      : 0
    const learnerDone = learnerAttempts.filter(
      (a) => a.snapshot.status === 'finalized' || a.snapshot.status === 'corrected',
    ).length
    const learnerRy = learnerAttempts.filter(
      (a) => a.snapshot.effectiveColor === 'red' || a.snapshot.effectiveColor === 'yellow',
    ).length
    const learnerRfc = learnerDone > 0 ? Math.round((learnerRy / learnerDone) * 100) : 0
    const learnerCapture: CaptureSessionState = {
      ...capture,
      learnerIds: [learnerId],
      questions: learnerQuestions,
      attempts: capture.attempts.filter((a) => learnerQuestionIds.has(a.sessionQuestionId)),
      position: {
        ...capture.position,
        questionIndex: learnerQuestionIndex,
        learnerIndex: 0,
      },
    }
    const active = activeSplitLearnerId === learnerId

    return (
      <section
        key={learnerId}
        className={`observe-split-pane${active ? ' is-active' : ''}`}
        aria-label={`Observe ${user?.displayName ?? learnerId}`}
        onPointerDown={() => setActiveSplitLearnerId(learnerId)}
      >
        <div className="observe-stage-hero observe-split-hero">
          <div className="observe-phone-avatar" aria-hidden={false}>
            <UserAvatar
              name={user?.displayName ?? 'Learner'}
              avatarUrl={user?.avatarUrl}
              size="md"
            />
          </div>
          <h2 className="observe-learner observe-learner-solo observe-split-name">
            {user?.displayName ?? 'Learner'}
          </h2>
          <div className="observe-meta-row">
            <span className="observe-learner-rfc" title="Learner RFC in this session">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              RFC {learnerDone ? `${learnerRfc}%` : '—'}
            </span>
            <span className="observe-meta-muted">
              {learnerDone}/{Math.max(learnerAttempts.length, 1)} done
            </span>
          </div>
          {paneProbeOpen ? (
            <p className="observe-depth-inline" title="n = how deep after Green (Continue).">
              n=<strong>{paneProbeDepth}</strong>
            </p>
          ) : null}
        </div>

        {paneAttempt ? (
          <>
            <div className="observe-split-map">
              <ObserveHeatmap
                capture={learnerCapture}
                currentQuestionIndex={learnerQuestionIndex}
                learnerName={learnerName}
                onSelectQuestion={(i) => {
                  const q = learnerQuestions[i]
                  if (!q) return
                  const originalIndex = capture.questions.findIndex((x) => x.id === q.id)
                  setActiveSplitLearnerId(learnerId)
                  setCapture(jumpToQuestion(capture, originalIndex))
                }}
                layout="row"
              />
            </div>
            <div
              className={`observe-dock observe-dock-lg${reaction ? ` is-glowing is-${reaction.color}` : ''}`}
            >
              {paneProbeOpen ? (
                <div
                  className="observe-dock-probe"
                  role="group"
                  aria-label={`Resolve probe for ${user?.displayName ?? 'learner'}`}
                >
                  {PROBE_ACTIONS.map((action) => (
                    <button
                      key={action.outcome}
                      type="button"
                      className={`observe-dock-probe-btn ${action.className}`}
                      onClick={() => resolveProbeForLearner(learnerId, action.outcome)}
                      disabled={liveSaving}
                      aria-label={`${action.label} probe`}
                    >
                      <span>{action.label}</span>
                      <kbd>{action.shortcut}</kbd>
                    </button>
                  ))}
                </div>
              ) : (
                <div
                  className="observe-dock-colors"
                  role="group"
                  aria-label={`Result color for ${user?.displayName ?? 'learner'}`}
                >
                  {COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`observe-dock-color is-${c.key}${
                        paneFinalized && paneAttempt.snapshot.effectiveColor === c.key
                          ? ' is-selected'
                          : ''
                      }`}
                      onClick={() => recordColorForLearner(learnerId, c.key)}
                      disabled={liveSaving}
                      aria-label={c.label}
                    >
                      <span className="observe-dock-num">{c.shortcut}</span>
                      <span className="observe-dock-label">{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="observe-dock-tools observe-split-tools">
                <span className="observe-dock-q" aria-live="polite">
                  Q{learnerQuestionIndex + 1}/{Math.max(learnerQuestions.length, 1)}
                </span>
                <span className="observe-meta-muted">Tab switches pane</span>
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="observe-cta"
            disabled={liveSaving}
            onClick={() => {
              setActiveSplitLearnerId(learnerId)
              void advanceLearnerPane(capture, learnerId).then(setCapture)
            }}
          >
            <Plus className="h-5 w-5" aria-hidden />
            Start {user?.displayName ?? 'learner'}
          </button>
        )}
      </section>
    )
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
        <Link to={exitPath} className="observe-nav-exit" aria-label="Exit observe">
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
        </div>
      </header>

      <button
        type="button"
        className="observe-finish-fab"
        onClick={() => void finishSessionAndSave()}
        disabled={finishing}
        aria-label="Finish session and save"
        title="Finish & save (F)"
      >
        <CheckCircle2 aria-hidden strokeWidth={2.25} />
        <span>{finishing ? 'Saving…' : 'Finish'}</span>
      </button>

      {/* Desktop left rail (resizable). Phone uses bottom map sheet instead. */}
      {capture.questions.length > 0 && !isPhone && !splitMode ? (
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
                {probeOpen ? (
                  <p className="observe-rail-n" title="n = probe depth after Green">
                    n={probeDepth}
                  </p>
                ) : null}
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
        {splitMode && capture.questions.length > 0 ? (
          <div className={`observe-split${isPhone ? ' is-portrait' : ' is-landscape'}`}>
            {capture.learnerIds.map(renderLearnerPane)}
          </div>
        ) : capture.questions.length === 0 ? (
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
                <p className="observe-depth-inline" title="n = how deep after Green (Continue).">
                  n=<strong>{probeDepth}</strong>
                </p>
              ) : null}
            </div>

            {reaction && reaction.kind === 'happy' ? (
              <div key={reaction.id} className="observe-react observe-react-happy" aria-hidden>
                <span className="observe-react-symbol">
                  <Check aria-hidden />
                </span>
                <span className="observe-react-label">Tập trung tốt!</span>
                <Sparkles className="observe-react-sparkles" aria-hidden />
                <span className="observe-react-burst" />
              </div>
            ) : null}

            <div
              className={`observe-dock observe-dock-lg${reaction ? ` is-glowing is-${reaction.color}` : ''}`}
            >
              {probeOpen ? (
                <div className="observe-dock-probe" role="group" aria-label="Resolve probe">
                  {PROBE_ACTIONS.map((action) => (
                    <button
                      key={action.outcome}
                      type="button"
                      className={`observe-dock-probe-btn ${action.className}`}
                      onClick={() => resolveProbe(action.outcome)}
                      disabled={liveSaving}
                      aria-label={`${action.label} probe`}
                    >
                      <span>{action.label}</span>
                      <kbd>{action.shortcut}</kbd>
                    </button>
                  ))}
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
                  <kbd>F</kbd>/<kbd>P</kbd>/<kbd>D</kbd> Fail / Pass / Done
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

      {finishSummary && (
        <div className="observe-modal-container">
          <div className="observe-modal-backdrop" aria-hidden="true" />
          <div
            className="observe-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-finish-summary-title"
          >
            <div className="observe-modal-icon">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
            <h2 id="modal-finish-summary-title" className="observe-modal-title">
              Session Summary
            </h2>
            <p className="observe-modal-desc">
              Review this session summary. Save & Finish will close this day permanently, then the
              next visit starts a new day.
            </p>
            <pre className="observe-modal-summary-text">{finishSummary}</pre>
            <div className="observe-modal-actions">
              <button
                type="button"
                className="observe-modal-btn observe-modal-cancel"
                onClick={() => setFinishSummary(null)}
                disabled={finishing}
              >
                Review More
              </button>
              <button
                type="button"
                className="observe-modal-btn observe-modal-confirm"
                onClick={() => void handleConfirmFinish()}
                disabled={finishing}
              >
                {finishing ? 'Saving…' : 'Save & Finish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

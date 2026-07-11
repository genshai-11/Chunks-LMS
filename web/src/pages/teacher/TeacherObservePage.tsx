import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Keyboard, PanelLeft, Plus, X } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  addSessionQuestion,
  advancePosition,
  currentAttempt,
  jumpToQuestion,
  recordColorForCurrent,
  resolveProbeForCurrent,
  retreatPosition,
  type CaptureSessionState,
} from '../../modules/assessment/session-capture'
import { ObserveHeatmap } from '../../components/ObserveHeatmap'
import { UserAvatar } from '../../components/UserAvatar'
import type { ResultColor } from '../../modules/result-lifecycle/types'
import { useAppState } from '../../state/useAppState'

const COLORS: { key: ResultColor; label: string; shortcut: string }[] = [
  { key: 'red', label: 'Red', shortcut: '1' },
  { key: 'yellow', label: 'Yellow', shortcut: '2' },
  { key: 'green', label: 'Green', shortcut: '3' },
  { key: 'purple', label: 'Purple', shortcut: '4' },
]

type Reaction = 'happy' | 'fight' | null

function reactionFor(color: ResultColor | 'fail' | 'done'): Reaction {
  if (color === 'green' || color === 'purple' || color === 'done') return 'happy'
  if (color === 'red' || color === 'yellow' || color === 'fail') return 'fight'
  return null
}

function autoNextQuestion(state: CaptureSessionState): CaptureSessionState {
  const atLast =
    state.questions.length === 0 ||
    state.position.questionIndex >= state.questions.length - 1
  if (atLast) {
    const r = addSessionQuestion(state)
    if (r.ok) return r.state
  }
  return advancePosition(state)
}

/**
 * Observe: left rail (avatar + collapsible map), big name, large bottom color dock,
 * happy/fight reaction flash. Phone-friendly.
 */
export function TeacherObservePage() {
  const navigate = useNavigate()
  const { roster, capture, setCapture, appendFinalizedFromCapture, scheduling } =
    useAppState()
  const [toast, setToast] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(false)
  const [mapOpen, setMapOpen] = useState(true)
  const [reaction, setReaction] = useState<Reaction>(null)

  const teacher = roster.users.find((u) => u.roles.includes('teacher'))
  const classRow =
    roster.classes.find((c) => c.teacherUserId === teacher?.id) ?? roster.classes[0]
  const openSession = scheduling.learningSessions.find(
    (s) => s.classId === classRow?.id && s.status === 'open',
  )

  const attempt = capture ? currentAttempt(capture) : null
  const learner = attempt
    ? roster.users.find((u) => u.id === attempt.learnerUserId)
    : null

  const qNum = capture ? capture.position.questionIndex + 1 : 0
  const qTotal = capture?.questions.length ?? 0
  const probeDepth = attempt?.snapshot.probeCount ?? 0
  const isFinalized =
    attempt?.snapshot.status === 'finalized' || attempt?.snapshot.status === 'corrected'
  const probeOpen =
    attempt?.snapshot.status === 'probe_open' ||
    attempt?.snapshot.status === 'resolution_required'

  const learnerName = useCallback(
    (id: string) => roster.users.find((u) => u.id === id)?.displayName ?? id.slice(0, 6),
    [roster.users],
  )

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 900)
  }, [])

  const playReaction = useCallback((kind: Reaction) => {
    if (!kind) return
    setReaction(kind)
    window.setTimeout(() => setReaction(null), 700)
  }, [])

  const apply = useCallback(
    (next: CaptureSessionState) => {
      setCapture(next)
      appendFinalizedFromCapture(next)
    },
    [setCapture, appendFinalizedFromCapture],
  )

  const recordColor = useCallback(
    (color: ResultColor) => {
      if (!capture) return
      const wasFinal = isFinalized
      const r = recordColorForCurrent(capture, color)
      if (!r.ok) {
        flash(r.error)
        return
      }
      apply(r.state)
      if (
        r.value.snapshot.status === 'finalized' ||
        r.value.snapshot.status === 'corrected'
      ) {
        playReaction(reactionFor(color))
        if (wasFinal) {
          flash(color)
        } else {
          const next = autoNextQuestion(r.state)
          setCapture(next)
          appendFinalizedFromCapture(next)
          flash(color)
        }
      }
    },
    [capture, apply, flash, setCapture, isFinalized, appendFinalizedFromCapture, playReaction],
  )

  const resolveProbe = useCallback(
    (outcome: 'fail' | 'continue' | 'done') => {
      if (!capture) return
      const r = resolveProbeForCurrent(capture, outcome)
      if (!r.ok) {
        flash(r.error)
        return
      }
      apply(r.state)
      if (
        r.value.snapshot.status === 'finalized' ||
        r.value.snapshot.status === 'corrected'
      ) {
        playReaction(reactionFor(outcome === 'fail' ? 'fail' : 'done'))
        const next = autoNextQuestion(r.state)
        setCapture(next)
        appendFinalizedFromCapture(next)
        flash(outcome === 'fail' ? 'yellow' : 'green')
      } else if (outcome === 'continue') {
        flash(`n=${r.value.snapshot.probeCount}`)
      }
    },
    [capture, apply, flash, setCapture, appendFinalizedFromCapture, playReaction],
  )

  const startFirst = useCallback(() => {
    if (!capture) return
    const r = addSessionQuestion(capture)
    if (!r.ok) {
      flash(r.error)
      return
    }
    setCapture(r.state)
  }, [capture, setCapture, flash])

  const prevCell = useCallback(() => {
    if (!capture || capture.questions.length === 0) return
    setCapture(retreatPosition(capture))
  }, [capture, setCapture])

  const selectQuestion = useCallback(
    (questionIndex: number) => {
      if (!capture) return
      setCapture(jumpToQuestion(capture, questionIndex))
    },
    [capture, setCapture],
  )

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
      if (k === 'n' && capture?.questions.length === 0) {
        e.preventDefault()
        startFirst()
        return
      }
      if (k === '1') {
        e.preventDefault()
        recordColor('red')
        return
      }
      if (k === '2') {
        e.preventDefault()
        recordColor('yellow')
        return
      }
      if (k === '3') {
        e.preventDefault()
        recordColor('green')
        return
      }
      if (k === '4') {
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
  }, [navigate, prevCell, recordColor, resolveProbe, probeOpen, capture, startFirst])

  if (!openSession || !capture || capture.sessionStatus !== 'open') {
    return <Navigate to="/teacher/session" replace />
  }

  return (
    <div
      className={`observe-root${reaction === 'happy' ? ' is-react-happy' : ''}${
        reaction === 'fight' ? ' is-react-fight' : ''
      }`}
      role="application"
      aria-label="Focus and Awareness observation"
    >
      <header className="observe-bar observe-bar-slim">
        <Link to="/teacher/session" className="observe-exit" aria-label="Exit">
          <X className="h-4 w-4" strokeWidth={2} />
        </Link>
        <div className="observe-bar-center">
          <span className="observe-class">{classRow?.name ?? 'Class'}</span>
          {qTotal > 0 ? (
            <>
              <span className="observe-sep">·</span>
              <span className="observe-mode">
                Q{qNum}
                <span className="observe-meta-muted">/{qTotal}</span>
              </span>
            </>
          ) : null}
        </div>
        <div className="observe-bar-actions">
          {capture.questions.length > 0 ? (
            <button
              type="button"
              className="observe-keys-btn icon-only"
              onClick={() => setMapOpen((v) => !v)}
              aria-pressed={mapOpen}
              aria-label={mapOpen ? 'Hide map' : 'Show map'}
              title="Map (H)"
            >
              <PanelLeft className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="observe-keys-btn icon-only"
            onClick={() => setShowKeys((v) => !v)}
            aria-label="Shortcuts"
          >
            <Keyboard className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="observe-body">
        {/* Left rail: avatar + collapsible heatmap (same area) */}
        {capture.questions.length > 0 ? (
          <aside
            className={`observe-rail${mapOpen ? ' is-open' : ' is-closed'}`}
            aria-label="Learner and progress map"
          >
            <div className="observe-rail-person">
              <UserAvatar
                name={learner?.displayName ?? 'Learner'}
                avatarUrl={learner?.avatarUrl}
                size="lg"
                className="observe-rail-avatar"
              />
              <p className="observe-rail-name">{learner?.displayName ?? 'Learner'}</p>
              {probeOpen ? (
                <p className="observe-rail-n">n={probeDepth}</p>
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
                aria-label="Open map"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            )}

            {mapOpen ? (
              <button
                type="button"
                className="observe-rail-collapse"
                onClick={() => setMapOpen(false)}
                aria-label="Hide map"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </aside>
        ) : null}

        {/* Center: big name only */}
        <main className="observe-stage observe-stage-tight">
          {capture.questions.length === 0 ? (
            <div className="observe-empty">
              <p className="observe-empty-title">Observe</p>
              <button type="button" className="observe-cta" onClick={startFirst}>
                <Plus className="h-5 w-5" aria-hidden />
                Start
                <kbd>N</kbd>
              </button>
            </div>
          ) : (
            <>
              <h1 className="observe-learner observe-learner-solo">
                {learner?.displayName ?? 'Learner'}
              </h1>
              {probeOpen ? (
                <p className="observe-depth-inline">
                  n=<strong>{probeDepth}</strong>
                  <span className="observe-meta-muted"> · F / C / D</span>
                </p>
              ) : null}

              {/* Reaction burst */}
              {reaction === 'happy' ? (
                <div className="observe-react observe-react-happy" aria-hidden>
                  <span>😊</span>
                  <span className="observe-react-burst" />
                </div>
              ) : null}
              {reaction === 'fight' ? (
                <div className="observe-react observe-react-fight" aria-hidden>
                  <span>💪</span>
                  <span className="observe-react-burst" />
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>

      {/* Big bottom color dock — numbers only */}
      {capture.questions.length > 0 ? (
        <div className="observe-dock observe-dock-lg">
          {probeOpen ? (
            <div className="observe-dock-probe" role="group" aria-label="Resolve green">
              <button
                type="button"
                className="observe-dock-probe-btn fail"
                onClick={() => resolveProbe('fail')}
              >
                Fail
                <kbd>F</kbd>
              </button>
              <button
                type="button"
                className="observe-dock-probe-btn cont"
                onClick={() => resolveProbe('continue')}
              >
                Cont
                <kbd>C</kbd>
              </button>
              <button
                type="button"
                className="observe-dock-probe-btn done"
                onClick={() => resolveProbe('done')}
              >
                Done
                <kbd>D</kbd>
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
                  disabled={!attempt}
                  aria-label={c.label}
                >
                  <span className="observe-dock-num">{c.shortcut}</span>
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
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <Link to="/teacher/session" className="observe-tool">
              Exit
            </Link>
          </div>
        </div>
      ) : null}

      {showKeys && (
        <div className="observe-keys-panel" role="dialog" aria-label="Keyboard shortcuts">
          <p>
            <kbd>1</kbd>–<kbd>4</kbd> · auto next · <kbd>F</kbd>/<kbd>C</kbd>/<kbd>D</kbd> ·{' '}
            <kbd>H</kbd> map · <kbd>←</kbd> prev · <kbd>Esc</kbd>
          </p>
        </div>
      )}

      {toast && (
        <div className="observe-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

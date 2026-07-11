import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Keyboard,
  Plus,
  Repeat2,
  X,
} from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  addSessionQuestion,
  advancePosition,
  currentAttempt,
  recordColorForCurrent,
  resolveProbeForCurrent,
  setCaptureMode,
} from '../../modules/assessment/session-capture'
import { UserAvatar } from '../../components/UserAvatar'
import type { ResultColor } from '../../modules/result-lifecycle/types'
import { useAppState } from '../../state/useAppState'

const COLORS: { key: ResultColor; label: string; hint: string; shortcut: string }[] = [
  { key: 'red', label: 'Red', hint: 'Not ready', shortcut: '1' },
  { key: 'yellow', label: 'Yellow', hint: 'Partial', shortcut: '2' },
  { key: 'green', label: 'Green', hint: 'Probe', shortcut: '3' },
  { key: 'purple', label: 'Purple', hint: 'Mastery', shortcut: '4' },
]

/**
 * Full-screen, minimal observation mode for Focus / Awareness capture.
 * Hides LMS chrome via AppShell focus mode.
 */
export function TeacherObservePage() {
  const navigate = useNavigate()
  const { roster, capture, setCapture, appendFinalizedFromCapture, scheduling } =
    useAppState()
  const [toast, setToast] = useState<string | null>(null)
  const [showKeys, setShowKeys] = useState(false)

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
  const qTotal = Math.max(capture?.questions.length ?? 0, 1)
  const lTotal = capture?.learnerIds.length ?? 0

  const progressDone = useMemo(() => {
    if (!capture) return 0
    return capture.attempts.filter(
      (a) => a.snapshot.status === 'finalized' || a.snapshot.status === 'corrected',
    ).length
  }, [capture])
  const progressTotal = capture?.attempts.length ?? 0
  const progressPct =
    progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0

  const perLearnerTarget =
    lTotal > 0 && progressTotal > 0 ? Math.round((progressTotal / lTotal) * 10) / 10 : 0

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1600)
  }, [])

  const apply = useCallback(
    (next: NonNullable<typeof capture>) => {
      setCapture(next)
      appendFinalizedFromCapture(next)
    },
    [setCapture, appendFinalizedFromCapture],
  )

  const recordColor = useCallback(
    (color: ResultColor) => {
      if (!capture) return
      const r = recordColorForCurrent(capture, color)
      if (!r.ok) {
        flash(r.error)
        return
      }
      apply(r.state)
      // Auto-advance when finalized (not green probe open)
      if (
        r.value.snapshot.status === 'finalized' ||
        r.value.snapshot.status === 'corrected'
      ) {
        const advanced = advancePosition(r.state)
        setCapture(advanced)
        flash(`${color} · next`)
      } else if (r.value.snapshot.status === 'probe_open') {
        flash('Green — resolve probe')
      }
    },
    [capture, apply, flash, setCapture],
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
        const advanced = advancePosition(r.state)
        setCapture(advanced)
        flash(`${outcome} · next`)
      }
    },
    [capture, apply, flash, setCapture],
  )

  const nextQuestion = useCallback(() => {
    if (!capture) return
    const r = addSessionQuestion(capture)
    if (!r.ok) {
      flash(r.error)
      return
    }
    setCapture(r.state)
    flash(`Q${r.value.sequenceNumber}`)
  }, [capture, setCapture, flash])

  const nextCell = useCallback(() => {
    if (!capture) return
    setCapture(advancePosition(capture))
  }, [capture, setCapture])

  const toggleMode = useCallback(() => {
    if (!capture) return
    setCapture(
      setCaptureMode(
        capture,
        capture.position.mode === 'question_first' ? 'learner_first' : 'question_first',
      ),
    )
  }, [capture, setCapture])

  // Keyboard: 1–4 colors, F/C/D probe, N next Q, → next cell, Esc exit
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
      if (k === 'n') {
        e.preventDefault()
        nextQuestion()
        return
      }
      if (k === 'arrowright' || k === ' ') {
        e.preventDefault()
        nextCell()
        return
      }
      if (k === 'm') {
        e.preventDefault()
        toggleMode()
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
      const probeOpen =
        attempt?.snapshot.status === 'probe_open' ||
        attempt?.snapshot.status === 'resolution_required'
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
  }, [
    navigate,
    nextQuestion,
    nextCell,
    toggleMode,
    recordColor,
    resolveProbe,
    attempt?.snapshot.status,
  ])

  if (!openSession || !capture || capture.sessionStatus !== 'open') {
    return <Navigate to="/teacher/session" replace />
  }

  const probeOpen =
    attempt?.snapshot.status === 'probe_open' ||
    attempt?.snapshot.status === 'resolution_required'
  const needsResolution = attempt?.snapshot.status === 'resolution_required'

  return (
    <div className="observe-root" role="application" aria-label="Focus and Awareness observation">
      <header className="observe-bar">
        <Link to="/teacher/session" className="observe-exit" aria-label="Exit observation">
          <X className="h-5 w-5" strokeWidth={2} />
          <span>Exit</span>
        </Link>
        <div className="observe-bar-center">
          <span className="observe-class">{classRow?.name ?? 'Class'}</span>
          <span className="observe-sep" aria-hidden>
            ·
          </span>
          <span className="observe-mode">
            {capture.position.mode === 'question_first' ? 'By question' : 'By learner'}
          </span>
        </div>
        <button
          type="button"
          className="observe-keys-btn"
          onClick={() => setShowKeys((v) => !v)}
          aria-pressed={showKeys}
        >
          <Keyboard className="h-4 w-4" aria-hidden />
          <span>Keys</span>
        </button>
      </header>

      <div className="observe-progress" aria-hidden>
        <div className="observe-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <main className="observe-stage">
        {capture.questions.length === 0 ? (
          <div className="observe-empty">
            <p className="observe-empty-title">Ready to observe</p>
            <p className="observe-empty-desc">Add the first question, then tap a color.</p>
            <button type="button" className="observe-cta" onClick={nextQuestion}>
              <Plus className="h-5 w-5" aria-hidden />
              Start first question
              <kbd>N</kbd>
            </button>
          </div>
        ) : (
          <>
            <p className="observe-meta">
              Sentence <strong>{qNum}</strong>
              <span className="observe-meta-muted"> / {qTotal}</span>
              <span className="observe-sep">·</span>
              <span className="observe-meta-muted">1 learner / sentence</span>
              <span className="observe-sep">·</span>
              <span className="observe-meta-muted">
                {progressDone}/{progressTotal} done
                {perLearnerTarget > 0 ? ` · ~${perLearnerTarget}/learner` : ''}
              </span>
            </p>

            <div className="observe-learner-block">
              <UserAvatar
                name={learner?.displayName ?? 'Learner'}
                avatarUrl={learner?.avatarUrl}
                size="xl"
                className="observe-learner-avatar"
              />
              <h1 className="observe-learner">{learner?.displayName ?? 'Learner'}</h1>
            </div>

            {attempt && (
              <p className="observe-status">
                {probeOpen ? (
                  needsResolution ? (
                    <span className="observe-status-warn">Max probes — Fail or Done</span>
                  ) : (
                    <span className="observe-status-probe">
                      Green probe open · {attempt.snapshot.probeCount}/
                      {attempt.snapshot.maxProbeCount}
                    </span>
                  )
                ) : attempt.snapshot.effectiveColor ? (
                  <span className={`observe-status-done color-tag-${attempt.snapshot.effectiveColor}`}>
                    <Check className="h-4 w-4" aria-hidden />
                    {attempt.snapshot.effectiveColor}
                  </span>
                ) : (
                  <span className="observe-status-wait">Tap a color</span>
                )}
              </p>
            )}

            {!probeOpen && (
              <div className="observe-colors" role="group" aria-label="Result color">
                {COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    className={`observe-color observe-color-${c.key}`}
                    onClick={() => recordColor(c.key)}
                    disabled={!attempt || attempt.snapshot.status === 'finalized' || attempt.snapshot.status === 'corrected'}
                  >
                    <span className="observe-color-key">{c.shortcut}</span>
                    <span className="observe-color-label">{c.label}</span>
                    <span className="observe-color-hint">{c.hint}</span>
                  </button>
                ))}
              </div>
            )}

            {probeOpen && (
              <div className="observe-probe" role="group" aria-label="Green probe">
                <p className="observe-probe-title">Resolve Green</p>
                <div className="observe-probe-actions">
                  <button
                    type="button"
                    className="observe-probe-btn fail"
                    onClick={() => resolveProbe('fail')}
                  >
                    Fail <kbd>F</kbd>
                  </button>
                  {!needsResolution && (
                    <button
                      type="button"
                      className="observe-probe-btn continue"
                      onClick={() => resolveProbe('continue')}
                    >
                      Continue <kbd>C</kbd>
                    </button>
                  )}
                  <button
                    type="button"
                    className="observe-probe-btn done"
                    onClick={() => resolveProbe('done')}
                  >
                    Done <kbd>D</kbd>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="observe-footer">
        <button type="button" className="observe-foot-btn" onClick={toggleMode}>
          <Repeat2 className="h-4 w-4" aria-hidden />
          Mode
          <kbd>M</kbd>
        </button>
        <button type="button" className="observe-foot-btn primary" onClick={nextQuestion}>
          <Plus className="h-4 w-4" aria-hidden />
          Next Q
          <kbd>N</kbd>
        </button>
        <button type="button" className="observe-foot-btn" onClick={nextCell}>
          Next
          <ArrowRight className="h-4 w-4" aria-hidden />
          <kbd>→</kbd>
        </button>
        <Link to="/teacher/session" className="observe-foot-btn ghost">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Session
        </Link>
      </footer>

      {showKeys && (
        <div className="observe-keys-panel" role="dialog" aria-label="Keyboard shortcuts">
          <p>
            <kbd>1</kbd>–<kbd>4</kbd> colors · <kbd>F</kbd>/<kbd>C</kbd>/<kbd>D</kbd> probe ·{' '}
            <kbd>N</kbd> question · <kbd>→</kbd> next · <kbd>M</kbd> mode · <kbd>Esc</kbd> exit
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

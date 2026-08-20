import { useEffect, useRef } from 'react'
import type { CaptureSessionState } from '../modules/assessment/session-capture'
import { sessionColorSummary } from '../modules/assessment/session-capture'
import { calculateSpectrumStepBreakdown } from '../modules/metrics/calculate'
import { probeChunksNumber } from '../modules/assessment/probe-metrics'

type Props = {
  capture: CaptureSessionState
  currentQuestionIndex: number
  learnerName: (userId: string) => string
  onSelectQuestion: (questionIndex: number) => void
  /** Vertical column (left rail) vs horizontal strip */
  layout?: 'column' | 'row'
}

/**
 * Compact Q map + RFC/%c counts. Column mode for left rail.
 */
export function ObserveHeatmap({
  capture,
  currentQuestionIndex,
  learnerName,
  onSelectQuestion,
  layout = 'column',
}: Props) {
  const summary = sessionColorSummary(capture)
  const finalizedAttempts = capture.attempts.filter(
    (a) =>
      (a.snapshot.status === 'finalized' || a.snapshot.status === 'corrected') &&
      a.snapshot.effectiveColor,
  )
  const spectrum = calculateSpectrumStepBreakdown(
    finalizedAttempts.map((a) => ({
      effectiveColor: a.snapshot.effectiveColor!,
      enteredProbeFlow: a.snapshot.enteredProbeFlow,
      probeEventCount: a.snapshot.probeCount,
    })),
  )
  const nTotal = spectrum.totalRecords
  const rfcPct = spectrum.rfc == null ? 0 : Math.round(spectrum.rfc * 100)
  const racPct = spectrum.rac == null ? 0 : Math.round(spectrum.rac * 100)
  const rfcTitle = `RFC = warm steps / N_total = ${spectrum.warmSteps} / ${nTotal}. Warm = Red + Orange + Yellow.`
  const racTitle = `%c = cool steps / N_total = ${spectrum.coolSteps} / ${nTotal}. Cool = Green + Blue + Indigo + Purple.`
  const totalTitle = `Total records = primary records + probe records = ${spectrum.primaryRecords} + ${spectrum.probeRecords} = ${nTotal}. Finalized attempts=${summary.done}; max chunks number=${summary.maxProbeDepth}.`

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const activeEl = containerRef.current.querySelector('.observe-heat-dot-btn.is-current')
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [currentQuestionIndex])

  return (
    <div className={`observe-heat layout-${layout}`}>
      <div className="observe-heat-summary" aria-label="Session summary">
        <span className="observe-heat-metric" title={rfcTitle}>
          RFC <strong>{nTotal ? `${rfcPct}%` : '—'}</strong>
        </span>
        <span className="observe-heat-metric muted" title={racTitle}>
          %c <strong>{nTotal ? `${racPct}%` : '—'}</strong>
        </span>
        <span
          className="observe-heat-metric muted tabular"
          title={totalTitle}
        >
          records {nTotal}/{Math.max(summary.total + spectrum.probeRecords, 1)}
          {summary.maxProbeDepth > 0 ? ` · max chunks=${summary.maxProbeDepth}` : ''}
        </span>
      </div>

      <div
        ref={containerRef}
        className="observe-heat-grid"
        role="list"
        aria-label="Question map"
      >
        {capture.questions.map((q, i) => {
          const attempt = capture.attempts.find((a) => a.sessionQuestionId === q.id)
          const snap = attempt?.snapshot
          const color = snap?.effectiveColor ?? null
          const open = snap?.status === 'probe_open' || snap?.status === 'resolution_required'
          const draft = !snap || snap.status === 'draft'
          const active = i === currentQuestionIndex
          const cls = open ? 'is-open' : draft ? 'is-draft' : color ? `is-${color}` : 'is-empty'
          const chunksNumber = snap ? probeChunksNumber(snap) : null
          const probeBit = chunksNumber != null
            ? ` · probe records=${snap?.probeCount ?? 0}; chunks number=${chunksNumber}`
            : open
              ? ' · probe open'
              : ''
          return (
            <button
              key={q.id}
              type="button"
              role="listitem"
              className={`observe-heat-dot-btn ${cls}${active ? ' is-current' : ''}`}
              title={`Q${q.sequenceNumber} · ${learnerName(q.assignedLearnerUserId)}${
                color ? ` · ${color}` : ''
              }${probeBit || (draft ? ' · not assessed' : '')}`}
              aria-label={`Question ${q.sequenceNumber}, ${learnerName(
                q.assignedLearnerUserId,
              )}, ${color ?? (open ? 'probe open' : 'not assessed')}${
                chunksNumber != null ? `, chunks number=${chunksNumber}` : ''
              }`}
              aria-current={active ? 'step' : undefined}
              onClick={() => onSelectQuestion(i)}
            >
              {q.sequenceNumber}
              {chunksNumber != null ? (
                <span className="observe-heat-probe-badge">n{chunksNumber}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

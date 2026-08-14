import { useEffect, useRef } from 'react'
import type { CaptureSessionState } from '../modules/assessment/session-capture'
import { sessionColorSummary } from '../modules/assessment/session-capture'
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
  // Sample size for RFC/%c — not n depth.
  const finalized = summary.done
  const ry = summary.byColor.red + summary.byColor.yellow
  const gp = summary.byColor.green + summary.byColor.purple
  const rfcPct = finalized > 0 ? Math.round((ry / finalized) * 100) : 0
  const racPct = finalized > 0 ? Math.round((gp / finalized) * 100) : 0

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
        <span className="observe-heat-metric" title="(Red+Orange) / finalized questions">
          RFC <strong>{finalized ? `${rfcPct}%` : '—'}</strong>
        </span>
        <span className="observe-heat-metric muted" title="(Green+Purple) / finalized questions">
          %c <strong>{finalized ? `${racPct}%` : '—'}</strong>
        </span>
        <span
          className="observe-heat-metric muted tabular"
          title={`Finalized questions · n depth max=${summary.maxProbeDepth}`}
        >
          {summary.done}/{Math.max(summary.total, 1)}
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
          const probeBit =
            chunksNumber != null ? ` · n depth=${chunksNumber}` : open ? ' · probe open' : ''
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
                chunksNumber != null ? `, n depth=${chunksNumber}` : ''
              }`}
              aria-current={active ? 'step' : undefined}
              onClick={() => onSelectQuestion(i)}
            >
              {q.sequenceNumber}
            </button>
          )
        })}
      </div>
    </div>
  )
}

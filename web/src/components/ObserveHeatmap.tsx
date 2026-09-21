import { useEffect, useRef } from 'react'
import type { CaptureSessionState } from '../modules/assessment/session-capture'
import { sessionColorSummary } from '../modules/assessment/session-capture'
import { calculateSpectrumStepBreakdown, COLOR_PERCENT_X_VALUES } from '../modules/metrics/calculate'
import { probeChunksNumber } from '../modules/assessment/probe-metrics'
import { SPECTRUM_COLORS, type ResultColor } from '../modules/result-lifecycle/types'

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
  const racPct = spectrum.avgPercentX == null ? 0 : Math.round(spectrum.avgPercentX)
  const legacyRacPct = spectrum.rac == null ? 0 : Math.round(spectrum.rac * 100)
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
        <span
          className="observe-heat-metric observe-has-tooltip"
          tabIndex={0}
          aria-label={`Struggle RFC: ${nTotal ? `${rfcPct}%` : '—'}`}
        >
          RFC <strong>{nTotal ? `${rfcPct}%` : '—'}</strong>
          <span className="observe-metric-tooltip observe-tooltip-rich tooltip-left" role="tooltip">
            <span className="observe-tooltip-header">
              <span>Struggle (RFC)</span>
              <span className="font-mono text-amber-300 font-bold">{nTotal ? `${rfcPct}%` : '—'}</span>
            </span>
            <span className="observe-tooltip-divider" />
            <span className="observe-tooltip-body">
              <span className="observe-tooltip-row">
                <span className="observe-tooltip-key">Formula:</span>
                <span className="observe-tooltip-val font-mono text-[10px]">warm records / N_total</span>
              </span>
              <span className="observe-tooltip-row">
                <span className="observe-tooltip-key">Warm steps:</span>
                <span className="observe-tooltip-val">
                  {spectrum.warmSteps} / {nTotal}{' '}
                  <span className="text-slate-400 font-normal">(Red + Orange + Yellow)</span>
                </span>
              </span>
              <span className="observe-tooltip-note">
                Lower RFC indicates less observed struggle.
              </span>
            </span>
          </span>
        </span>

        <span
          className="observe-heat-metric muted observe-has-tooltip"
          tabIndex={0}
          aria-label={`Awareness / Success (%c): ${nTotal ? `${racPct}%` : '—'}`}
        >
          %c <strong>{nTotal ? `${racPct}%` : '—'}</strong>
          <span className="observe-metric-tooltip observe-tooltip-rich tooltip-center" role="tooltip">
            <span className="observe-tooltip-header">
              <span>Awareness / Success (%c)</span>
              <span className="font-mono text-emerald-300 font-bold">{nTotal ? `${racPct}%` : '—'}</span>
            </span>
            <span className="observe-tooltip-divider" />
            <span className="observe-tooltip-body">
              <span className="observe-tooltip-row">
                <span className="observe-tooltip-key">Formula:</span>
                <span className="observe-tooltip-val font-mono text-[10px]">Avg %x = sum(%x) / N_total</span>
              </span>
              <span className="observe-tooltip-row">
                <span className="observe-tooltip-key">7-color weighted:</span>
                <span className="observe-tooltip-val">
                  {spectrum.sumPercentX.toFixed(1)}% / {nTotal} = {(spectrum.avgPercentX ?? 0).toFixed(1)}%
                </span>
              </span>
              <span className="observe-tooltip-row">
                <span className="observe-tooltip-key">Legacy RAC:</span>
                <span className="observe-tooltip-val">
                  {legacyRacPct}%{' '}
                  <span className="text-slate-400 font-normal">
                    ({spectrum.coolSteps}/{nTotal} cool records)
                  </span>
                </span>
              </span>
              <span className="observe-tooltip-note">
                Weights: Red 0%, Orange 17%, Yellow 34%, Green 50%, Blue 67%, Indigo 84%, Purple 100%.
              </span>
            </span>
          </span>
        </span>

        <div
          className="observe-heat-counts observe-color-pills"
          aria-label="Recorded 7-color counts"
        >
          {SPECTRUM_COLORS.map((color) => (
            <span
              key={color}
              className={`observe-heat-count is-${color}`}
              title={`${color}: ${summary ? summary.recordedByColor[color] : 0} recorded steps${
                color === 'green' ? ' (Green probe openers)' : color === 'blue' ? ' (Continue probe steps)' : ''
              }`}
            >
              <i aria-hidden />
              {summary ? summary.recordedByColor[color] : 0}
            </span>
          ))}
          <span
            className="observe-heat-count is-total"
            title={summary ? `N_total = primary + probe = ${summary.primaryRecords} + ${summary.probeRecords}` : 'N_total'}
          >
            Σ {summary ? summary.totalRecords : 0}
          </span>
        </div>
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
          const colorName = color ? color.charAt(0).toUpperCase() + color.slice(1) : null

          return (
            <button
              key={q.id}
              type="button"
              role="listitem"
              className={`observe-heat-dot-btn ${cls}${active ? ' is-current' : ''}`}
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
              <span className="observe-dot-tooltip" role="tooltip">
                <span className="observe-dot-tooltip-title">
                  {open ? 'Probe in progress' : draft ? 'Not assessed' : `${colorName} (${COLOR_PERCENT_X_VALUES[color as ResultColor] ?? 0}%)`}
                </span>
                {chunksNumber != null ? (
                  <span className="observe-dot-tooltip-detail">
                    Chunks n{chunksNumber} · {snap?.probeCount ?? 0} step{(snap?.probeCount ?? 0) === 1 ? '' : 's'}
                  </span>
                ) : color ? (
                  <span className="observe-dot-tooltip-detail">Finalized primary step</span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

import type { CaptureSessionState } from '../modules/assessment/session-capture'
import { sessionColorSummary } from '../modules/assessment/session-capture'
import type { ResultColor } from '../modules/result-lifecycle/types'

type Props = {
  capture: CaptureSessionState
  currentQuestionIndex: number
  learnerName: (userId: string) => string
  onSelectQuestion: (questionIndex: number) => void
  /** Vertical column (left rail) vs horizontal strip */
  layout?: 'column' | 'row'
}

const COLOR_ORDER: ResultColor[] = ['red', 'yellow', 'green', 'purple']

/**
 * Compact Q map + RFC/RAC counts. Column mode for left rail.
 */
export function ObserveHeatmap({
  capture,
  currentQuestionIndex,
  learnerName,
  onSelectQuestion,
  layout = 'column',
}: Props) {
  const summary = sessionColorSummary(capture)
  const n = summary.done
  const ry = summary.byColor.red + summary.byColor.yellow
  const gp = summary.byColor.green + summary.byColor.purple
  const rfcPct = n > 0 ? Math.round((ry / n) * 100) : 0
  const racPct = n > 0 ? Math.round((gp / n) * 100) : 0

  return (
    <div className={`observe-heat layout-${layout}`}>
      <div className="observe-heat-summary" aria-label="Session summary">
        <span className="observe-heat-metric" title="(Red+Yellow)/N">
          RFC <strong>{n ? `${rfcPct}%` : '—'}</strong>
        </span>
        <span className="observe-heat-metric muted" title="(Green+Purple)/N">
          RAC <strong>{n ? `${racPct}%` : '—'}</strong>
        </span>
        <span className="observe-heat-counts" aria-label="Color counts">
          {COLOR_ORDER.map((c) => (
            <span
              key={c}
              className={`observe-heat-count is-${c}`}
              title={`${c}: ${summary.byColor[c]}`}
            >
              <i aria-hidden />
              {summary.byColor[c]}
            </span>
          ))}
        </span>
        <span className="observe-heat-metric muted tabular">
          {summary.done}/{Math.max(summary.total, 1)}
        </span>
      </div>

      <div className="observe-heat-grid" role="list" aria-label="Question map">
        {capture.questions.map((q, i) => {
          const attempt = capture.attempts.find((a) => a.sessionQuestionId === q.id)
          const snap = attempt?.snapshot
          const color = snap?.effectiveColor ?? null
          const open =
            snap?.status === 'probe_open' || snap?.status === 'resolution_required'
          const draft = !snap || snap.status === 'draft'
          const active = i === currentQuestionIndex
          const cls = open
            ? 'is-open'
            : draft
              ? 'is-draft'
              : color
                ? `is-${color}`
                : 'is-empty'
          return (
            <button
              key={q.id}
              type="button"
              role="listitem"
              className={`observe-heat-dot-btn ${cls}${active ? ' is-current' : ''}`}
              title={`Q${q.sequenceNumber} · ${learnerName(q.assignedLearnerUserId)}${
                color ? ` · ${color}` : open ? ' · probe' : ''
              }`}
              onClick={() => onSelectQuestion(i)}
            >
              <span className="sr-only">Q{q.sequenceNumber}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

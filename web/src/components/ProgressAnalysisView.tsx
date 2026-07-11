import { useMemo, useState } from 'react'
import {
  Activity,
  CalendarDays,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  buildCourseProgressReport,
  buildLearnerProgressReport,
  filterResults,
  formatDelta,
  formatMetricValue,
  type ResultRecord,
} from '../modules/reporting/progress'
import {
  resolveReportWindow,
  type ReportWindowKind,
} from '../modules/reporting/report-window'
import {
  buildSessionMetricSeries,
  sessionLabel,
  type SessionMetricPoint,
} from '../modules/reporting/session-series'
import type { DomainUser } from '../modules/roster/types'
import type { ResultColor } from '../modules/result-lifecycle/types'
import { COLOR_SCORE } from '../modules/result-lifecycle/types'
import type { MetricSettingsState } from '../modules/metrics/settings'
import type { MetricKey, MetricObservation } from '../modules/metrics/calculate'
import { AnalysisChartsPanel } from './AnalysisChartsPanel'
import { UserAvatar } from './UserAvatar'

type SessionOpt = {
  id: string
  startedAt: string
  completedAt: string | null
  sessionNumber?: number | null
}

type Props = {
  mode: 'teacher' | 'learner'
  courseId: string
  courseCode: string
  courseStart: string
  courseEnd?: string | null
  classId?: string
  className?: string
  /** Planned course days (e.g. 15) for Day N/15 labels */
  totalDays?: number | null
  ledger: ResultRecord[]
  users: DomainUser[]
  learnerUserId?: string
  learningSessions?: SessionOpt[]
  emptyHint?: string
  /**
   * Admin metric config — used only to respect enabled/min-sample for secondary KPIs.
   * Full metric catalog lives on Admin → Metrics, not here.
   */
  metricSettings?: MetricSettingsState
}

/** Time scope: keep simple — course total, one day, or custom range */
const TIME_SCOPES: { kind: ReportWindowKind; label: string; hint: string }[] = [
  { kind: 'course', label: 'Whole course', hint: 'All days so far' },
  { kind: 'session', label: 'One day', hint: 'Single live session' },
  { kind: 'custom', label: 'Date range', hint: 'Pick from → to' },
]

function colorCounts(records: ResultRecord[]): Record<ResultColor, number> {
  const c: Record<ResultColor, number> = { red: 0, yellow: 0, green: 0, purple: 0 }
  for (const r of records) c[r.effectiveColor] += 1
  return c
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

/** RFC↑ = more struggle (worse). RAC↑ = more success (better). */
function trendTone(key: 'rfc' | 'rac', delta: number | null | undefined): 'up' | 'down' | 'flat' {
  if (delta == null || Math.abs(delta) < 0.05) return 'flat'
  if (key === 'rfc') return delta < 0 ? 'up' : 'down' // lower RFC is better
  return delta > 0 ? 'up' : 'down'
}

function formatPp(delta: number | null | undefined): string {
  if (delta == null) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)} pp`
}

function sessionRfcDelta(points: SessionMetricPoint[], index: number): number | null {
  if (index <= 0) return null
  const cur = points[index]?.metrics.rfc
  const prev = points[index - 1]?.metrics.rfc
  if (cur == null || prev == null) return null
  return (cur - prev) * 100 // percentage points
}

function sessionRacDelta(points: SessionMetricPoint[], index: number): number | null {
  if (index <= 0) return null
  const cur = points[index]?.metrics.rac
  const prev = points[index - 1]?.metrics.rac
  if (cur == null || prev == null) return null
  return (cur - prev) * 100
}

function pickMetric(
  list: MetricObservation[],
  key: MetricKey,
  settings?: MetricSettingsState,
): MetricObservation | null {
  const obs = list.find((m) => m.key === key)
  if (!obs) return null
  if (!settings) return obs
  const cfg = settings.metrics.find((m) => m.key === key)
  if (cfg && !cfg.enabled) return null
  if (cfg && obs.sampleSize < cfg.minSample) {
    return { ...obs, value: null, status: cfg.status }
  }
  return cfg ? { ...obs, status: cfg.status, definition: cfg.definition || obs.definition } : obs
}

/**
 * Teacher + learner Analysis dashboard.
 * Focus: RFC / RAC, color mix, per-day session trend — not the full metrics catalog.
 */
export function ProgressAnalysisView({
  mode,
  courseId,
  courseCode,
  courseStart,
  courseEnd,
  classId,
  className,
  totalDays,
  ledger,
  users,
  learnerUserId,
  learningSessions = [],
  emptyHint,
  metricSettings,
}: Props) {
  const [kind, setKind] = useState<ReportWindowKind>('course')
  const [customStart, setCustomStart] = useState(courseStart.slice(0, 10) || '2026-07-01')
  const [customEnd, setCustomEnd] = useState(
    (courseEnd ?? '2026-12-31').toString().slice(0, 10),
  )
  const [sessionId, setSessionId] = useState(learningSessions[0]?.id ?? '')
  const [selectedLearner, setSelectedLearner] = useState(learnerUserId ?? '')
  const [tab, setTab] = useState<
    'overview' | 'charts' | 'sessions' | 'learners' | 'history'
  >('overview')

  const learners = useMemo(
    () => users.filter((u) => u.roles.includes('learner')),
    [users],
  )

  const orderedSessions = useMemo(() => {
    return [...learningSessions].sort((a, b) => {
      const na = a.sessionNumber ?? 9999
      const nb = b.sessionNumber ?? 9999
      if (na !== nb) return na - nb
      return a.startedAt.localeCompare(b.startedAt)
    })
  }, [learningSessions])

  const window = useMemo(() => {
    try {
      if (kind === 'course') {
        return resolveReportWindow({
          kind: 'course',
          courseStart,
          courseEnd: courseEnd ?? '2026-12-31',
        })
      }
      if (kind === 'session') {
        const s = orderedSessions.find((x) => x.id === sessionId) ?? orderedSessions[0]
        if (!s) {
          return resolveReportWindow({
            kind: 'course',
            courseStart,
            courseEnd: courseEnd ?? '2026-12-31',
          })
        }
        return resolveReportWindow({
          kind: 'session',
          learningSessionId: s.id,
          sessionStartedAt: s.startedAt,
          sessionEndedAt: s.completedAt,
        })
      }
      // custom (and any leftover week/month → treat as custom range)
      return resolveReportWindow({
        kind: 'custom',
        start: `${customStart}T00:00:00.000Z`,
        end: `${customEnd}T23:59:59.999Z`,
      })
    } catch {
      return null
    }
  }, [kind, customStart, customEnd, sessionId, courseStart, courseEnd, orderedSessions])

  const scopedLedger = useMemo(() => {
    if (!classId) return ledger.filter((r) => r.courseId === courseId)
    return ledger.filter((r) => r.courseId === courseId && r.classId === classId)
  }, [ledger, courseId, classId])

  const focusLearnerId = mode === 'learner' ? learnerUserId : selectedLearner || undefined
  const focusLearner = focusLearnerId
    ? users.find((u) => u.id === focusLearnerId)
    : undefined

  const courseReport = useMemo(() => {
    if (!window || mode === 'learner' || focusLearnerId) return null
    const learnerIds = learners.map((u) => u.id)
    return buildCourseProgressReport(scopedLedger, courseId, window, { learnerIds })
  }, [window, mode, focusLearnerId, scopedLedger, courseId, learners])

  const learnerReport = useMemo(() => {
    if (!window || !focusLearnerId) return null
    return buildLearnerProgressReport(scopedLedger, focusLearnerId, window, {
      courseId,
      classId,
    })
  }, [window, focusLearnerId, scopedLedger, courseId, classId])

  const comparison = learnerReport?.comparison ?? courseReport?.overall ?? null

  const windowRecords = useMemo(() => {
    if (!window) return []
    return filterResults(scopedLedger, window, {
      courseId,
      classId,
      learnerUserId: focusLearnerId,
    })
  }, [window, scopedLedger, courseId, classId, focusLearnerId])

  const counts = colorCounts(windowRecords)
  const total = windowRecords.length
  const maxBar = Math.max(1, ...Object.values(counts))

  const rfc = comparison ? pickMetric(comparison.current, 'rfc', metricSettings) : null
  const rac = comparison ? pickMetric(comparison.current, 'rac', metricSettings) : null
  const avg = comparison
    ? pickMetric(comparison.current, 'average_performance', metricSettings)
    : null

  const rfcDelta = comparison?.deltas.rfc
  const racDelta = comparison?.deltas.rac
  const rfcTone = trendTone('rfc', rfcDelta)
  const racTone = trendTone('rac', racDelta)

  /** Per-day series for class or focused learner */
  const sessionSeries = useMemo(() => {
    return buildSessionMetricSeries({
      ledger: scopedLedger,
      learningSessions: orderedSessions.map((s) => ({
        id: s.id,
        classId: classId ?? '',
        scheduledSessionId: null,
        status: s.completedAt ? ('completed' as const) : ('open' as const),
        plannedQuestionCount: null,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        maxProbeCount: 2,
        sessionNumber: s.sessionNumber ?? null,
      })),
      courseId,
      classId,
      learnerUserId: focusLearnerId,
      metricKeys: ['rfc', 'rac', 'average_performance'],
    })
  }, [scopedLedger, orderedSessions, courseId, classId, focusLearnerId])

  const recent = [...windowRecords]
    .sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt))
    .slice(0, 20)

  const selectedSessionLabel = useMemo(() => {
    const s = orderedSessions.find((x) => x.id === sessionId) ?? orderedSessions[0]
    if (!s) return '—'
    const num =
      s.sessionNumber ??
      orderedSessions.findIndex((x) => x.id === s.id) + 1
    return sessionLabel(num, s.startedAt, totalDays)
  }, [orderedSessions, sessionId, totalDays])

  if (scopedLedger.length === 0) {
    return (
      <div className="empty-state analysis-empty">
        <p>
          <strong>No progress data yet</strong>
        </p>
        <p className="meta" style={{ textAlign: 'center' }}>
          {emptyHint ??
            'Complete a live session with finalized Focus / Awareness colors to see progress here.'}
        </p>
      </div>
    )
  }

  const subTabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'charts' as const, label: 'Charts' },
    { id: 'sessions' as const, label: 'By day' },
    ...(mode === 'teacher' && !focusLearnerId
      ? [{ id: 'learners' as const, label: 'Learners' }]
      : []),
    { id: 'history' as const, label: 'Results' },
  ]

  return (
    <div className="analysis">
      {/* ——— Filters: Who + When ——— */}
      <section className="analysis-filter-card" aria-label="Analysis filters">
        <div className="analysis-filter-row">
          <div className="analysis-filter-block">
            <span className="analysis-filter-label">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Time
            </span>
            <div className="analysis-chip-row" role="group" aria-label="Time scope">
              {TIME_SCOPES.map((w) => (
                <button
                  key={w.kind}
                  type="button"
                  className={`analysis-chip${kind === w.kind ? ' is-active' : ''}`}
                  aria-pressed={kind === w.kind}
                  title={w.hint}
                  onClick={() => setKind(w.kind)}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'teacher' ? (
            <div className="analysis-filter-block analysis-filter-grow">
              <span className="analysis-filter-label">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Who
              </span>
              <label className="analysis-select-wrap">
                <span className="sr-only">Learner</span>
                <select
                  className="analysis-select"
                  value={selectedLearner}
                  onChange={(e) => {
                    setSelectedLearner(e.target.value)
                    if (e.target.value) setTab('overview')
                  }}
                >
                  <option value="">Whole class</option>
                  {learners.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        {kind === 'session' && orderedSessions.length > 0 ? (
          <div className="analysis-filter-row">
            <label className="analysis-select-wrap analysis-filter-grow">
              <span className="analysis-filter-label">Day / session</span>
              <select
                className="analysis-select"
                value={sessionId || orderedSessions[0]?.id}
                onChange={(e) => setSessionId(e.target.value)}
              >
                {orderedSessions.map((s, i) => {
                  const num = s.sessionNumber ?? i + 1
                  const label = sessionLabel(num, s.startedAt, totalDays)
                  const date = new Date(s.startedAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })
                  return (
                    <option key={s.id} value={s.id}>
                      {label} · {date}
                      {s.completedAt ? '' : ' · open'}
                    </option>
                  )
                })}
              </select>
            </label>
          </div>
        ) : null}

        {kind === 'custom' ? (
          <div className="analysis-filter-row analysis-dates">
            <label className="analysis-select-wrap">
              <span className="analysis-filter-label">From</span>
              <input
                type="date"
                className="analysis-select"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </label>
            <label className="analysis-select-wrap">
              <span className="analysis-filter-label">To</span>
              <input
                type="date"
                className="analysis-select"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </label>
          </div>
        ) : null}

        <p className="analysis-filter-meta">
          {courseCode}
          {className ? ` · ${className}` : ''}
          {focusLearner ? ` · ${focusLearner.displayName}` : mode === 'teacher' ? ' · class' : ''}
          {kind === 'session' ? ` · ${selectedSessionLabel}` : window ? ` · ${window.label}` : ''}
          {' · '}
          <strong>n={total}</strong> finalized
        </p>
      </section>

      {/* Focused learner strip */}
      {focusLearner ? (
        <div className="analysis-person-strip">
          <UserAvatar
            name={focusLearner.displayName}
            avatarUrl={focusLearner.avatarUrl}
            size="md"
          />
          <div className="analysis-person-copy">
            <p className="analysis-person-name">{focusLearner.displayName}</p>
            <p className="meta">
              {mode === 'teacher' ? 'Learner detail' : 'Your progress'} · {total} results in scope
            </p>
          </div>
          {mode === 'teacher' ? (
            <button
              type="button"
              className="ghost analysis-person-clear"
              onClick={() => setSelectedLearner('')}
            >
              Class view
            </button>
          ) : null}
        </div>
      ) : null}

      <nav className="subnav" aria-label="Analysis sections">
        {subTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'is-active' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ——— Overview ——— */}
      {tab === 'overview' && (
        <div className="analysis-tab-body">
          <p className="analysis-plain-hint">
            <strong>RFC</strong> = share of Red+Yellow (struggle). Lower is better focus.
            {' · '}
            <strong>RAC</strong> = share of Green+Purple (success). Higher is better.
          </p>

          <div className="stat-grid analysis-kpis">
            <div className={`stat-card analysis-kpi-rfc${rfcTone === 'up' ? ' is-good' : rfcTone === 'down' ? ' is-warn' : ''}`}>
              <p className="stat-label">
                <Activity className="inline h-3.5 w-3.5" aria-hidden /> Struggle (RFC)
              </p>
              <p className="stat-value">{rfc ? formatMetricValue(rfc) : '—'}</p>
              <p className={`analysis-delta is-${rfcTone}`}>
                {rfcTone === 'up' ? (
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                ) : rfcTone === 'down' ? (
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                ) : null}
                {formatDelta('rfc', rfcDelta)}
                <span className="analysis-delta-note"> vs prior window</span>
              </p>
            </div>
            <div className={`stat-card analysis-kpi-rac${racTone === 'up' ? ' is-good' : racTone === 'down' ? ' is-warn' : ''}`}>
              <p className="stat-label">Success (RAC)</p>
              <p className="stat-value">{rac ? formatMetricValue(rac) : '—'}</p>
              <p className={`analysis-delta is-${racTone}`}>
                {racTone === 'up' ? (
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                ) : racTone === 'down' ? (
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                ) : null}
                {formatDelta('rac', racDelta)}
                <span className="analysis-delta-note"> vs prior window</span>
              </p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Avg score</p>
              <p className="stat-value">{avg ? formatMetricValue(avg) : '—'}</p>
              <p className="meta">0–3 scale · n={total}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">Results</p>
              <p className="stat-value">{total}</p>
              <p className="meta">
                G/P {counts.green + counts.purple} · R/Y {counts.red + counts.yellow}
              </p>
            </div>
          </div>

          <div className="analysis-grid">
            <div className="panel">
              <div className="panel-body-inner">
                <p className="panel-title mb-2">Color mix</p>
                {total === 0 ? (
                  <p className="meta">No data in this filter.</p>
                ) : (
                  <div className="dist-bars">
                    {(['red', 'yellow', 'green', 'purple'] as ResultColor[]).map((color) => {
                      const n = counts[color]
                      const p = pct(n, total)
                      const width = `${Math.max(n ? 8 : 0, (n / maxBar) * 100)}%`
                      return (
                        <div key={color} className="dist-row">
                          <span className={`capture-dot ${color}`}>{color}</span>
                          <div className="dist-track">
                            <div className={`dist-fill dist-${color}`} style={{ width }} />
                          </div>
                          <span className="dist-count">
                            {n} · {p}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-body-inner">
                <p className="panel-title mb-2">Recent days snapshot</p>
                {sessionSeries.length === 0 ? (
                  <p className="meta">No per-day series yet.</p>
                ) : (
                  <ul className="analysis-session-mini">
                    {sessionSeries.slice(-5).map((p, idx, arr) => {
                      const globalIdx = sessionSeries.length - arr.length + idx
                      const dRfc = sessionRfcDelta(sessionSeries, globalIdx)
                      const tone = trendTone('rfc', dRfc)
                      return (
                        <li key={p.learningSessionId}>
                          <button
                            type="button"
                            className="analysis-session-mini-row"
                            onClick={() => {
                              setKind('session')
                              setSessionId(p.learningSessionId)
                              setTab('overview')
                            }}
                          >
                            <span className="analysis-session-mini-day">
                              {sessionLabel(p.sessionNumber, p.startedAt, totalDays)}
                            </span>
                            <span className="analysis-session-mini-rfc">
                              RFC{' '}
                              {p.metrics.rfc != null
                                ? `${(p.metrics.rfc * 100).toFixed(0)}%`
                                : '—'}
                            </span>
                            <span className={`analysis-delta is-${tone}`}>
                              {formatPp(dRfc)}
                            </span>
                            <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <div className="analysis-link-row">
                  <button
                    type="button"
                    className="ghost analysis-link-btn"
                    onClick={() => setTab('sessions')}
                  >
                    Full day-by-day →
                  </button>
                  <button
                    type="button"
                    className="ghost analysis-link-btn"
                    onClick={() => setTab('charts')}
                  >
                    Open charts →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ——— Charts (line / bar / multi) ——— */}
      {tab === 'charts' && (
        <div className="analysis-tab-body">
          <p className="analysis-plain-hint">
            Multi-chart board: line &amp; bar for RFC/RAC by day, stacked colors, pie mix.
            Respects <strong>Who</strong> filter (class or one learner) above.
          </p>
          <AnalysisChartsPanel
            ledger={scopedLedger}
            learningSessions={orderedSessions}
            courseId={courseId}
            classId={classId}
            learnerUserId={focusLearnerId}
            totalDays={totalDays}
          />
        </div>
      )}

      {/* ——— By day (session series + Δ RFC) ——— */}
      {tab === 'sessions' && (
        <div className="analysis-tab-body">
          <p className="analysis-plain-hint">
            Each row is one live day. <strong>Δ RFC</strong> is change vs the previous day
            (negative pp = less struggle = improvement).
          </p>
          {sessionSeries.length === 0 ? (
            <p className="empty-state">No session results yet.</p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Progress by day">
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col">n</th>
                    <th scope="col">RFC</th>
                    <th scope="col">Δ RFC</th>
                    <th scope="col">RAC</th>
                    <th scope="col">Δ RAC</th>
                    <th scope="col">Avg</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {sessionSeries.map((p, i) => {
                    const dRfc = sessionRfcDelta(sessionSeries, i)
                    const dRac = sessionRacDelta(sessionSeries, i)
                    const rfcT = trendTone('rfc', dRfc)
                    const racT = trendTone('rac', dRac)
                    return (
                      <tr key={p.learningSessionId}>
                        <th scope="row">
                          <span className="analysis-day-cell">
                            {sessionLabel(p.sessionNumber, p.startedAt, totalDays)}
                            <small>
                              {new Date(p.startedAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </small>
                          </span>
                        </th>
                        <td>{p.attemptCount}</td>
                        <td>
                          {p.metrics.rfc != null
                            ? `${(p.metrics.rfc * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td>
                          <span className={`analysis-delta is-${rfcT}`}>{formatPp(dRfc)}</span>
                        </td>
                        <td>
                          {p.metrics.rac != null
                            ? `${(p.metrics.rac * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td>
                          <span className={`analysis-delta is-${racT}`}>{formatPp(dRac)}</span>
                        </td>
                        <td>
                          {p.metrics.average_performance != null
                            ? p.metrics.average_performance.toFixed(2)
                            : '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="ghost"
                            onClick={() => {
                              setKind('session')
                              setSessionId(p.learningSessionId)
                              setTab('overview')
                            }}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ——— Learners (teacher class view) ——— */}
      {tab === 'learners' && mode === 'teacher' && courseReport && (
        <div className="analysis-tab-body">
          <p className="analysis-plain-hint">
            Tap a learner for their personal dashboard (RFC trend by day + results).
          </p>
          <div className="table-wrap">
            <table aria-label="Learner progress">
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  <th scope="col">n</th>
                  <th scope="col">RFC</th>
                  <th scope="col">Δ RFC</th>
                  <th scope="col">RAC</th>
                  <th scope="col">Avg</th>
                  <th scope="col" />
                </tr>
              </thead>
              <tbody>
                {courseReport.byLearner.map((row) => {
                  const user = users.find((u) => u.id === row.learnerUserId)
                  const rRac = row.comparison.current.find((m) => m.key === 'rac')
                  const rRfc = row.comparison.current.find((m) => m.key === 'rfc')
                  const rAvg = row.comparison.current.find((m) => m.key === 'average_performance')
                  const dRfc = row.comparison.deltas.rfc
                  const tone = trendTone('rfc', dRfc)
                  return (
                    <tr key={row.learnerUserId}>
                      <td>
                        <span className="cell-with-avatar">
                          <UserAvatar
                            name={user?.displayName ?? row.learnerUserId}
                            avatarUrl={user?.avatarUrl}
                            size="sm"
                          />
                          <span>{user?.displayName ?? row.learnerUserId}</span>
                        </span>
                      </td>
                      <td>{row.attemptCount}</td>
                      <td>{rRfc ? formatMetricValue(rRfc) : '—'}</td>
                      <td>
                        <span className={`analysis-delta is-${tone}`}>{formatPp(dRfc)}</span>
                      </td>
                      <td>{rRac ? formatMetricValue(rRac) : '—'}</td>
                      <td>{rAvg ? formatMetricValue(rAvg) : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => {
                            setSelectedLearner(row.learnerUserId)
                            setTab('overview')
                          }}
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ——— Recent results ——— */}
      {tab === 'history' && (
        <div className="analysis-tab-body">
          <div className="table-wrap">
            {recent.length === 0 ? (
              <p className="empty-state">Nothing in this filter.</p>
            ) : (
              <table aria-label="Recent observations">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    {mode === 'teacher' && !focusLearnerId ? (
                      <th scope="col">Learner</th>
                    ) : null}
                    <th scope="col">Color</th>
                    <th scope="col">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => {
                    const user = users.find((u) => u.id === r.learnerUserId)
                    return (
                      <tr key={r.id}>
                        <td>{new Date(r.finalizedAt).toLocaleString()}</td>
                        {mode === 'teacher' && !focusLearnerId ? (
                          <td>
                            <button
                              type="button"
                              className="ghost cell-with-avatar"
                              onClick={() => {
                                setSelectedLearner(r.learnerUserId)
                                setTab('overview')
                              }}
                            >
                              <UserAvatar
                                name={user?.displayName ?? r.learnerUserId}
                                avatarUrl={user?.avatarUrl}
                                size="sm"
                              />
                              <span>{user?.displayName ?? r.learnerUserId.slice(0, 8)}</span>
                            </button>
                          </td>
                        ) : null}
                        <td>
                          <span className={`capture-dot ${r.effectiveColor}`}>
                            {r.effectiveColor}
                          </span>
                        </td>
                        <td>{COLOR_SCORE[r.effectiveColor]}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
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
import type { DomainUser } from '../modules/roster/types'
import type { ResultColor } from '../modules/result-lifecycle/types'
import { COLOR_SCORE } from '../modules/result-lifecycle/types'
import type { MetricSettingsState } from '../modules/metrics/settings'
import type { MetricKey, MetricObservation } from '../modules/metrics/calculate'
import { UserAvatar } from './UserAvatar'

type SessionOpt = { id: string; startedAt: string; completedAt: string | null }

type Props = {
  mode: 'teacher' | 'learner'
  courseId: string
  courseCode: string
  courseStart: string
  courseEnd?: string | null
  classId?: string
  className?: string
  ledger: ResultRecord[]
  users: DomainUser[]
  learnerUserId?: string
  learningSessions?: SessionOpt[]
  emptyHint?: string
  /** Admin-controlled visibility / status / min sample */
  metricSettings?: MetricSettingsState
}

const WINDOWS: { kind: ReportWindowKind; label: string }[] = [
  { kind: 'course', label: 'Whole course' },
  { kind: 'month', label: 'This month' },
  { kind: 'week', label: 'This week' },
  { kind: 'session', label: 'One session' },
  { kind: 'custom', label: 'Custom dates' },
]

function colorCounts(records: ResultRecord[]): Record<ResultColor, number> {
  const c: Record<ResultColor, number> = { red: 0, yellow: 0, green: 0, purple: 0 }
  for (const r of records) c[r.effectiveColor] += 1
  return c
}

export function ProgressAnalysisView({
  mode,
  courseId,
  courseCode,
  courseStart,
  courseEnd,
  classId,
  className,
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
  const [tab, setTab] = useState<'summary' | 'learners' | 'history' | 'metrics'>('summary')

  const window = useMemo(() => {
    try {
      if (kind === 'course') {
        return resolveReportWindow({
          kind: 'course',
          courseStart,
          courseEnd: courseEnd ?? '2026-12-31',
        })
      }
      if (kind === 'week') {
        return resolveReportWindow({ kind: 'week', anchor: `${customStart}T12:00:00.000Z` })
      }
      if (kind === 'month') {
        return resolveReportWindow({ kind: 'month', anchor: `${customStart}T12:00:00.000Z` })
      }
      if (kind === 'session') {
        const s =
          learningSessions.find((x) => x.id === sessionId) ?? learningSessions[0]
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
      return resolveReportWindow({
        kind: 'custom',
        start: `${customStart}T00:00:00.000Z`,
        end: `${customEnd}T23:59:59.999Z`,
      })
    } catch {
      return null
    }
  }, [kind, customStart, customEnd, sessionId, courseStart, courseEnd, learningSessions])

  const scopedLedger = useMemo(() => {
    if (!classId) return ledger.filter((r) => r.courseId === courseId)
    return ledger.filter((r) => r.courseId === courseId && r.classId === classId)
  }, [ledger, courseId, classId])

  const focusLearnerId = mode === 'learner' ? learnerUserId : selectedLearner || undefined

  const courseReport = useMemo(() => {
    if (!window || mode === 'learner') return null
    const learnerIds = users.filter((u) => u.roles.includes('learner')).map((u) => u.id)
    return buildCourseProgressReport(scopedLedger, courseId, window, { learnerIds })
  }, [window, mode, scopedLedger, courseId, users])

  const learnerReport = useMemo(() => {
    if (!window || !focusLearnerId) return null
    return buildLearnerProgressReport(scopedLedger, focusLearnerId, window, {
      courseId,
      classId,
    })
  }, [window, focusLearnerId, scopedLedger, courseId, classId])

  const comparison = learnerReport?.comparison ?? courseReport?.overall ?? null

  const visibleMetrics = useMemo(() => {
    if (!comparison) return [] as MetricObservation[]
    return comparison.current
      .map((obs): MetricObservation | null => {
        if (!metricSettings) return obs
        const cfg = metricSettings.metrics.find((m) => m.key === obs.key)
        if (!cfg || !cfg.enabled) return null
        const belowMin = obs.sampleSize < cfg.minSample
        return {
          ...obs,
          status: cfg.status,
          value: belowMin ? null : obs.value,
          definition: cfg.definition || obs.definition,
        }
      })
      .filter((m): m is MetricObservation => m !== null)
  }, [comparison, metricSettings])

  const pick = (key: MetricKey) => visibleMetrics.find((m) => m.key === key)

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

  const rac = pick('rac')
  const rfc = pick('rfc')
  const avg = pick('average_performance')
  const purple = pick('purple_mastery_rate')
  const clar = pick('clarification_rate')
  const recovery = pick('awareness_recovery')

  const recent = [...windowRecords]
    .sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt))
    .slice(0, 12)

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
    { id: 'summary' as const, label: 'Summary' },
    ...(mode === 'teacher' ? [{ id: 'learners' as const, label: 'By learner' }] : []),
    { id: 'history' as const, label: 'History' },
    { id: 'metrics' as const, label: 'All metrics' },
  ]

  return (
    <div className="analysis">
      <div className="analysis-toolbar-compact">
        <div className="btn-row my-0" role="group" aria-label="Time window">
          {WINDOWS.map((w) => (
            <button
              key={w.kind}
              type="button"
              className={kind === w.kind ? 'active' : 'ghost'}
              aria-pressed={kind === w.kind}
              onClick={() => setKind(w.kind)}
            >
              {w.label}
            </button>
          ))}
        </div>
        {(kind === 'week' || kind === 'month' || kind === 'custom') && (
          <div className="form-grid form-grid-inline">
            <label>
              {kind === 'custom' ? 'From' : 'Date'}
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </label>
            {kind === 'custom' && (
              <label>
                To
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </label>
            )}
          </div>
        )}
        {kind === 'session' && learningSessions.length > 0 && (
          <label className="field field-inline">
            Session
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
              {learningSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {new Date(s.startedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === 'teacher' && (
          <label className="field field-inline">
            Learner
            <select value={selectedLearner} onChange={(e) => setSelectedLearner(e.target.value)}>
              <option value="">All</option>
              {users
                .filter((u) => u.roles.includes('learner'))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
            </select>
          </label>
        )}
        <p className="meta analysis-window-meta">
          {courseCode}
          {className ? ` · ${className}` : ''}
          {window ? ` · ${window.label}` : ''} · n={total}
        </p>
      </div>

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

      {tab === 'summary' && (
        <div className="analysis-tab-body">
          <div className="stat-grid analysis-kpis">
            {rac ? (
              <div className="stat-card kpi-highlight">
                <p className="stat-label">RAC</p>
                <p className="stat-value">{formatMetricValue(rac)}</p>
                <p className="meta">{formatDelta('rac', comparison?.deltas.rac)}</p>
              </div>
            ) : null}
            {rfc ? (
              <div className="stat-card">
                <p className="stat-label">RFC</p>
                <p className="stat-value">{formatMetricValue(rfc)}</p>
                <p className="meta">{formatDelta('rfc', comparison?.deltas.rfc)}</p>
              </div>
            ) : null}
            {avg ? (
              <div className="stat-card">
                <p className="stat-label">Avg</p>
                <p className="stat-value">{formatMetricValue(avg)}</p>
                <p className="meta">n={avg.sampleSize}</p>
              </div>
            ) : null}
            {purple ? (
              <div className="stat-card">
                <p className="stat-label">Purple</p>
                <p className="stat-value">{formatMetricValue(purple)}</p>
              </div>
            ) : null}
          </div>

          <div className="analysis-grid">
            <div className="panel">
              <div className="panel-body-inner">
                <p className="panel-title mb-2">Colors</p>
                {total === 0 ? (
                  <p className="meta">No data in window.</p>
                ) : (
                  <div className="dist-bars">
                    {(['red', 'yellow', 'green', 'purple'] as ResultColor[]).map((color) => {
                      const n = counts[color]
                      const pct = total ? Math.round((n / total) * 100) : 0
                      const width = `${Math.max(n ? 8 : 0, (n / maxBar) * 100)}%`
                      return (
                        <div key={color} className="dist-row">
                          <span className={`capture-dot ${color}`}>{color}</span>
                          <div className="dist-track">
                            <div className={`dist-fill dist-${color}`} style={{ width }} />
                          </div>
                          <span className="dist-count">
                            {n} · {pct}%
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
                <p className="panel-title mb-2">Probe</p>
                <div className="metric-list">
                  {clar ? (
                    <div className="metric-row">
                      <strong>Clarification</strong>
                      <span className="metric-val">{formatMetricValue(clar)}</span>
                    </div>
                  ) : null}
                  {recovery ? (
                    <div className="metric-row">
                      <strong>Recovery</strong>
                      <span className="metric-val">{formatMetricValue(recovery)}</span>
                    </div>
                  ) : null}
                  {!clar && !recovery ? (
                    <p className="meta">No probe metrics enabled.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'learners' && mode === 'teacher' && courseReport && (
        <div className="table-wrap">
          <table aria-label="Learner progress">
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">n</th>
                <th scope="col">RAC</th>
                <th scope="col">RFC</th>
                <th scope="col">Avg</th>
                <th scope="col">Δ RAC</th>
              </tr>
            </thead>
            <tbody>
              {courseReport.byLearner.map((row) => {
                const user = users.find((u) => u.id === row.learnerUserId)
                const rRac = row.comparison.current.find((m) => m.key === 'rac')
                const rRfc = row.comparison.current.find((m) => m.key === 'rfc')
                const rAvg = row.comparison.current.find((m) => m.key === 'average_performance')
                return (
                  <tr key={row.learnerUserId}>
                    <td>
                      <button
                        type="button"
                        className="ghost cell-with-avatar"
                        onClick={() => {
                          setSelectedLearner(row.learnerUserId)
                          setTab('summary')
                        }}
                      >
                        <UserAvatar
                          name={user?.displayName ?? row.learnerUserId}
                          avatarUrl={user?.avatarUrl}
                          size="sm"
                        />
                        <span>{user?.displayName ?? row.learnerUserId}</span>
                      </button>
                    </td>
                    <td>{row.attemptCount}</td>
                    <td>{rRac ? formatMetricValue(rRac) : '—'}</td>
                    <td>{rRfc ? formatMetricValue(rRfc) : '—'}</td>
                    <td>{rAvg ? formatMetricValue(rAvg) : '—'}</td>
                    <td>{formatDelta('rac', row.comparison.deltas.rac)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div className="table-wrap">
          {recent.length === 0 ? (
            <p className="empty-state">Nothing in this window.</p>
          ) : (
            <table aria-label="Recent observations">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  {mode === 'teacher' ? <th scope="col">Learner</th> : null}
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
                      {mode === 'teacher' ? (
                        <td>
                          <span className="cell-with-avatar">
                            <UserAvatar
                              name={user?.displayName ?? r.learnerUserId}
                              avatarUrl={user?.avatarUrl}
                              size="sm"
                            />
                            <span>{user?.displayName ?? r.learnerUserId.slice(0, 8)}</span>
                          </span>
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
      )}

      {tab === 'metrics' && comparison && (
        <div className="table-wrap">
          <table aria-label="Enabled metrics">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Value</th>
                <th scope="col">n</th>
                <th scope="col">Δ</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleMetrics.map((m) => (
                <tr key={m.key}>
                  <th scope="row">{m.key}</th>
                  <td>{formatMetricValue(m)}</td>
                  <td>{m.sampleSize}</td>
                  <td>{formatDelta(m.key, comparison.deltas[m.key])}</td>
                  <td>
                    {m.status === 'experimental' ? (
                      <span className="badge experimental">exp</span>
                    ) : (
                      <span className="badge">{m.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

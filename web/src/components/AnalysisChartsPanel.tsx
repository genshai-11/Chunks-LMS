import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MetricKey } from '../modules/metrics/calculate'
import type { MetricSettingsState } from '../modules/metrics/settings'
import { getEnabledMetricKeys } from '../modules/metrics/settings'
import type { ResultRecord } from '../modules/reporting/progress'
import {
  buildSessionMetricSeries,
  sessionLabel,
  toChartRows,
  type SessionMetricPoint,
} from '../modules/reporting/session-series'
import type { ResultColor } from '../modules/result-lifecycle/types'

export type AnalysisChartKind = 'line' | 'bar' | 'area' | 'composed' | 'pie'

type SessionOpt = {
  id: string
  startedAt: string
  completedAt: string | null
  sessionNumber?: number | null
}

type Props = {
  ledger: ResultRecord[]
  learningSessions: SessionOpt[]
  courseId: string
  classId?: string
  learnerUserId?: string
  totalDays?: number | null
  /** Compact: hide advanced multi-metric toggles */
  compact?: boolean
  /** Admin-enabled metrics control which chips appear */
  metricSettings?: MetricSettingsState
}

const METRIC_COLORS: Partial<Record<MetricKey, string>> = {
  rfc: '#dc2626',
  rac: '#059669',
  average_performance: '#4f46e5',
  purple_mastery_rate: '#7c3aed',
  clarification_rate: '#0891b2',
  clarification_depth: '#0d9488',
  n_count: '#0ea5e9',
  n_depth_max: '#f97316',
  n_depth_avg: '#a855f7',
  awareness_recovery: '#db2777',
  focus_stability: '#64748b',
}

const FALLBACK_METRICS: MetricKey[] = [
  'rfc',
  'rac',
  'average_performance',
  'n_count',
  'n_depth_max',
  'n_depth_avg',
]

const COLOR_HEX: Record<ResultColor, string> = {
  red: '#f87171',
  yellow: '#facc15',
  green: '#4ade80',
  purple: '#c084fc',
}

const CHART_KINDS: { id: AnalysisChartKind; label: string }[] = [
  { id: 'line', label: 'Line' },
  { id: 'bar', label: 'Bar' },
  { id: 'area', label: 'Area' },
  { id: 'composed', label: 'Combo' },
  { id: 'pie', label: 'Pie' },
]

const LAYOUTS = [
  { id: 'multi' as const, label: 'Multi' },
  { id: 'single' as const, label: 'Single' },
]

const RADIAN = Math.PI / 180
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)

  return percent > 0.08 ? (
    <text
      x={x}
      y={y}
      fill="#000000"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-[10px] font-black"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  ) : null
}

function toSessions(list: SessionOpt[], classId?: string) {
  return list.map((s) => ({
    id: s.id,
    classId: classId ?? '',
    scheduledSessionId: null as string | null,
    status: (s.completedAt ? 'completed' : 'open') as 'open' | 'completed',
    plannedQuestionCount: null as number | null,
    startedAt: s.startedAt,
    completedAt: s.completedAt,
    maxProbeCount: 2,
    sessionNumber: s.sessionNumber ?? null,
    ownerUserId: null,
    lockExpiresAt: null,
    sessionKind: 'regular' as const,
    participantLearnerIds: null,
  }))
}

function colorByDay(
  points: SessionMetricPoint[],
  ledger: ResultRecord[],
  totalDays?: number | null,
): Array<Record<string, string | number>> {
  return points.map((p) => {
    const counts = { red: 0, yellow: 0, green: 0, purple: 0 }
    for (const r of ledger) {
      if (r.learningSessionId !== p.learningSessionId) continue
      counts[r.effectiveColor] += 1
    }
    return {
      name: sessionLabel(p.sessionNumber, p.startedAt, totalDays),
      ...counts,
      total: counts.red + counts.yellow + counts.green + counts.purple,
    }
  })
}

function pctTooltip(value: number | string | undefined, name: string) {
  if (value == null || value === '') return [String(value), name]
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(n)) return [String(value), name]
  if (name.toLowerCase().includes('avg') || name.toLowerCase().includes('score')) {
    return [n.toFixed(2), name]
  }
  if (name.toLowerCase().includes('rfc') || name.toLowerCase().includes('rac') || name.includes('%')) {
    return [`${n}%`, name]
  }
  return [String(n), name]
}

/**
 * Dynamic multi-chart board for Analysis: line / bar / area / combo / pie,
 * multi-panel layout, core Focus metrics + color stack.
 */
export function AnalysisChartsPanel({
  ledger,
  learningSessions,
  courseId,
  classId,
  learnerUserId,
  totalDays,
  compact = false,
  metricSettings,
}: Props) {
  const [layout, setLayout] = useState<'multi' | 'single'>('multi')
  const [chartKind, setChartKind] = useState<AnalysisChartKind>('line')
  const [metrics, setMetrics] = useState<MetricKey[]>(['rfc', 'rac'])
  const [selectedDays, setSelectedDays] = useState<string[]>([])

  const availableMetrics = useMemo((): Array<{ key: MetricKey; label: string; color: string }> => {
    const keys =
      metricSettings && getEnabledMetricKeys(metricSettings).length > 0
        ? getEnabledMetricKeys(metricSettings)
        : FALLBACK_METRICS
    return keys.map((key) => ({
      key,
      label: metricSettings?.metrics.find((m) => m.key === key)?.label ?? key,
      color: METRIC_COLORS[key] ?? '#64748b',
    }))
  }, [metricSettings])

  // Drop chart series that Admin disabled
  const activeMetrics = useMemo(
    () => metrics.filter((k) => availableMetrics.some((m) => m.key === k)),
    [metrics, availableMetrics],
  )

  const points = useMemo(
    () =>
      buildSessionMetricSeries({
        ledger,
        learningSessions: toSessions(learningSessions, classId),
        courseId,
        classId,
        learnerUserId,
        metricKeys: availableMetrics.map((m) => m.key),
      }),
    [ledger, learningSessions, courseId, classId, learnerUserId, availableMetrics],
  )

  const filtered = useMemo(() => {
    if (selectedDays.length === 0) return points
    return points.filter((p) => selectedDays.includes(p.learningSessionId))
  }, [points, selectedDays])

  const trendRows = useMemo(
    () => toChartRows(filtered, activeMetrics),
    [filtered, activeMetrics],
  )

  const colorRows = useMemo(
    () =>
      colorByDay(
        filtered,
        ledger.filter((r) => {
          if (learnerUserId && r.learnerUserId !== learnerUserId) return false
          if (classId && r.classId !== classId) return false
          if (r.courseId !== courseId) return false
          return true
        }),
        totalDays,
      ),
    [filtered, ledger, learnerUserId, classId, courseId, totalDays],
  )

  const colorMixPie = useMemo(() => {
    const counts = { red: 0, yellow: 0, green: 0, purple: 0 }
    // Scope to selected days when set; otherwise all days that have series points
    const ids = new Set(
      (selectedDays.length > 0 ? filtered : points).map((p) => p.learningSessionId),
    )
    for (const r of ledger) {
      if (learnerUserId && r.learnerUserId !== learnerUserId) continue
      if (classId && r.classId !== classId) continue
      if (r.courseId !== courseId) continue
      // Only count results that belong to a day in scope (prevents orphan / wrong totals)
      if (ids.size > 0 && !ids.has(r.learningSessionId)) continue
      counts[r.effectiveColor] += 1
    }
    return (Object.keys(counts) as ResultColor[]).map((c) => ({
      name: c,
      value: counts[c],
      fill: COLOR_HEX[c],
    })).filter((d) => d.value > 0)
  }, [filtered, points, selectedDays, ledger, learnerUserId, classId, courseId])

  const colorMixTotal = colorMixPie.reduce((s, d) => s + d.value, 0)

  function toggleMetric(key: MetricKey) {
    setMetrics((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev
        return prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  function toggleDay(id: string) {
    setSelectedDays((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  if (points.length === 0) {
    return (
      <div className="empty-state analysis-empty">
        <p>
          <strong>No chart data yet</strong>
        </p>
        <p className="meta" style={{ textAlign: 'center' }}>
          Finalize Focus / Awareness colors in live days — charts plot Day 1…N.
        </p>
      </div>
    )
  }

  const metricMeta = (key: MetricKey) => availableMetrics.find((m) => m.key === key)

  const trendChart = (kind: AnalysisChartKind, height = 260) => {
    if (trendRows.length === 0 || activeMetrics.length === 0) {
      return <p className="meta">Select at least one metric.</p>
    }

    if (kind === 'pie') {
      // Color mix only — never mix ratio metrics into a count pie (that caused wrong 69 vs 4-2-1-14)
      if (colorMixPie.length === 0) {
        return <p className="meta">No finalized colors in scope (sample=0).</p>
      }
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={colorMixPie}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={Math.min(100, height / 2 - 20)}
              labelLine={false}
              label={renderCustomizedLabel}
            >
              {colorMixPie.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, n) => [`${v} results`, String(n)]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )
    }

    if (kind === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={trendRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => pctTooltip(v as number, String(n))} />
            <Legend />
            {activeMetrics.map((k) => (
              <Bar
                key={k}
                dataKey={k}
                name={metricMeta(k)?.label ?? k}
                fill={metricMeta(k)?.color ?? '#64748b'}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )
    }

    if (kind === 'area') {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={trendRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => pctTooltip(v as number, String(n))} />
            <Legend />
            {activeMetrics.map((k) => (
              <Area
                key={k}
                type="monotone"
                dataKey={k}
                name={metricMeta(k)?.label ?? k}
                stroke={metricMeta(k)?.color ?? '#64748b'}
                fill={metricMeta(k)?.color ?? '#64748b'}
                fillOpacity={0.12}
                strokeWidth={2}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )
    }

    if (kind === 'composed') {
      const lineKeys = activeMetrics.filter((k) => k === 'rfc' || k === 'rac')
      const barKeys = activeMetrics.filter((k) => k === 'average_performance')
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={trendRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} unit="%" />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 3]} />
            <Tooltip formatter={(v, n) => pctTooltip(v as number, String(n))} />
            <Legend />
            {barKeys.map((k) => (
              <Bar
                key={k}
                yAxisId="right"
                dataKey={k}
                name={metricMeta(k)?.label ?? k}
                fill={metricMeta(k)?.color ?? '#4f46e5'}
                radius={[4, 4, 0, 0]}
                opacity={0.85}
              />
            ))}
            {lineKeys.map((k) => (
              <Line
                key={k}
                yAxisId="left"
                type="monotone"
                dataKey={k}
                name={metricMeta(k)?.label ?? k}
                stroke={metricMeta(k)?.color ?? '#64748b'}
                strokeWidth={2.5}
                dot
              />
            ))}
            {lineKeys.length === 0 &&
              activeMetrics.map((k) => (
                <Line
                  key={k}
                  yAxisId="left"
                  type="monotone"
                  dataKey={k}
                  name={metricMeta(k)?.label ?? k}
                  stroke={metricMeta(k)?.color ?? '#64748b'}
                  strokeWidth={2}
                  dot
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      )
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={trendRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v, n) => pctTooltip(v as number, String(n))} />
          <Legend />
          {activeMetrics.map((k) => (
            <Line
              key={k}
              type="monotone"
              dataKey={k}
              name={metricMeta(k)?.label ?? k}
              stroke={metricMeta(k)?.color ?? '#64748b'}
              strokeWidth={2.5}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }

  const colorStackChart = (height = 240) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={colorRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="red" stackId="c" fill={COLOR_HEX.red} name="Red" radius={[0, 0, 0, 0]} />
        <Bar dataKey="yellow" stackId="c" fill={COLOR_HEX.yellow} name="Yellow" />
        <Bar dataKey="green" stackId="c" fill={COLOR_HEX.green} name="Green" />
        <Bar dataKey="purple" stackId="c" fill={COLOR_HEX.purple} name="Purple" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )

  const colorPieChart = (height = 240) => (
    <div>
      <p className="meta" style={{ textAlign: 'center', marginBottom: 4 }}>
        sample={colorMixTotal}
        {colorMixPie.length
          ? ` · ${colorMixPie.map((d) => `${d.name[0]!.toUpperCase()}${d.value}`).join(' ')}`
          : ''}
      </p>
      <ResponsiveContainer width="100%" height={height - 28}>
        <PieChart>
          <Pie
            data={colorMixPie}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={Math.min(90, (height - 28) / 2 - 20)}
            labelLine={false}
            label={renderCustomizedLabel}
          >
            {colorMixPie.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(v, n) => [`${v} results`, String(n)]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )

  return (
    <div className="analysis-charts">
      <div className="analysis-charts-toolbar">
        <div className="analysis-filter-block">
          <span className="analysis-filter-label">Layout</span>
          <div className="analysis-chip-row" role="group" aria-label="Chart layout">
            {LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`analysis-chip${layout === l.id ? ' is-active' : ''}`}
                aria-pressed={layout === l.id}
                onClick={() => setLayout(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {layout === 'single' ? (
          <div className="analysis-filter-block">
            <span className="analysis-filter-label">Chart type</span>
            <div className="analysis-chip-row" role="group" aria-label="Chart type">
              {CHART_KINDS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`analysis-chip${chartKind === t.id ? ' is-active' : ''}`}
                  aria-pressed={chartKind === t.id}
                  onClick={() => setChartKind(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="analysis-filter-block analysis-filter-grow">
          <span className="analysis-filter-label">Metrics on trend (show/hide)</span>
          <div className="analysis-chip-row">
            {availableMetrics.map((m) => {
              const on = activeMetrics.includes(m.key)
              return (
                <button
                  key={m.key}
                  type="button"
                  className={`analysis-chip${on ? ' is-active' : ''}`}
                  style={on ? { borderColor: m.color, color: m.color } : undefined}
                  aria-pressed={on}
                  title={metricSettings?.metrics.find((x) => x.key === m.key)?.definition}
                  onClick={() => toggleMetric(m.key)}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {!compact && points.length > 1 ? (
        <div className="analysis-charts-days">
          <span className="analysis-filter-label">Scope</span>
          <div className="analysis-chip-row">
            <button
              type="button"
              className={`analysis-chip${selectedDays.length === 0 ? ' is-active' : ''}`}
              onClick={() => setSelectedDays([])}
            >
              All Days
            </button>
            {points.map((p) => {
              const on = selectedDays.includes(p.learningSessionId)
              return (
                <button
                  key={p.learningSessionId}
                  type="button"
                  className={`analysis-chip${on ? ' is-active' : ''}`}
                  onClick={() => toggleDay(p.learningSessionId)}
                >
                  {sessionLabel(p.sessionNumber, p.startedAt, totalDays)}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {layout === 'multi' ? (
        <div className="analysis-charts-grid">
          <article className="analysis-chart-card">
            <header className="analysis-chart-card-head">
              <h3>RFC &amp; RAC by day</h3>
              <span className="meta">Line · lower RFC better</span>
            </header>
            <div className="analysis-chart-body">{trendChart('line', 240)}</div>
          </article>
          <article className="analysis-chart-card">
            <header className="analysis-chart-card-head">
              <h3>Metrics by day</h3>
              <span className="meta">Bar · multi metric</span>
            </header>
            <div className="analysis-chart-body">{trendChart('bar', 240)}</div>
          </article>
          <article className="analysis-chart-card">
            <header className="analysis-chart-card-head">
              <h3>Color stack by day</h3>
              <span className="meta">Stacked bar</span>
            </header>
            <div className="analysis-chart-body">{colorStackChart(240)}</div>
          </article>
          <article className="analysis-chart-card">
            <header className="analysis-chart-card-head">
              <h3>Color mix</h3>
              <span className="meta">Pie · finalized counts only</span>
            </header>
            <div className="analysis-chart-body">
              {colorMixPie.length === 0 ? (
                <p className="meta">No colors in scope.</p>
              ) : (
                colorPieChart(240)
              )}
            </div>
          </article>
          <article className="analysis-chart-card analysis-chart-card-wide">
            <header className="analysis-chart-card-head">
              <h3>Combo · lines + avg bar</h3>
              <span className="meta">Dual axis when Avg selected</span>
            </header>
            <div className="analysis-chart-body">{trendChart('composed', 280)}</div>
          </article>
        </div>
      ) : (
        <div className="analysis-charts-single">
          <article className="analysis-chart-card">
            <header className="analysis-chart-card-head">
              <h3>
                {chartKind === 'pie'
                  ? 'Color mix (finalized)'
                  : chartKind === 'composed'
                    ? 'Combo trend'
                    : `${chartKind[0]!.toUpperCase()}${chartKind.slice(1)} trend by day`}
              </h3>
              <span className="meta">{filtered.length} day(s)</span>
            </header>
            <div className="analysis-chart-body">{trendChart(chartKind, 320)}</div>
          </article>
          {(chartKind === 'bar' || chartKind === 'line') && (
            <article className="analysis-chart-card">
              <header className="analysis-chart-card-head">
                <h3>Color stack (context)</h3>
              </header>
              <div className="analysis-chart-body">{colorStackChart(220)}</div>
            </article>
          )}
        </div>
      )}
    </div>
  )
}

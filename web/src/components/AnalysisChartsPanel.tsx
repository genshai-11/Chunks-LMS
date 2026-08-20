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
import { SPECTRUM_COLORS, type ResultColor } from '../modules/result-lifecycle/types'

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
  rac: '#16a34a',
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
  orange: '#f97316',
  yellow: '#facc15',
  green: '#4ade80',
  blue: '#38bdf8',
  indigo: '#818cf8',
  purple: '#c084fc',
}

function emptyColorCounts(): Record<ResultColor, number> {
  return Object.fromEntries(SPECTRUM_COLORS.map((color) => [color, 0])) as Record<
    ResultColor,
    number
  >
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
    const counts = emptyColorCounts()
    for (const r of ledger) {
      if (r.learningSessionId !== p.learningSessionId) continue
      counts[r.effectiveColor] += 1
    }
    return {
      name: sessionLabel(p.sessionNumber, p.startedAt, totalDays),
      ...counts,
      total: SPECTRUM_COLORS.reduce((sum, color) => sum + counts[color], 0),
    }
  })
}

function metricDisplayLabel(name: string): string {
  return name === 'rac' || name.toUpperCase() === 'RAC' ? '%c' : name
}

function pctTooltip(value: number | string | undefined, name: string) {
  const label = metricDisplayLabel(name)
  if (value == null || value === '') return [String(value), label]
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(n)) return [String(value), label]
  if (name.toLowerCase().includes('avg') || name.toLowerCase().includes('score')) {
    return [n.toFixed(2), label]
  }
  if (name.toLowerCase().includes('rfc') || name.toLowerCase().includes('rac') || name.includes('%')) {
    return [`${n}%`, label]
  }
  return [String(n), label]
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
      label: key === 'rac' ? '%c' : (metricSettings?.metrics.find((m) => m.key === key)?.label ?? key),
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
    const counts = emptyColorCounts()
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
    return SPECTRUM_COLORS.map((c) => ({
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

  const [cardOrder, setCardOrder] = useState<string[]>([
    'trendLine',
    'trendBar',
    'colorStack',
    'colorMix',
    'combo',
  ])
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  const cardData: Record<
    string,
    {
      title: string
      subtitle: string
      isWide?: boolean
      render: (height: number) => React.ReactNode
    }
  > = {
    trendLine: {
      title: 'RFC & %c by day',
      subtitle: 'Line · lower RFC and higher %c are better',
      render: (h) => trendChart('line', h),
    },
    trendBar: {
      title: 'Metrics by day',
      subtitle: 'Bar · multi metric',
      render: (h) => trendChart('bar', h),
    },
    colorStack: {
      title: 'Color stack by day',
      subtitle: 'Stacked bar',
      render: (h) => colorStackChart(h),
    },
    colorMix: {
      title: 'Color mix',
      subtitle: 'Pie · finalized counts only',
      render: (h) =>
        colorMixPie.length === 0 ? (
          <p className="meta">No colors in scope.</p>
        ) : (
          colorPieChart(h)
        ),
    },
    combo: {
      title: 'Combo · lines + avg bar',
      subtitle: 'Dual axis when Avg selected',
      isWide: true,
      render: (h) => trendChart('composed', h),
    },
  }

  function moveCard(index: number, direction: 'prev' | 'next') {
    const newOrder = [...cardOrder]
    const targetIndex = direction === 'prev' ? index - 1 : index + 1
    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      const temp = newOrder[index]
      newOrder[index] = newOrder[targetIndex]
      newOrder[targetIndex] = temp
      setCardOrder(newOrder)
    }
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
        <Bar dataKey="yellow" stackId="c" fill={COLOR_HEX.yellow} name="Orange" />
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
          {cardOrder.map((id, index) => {
            const card = cardData[id]
            if (!card) return null
            return (
              <article
                key={id}
                className={`analysis-chart-card${card.isWide ? ' analysis-chart-card-wide' : ''}`}
              >
                <header className="analysis-chart-card-head">
                  <div>
                    <h3>{card.title}</h3>
                    <span className="meta">{card.subtitle}</span>
                  </div>
                  <div className="analysis-card-actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveCard(index, 'prev')}
                      className="analysis-action-btn"
                      title="Move Up/Left"
                      aria-label="Move up or left"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      disabled={index === cardOrder.length - 1}
                      onClick={() => moveCard(index, 'next')}
                      className="analysis-action-btn"
                      title="Move Down/Right"
                      aria-label="Move down or right"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedCard(id)}
                      className="analysis-action-btn expand-btn"
                      title="Expand View"
                      aria-label="Expand chart view"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                      </svg>
                    </button>
                  </div>
                </header>
                <div className="analysis-chart-body">{card.render(240)}</div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="analysis-charts-single">
          <article className="analysis-chart-card">
            <header className="analysis-chart-card-head">
              <div>
                <h3>
                  {chartKind === 'pie'
                    ? 'Color mix (finalized)'
                    : chartKind === 'composed'
                      ? 'Combo trend'
                      : `${chartKind[0]!.toUpperCase()}${chartKind.slice(1)} trend by day`}
                </h3>
                <span className="meta">{filtered.length} day(s)</span>
              </div>
              <div className="analysis-card-actions">
                <button
                  type="button"
                  onClick={() => setExpandedCard(chartKind === 'pie' ? 'colorMix' : chartKind === 'composed' ? 'combo' : chartKind === 'line' ? 'trendLine' : 'trendBar')}
                  className="analysis-action-btn expand-btn"
                  title="Expand View"
                  aria-label="Expand chart view"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                  </svg>
                </button>
              </div>
            </header>
            <div className="analysis-chart-body">{trendChart(chartKind, 320)}</div>
          </article>
          {(chartKind === 'bar' || chartKind === 'line') && (
            <article className="analysis-chart-card">
              <header className="analysis-chart-card-head">
                <div>
                  <h3>Color stack (context)</h3>
                </div>
                <div className="analysis-card-actions">
                  <button
                    type="button"
                    onClick={() => setExpandedCard('colorStack')}
                    className="analysis-action-btn expand-btn"
                    title="Expand View"
                    aria-label="Expand chart view"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                    </svg>
                  </button>
                </div>
              </header>
              <div className="analysis-chart-body">{colorStackChart(220)}</div>
            </article>
          )}
        </div>
      )}

      {expandedCard && (
        <div className="analysis-modal-overlay" onClick={() => setExpandedCard(null)}>
          <div className="analysis-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="analysis-modal-header">
              <div>
                <h3>{cardData[expandedCard]?.title || 'Chart View'}</h3>
                <span className="meta">{cardData[expandedCard]?.subtitle}</span>
              </div>
              <button
                type="button"
                className="analysis-modal-close"
                onClick={() => setExpandedCard(null)}
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>
            <div className="analysis-modal-body">
              {cardData[expandedCard]?.render(420)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

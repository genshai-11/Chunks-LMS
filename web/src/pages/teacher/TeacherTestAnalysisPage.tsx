import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Brain, Eye, EyeOff, Gauge, LineChart as LineChartIcon, PieChart as PieChartIcon, Target, Zap } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  Brush,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { listActiveLearners } from '../../modules/roster/service'
import { getStandaloneAssignmentAnalysis, type StandaloneTestRunRow } from '../../lib/standalone-tests'
import { useAppState } from '../../state/useAppState'

type ResultColor = 'red' | 'yellow' | 'green' | 'purple'
type AnalysisItem = Record<string, any>

const COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  green: '#22c55e',
  purple: '#a855f7',
  pending: '#64748b',
}

const COLOR_LABELS: Record<ResultColor, string> = {
  red: 'Đỏ',
  yellow: 'Vàng',
  green: 'Xanh',
  purple: 'Tím',
}

const COLOR_SCORE: Record<ResultColor, number> = {
  red: 0,
  yellow: 1,
  green: 2,
  purple: 3,
}

function snapshot(item: AnalysisItem) {
  return item?.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots ?? null
}

function colorOf(item: AnalysisItem): ResultColor | 'pending' {
  return (snapshot(item)?.effective_color as ResultColor | undefined) ?? 'pending'
}

function isFinal(item: AnalysisItem): boolean {
  return ['finalized', 'corrected'].includes(snapshot(item)?.status)
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function pct(value: number): string {
  return `${Math.round(value)}%`
}

function resultScore(color: ResultColor | 'pending', snap: any): number {
  const stored = Number(snap?.effective_score ?? snap?.effectiveScore)
  if (Number.isFinite(stored)) return stored
  return color === 'pending' ? 0 : COLOR_SCORE[color]
}

function ResultDot(props: any) {
  const { cx, cy, payload } = props
  if (typeof cx !== 'number' || typeof cy !== 'number') return null
  const fill = payload?.colorHex ?? COLOR_HEX.pending
  const isPending = payload?.color === 'pending'
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isPending ? 4 : 6}
      fill={fill}
      stroke="#0f172a"
      strokeWidth={2}
      aria-label={`${payload?.label ?? 'Question'} CPD ${payload?.cpd ?? '—'}`}
    />
  )
}

export function TeacherTestAnalysisPage() {
  const { assignmentId } = useParams()
  const { roster } = useAppState()
  const [runs, setRuns] = useState<StandaloneTestRunRow[]>([])
  const [items, setItems] = useState<AnalysisItem[]>([])
  const [learnerId, setLearnerId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedSessions, setSelectedSessions] = useState<number[]>([])
  const [selectedColors, setSelectedColors] = useState<ResultColor[]>(['red', 'yellow', 'green', 'purple'])
  const [showChartLabels, setShowChartLabels] = useState(true)

  useEffect(() => {
    if (!assignmentId) return
    let active = true
    setLoading(true)
    void getStandaloneAssignmentAnalysis(assignmentId).then((result) => {
      if (!active) return
      setLoading(false)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setRuns(result.data.runs)
      setItems(result.data.items)
      setLearnerId(result.data.assignment?.learnerUserId ?? result.data.runs[0]?.learnerUserId ?? '')
    })
    return () => {
      active = false
    }
  }, [assignmentId])

  const learner = listActiveLearners(roster).find((l) => l.id === learnerId)

  const rows = useMemo(
    () =>
      items.map((item, index) => {
        const run = runs.find((r) => r.id === item.parent_run_id)
        const color = colorOf(item)
        const snap = snapshot(item)
        const cvr = num(item.target_cvr_ohm, run?.targetCvrOhm ?? 0)
        const cci = num(item.cci_value, run?.cciValue ?? 0)
        const baseCpd = num(item.item_cpd, run?.itemCpd ?? cvr * cci)
        const score = resultScore(color, snap)
        const finalCpd = Number((baseCpd * score).toFixed(2))
        return {
          index: index + 1,
          label: `Câu ${index + 1}`,
          shortLabel: `Q${index + 1}`,
          prompt: String(item.prompt_text ?? ''),
          session: num(item.session_number, run?.sessionNumber ?? 1),
          language: String(item.prompt_language ?? run?.promptLanguage ?? 'vi').toUpperCase(),
          cvr,
          cci,
          baseCpd,
          resultScore: score,
          cpd: finalCpd,
          probeDepth: num(snap?.probe_count ?? snap?.probeCount, 0),
          color,
          colorHex: COLOR_HEX[color],
          finalized: isFinal(item),
        }
      }),
    [items, runs],
  )

  const availableSessions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.session))).sort((a, b) => a - b),
    [rows],
  )

  const chartRows = useMemo(() => {
    const sessionSet = selectedSessions.length ? new Set(selectedSessions) : null
    const colorSet = new Set<ResultColor>(selectedColors)
    return rows.filter((row) => {
      if (sessionSet && !sessionSet.has(row.session)) return false
      if (row.color !== 'pending' && !colorSet.has(row.color)) return false
      return true
    })
  }, [rows, selectedColors, selectedSessions])

  const metrics = useMemo(() => {
    const finalized = chartRows.filter((row) => row.finalized)
    const count = Math.max(finalized.length, 1)
    const redYellow = finalized.filter((row) => row.color === 'red' || row.color === 'yellow').length
    const greenPurple = finalized.filter((row) => row.color === 'green' || row.color === 'purple').length
    return {
      finalized: finalized.length,
      total: chartRows.length,
      rfc: finalized.length ? (redYellow / count) * 100 : 0,
      rac: finalized.length ? (greenPurple / count) * 100 : 0,
      avgCvr: finalized.reduce((sum, row) => sum + row.cvr, 0) / count,
      avgCci: finalized.reduce((sum, row) => sum + row.cci, 0) / count,
      avgCpd: finalized.reduce((sum, row) => sum + row.cpd, 0) / count,
      peakProbeDepth: Math.max(0, ...finalized.map((row) => row.probeDepth)),
    }
  }, [chartRows])

  const rfcTimelineRows = useMemo(() => {
    const map = new Map<number, typeof chartRows>()
    for (const row of chartRows) {
      if (!map.has(row.session)) map.set(row.session, [])
      map.get(row.session)!.push(row)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([session, group]) => {
        const finalized = group.filter((row) => row.finalized)
        const denom = Math.max(finalized.length, 1)
        const red = finalized.filter((row) => row.color === 'red').length
        const yellow = finalized.filter((row) => row.color === 'yellow').length
        const green = finalized.filter((row) => row.color === 'green').length
        const purple = finalized.filter((row) => row.color === 'purple').length
        return {
          session,
          label: `Session ${session}`,
          shortLabel: `S${session}`,
          rfc: finalized.length ? Math.round(((red + yellow) / denom) * 100) : 0,
          finalized: finalized.length,
          red,
          yellow,
          green,
          purple,
        }
      })
  }, [chartRows])

  const colorDistribution = useMemo(() => {
    const finalized = chartRows.filter((row) => row.finalized && row.color !== 'pending')
    const total = Math.max(finalized.length, 1)
    return (['red', 'yellow', 'green', 'purple'] as ResultColor[]).map((color) => {
      const count = finalized.filter((row) => row.color === color).length
      return {
        color,
        name: COLOR_LABELS[color],
        count,
        percent: finalized.length ? Math.round((count / total) * 100) : 0,
        fill: COLOR_HEX[color],
      }
    })
  }, [chartRows])

  if (loading) return <EmptyState icon={BarChart3} title="Loading standalone analysis…" />
  if (error) return <EmptyState icon={BarChart3} title="Could not load analysis" description={error} />

  return (
    <div className="test-analysis-page">
      <PageHeader
        icon={BarChart3}
        kicker="Teacher · Standalone Test Analysis"
        title={learner?.displayName ? `${learner.displayName} · Test Analysis` : 'Standalone Test Analysis'}
        subtitle="Dedicated analysis for Tests 1-1, separate from class/session analysis."
        actions={
          <Link className="btn ghost" to="/teacher/tests">
            Back to Tests
          </Link>
        }
      />

      <div className="standalone-analysis-grid">
        <div className="standalone-metric-card">
          <Activity className="h-5 w-5 text-amber-300" />
          <span>RFC</span>
          <strong>{pct(metrics.rfc)}</strong>
        </div>
        <div className="standalone-metric-card">
          <Target className="h-5 w-5 text-emerald-300" />
          <span>RAC</span>
          <strong>{pct(metrics.rac)}</strong>
        </div>
        <div className="standalone-metric-card">
          <Gauge className="h-5 w-5 text-indigo-300" />
          <span>Avg CVR</span>
          <strong>{metrics.avgCvr.toFixed(1)}</strong>
        </div>
        <div className="standalone-metric-card">
          <Brain className="h-5 w-5 text-purple-300" />
          <span>Avg CCI</span>
          <strong>{metrics.avgCci.toFixed(1)}</strong>
        </div>
        <div className="standalone-metric-card">
          <Zap className="h-5 w-5 text-cyan-300" />
          <span>Avg Final CPD</span>
          <strong>{metrics.avgCpd.toFixed(1)}</strong>
        </div>
        <div className="standalone-metric-card">
          <LineChartIcon className="h-5 w-5 text-rose-300" />
          <span>Peak Probe Depth</span>
          <strong>n={metrics.peakProbeDepth}</strong>
        </div>
      </div>

      <div className="test-analysis-workbench">
        <aside className="test-analysis-filter-card" aria-label="Chart filters">
          <div className="test-analysis-filter-head">
            <Gauge className="h-4 w-4" />
            <div>
              <strong>Filters</strong>
              <span>{chartRows.length}/{rows.length} câu</span>
            </div>
          </div>

          <div className="test-analysis-filter-section">
            <div className="test-analysis-filter-title">
              <span>Sessions</span>
              <button type="button" onClick={() => setSelectedSessions([])}>All</button>
            </div>
            <div className="test-analysis-chip-grid">
              {availableSessions.map((session) => {
                const active = selectedSessions.length === 0 || selectedSessions.includes(session)
                return (
                  <button
                    key={session}
                    type="button"
                    className={`test-analysis-chip${active ? ' is-active' : ''}`}
                    onClick={() =>
                      setSelectedSessions((current) =>
                        current.includes(session)
                          ? current.filter((value) => value !== session)
                          : [...current, session].sort((a, b) => a - b),
                      )
                    }
                  >
                    S{session}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="test-analysis-filter-section">
            <div className="test-analysis-filter-title">
              <span>Colors</span>
              <button type="button" onClick={() => setSelectedColors(['red', 'yellow', 'green', 'purple'])}>All</button>
            </div>
            <div className="test-analysis-color-list">
              {(['red', 'yellow', 'green', 'purple'] as ResultColor[]).map((color) => {
                const active = selectedColors.includes(color)
                return (
                  <button
                    key={color}
                    type="button"
                    className={`test-analysis-color-chip${active ? ' is-active' : ''}`}
                    style={active ? { borderColor: COLOR_HEX[color], background: `${COLOR_HEX[color]}1f` } : undefined}
                    onClick={() =>
                      setSelectedColors((current) =>
                        current.includes(color)
                          ? current.filter((value) => value !== color)
                          : [...current, color],
                      )
                    }
                  >
                    <i style={{ background: COLOR_HEX[color] }} />
                    {COLOR_LABELS[color]}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            className={`test-analysis-label-toggle${showChartLabels ? ' is-active' : ''}`}
            onClick={() => setShowChartLabels((value) => !value)}
            title={showChartLabels ? 'Hide chart labels' : 'Show chart labels'}
          >
            {showChartLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <span>{showChartLabels ? 'Hide labels' : 'Show labels'}</span>
          </button>
        </aside>

        <div className="test-analysis-chart-stack">
          <Panel
            className="test-analysis-panel"
            icon={LineChartIcon}
            title="CPD & Câu"
              description={`${metrics.finalized}/${metrics.total} câu finalized · Final CPD = CVR × CCI × điểm màu.`}
              collapsible={false}
            >
              <div className="standalone-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartRows} margin={{ top: 20, right: 20, bottom: 8, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="label" stroke="#334155" fontSize={11} interval="preserveStartEnd" tickLine={false} />
                    <YAxis
                      stroke="#334155"
                      fontSize={11}
                      tickLine={false}
                      label={{ value: 'Final CPD', angle: -90, position: 'insideLeft', fill: '#334155' }}
                    />
                    <Tooltip
                      cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0]?.payload
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                            <div className="mb-1 font-black text-slate-950">{row.label}</div>
                            <div>Final CPD: <strong style={{ color: row.colorHex }}>{row.cpd}</strong></div>
                            <div>Formula: {row.baseCpd} × {row.resultScore}</div>
                            <div>Result: <strong className="capitalize" style={{ color: row.colorHex }}>{row.color}</strong></div>
                            <div>Session: <strong>{row.session}</strong> · {row.language}</div>
                            {row.prompt ? <div className="mt-1 max-w-xs text-slate-600">“{row.prompt}”</div> : null}
                          </div>
                        )
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="cpd"
                      name="Final CPD"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      dot={<ResultDot />}
                      activeDot={<ResultDot />}
                      isAnimationActive={false}
                    >
                      {showChartLabels ? <LabelList dataKey="cpd" position="top" className="test-analysis-chart-label" /> : null}
                    </Line>
                    <Brush dataKey="label" height={24} stroke="#4f46e5" travellerWidth={10} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
          </Panel>

          <div className="test-analysis-chart-row">
            <Panel
              className="test-analysis-panel"
              icon={LineChartIcon}
              title="RFC theo session"
              description="RFC% = tỷ lệ Đỏ + Vàng trên các câu finalized trong từng session."
              collapsible={false}
            >
              <div className="standalone-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={rfcTimelineRows} margin={{ top: 20, right: 20, bottom: 8, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="shortLabel" stroke="#334155" fontSize={12} tickLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      stroke="#334155"
                      fontSize={11}
                      tickLine={false}
                      label={{ value: 'RFC %', angle: -90, position: 'insideLeft', fill: '#334155' }}
                    />
                    <Tooltip
                      cursor={{ stroke: '#f59e0b', strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0]?.payload
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                            <div className="mb-1 font-black text-slate-950">{row.label}</div>
                            <div>RFC: <strong className="text-amber-700">{row.rfc}%</strong></div>
                            <div>Finalized: <strong>{row.finalized}</strong> câu</div>
                            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                              <span style={{ color: COLOR_HEX.red }}>Đỏ: {row.red}</span>
                              <span style={{ color: COLOR_HEX.yellow }}>Vàng: {row.yellow}</span>
                              <span style={{ color: COLOR_HEX.green }}>Xanh: {row.green}</span>
                              <span style={{ color: COLOR_HEX.purple }}>Tím: {row.purple}</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="rfc"
                      name="RFC %"
                      stroke="#d97706"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#d97706', stroke: '#0f172a', strokeWidth: 2 }}
                      isAnimationActive={false}
                    >
                      {showChartLabels ? <LabelList dataKey="rfc" position="top" formatter={(value: unknown) => `${value}%`} className="test-analysis-chart-label" /> : null}
                    </Line>
                    <Brush dataKey="shortLabel" height={24} stroke="#d97706" travellerWidth={10} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              className="test-analysis-panel"
              icon={PieChartIcon}
            title="Phân bổ % kết quả theo màu"
            description="Tỷ lệ các kết quả đã finalized theo 4 màu: Đỏ, Vàng, Xanh, Tím."
            collapsible={false}
          >
            <div className="standalone-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const row = payload[0]?.payload
                      return (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                          <div className="font-black" style={{ color: row.fill }}>{row.name}</div>
                          <div>Số câu: <strong>{row.count}</strong></div>
                          <div>Tỷ lệ: <strong>{row.percent}%</strong></div>
                        </div>
                      )
                    }}
                  />
                  <Pie
                    data={colorDistribution}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="78%"
                    paddingAngle={2}
                    label={showChartLabels ? ({ payload }: any) => (payload?.percent ? `${payload.percent}%` : '') : false}
                    isAnimationActive={false}
                  >
                    {colorDistribution.map((entry) => (
                      <Cell key={entry.color} fill={entry.fill} />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  </div>
  )
}

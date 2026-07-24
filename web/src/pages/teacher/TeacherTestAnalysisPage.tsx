import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { probeChunksNumber } from '../../modules/assessment/probe-metrics'

type ResultColor = 'red' | 'yellow' | 'green' | 'purple'
type AnalysisItem = Record<string, any>

const COLOR_HEX: Record<string, string> = {
  red: '#ef4444',
  yellow: '#f97316',
  green: '#22c55e',
  purple: '#a855f7',
  pending: '#64748b',
}

const COLOR_LABELS: Record<ResultColor, string> = {
  red: 'Red',
  yellow: 'Orange',
  green: 'Green',
  purple: 'Purple',
}

const METRIC_HEX = {
  rfc: '#dc2626',
  percentC: '#16a34a',
  cvr: '#dc2626',
  cci: '#16a34a',
  cpd: '#2563eb',
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

function ohm(value: number): string {
  return `${value.toFixed(1)} Ω`
}

function amp(value: number): string {
  return `${value.toFixed(1)}A`
}

function volt(value: number): string {
  return `${value.toFixed(1)}V`
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
  const [sessionBrushRange, setSessionBrushRange] = useState<{ startIndex?: number; endIndex?: number }>({})

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
          label: `Question ${index + 1}`,
          shortLabel: `Q${index + 1}`,
          prompt: String(item.prompt_text ?? ''),
          session: num(item.session_number, run?.sessionNumber ?? 1),
          language: String(item.prompt_language ?? run?.promptLanguage ?? 'vi').toUpperCase(),
          cvr,
          cci,
          baseCpd,
          resultScore: score,
          cpd: finalCpd,
          probeDepth: probeChunksNumber({
            enteredProbeFlow: Boolean(snap?.entered_probe_flow ?? snap?.enteredProbeFlow),
            probeCount: num(snap?.probe_count ?? snap?.probeCount, 0),
          }) ?? 0,
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
      percentC: finalized.length ? (greenPurple / count) * 100 : 0,
      avgCvr: finalized.reduce((sum, row) => sum + row.cvr, 0) / count,
      avgCci: finalized.reduce((sum, row) => sum + row.cci, 0) / count,
      avgCpd: finalized.reduce((sum, row) => sum + row.cpd, 0) / count,
      peakProbeDepth: Math.max(0, ...finalized.map((row) => row.probeDepth)),
    }
  }, [chartRows])

  const percentCTimelineRows = useMemo(() => {
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
        const avgCpd = finalized.length
          ? finalized.reduce((sum, row) => sum + row.cpd, 0) / denom
          : 0
        return {
          session,
          label: `Session ${session}`,
          shortLabel: `S${session}`,
          percentC: finalized.length ? Math.round(((green + purple) / denom) * 100) : 0,
          avgCpd: Number(avgCpd.toFixed(2)),
          percentCLabel: finalized.length ? `${Math.round(((green + purple) / denom) * 100)}%` : '—',
          avgCpdLabel: finalized.length ? `CPD ${avgCpd.toFixed(0)}V` : 'CPD —',
          finalized: finalized.length,
          red,
          yellow,
          green,
          purple,
        }
      })
  }, [chartRows])

  const maxSessionBrushIndex = Math.max(percentCTimelineRows.length - 1, 0)
  const sessionBrushStart = Math.min(maxSessionBrushIndex, Math.max(0, sessionBrushRange.startIndex ?? 0))
  const sessionBrushEnd = Math.max(
    sessionBrushStart,
    Math.min(maxSessionBrushIndex, sessionBrushRange.endIndex ?? maxSessionBrushIndex),
  )

  const brushedSessionRows = useMemo(
    () => percentCTimelineRows.slice(sessionBrushStart, sessionBrushEnd + 1),
    [percentCTimelineRows, sessionBrushEnd, sessionBrushStart],
  )

  const brushedSessionSet = useMemo(
    () => new Set(brushedSessionRows.map((row) => row.session)),
    [brushedSessionRows],
  )

  const cpdBrushIndexes = useMemo(() => {
    const indexes = chartRows
      .map((row, index) => (brushedSessionSet.size === 0 || brushedSessionSet.has(row.session) ? index : -1))
      .filter((index) => index >= 0)
    if (!indexes.length) return { startIndex: 0, endIndex: Math.max(chartRows.length - 1, 0) }
    return { startIndex: Math.min(...indexes), endIndex: Math.max(...indexes) }
  }, [brushedSessionSet, chartRows])

  const handleSessionBrushChange = useCallback((range: { startIndex?: number; endIndex?: number } | null) => {
    if (!range) return
    setSessionBrushRange(range)
  }, [])

  const handleQuestionBrushChange = useCallback((range: { startIndex?: number; endIndex?: number } | null) => {
    if (!range) return
    const start = Math.max(0, range.startIndex ?? 0)
    const end = Math.min(Math.max(chartRows.length - 1, 0), range.endIndex ?? Math.max(chartRows.length - 1, 0))
    const visible = chartRows.slice(start, end + 1)
    if (!visible.length) return
    const visibleSessions = new Set(visible.map((row) => row.session))
    const sessionIndexes = percentCTimelineRows
      .map((row, index) => (visibleSessions.has(row.session) ? index : -1))
      .filter((index) => index >= 0)
    if (!sessionIndexes.length) return
    setSessionBrushRange({ startIndex: Math.min(...sessionIndexes), endIndex: Math.max(...sessionIndexes) })
  }, [chartRows, percentCTimelineRows])

  const toggleSession = useCallback((session: number) => {
    setSelectedSessions((current) => {
      if (current.includes(session)) {
        return current.filter((value) => value !== session)
      }
      return [...current, session].sort((a, b) => a - b)
    })
  }, [])

  const toggleColor = useCallback((color: ResultColor) => {
    setSelectedColors((current) => {
      if (current.includes(color)) {
        const next = current.filter((value) => value !== color)
        if (next.length === 0) {
          return ['red', 'yellow', 'green', 'purple']
        }
        return next
      }
      return [...current, color]
    })
  }, [])

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
        <div className="standalone-metric-card metric-rfc">
          <Activity className="h-5 w-5" />
          <span>RFC</span>
          <strong>{pct(metrics.rfc)}</strong>
        </div>
        <div className="standalone-metric-card metric-percent-c">
          <Target className="h-5 w-5" />
          <span>%c</span>
          <strong>{pct(metrics.percentC)}</strong>
        </div>
        <div className="standalone-metric-card metric-cvr">
          <Gauge className="h-5 w-5" />
          <span>Avg CVR</span>
          <strong>{ohm(metrics.avgCvr)}</strong>
        </div>
        <div className="standalone-metric-card metric-cci">
          <Brain className="h-5 w-5" />
          <span>Avg CCI</span>
          <strong>{amp(metrics.avgCci)}</strong>
        </div>
        <div className="standalone-metric-card metric-cpd">
          <Zap className="h-5 w-5" />
          <span>Avg Final CPD</span>
          <strong>{volt(metrics.avgCpd)}</strong>
        </div>
        <div className="standalone-metric-card">
          <LineChartIcon className="h-5 w-5 text-rose-300" />
          <span>Max Chunks Number</span>
          <strong>{metrics.peakProbeDepth}</strong>
        </div>
      </div>

      <div className="test-analysis-workbench">
        <aside className="test-analysis-filter-card" aria-label="Chart filters">
          <div className="test-analysis-filter-head">
            <Gauge className="h-4 w-4" />
            <div>
              <strong>Filters</strong>
              <span>{chartRows.length}/{rows.length} questions</span>
            </div>
          </div>

          <div className="test-analysis-filter-section">
            <div className="test-analysis-filter-title">
              <span>Sessions</span>
            </div>
            <div className="test-analysis-chip-grid">
              <button
                type="button"
                className={`test-analysis-chip${selectedSessions.length === 0 ? ' is-active' : ''}`}
                onClick={() => setSelectedSessions([])}
              >
                All
              </button>
              {availableSessions.map((session) => {
                const active = selectedSessions.includes(session)
                return (
                  <button
                    key={session}
                    type="button"
                    className={`test-analysis-chip${active ? ' is-active' : ''}`}
                    onClick={() => toggleSession(session)}
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
            </div>
            <div className="test-analysis-color-list">
              <button
                type="button"
                className={`test-analysis-color-chip${selectedColors.length === 4 ? ' is-active' : ''}`}
                onClick={() => setSelectedColors(['red', 'yellow', 'green', 'purple'])}
              >
                All
              </button>
              {(['red', 'yellow', 'green', 'purple'] as ResultColor[]).map((color) => {
                const active = selectedColors.length < 4 && selectedColors.includes(color)
                return (
                  <button
                    key={color}
                    type="button"
                    className={`test-analysis-color-chip${active ? ' is-active' : ''}`}
                    style={active ? { borderColor: COLOR_HEX[color], background: `${COLOR_HEX[color]}1f` } : undefined}
                    onClick={() => toggleColor(color)}
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
          <div className="test-analysis-chart-row">
          <Panel
            className="test-analysis-panel"
            icon={LineChartIcon}
            title="CPD by Question"
              description={`${metrics.finalized}/${metrics.total} finalized questions · Final CPD = CVR × CCI × color score.`}
              collapsible={false}
            >
              <div className="standalone-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={chartRows} syncId="standalone-analysis-brush" margin={{ top: 36, right: 20, bottom: 8, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="label" stroke="#334155" fontSize={11} interval="preserveStartEnd" tickLine={false} />
                    <YAxis
                      stroke="#334155"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(value) => `${value}V`}
                      label={{ value: 'Final CPD (V)', angle: -90, position: 'insideLeft', fill: METRIC_HEX.cpd }}
                    />
                    <Tooltip
                      cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0]?.payload
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                            <div className="mb-1 font-black text-slate-950">{row.label}</div>
                            <div>Final CPD: <strong style={{ color: METRIC_HEX.cpd }}>{volt(row.cpd)}</strong></div>
                            <div>Formula: {volt(row.baseCpd)} × {row.resultScore}</div>
                            <div>CVR: <strong style={{ color: METRIC_HEX.cvr }}>{ohm(row.cvr)}</strong> · CCI: <strong style={{ color: METRIC_HEX.cci }}>{amp(row.cci)}</strong></div>
                            <div>Result: <strong className="capitalize" style={{ color: row.colorHex }}>{row.color === 'yellow' ? 'orange' : row.color}</strong></div>
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
                      stroke={METRIC_HEX.cpd}
                      strokeWidth={3}
                      dot={<ResultDot />}
                      activeDot={<ResultDot />}
                      isAnimationActive={false}
                    >
                      {showChartLabels ? <LabelList dataKey="cpd" position="top" offset={10} formatter={(value: unknown) => `${Number(value).toFixed(0)}V`} className="test-analysis-chart-label" /> : null}
                    </Line>
                    <Brush
                      dataKey="label"
                      height={24}
                      stroke={METRIC_HEX.cpd}
                      travellerWidth={10}
                      startIndex={cpdBrushIndexes.startIndex}
                      endIndex={cpdBrushIndexes.endIndex}
                      onChange={handleQuestionBrushChange}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
          </Panel>

            <Panel
              className="test-analysis-panel"
              icon={LineChartIcon}
              title="%c by Session"
              description="%c = Green + Purple results divided by finalized questions in each session."
              collapsible={false}
            >
              <div className="standalone-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={percentCTimelineRows} syncId="standalone-analysis-brush" margin={{ top: 42, right: 20, bottom: 8, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="shortLabel" stroke="#334155" fontSize={12} tickLine={false} interval={0} />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      stroke="#334155"
                      fontSize={11}
                      tickLine={false}
                      label={{ value: '%c', angle: -90, position: 'insideLeft', fill: METRIC_HEX.percentC }}
                    />
                    <Tooltip
                      cursor={{ stroke: METRIC_HEX.percentC, strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0]?.payload
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                            <div className="mb-1 font-black text-slate-950">{row.label}</div>
                            <div>%c: <strong style={{ color: METRIC_HEX.percentC }}>{row.percentC}%</strong></div>
                            <div>Finalized: <strong>{row.finalized}</strong> questions</div>
                            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                              <span style={{ color: COLOR_HEX.red }}>Red: {row.red}</span>
                              <span style={{ color: COLOR_HEX.yellow }}>Orange: {row.yellow}</span>
                              <span style={{ color: COLOR_HEX.green }}>Green: {row.green}</span>
                              <span style={{ color: COLOR_HEX.purple }}>Purple: {row.purple}</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="percentC"
                      name="%c"
                      stroke={METRIC_HEX.percentC}
                      strokeWidth={3}
                      dot={{ r: 5, fill: METRIC_HEX.percentC, stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: METRIC_HEX.percentC, stroke: '#0f172a', strokeWidth: 2 }}
                      isAnimationActive={false}
                    >
                      {showChartLabels ? (
                        <LabelList dataKey="percentCLabel" position="top" offset={10} fill={METRIC_HEX.percentC} className="test-analysis-chart-label" />
                      ) : null}
                    </Line>
                    <Brush
                      dataKey="shortLabel"
                      height={24}
                      stroke={METRIC_HEX.percentC}
                      travellerWidth={10}
                      startIndex={sessionBrushStart}
                      endIndex={sessionBrushEnd}
                      onChange={handleSessionBrushChange}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="test-analysis-chart-row">
            <Panel
              className="test-analysis-panel"
              icon={LineChartIcon}
              title="%c & Avg CPD by Session"
              description="Dual-axis line chart: Session on X, %c as the green line, Avg CPD as the blue line. Brush stays synced with the session view."
              collapsible={false}
            >
              <div className="standalone-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={percentCTimelineRows} syncId="standalone-analysis-brush" margin={{ top: 42, right: 18, bottom: 8, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="shortLabel" stroke="#334155" fontSize={12} tickLine={false} interval={0} />
                    <YAxis
                      yAxisId="percent"
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                      stroke={METRIC_HEX.percentC}
                      fontSize={11}
                      tickLine={false}
                      label={{ value: '%c', angle: -90, position: 'insideLeft', fill: METRIC_HEX.percentC }}
                    />
                    <YAxis
                      yAxisId="cpd"
                      orientation="right"
                      tickFormatter={(value) => `${Number(value).toFixed(0)}V`}
                      stroke={METRIC_HEX.cpd}
                      fontSize={11}
                      tickLine={false}
                      label={{ value: 'Avg CPD (V)', angle: 90, position: 'insideRight', fill: METRIC_HEX.cpd }}
                    />
                    <Tooltip
                      cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0]?.payload
                        return (
                          <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                            <div className="mb-1 font-black text-slate-950">{row.label}</div>
                            <div>%c: <strong style={{ color: METRIC_HEX.percentC }}>{row.percentC}%</strong></div>
                            <div>Avg CPD: <strong style={{ color: METRIC_HEX.cpd }}>{volt(row.avgCpd)}</strong></div>
                            <div>Finalized: <strong>{row.finalized}</strong> questions</div>
                          </div>
                        )
                      }}
                    />
                    <Line
                      yAxisId="percent"
                      type="monotone"
                      dataKey="percentC"
                      name="%c"
                      stroke={METRIC_HEX.percentC}
                      strokeWidth={3}
                      dot={{ r: 5, fill: METRIC_HEX.percentC, stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: METRIC_HEX.percentC, stroke: '#0f172a', strokeWidth: 2 }}
                      isAnimationActive={false}
                    >
                      {showChartLabels ? (
                        <LabelList dataKey="percentCLabel" position="top" offset={10} fill={METRIC_HEX.percentC} className="test-analysis-chart-label" />
                      ) : null}
                    </Line>
                    <Line
                      yAxisId="cpd"
                      type="monotone"
                      dataKey="avgCpd"
                      name="Avg CPD"
                      stroke={METRIC_HEX.cpd}
                      strokeWidth={3}
                      dot={{ r: 5, fill: METRIC_HEX.cpd, stroke: '#ffffff', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: METRIC_HEX.cpd, stroke: '#0f172a', strokeWidth: 2 }}
                      isAnimationActive={false}
                    >
                      {showChartLabels ? <LabelList dataKey="avgCpd" position="bottom" offset={10} formatter={(value: unknown) => `${Number(value).toFixed(0)}V`} className="test-analysis-chart-label" /> : null}
                    </Line>
                    <Brush
                      dataKey="shortLabel"
                      height={24}
                      stroke={METRIC_HEX.cpd}
                      travellerWidth={10}
                      startIndex={sessionBrushStart}
                      endIndex={sessionBrushEnd}
                      onChange={handleSessionBrushChange}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel
              className="test-analysis-panel"
              icon={PieChartIcon}
            title="Result Color Distribution"
            description="Distribution of finalized results across Red, Orange, Green, and Purple."
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
                          <div>Questions: <strong>{row.count}</strong></div>
                          <div>Share: <strong>{row.percent}%</strong></div>
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

import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Brain, Gauge, LineChart as LineChartIcon, Target, Zap } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
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

export function TeacherTestAnalysisPage() {
  const { assignmentId } = useParams()
  const { roster } = useAppState()
  const [runs, setRuns] = useState<StandaloneTestRunRow[]>([])
  const [items, setItems] = useState<AnalysisItem[]>([])
  const [learnerId, setLearnerId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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
        return {
          index: index + 1,
          label: `Q${index + 1}`,
          session: num(item.session_number, run?.sessionNumber ?? 1),
          language: String(item.prompt_language ?? run?.promptLanguage ?? 'vi').toUpperCase(),
          cvr: num(item.target_cvr_ohm, run?.targetCvrOhm ?? 0),
          cci: num(item.cci_value, run?.cciValue ?? 0),
          cpd: num(item.item_cpd, run?.itemCpd ?? 0),
          probeDepth: num(snap?.probe_count ?? snap?.probeCount, 0),
          color,
          colorHex: COLOR_HEX[color],
          finalized: isFinal(item),
        }
      }),
    [items, runs],
  )

  const metrics = useMemo(() => {
    const finalized = rows.filter((row) => row.finalized)
    const count = Math.max(finalized.length, 1)
    const redYellow = finalized.filter((row) => row.color === 'red' || row.color === 'yellow').length
    const greenPurple = finalized.filter((row) => row.color === 'green' || row.color === 'purple').length
    return {
      finalized: finalized.length,
      total: rows.length,
      rfc: finalized.length ? (redYellow / count) * 100 : 0,
      rac: finalized.length ? (greenPurple / count) * 100 : 0,
      avgCvr: finalized.reduce((sum, row) => sum + row.cvr, 0) / count,
      avgCci: finalized.reduce((sum, row) => sum + row.cci, 0) / count,
      avgCpd: finalized.reduce((sum, row) => sum + row.cpd, 0) / count,
      peakProbeDepth: Math.max(0, ...finalized.map((row) => row.probeDepth)),
    }
  }, [rows])

  const sessionRows = useMemo(() => {
    const map = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = `${row.session}-${row.language}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    return Array.from(map.entries()).map(([key, group]) => {
      const finalized = group.filter((row) => row.finalized)
      const denom = Math.max(finalized.length, 1)
      const rac = finalized.filter((row) => row.color === 'green' || row.color === 'purple').length
      const rfc = finalized.filter((row) => row.color === 'red' || row.color === 'yellow').length
      return {
        key,
        label: `S${group[0]?.session ?? '—'} ${group[0]?.language ?? ''}`,
        avgCpd: finalized.reduce((sum, row) => sum + row.cpd, 0) / denom,
        focusLoad: (rfc / denom) * 100,
        awareness: (rac / denom) * 100,
        peakProbe: Math.max(0, ...finalized.map((row) => row.probeDepth)),
      }
    })
  }, [rows])

  if (loading) return <EmptyState icon={BarChart3} title="Loading standalone analysis…" />
  if (error) return <EmptyState icon={BarChart3} title="Could not load analysis" description={error} />

  return (
    <>
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
          <span>Avg CPD</span>
          <strong>{metrics.avgCpd.toFixed(1)}</strong>
        </div>
        <div className="standalone-metric-card">
          <LineChartIcon className="h-5 w-5 text-rose-300" />
          <span>Peak Probe Depth</span>
          <strong>n={metrics.peakProbeDepth}</strong>
        </div>
      </div>

      <Panel
        icon={LineChartIcon}
        title="CPD progression by question"
        description={`${metrics.finalized}/${metrics.total} finalized items. Dots inherit the final result color: 0 red, 1 yellow, 2 green, 3 purple.`}
        collapsible={false}
      >
        <div className="standalone-chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 16, right: 16, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#475569" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <Line type="monotone" dataKey="cpd" stroke="#818cf8" strokeWidth={3} dot={false} />
              <Bar dataKey="cpd" barSize={10} radius={[4, 4, 0, 0]}>
                {rows.map((row) => (
                  <Cell key={row.index} fill={row.colorHex} />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        icon={Brain}
        title="Cognitive load & focus by session"
        description="Session-level view for comparing VI/EN blocks or any selected multi-session run."
        collapsible={false}
      >
        <div className="standalone-chart-wrap is-short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sessionRows} margin={{ top: 16, right: 16, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#475569" fontSize={12} />
              <YAxis stroke="#475569" fontSize={11} />
              <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }} />
              <Bar dataKey="avgCpd" fill="#818cf8" name="Avg CPD" radius={[4, 4, 0, 0]} />
              <Bar dataKey="focusLoad" fill="#f59e0b" name="RFC load %" radius={[4, 4, 0, 0]} />
              <Bar dataKey="awareness" fill="#10b981" name="RAC focus %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </>
  )
}

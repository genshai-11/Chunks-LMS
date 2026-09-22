import { useMemo, useState, useEffect } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
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
import {
  COLOR_SCORE,
  COOL_COLORS,
  SPECTRUM_COLORS,
  WARM_COLORS,
  type ResultColor,
} from '../modules/result-lifecycle/types'
import type { MetricSettingsState } from '../modules/metrics/settings'
import { getEnabledMetricKeys } from '../modules/metrics/settings'
import {
  spectrumRecordsForAttempt,
  type MetricKey,
  type MetricObservation,
} from '../modules/metrics/calculate'
import { AnalysisChartsPanel } from './AnalysisChartsPanel'
import { UserAvatar } from './UserAvatar'
import { probeChunksNumber } from '../modules/assessment/probe-metrics'

const DAY_TABLE_DEFAULT: MetricKey[] = [
  'rfc',
  'rac',
  'average_performance',
  'n_count',
  'n_depth_max',
  'n_depth_avg',
]

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
  onDeleteSession?: (sessionId: string) => void
  onEditSessionNumber?: (sessionId: string, sessionNumber: number) => void
}

/** Time scope: keep simple — course total, one day, or custom range */
const TIME_SCOPES: { kind: ReportWindowKind; label: string; hint: string }[] = [
  { kind: 'course', label: 'Whole course', hint: 'All days so far' },
  { kind: 'session', label: 'One day', hint: 'Single live session' },
  { kind: 'custom', label: 'Date range', hint: 'Pick from → to' },
]

function colorCounts(records: ResultRecord[]): Record<ResultColor, number> {
  const c = Object.fromEntries(SPECTRUM_COLORS.map((color) => [color, 0])) as Record<
    ResultColor,
    number
  >
  for (const r of records) c[r.effectiveColor] += 1
  return c
}

const COLOR_HEX: Record<ResultColor, string> = {
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#facc15',
  green: '#22c55e',
  blue: '#38bdf8',
  indigo: '#6366f1',
  purple: '#a855f7',
}

const COLOR_LABELS: Record<ResultColor, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
  indigo: 'Indigo',
  purple: 'Purple',
}

function MiniSpectrumBar({
  counts,
  total,
  className = 'w-24 h-2.5',
}: {
  counts: Record<ResultColor, number>
  total: number
  className?: string
}) {
  if (total === 0) {
    return <div className={`${className} bg-white/5 rounded-full`} />
  }

  const title = SPECTRUM_COLORS.map(
    (c) => `${COLOR_LABELS[c]}: ${counts[c]} (${pct(counts[c], total)}%)`,
  ).join(' · ')

  return (
    <div
      className={`flex overflow-hidden rounded-full bg-slate-900 border border-white/10 ${className}`}
      title={title}
    >
      {SPECTRUM_COLORS.map((c) => {
        const count = counts[c]
        if (count === 0) return null
        const percentage = (count / total) * 100
        return (
          <div
            key={c}
            style={{
              width: `${percentage}%`,
              backgroundColor: COLOR_HEX[c],
            }}
            className="h-full transition-all"
          />
        )
      })}
    </div>
  )
}

function ProbePathwayView({ record }: { record: ResultRecord }) {
  const steps = useMemo(() => {
    return spectrumRecordsForAttempt({
      effectiveColor: record.effectiveColor,
      enteredProbeFlow: record.enteredProbeFlow,
      probeEventCount: record.probeEventCount,
    })
  }, [record.effectiveColor, record.enteredProbeFlow, record.probeEventCount])

  if (!record.enteredProbeFlow || steps.length <= 1) {
    return (
      <span className={`capture-dot ${record.effectiveColor}`}>
        {COLOR_LABELS[record.effectiveColor]}
      </span>
    )
  }

  const condensed: { color: ResultColor; count: number }[] = []
  for (const c of steps) {
    if (condensed.length > 0 && condensed[condensed.length - 1].color === c) {
      condensed[condensed.length - 1].count += 1
    } else {
      condensed.push({ color: c, count: 1 })
    }
  }

  const tooltip = `Probe sequence: ${steps.map((s) => COLOR_LABELS[s]).join(' → ')} (Depth: ${record.probeEventCount + 1})`

  return (
    <div className="flex items-center gap-1.5 flex-wrap" title={tooltip}>
      {condensed.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          {idx > 0 && <span className="text-slate-500 text-xs">→</span>}
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
            style={{
              backgroundColor: `${COLOR_HEX[item.color]}1a`,
              color: COLOR_HEX[item.color],
              border: `1px solid ${COLOR_HEX[item.color]}40`,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: COLOR_HEX[item.color] }}
            />
            <span>
              {COLOR_LABELS[item.color]}
              {item.count > 1 ? ` (x${item.count})` : ''}
            </span>
          </span>
        </div>
      ))}
    </div>
  )
}

function getSessionStatusBadge(metrics: Partial<Record<MetricKey, number | null>>) {
  const rfc = metrics.rfc
  const rac = metrics.rac
  if (rac == null || rfc == null) {
    return {
      label: 'Pending',
      className: 'bg-slate-800 text-slate-400 border border-white/5',
    }
  }
  // Mastery: %c >= 75% & RFC < 20%
  if (rac >= 0.75 && rfc < 0.20) {
    return {
      label: 'Mastery',
      className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    }
  }
  // Needs Attention: RFC >= 30%
  if (rfc >= 0.30) {
    return {
      label: 'Needs Attention',
      className: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    }
  }
  // Steady: %c >= 50%
  if (rac >= 0.50) {
    return {
      label: 'Steady',
      className: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
    }
  }
  // Developing
  return {
    label: 'Developing',
    className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  }
}

function getLearnerStatus(
  rac: number | null | undefined,
  rfc: number | null | undefined,
  count: number,
) {
  if (count === 0) {
    return {
      label: 'No Data',
      className: 'bg-slate-800 text-slate-400 border border-white/5',
    }
  }
  const percentC = rac != null ? rac * 100 : null
  const rfcVal = rfc != null ? rfc * 100 : null

  if (percentC != null && percentC >= 75 && (rfcVal == null || rfcVal < 20)) {
    return {
      label: 'High Mastery',
      className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    }
  }
  if (rfcVal != null && rfcVal >= 30) {
    return {
      label: 'Needs Focus',
      className: 'bg-rose-500/15 text-rose-300 border border-rose-500/30',
    }
  }
  return {
    label: 'Steady',
    className: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
  }
}

function resultColorLabel(color: ResultColor): string {
  return COLOR_LABELS[color] ?? color
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0
}

/** RFC↑ = more struggle (worse). %c↑ = more success (better). */
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
 * Focus: RFC / %c, color mix, per-day session trend — not the full metrics catalog.
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
  onDeleteSession,
  onEditSessionNumber,
}: Props) {
  const [kind, setKind] = useState<ReportWindowKind>('course')
  const [customStart, setCustomStart] = useState(courseStart.slice(0, 10) || '2026-07-01')
  const [customEnd, setCustomEnd] = useState(
    (courseEnd ?? '2026-12-31').toString().slice(0, 10),
  )
  const [sessionId, setSessionId] = useState(learningSessions[0]?.id ?? '')
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>(
    learnerUserId ? [learnerUserId] : [],
  )
  const [whoOpen, setWhoOpen] = useState(false)
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false)
  const [deleteSessionIdConfirm, setDeleteSessionIdConfirm] = useState<string | null>(null)
  const [editSessionId, setEditSessionId] = useState<string | null>(null)
  const [editSessionNumberInput, setEditSessionNumberInput] = useState<string>('')
  
  useEffect(() => {
    setSelectedLearnerIds(learnerUserId ? [learnerUserId] : [])
  }, [learnerUserId])

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

  const focusLearnerId = mode === 'learner' ? learnerUserId : (selectedLearnerIds.length === 1 ? selectedLearnerIds[0] : undefined)
  const focusLearner = focusLearnerId
    ? users.find((u) => u.id === focusLearnerId)
    : undefined

  const courseReport = useMemo(() => {
    if (!window || mode === 'learner' || focusLearnerId) return null
    const learnerIds = selectedLearnerIds.length > 0 ? selectedLearnerIds : learners.map((u) => u.id)
    return buildCourseProgressReport(scopedLedger, courseId, window, { learnerIds })
  }, [window, mode, focusLearnerId, scopedLedger, courseId, learners, selectedLearnerIds])

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
    const records = filterResults(scopedLedger, window, {
      courseId,
      classId,
      learnerUserId: focusLearnerId,
    })
    if (selectedLearnerIds.length > 1) {
      return records.filter((r) => selectedLearnerIds.includes(r.learnerUserId))
    }
    return records
  }, [window, scopedLedger, courseId, classId, focusLearnerId, selectedLearnerIds])

  const counts = colorCounts(windowRecords)
  const total = windowRecords.length
  const maxBar = Math.max(1, ...Object.values(counts))

  const pieData = useMemo(() => {
    return SPECTRUM_COLORS.map((color) => ({
      name: COLOR_LABELS[color],
      colorKey: color,
      value: counts[color],
      color: COLOR_HEX[color],
    })).filter((d) => d.value > 0)
  }, [counts])

  const rfc = comparison ? pickMetric(comparison.current, 'rfc', metricSettings) : null
  const rac = comparison ? pickMetric(comparison.current, 'rac', metricSettings) : null

  const rfcDelta = comparison?.deltas.rfc
  const racDelta = comparison?.deltas.rac
  const rfcTone = trendTone('rfc', rfcDelta)
  const racTone = trendTone('rac', racDelta)

  const additionalMetrics = useMemo(() => {
    if (!comparison || !metricSettings) return []
    const primaryKeys: MetricKey[] = ['rfc', 'rac', 'average_performance']
    return metricSettings.metrics
      .filter((m) => m.enabled && !primaryKeys.includes(m.key))
      .map((cfg) => {
        const obs = pickMetric(comparison.current, cfg.key, metricSettings)
        const delta = comparison.deltas[cfg.key]
        return {
          key: cfg.key,
          label: cfg.label,
          definition: cfg.definition,
          obs,
          delta,
        }
      })
      .filter(
        (item): item is {
          key: MetricKey
          label: string
          definition: string
          obs: MetricObservation
          delta: number | null | undefined
        } => item.obs !== null,
      )
  }, [comparison, metricSettings])

  const probeStats = useMemo(() => {
    const probed = windowRecords.filter((r) => r.enteredProbeFlow)
    const count = probed.length
    const chunksNumbers = probed.map((r) => probeChunksNumber({ enteredProbeFlow: r.enteredProbeFlow, probeCount: r.probeEventCount }) ?? 0)
    const totalChunksNumber = chunksNumbers.reduce((sum, value) => sum + value, 0)
    const avg = count > 0 ? totalChunksNumber / count : 0
    const max = count > 0 ? Math.max(...chunksNumbers) : 0
    return { count, avg, max }
  }, [windowRecords])

  /** Metrics available for by-day columns (Admin-enabled ∩ catalog defaults) */
  const dayMetricOptions = useMemo((): MetricKey[] => {
    if (metricSettings) {
      const enabled = getEnabledMetricKeys(metricSettings)
      return enabled.length > 0 ? enabled : DAY_TABLE_DEFAULT
    }
    return DAY_TABLE_DEFAULT
  }, [metricSettings])

  const [dayColumns, setDayColumns] = useState<MetricKey[]>(() => [
    'rfc',
    'rac',
    'average_performance',
  ])

  // Drop columns that Admin disabled; keep order of dayMetricOptions
  const visibleDayColumns = useMemo(
    () => dayMetricOptions.filter((k) => dayColumns.includes(k)),
    [dayMetricOptions, dayColumns],
  )

  /** Per-day series for class or focused learner — all enabled metrics from real ledger */
  const sessionSeries = useMemo(() => {
    return buildSessionMetricSeries({
      ledger: selectedLearnerIds.length > 0
        ? scopedLedger.filter((r) => selectedLearnerIds.includes(r.learnerUserId))
        : scopedLedger,
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
        ownerUserId: null,
        lockExpiresAt: null,
        sessionKind: 'regular' as const,
        participantLearnerIds: null,
      })),
      courseId,
      classId,
      learnerUserId: focusLearnerId,
      metricKeys: dayMetricOptions,
    })
  }, [scopedLedger, orderedSessions, courseId, classId, focusLearnerId, dayMetricOptions, selectedLearnerIds])

  function metricLabel(key: MetricKey): string {
    if (key === 'rac') return '%c'
    return metricSettings?.metrics.find((m) => m.key === key)?.label ?? key
  }

  function formatDayMetric(key: MetricKey, value: number | null | undefined): string {
    if (value == null) return '—'
    if (
      key === 'rfc' ||
      key === 'rac' ||
      key.includes('rate') ||
      key === 'awareness_recovery' ||
      key === 'purple_mastery_rate'
    ) {
      return `${(value * 100).toFixed(1)}%`
    }
    if (key === 'n_count' || key === 'n_depth_max') return String(Math.round(value))
    return value.toFixed(2)
  }

  function toggleDayColumn(key: MetricKey) {
    setDayColumns((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev
        return prev.filter((k) => k !== key)
      }
      return [...prev, key]
    })
  }

  const sessionColorMap = useMemo(() => {
    const map = new Map<string, { counts: Record<ResultColor, number>; total: number }>()
    const targetLedger = selectedLearnerIds.length > 0
      ? scopedLedger.filter((r) => selectedLearnerIds.includes(r.learnerUserId))
      : scopedLedger

    for (const r of targetLedger) {
      let entry = map.get(r.learningSessionId)
      if (!entry) {
        entry = {
          counts: { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, indigo: 0, purple: 0 },
          total: 0,
        }
        map.set(r.learningSessionId, entry)
      }
      entry.counts[r.effectiveColor] += 1
      entry.total += 1
    }
    return map
  }, [scopedLedger, selectedLearnerIds])

  const sessionDeltaMap = useMemo(() => {
    const map = new Map<string, { dRfc: number | null; dRac: number | null }>()
    sessionSeries.forEach((p, i) => {
      map.set(p.learningSessionId, {
        dRfc: sessionRfcDelta(sessionSeries, i),
        dRac: sessionRacDelta(sessionSeries, i),
      })
    })
    return map
  }, [sessionSeries])

  const learnerColorMap = useMemo(() => {
    const map = new Map<string, { counts: Record<ResultColor, number>; total: number }>()
    for (const r of scopedLedger) {
      let entry = map.get(r.learnerUserId)
      if (!entry) {
        entry = {
          counts: { red: 0, orange: 0, yellow: 0, green: 0, blue: 0, indigo: 0, purple: 0 },
          total: 0,
        }
        map.set(r.learnerUserId, entry)
      }
      entry.counts[r.effectiveColor] += 1
      entry.total += 1
    }
    return map
  }, [scopedLedger])

  type SessionSortField = 'day' | 'sample' | 'rfc' | 'rac'
  type SortDirection = 'asc' | 'desc'
  const [sessionSortField, setSessionSortField] = useState<SessionSortField>('day')
  const [sessionSortDir, setSessionSortDir] = useState<SortDirection>('asc')

  const handleSessionSort = (field: SessionSortField) => {
    if (sessionSortField === field) {
      setSessionSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSessionSortField(field)
      setSessionSortDir(field === 'day' ? 'asc' : 'desc')
    }
  }

  const renderSortIcon = (field: SessionSortField) => {
    if (sessionSortField !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-500 shrink-0 opacity-60" />
    }
    return sessionSortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-indigo-400 shrink-0" />
    ) : (
      <ArrowDown className="h-3 w-3 text-indigo-400 shrink-0" />
    )
  }

  const sortedSessionSeries = useMemo(() => {
    return [...sessionSeries].sort((a, b) => {
      let diff = 0
      if (sessionSortField === 'day') {
        diff = (a.sessionNumber ?? 0) - (b.sessionNumber ?? 0)
      } else if (sessionSortField === 'sample') {
        diff = a.attemptCount - b.attemptCount
      } else if (sessionSortField === 'rfc') {
        const aVal = a.metrics.rfc ?? -1
        const bVal = b.metrics.rfc ?? -1
        diff = aVal - bVal
      } else if (sessionSortField === 'rac') {
        const aVal = a.metrics.rac ?? -1
        const bVal = b.metrics.rac ?? -1
        diff = aVal - bVal
      }
      return sessionSortDir === 'asc' ? diff : -diff
    })
  }, [sessionSeries, sessionSortField, sessionSortDir])

  type HistoryFilter = 'all' | 'warm' | 'cool' | 'probed'
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all')
  const [historySearch, setHistorySearch] = useState('')
  const [pageSize, setPageSize] = useState<number>(25)
  const [currentPage, setCurrentPage] = useState<number>(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [historyFilter, historySearch, pageSize])

  const filteredHistory = useMemo(() => {
    const sorted = [...windowRecords].sort((a, b) => b.finalizedAt.localeCompare(a.finalizedAt))
    return sorted.filter((r) => {
      if (historyFilter === 'warm' && !WARM_COLORS.includes(r.effectiveColor)) {
        return false
      }
      if (historyFilter === 'cool' && !COOL_COLORS.includes(r.effectiveColor)) {
        return false
      }
      if (historyFilter === 'probed' && !r.enteredProbeFlow) {
        return false
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase().trim()
        const u = users.find((user) => user.id === r.learnerUserId)
        const name = (u?.displayName ?? r.learnerUserId).toLowerCase()
        if (!name.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [windowRecords, historyFilter, historySearch, users])

  const historyFilterCounts = useMemo(() => {
    let warm = 0
    let cool = 0
    let probed = 0
    for (const r of windowRecords) {
      if (WARM_COLORS.includes(r.effectiveColor)) warm++
      if (COOL_COLORS.includes(r.effectiveColor)) cool++
      if (r.enteredProbeFlow) probed++
    }
    return {
      all: windowRecords.length,
      warm,
      cool,
      probed,
    }
  }, [windowRecords])

  const totalHistory = filteredHistory.length
  const totalPages = Math.max(1, Math.ceil(totalHistory / pageSize))
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages)
  const startIdx = (safeCurrentPage - 1) * pageSize
  const endIdx = Math.min(startIdx + pageSize, totalHistory)
  const paginatedHistory = useMemo(() => {
    return filteredHistory.slice(startIdx, endIdx)
  }, [filteredHistory, startIdx, endIdx])

  const trajectoryConfig = useMemo(() => {
    const percentCVal = rac?.value != null ? rac.value * 100 : null
    const rfcVal = rfc?.value != null ? rfc.value * 100 : null

    if (percentCVal != null && percentCVal >= 70) {
      return {
        title: 'Mastery Trajectory',
        description: 'Cohort demonstrating strong chunk mastery',
        stripClass: 'bg-emerald-950/20 border-emerald-500/20',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        iconClass: 'bg-emerald-500/10 text-emerald-400',
        icon: CheckCircle2,
      }
    }
    if (rfcVal != null && rfcVal >= 30) {
      return {
        title: 'Struggle Attention',
        description: 'High difficulty detected, review recommended',
        stripClass: 'bg-rose-950/20 border-rose-500/20',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
        iconClass: 'bg-rose-500/10 text-rose-400',
        icon: AlertTriangle,
      }
    }
    return {
      title: 'Steady Trajectory',
      description: 'Consistent progress across learning sessions',
      stripClass: 'bg-indigo-950/20 border-indigo-500/20',
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      iconClass: 'bg-indigo-500/10 text-indigo-400',
      icon: Target,
    }
  }, [rac, rfc])

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
              <div className="relative">
                <button
                  type="button"
                  className="analysis-select flex items-center justify-between gap-2 text-left w-full min-w-[140px] px-3 py-1.5 rounded-lg border border-white/10 bg-slate-900 text-xs text-white cursor-pointer"
                  onClick={() => setWhoOpen((o) => !o)}
                >
                  <span className="truncate">
                    {selectedLearnerIds.length === 0
                      ? 'Whole class'
                      : selectedLearnerIds.length === 1
                        ? (learners.find((u) => u.id === selectedLearnerIds[0])?.displayName ?? '1 Learner')
                        : `${selectedLearnerIds.length} learners`}
                  </span>
                  <ChevronRight className={`h-3 w-3 transform transition-transform shrink-0 ${whoOpen ? 'rotate-90' : ''}`} />
                </button>
                {whoOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setWhoOpen(false)} />
                    <div className="absolute left-0 mt-1 z-40 w-56 rounded-xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5 px-2">
                        <button
                          type="button"
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold border-0 bg-transparent cursor-pointer"
                          onClick={() => {
                            setSelectedLearnerIds([])
                            setWhoOpen(false)
                          }}
                        >
                          Clear (Whole class)
                        </button>
                        <button
                          type="button"
                          className="text-[10px] text-slate-400 hover:text-white font-semibold border-0 bg-transparent cursor-pointer"
                          onClick={() => setWhoOpen(false)}
                        >
                          Done
                        </button>
                      </div>
                      <div className="max-h-60 overflow-y-auto flex flex-col gap-0.5 hide-scrollbar">
                        {learners.map((u) => {
                          const checked = selectedLearnerIds.includes(u.id)
                          return (
                            <label
                              key={u.id}
                              className="flex items-center gap-2 px-2 py-1 hover:bg-white/5 rounded-lg cursor-pointer text-xs text-slate-300 hover:text-white"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                className="rounded bg-slate-950 border-white/10 text-indigo-500 cursor-pointer"
                                onChange={() => {
                                  setSelectedLearnerIds((prev) => {
                                    const next = prev.includes(u.id)
                                      ? prev.filter((id) => id !== u.id)
                                      : [...prev, u.id]
                                    if (next.length > 0) setTab('overview')
                                    return next
                                  })
                                }}
                              />
                              <span className="truncate">{u.displayName}</span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
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
          {selectedLearnerIds.length > 0
            ? selectedLearnerIds.length === 1
              ? ` · ${focusLearner?.displayName}`
              : ` · ${selectedLearnerIds.length} learners`
            : mode === 'teacher'
              ? ' · class'
              : ''}
          {kind === 'session' ? ` · ${selectedSessionLabel}` : window ? ` · ${window.label}` : ''}
          {' · '}
          <strong>{total} finalized</strong>
          <span className="text-slate-400"> (sample size, not chunks number)</span>
        </p>
      </section>

      {/* Focused learner strip */}
      {selectedLearnerIds.length > 1 ? (
        <div className="analysis-person-strip flex items-center justify-between gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2 overflow-hidden py-1">
              {selectedLearnerIds.slice(0, 3).map((id) => {
                const u = learners.find((x) => x.id === id)
                return (
                  <UserAvatar
                    key={id}
                    name={u?.displayName ?? ''}
                    avatarUrl={u?.avatarUrl}
                    size="sm"
                    className="ring-2 ring-slate-950"
                  />
                )
              })}
              {selectedLearnerIds.length > 3 && (
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-800 text-[10px] font-bold text-white ring-2 ring-slate-950">
                  +{selectedLearnerIds.length - 3}
                </div>
              )}
            </div>
            <div className="analysis-person-copy">
              <p className="analysis-person-name text-sm font-bold text-white">
                {selectedLearnerIds.length} Learners Selected
              </p>
              <p className="meta text-xs text-slate-400">
                {selectedLearnerIds
                  .map((id) => learners.find((x) => x.id === id)?.displayName)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          </div>
          {mode === 'teacher' ? (
            <button
              type="button"
              className="ghost analysis-person-clear"
              onClick={() => setSelectedLearnerIds([])}
            >
              Class view
            </button>
          ) : null}
        </div>
      ) : focusLearner ? (
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
              onClick={() => setSelectedLearnerIds([])}
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
          <div className="stat-grid analysis-kpis">
            <div className={`stat-card analysis-kpi-rfc${rfcTone === 'up' ? ' is-good' : rfcTone === 'down' ? ' is-warn' : ''}`}>
              <p className="stat-label flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                <span>Struggle (RFC)</span>
                <span className="group relative inline-block cursor-help text-slate-400 hover:text-slate-200">
                  <Info className="h-3.5 w-3.5" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-950 p-2.5 text-[10px] font-normal leading-normal text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100 border border-white/10 text-left normal-case">
                    <strong>Struggle (RFC)</strong> = (Red + Orange) ÷ finalized sample. Lower RFC is better. Source: assessment ledger only (no mock).
                  </span>
                </span>
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
              <p className="stat-label flex items-center gap-1">
                <span>Success (%c)</span>
                <span className="group relative inline-block cursor-help text-slate-400 hover:text-slate-200">
                  <Info className="h-3.5 w-3.5" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-950 p-2.5 text-[10px] font-normal leading-normal text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100 border border-white/10 text-left normal-case">
                    <strong>Success (%c)</strong> = Avg %x: mean normalized 7-color spectrum factor over N_total (Red 0%, Orange 17%, Yellow 34%, Green 50%, Blue 67%, Indigo 84%, Purple 100%). Higher %c is better. (Legacy RAC = cool records / N_total).
                  </span>
                </span>
              </p>
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
              <p className="stat-label flex items-center gap-1">
                <span>Results</span>
                <span className="group relative inline-block cursor-help text-slate-400 hover:text-slate-200">
                  <Info className="h-3.5 w-3.5" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-950 p-2.5 text-[10px] font-normal leading-normal text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100 border border-white/10 text-left normal-case">
                    <strong>Finalized Results</strong> = total finalized attempts in the window (sample size). Each question contributes 1 primary result; probe steps generate additional observations in N_total.
                  </span>
                </span>
              </p>
              <p className="stat-value">{total}</p>
              <p className="meta">
                G/P {counts.green + counts.purple} · R/Y {counts.red + counts.yellow}
              </p>
            </div>
          </div>

          {/* Cohort Health & Trajectory Insight Badge/Strip */}
          <div
            className={`mt-4 p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${trajectoryConfig.stripClass}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${trajectoryConfig.iconClass}`}>
                <trajectoryConfig.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border ${trajectoryConfig.badgeClass}`}
                  >
                    {trajectoryConfig.title}
                  </span>
                  <span className="text-xs text-slate-300 font-medium">
                    {trajectoryConfig.description}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Current %c:{' '}
                  <strong className="text-slate-200">{rac ? formatMetricValue(rac) : '—'}</strong>
                  {' · '}
                  RFC:{' '}
                  <strong className="text-slate-200">{rfc ? formatMetricValue(rfc) : '—'}</strong>
                  {racDelta != null && (
                    <>
                      {' · '}
                      <span>Δ %c: </span>
                      <strong
                        className={
                          racTone === 'up'
                            ? 'text-emerald-400'
                            : racTone === 'down'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                        }
                      >
                        {formatDelta('rac', racDelta)}
                      </strong>
                    </>
                  )}
                  {rfcDelta != null && (
                    <>
                      {' · '}
                      <span>Δ RFC: </span>
                      <strong
                        className={
                          rfcTone === 'up'
                            ? 'text-emerald-400'
                            : rfcTone === 'down'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                        }
                      >
                        {formatDelta('rfc', rfcDelta)}
                      </strong>
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="text-[11px] font-mono text-slate-400 shrink-0 self-end sm:self-center">
              Cohort Health: <span className="text-white font-semibold">{total} samples evaluated</span>
            </div>
          </div>

          {/* Bento-style layout for Chunks Number metrics */}
          <div className="my-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span>Chunks Number Metrics</span>
                <span className="text-[10px] text-slate-500 font-normal lowercase">(from finalized ledger)</span>
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Chunks Count */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between group">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <span>chunks count</span>
                    <span className="group/tooltip relative inline-block cursor-help text-slate-500 hover:text-slate-300">
                      <Info className="h-3.5 w-3.5" />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg bg-slate-950 p-2.5 text-[10px] font-normal leading-normal text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover/tooltip:opacity-100 border border-white/10 text-left normal-case">
                        <strong>chunks count</strong> = number of times the teacher selected Green (2). Values use real observations only.
                      </span>
                    </span>
                  </span>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
                    <Target className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-white font-mono tracking-tight">
                    {probeStats.count}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Green (2) entries · sample={total}
                  </p>
                </div>
              </div>

              {/* Card 2: Avg Chunks Number */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between group">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <span>avg chunks number</span>
                    <span className="group/tooltip relative inline-block cursor-help text-slate-500 hover:text-slate-300">
                      <Info className="h-3.5 w-3.5" />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg bg-slate-950 p-2.5 text-[10px] font-normal leading-normal text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover/tooltip:opacity-100 border border-white/10 text-left normal-case">
                        <strong>avg chunks number</strong> = mean chunks number on probed questions. Green opens at 1; each Continue adds 1. Example: Green + Continue ×8 + Done → chunks number 9.
                      </span>
                    </span>
                  </span>
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:scale-105 transition-transform">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-white font-mono tracking-tight">
                    {probeStats.count > 0 ? probeStats.avg.toFixed(1) : '—'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Mean chunks number on probed Qs
                  </p>
                </div>
              </div>

              {/* Card 3: Max Chunks Number */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col justify-between group">
                <div className="flex items-start justify-between">
                  <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <span>max chunks number</span>
                    <span className="group/tooltip relative inline-block cursor-help text-slate-500 hover:text-slate-300">
                      <Info className="h-3.5 w-3.5" />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-60 -translate-x-1/2 rounded-lg bg-slate-950 p-2.5 text-[10px] font-normal leading-normal text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover/tooltip:opacity-100 border border-white/10 text-left normal-case">
                        <strong>max chunks number</strong> = maximum observed chunks number on one question (not session ceiling). Green opens at 1; each Continue adds 1. Example: Green + Continue ×8 + Done → chunks number 9.
                      </span>
                    </span>
                  </span>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-105 transition-transform">
                    <Zap className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-white font-mono tracking-tight">
                    {probeStats.count > 0 ? probeStats.max : '—'}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Peak observed chunks number
                  </p>
                </div>
              </div>
            </div>
          </div>

          {additionalMetrics.length > 0 && (
            <div className="analysis-additional-section" style={{ marginTop: 24, marginBottom: 24 }}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Additional Indicators (Customized by Admin)
              </h3>
              <div className="stat-grid" style={{ marginBottom: 24 }}>
                {additionalMetrics.map((item) => {
                  const valStr = formatMetricValue(item.obs)
                  const delta = item.delta
                  const tone =
                    delta == null || Math.abs(delta) < 0.05
                      ? ('flat' as const)
                      : ['purple_mastery_rate', 'awareness_recovery', 'focus_stability'].includes(
                            item.key,
                          )
                        ? delta > 0
                          ? ('up' as const)
                          : ('down' as const)
                        : ('flat' as const)

                  return (
                    <div key={item.key} className="stat-card" title={item.definition}>
                      <p className="stat-label">{item.label}</p>
                      <p className="stat-value">{valStr}</p>
                      <p className={`analysis-delta is-${tone}`}>
                        {tone === 'up' ? (
                          <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                        ) : tone === 'down' ? (
                          <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                        ) : null}
                        {formatDelta(item.key, delta)}
                        <span className="analysis-delta-note"> vs prior window</span>
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="analysis-grid">
            <div className="panel">
              <div className="panel-body-inner">
                <p className="panel-title mb-2">Color mix</p>
                <p className="meta" style={{ marginTop: 0 }}>
                  Finalized results in current filter · sample={total}
                  {total > 0
                    ? ` · R${counts.red} O${counts.orange} Y${counts.yellow} G${counts.green} B${counts.blue} I${counts.indigo} P${counts.purple}`
                    : ''}
                </p>
                {total === 0 ? (
                  <p className="meta">No data in this filter.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-6 items-center w-full">
                    <div className="dist-bars flex-1 w-full">
                      {SPECTRUM_COLORS.map((color) => {
                        const n = counts[color]
                        const p = pct(n, total)
                        const width = `${Math.max(n ? 8 : 0, (n / Math.max(maxBar, 1)) * 100)}%`
                        return (
                          <div key={color} className="dist-row">
                            <span className={`capture-dot ${color}`}>{resultColorLabel(color)}</span>
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
                    {pieData.length > 0 && (
                      <div className="flex-shrink-0" style={{ width: 140, height: 140 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const item = payload[0].payload
                                  const p = pct(item.value, total)
                                  return (
                                    <div className="rounded-lg border border-white/10 bg-slate-950 p-2 text-xs shadow-xl pointer-events-none z-50">
                                      <div className="flex items-center gap-1.5 font-semibold text-white">
                                        <span
                                          className="inline-block h-2 w-2 rounded-full"
                                          style={{ backgroundColor: item.color }}
                                        />
                                        <span>{item.name}</span>
                                      </div>
                                      <p className="mt-1 text-slate-300 font-mono text-[11px]">
                                        {item.value} {item.value === 1 ? 'record' : 'records'} · {p}%
                                      </p>
                                    </div>
                                  )
                                }
                                return null
                              }}
                            />
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={55}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {pieData.map((entry) => (
                                <Cell key={`cell-${entry.colorKey}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
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
                      const sessionData = sessionColorMap.get(p.learningSessionId) ?? {
                        counts: colorCounts([]),
                        total: p.attemptCount,
                      }
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
                            <MiniSpectrumBar
                              counts={sessionData.counts}
                              total={sessionData.total}
                              className="w-16 sm:w-20 h-2 shrink-0"
                            />
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
            Multi-chart board: line &amp; bar for RFC/%c by day, stacked colors, pie mix.
            Respects <strong>Who</strong> filter (class or one learner) above.
          </p>
          <AnalysisChartsPanel
            ledger={scopedLedger}
            learningSessions={orderedSessions}
            courseId={courseId}
            classId={classId}
            learnerUserId={focusLearnerId}
            totalDays={totalDays}
            metricSettings={metricSettings}
          />
        </div>
      )}

      {/* ——— By day (session series + Δ RFC) ——— */}
      {tab === 'sessions' && (
        <div className="analysis-tab-body">
          <div className="analysis-columns-selector mb-3 border border-white/5 bg-white/[0.02] rounded-xl p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-indigo-400" />
                <span>Table Columns ({visibleDayColumns.length} active)</span>
                <span className="group relative inline-block cursor-help text-slate-400 hover:text-slate-200">
                  <Info className="h-3.5 w-3.5" />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-slate-950 p-2.5 text-[10px] font-normal leading-normal text-slate-200 opacity-0 shadow-2xl transition-opacity group-hover:opacity-100 border border-white/10 text-left normal-case">
                    Each row is one live day from the <strong>finalized ledger</strong> (no mock).
                    <br />
                    <strong>RFC</strong> = (Red+Orange) / sample. <strong>Δ RFC</strong> = change vs previous day (negative pp = improvement).
                  </span>
                </span>
              </span>
              <button
                type="button"
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold border-0 bg-transparent cursor-pointer flex items-center gap-0.5"
                onClick={() => setColumnsPanelOpen(!columnsPanelOpen)}
              >
                {columnsPanelOpen ? 'Hide columns config' : 'Show columns config'}
                <ChevronRight className={`h-3 w-3 transform transition-transform ${columnsPanelOpen ? 'rotate-90' : ''}`} />
              </button>
            </div>
            {columnsPanelOpen && (
              <div className="mt-2.5 pt-2.5 border-t border-white/5 flex flex-wrap gap-1.5">
                {dayMetricOptions.map((key) => {
                  const on = visibleDayColumns.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`analysis-chip${on ? ' is-active' : ''} text-[10px] py-1 px-2.5 cursor-pointer`}
                      aria-pressed={on}
                      title={metricSettings?.metrics.find((m) => m.key === key)?.definition ?? key}
                      onClick={() => toggleDayColumn(key)}
                    >
                      {metricLabel(key)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {sessionSeries.length === 0 ? (
            <p className="empty-state">No session results yet.</p>
          ) : (
            <div className="table-wrap">
              <table aria-label="Progress by day">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="cursor-pointer hover:text-white select-none transition-colors"
                      onClick={() => handleSessionSort('day')}
                      title="Sort by Day number"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Day</span>
                        {renderSortIcon('day')}
                      </div>
                    </th>
                    <th scope="col" title="Session progress status based on %c and RFC">
                      Status
                    </th>
                    <th
                      scope="col"
                      className="cursor-pointer hover:text-white select-none transition-colors"
                      onClick={() => handleSessionSort('sample')}
                      title="Sort by finalized results sample size (not chunks number)"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>sample</span>
                        {renderSortIcon('sample')}
                      </div>
                    </th>
                    <th scope="col" title="7-color spectrum composition for this session">
                      Spectrum Breakdown
                    </th>
                    {visibleDayColumns.map((key) => (
                      <th
                        key={key}
                        scope="col"
                        className={
                          key === 'rfc' || key === 'rac'
                            ? 'cursor-pointer hover:text-white select-none transition-colors'
                            : ''
                        }
                        onClick={
                          key === 'rfc' || key === 'rac'
                            ? () => handleSessionSort(key)
                            : undefined
                        }
                        title={metricSettings?.metrics.find((m) => m.key === key)?.definition}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{metricLabel(key)}</span>
                          {(key === 'rfc' || key === 'rac') && renderSortIcon(key)}
                        </div>
                      </th>
                    ))}
                    {visibleDayColumns.includes('rfc') ? (
                      <th scope="col" title="RFC change vs previous day in course sequence (percentage points)">
                        Δ RFC
                      </th>
                    ) : null}
                    {visibleDayColumns.includes('rac') ? (
                      <th scope="col" title="%c change vs previous day in course sequence (percentage points)">
                        Δ %c
                      </th>
                    ) : null}
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {sortedSessionSeries.map((p) => {
                    const deltas = sessionDeltaMap.get(p.learningSessionId)
                    const dRfc = deltas?.dRfc ?? null
                    const dRac = deltas?.dRac ?? null
                    const rfcT = trendTone('rfc', dRfc)
                    const racT = trendTone('rac', dRac)
                    const statusBadge = getSessionStatusBadge(p.metrics)
                    const sessionData = sessionColorMap.get(p.learningSessionId) ?? {
                      counts: colorCounts([]),
                      total: p.attemptCount,
                    }
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
                        <td>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="font-mono text-xs tabular-nums">{p.attemptCount}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <MiniSpectrumBar
                              counts={sessionData.counts}
                              total={sessionData.total}
                              className="w-24 h-2.5 shrink-0"
                            />
                            <span className="font-mono text-[10px] text-slate-400">
                              {sessionData.total > 0
                                ? `${pct(
                                    sessionData.counts.purple +
                                      sessionData.counts.indigo +
                                      sessionData.counts.blue +
                                      sessionData.counts.green,
                                    sessionData.total,
                                  )}% cool`
                                : ''}
                            </span>
                          </div>
                        </td>
                        {visibleDayColumns.map((key) => (
                          <td key={key} className="font-mono text-xs tabular-nums">
                            {formatDayMetric(key, p.metrics[key])}
                          </td>
                        ))}
                        {visibleDayColumns.includes('rfc') ? (
                          <td>
                            <span className={`analysis-delta is-${rfcT}`}>{formatPp(dRfc)}</span>
                          </td>
                        ) : null}
                        {visibleDayColumns.includes('rac') ? (
                          <td>
                            <span className={`analysis-delta is-${racT}`}>{formatPp(dRac)}</span>
                          </td>
                        ) : null}
                        <td>
                          <div className="flex items-center gap-2">
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
                             {mode === 'teacher' && onEditSessionNumber && (
                              <button
                                type="button"
                                className="ghost text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-2 py-1 rounded"
                                onClick={() => {
                                  setEditSessionId(p.learningSessionId)
                                  setEditSessionNumberInput(String(p.sessionNumber ?? ''))
                                }}
                              >
                                Edit Day
                              </button>
                            )}
                            {mode === 'teacher' && onDeleteSession && (
                              <button
                                type="button"
                                className="ghost text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded"
                                onClick={() => setDeleteSessionIdConfirm(p.learningSessionId)}
                              >
                                Delete
                              </button>
                            )}
                          </div>
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
                  <th scope="col" title="Learner trajectory status based on %c and RFC">
                    Status
                  </th>
                  <th scope="col" title="Finalized sample size (not chunks number)">
                    sample
                  </th>
                  <th scope="col" title="7-color learning spectrum composition">
                    Spectrum Profile
                  </th>
                  <th scope="col">RFC</th>
                  <th scope="col">Δ RFC</th>
                  <th scope="col">%c</th>
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
                  const learnerData = learnerColorMap.get(row.learnerUserId) ?? {
                    counts: colorCounts([]),
                    total: row.attemptCount,
                  }
                  const statusBadge = getLearnerStatus(rRac?.value, rRfc?.value, row.attemptCount)
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
                      <td>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${statusBadge.className}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="font-mono text-xs tabular-nums">{row.attemptCount}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <MiniSpectrumBar
                            counts={learnerData.counts}
                            total={row.attemptCount}
                            className="w-24 h-2.5 shrink-0"
                          />
                          <span className="font-mono text-[10px] text-slate-400">
                            {row.attemptCount > 0
                              ? `${pct(
                                  learnerData.counts.purple +
                                    learnerData.counts.indigo +
                                    learnerData.counts.blue +
                                    learnerData.counts.green,
                                  row.attemptCount,
                                )}% cool`
                              : ''}
                          </span>
                        </div>
                      </td>
                      <td className="font-mono text-xs tabular-nums">
                        {rRfc ? formatMetricValue(rRfc) : '—'}
                      </td>
                      <td>
                        <span className={`analysis-delta is-${tone}`}>{formatPp(dRfc)}</span>
                      </td>
                      <td className="font-mono text-xs tabular-nums">
                        {rRac ? formatMetricValue(rRac) : '—'}
                      </td>
                      <td className="font-mono text-xs tabular-nums">
                        {rAvg ? formatMetricValue(rAvg) : '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="primary"
                          onClick={() => {
                            setSelectedLearnerIds([row.learnerUserId])
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

      {/* ——— Results / History tab ——— */}
      {tab === 'history' && (
        <div className="analysis-tab-body">
          {/* Quick Filter Toolbar */}
          <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Result filters">
              <button
                type="button"
                className={`analysis-chip${historyFilter === 'all' ? ' is-active' : ''}`}
                onClick={() => setHistoryFilter('all')}
              >
                All ({historyFilterCounts.all})
              </button>
              <button
                type="button"
                className={`analysis-chip${historyFilter === 'warm' ? ' is-active' : ''}`}
                onClick={() => setHistoryFilter('warm')}
              >
                <span className="text-red-400 mr-1">🔴</span>
                Struggle (Warm) ({historyFilterCounts.warm})
              </button>
              <button
                type="button"
                className={`analysis-chip${historyFilter === 'cool' ? ' is-active' : ''}`}
                onClick={() => setHistoryFilter('cool')}
              >
                <span className="text-emerald-400 mr-1">🟢</span>
                Mastery (Cool) ({historyFilterCounts.cool})
              </button>
              <button
                type="button"
                className={`analysis-chip${historyFilter === 'probed' ? ' is-active' : ''}`}
                onClick={() => setHistoryFilter('probed')}
              >
                <span className="text-indigo-400 mr-1">🔍</span>
                Probed Only ({historyFilterCounts.probed})
              </button>
            </div>

            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by learner name..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap">
            {totalHistory === 0 ? (
              <p className="empty-state">Nothing in this filter.</p>
            ) : (
              <table aria-label="Assessment results ledger">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Session</th>
                    {mode === 'teacher' && !focusLearnerId ? (
                      <th scope="col">Learner</th>
                    ) : null}
                    <th scope="col">Probe Flow Pathway</th>
                    <th scope="col">Final Color</th>
                    <th scope="col">Score</th>
                    <th scope="col" title="Chunks number on question">Chunks #</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((r) => {
                    const user = users.find((u) => u.id === r.learnerUserId)
                    const session = orderedSessions.find((s) => s.id === r.learningSessionId)
                    const sessionNum =
                      session?.sessionNumber ??
                      (session ? orderedSessions.findIndex((x) => x.id === session.id) + 1 : null)
                    const cNumber = r.enteredProbeFlow
                      ? probeChunksNumber({ enteredProbeFlow: r.enteredProbeFlow, probeCount: r.probeEventCount }) ?? 1
                      : 1

                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-200 whitespace-nowrap">
                              {new Date(r.finalizedAt).toLocaleDateString([], {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(r.finalizedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </td>
                        <td>
                          {sessionNum != null ? (
                            <span
                              className="inline-flex items-center font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-white/10 text-slate-300"
                              title={session?.startedAt ? new Date(session.startedAt).toLocaleDateString() : undefined}
                            >
                              D{sessionNum}
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-xs">—</span>
                          )}
                        </td>
                        {mode === 'teacher' && !focusLearnerId ? (
                          <td>
                            <button
                              type="button"
                              className="ghost cell-with-avatar text-left"
                              onClick={() => {
                                setSelectedLearnerIds([r.learnerUserId])
                                setTab('overview')
                              }}
                            >
                              <UserAvatar
                                name={user?.displayName ?? r.learnerUserId}
                                avatarUrl={user?.avatarUrl}
                                size="sm"
                              />
                              <span className="truncate max-w-[120px] font-medium text-slate-200 hover:text-white">
                                {user?.displayName ?? r.learnerUserId.slice(0, 8)}
                              </span>
                            </button>
                          </td>
                        ) : null}
                        <td>
                          <ProbePathwayView record={r} />
                        </td>
                        <td>
                          <span className={`capture-dot ${r.effectiveColor}`}>
                            {resultColorLabel(r.effectiveColor)}
                          </span>
                        </td>
                        <td className="font-mono text-xs tabular-nums text-slate-300">
                          {COLOR_SCORE[r.effectiveColor]}
                        </td>
                        <td className="font-mono text-xs tabular-nums text-slate-300">
                          {r.enteredProbeFlow ? (
                            <span className="font-bold text-amber-400">{cNumber}</span>
                          ) : (
                            <span className="text-slate-500">1</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination controls */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 px-1">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-white">{totalHistory === 0 ? 0 : startIdx + 1}</strong> -{' '}
                <strong className="text-white">{endIdx}</strong> of{' '}
                <strong className="text-white">{totalHistory}</strong> results
              </span>
              {totalHistory > 0 && (
                <div className="flex items-center gap-1.5 ml-3 border-l border-white/10 pl-3">
                  <span>Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-slate-900 border border-white/10 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Prev</span>
                </button>

                <span className="font-mono text-xs px-2 text-slate-300">
                  Page <strong className="text-white">{safeCurrentPage}</strong> of{' '}
                  <strong className="text-white">{totalPages}</strong>
                </span>

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-white/10 bg-slate-900 text-xs font-medium text-slate-200 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteSessionIdConfirm && (
        <div className="observe-modal-container">
          <div className="observe-modal-backdrop" onClick={() => setDeleteSessionIdConfirm(null)} />
          <div className="observe-modal-card text-left max-w-md p-6 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl relative z-50">
            <h3 className="text-lg font-bold text-white mb-2">Delete Live Session?</h3>
            <p className="text-sm text-slate-300 mb-6">
              Are you sure you want to delete this live session? All question captures and attendance for this session will be permanently deleted from the database.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn secondary px-4 py-2 text-xs font-semibold rounded-lg"
                onClick={() => setDeleteSessionIdConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary bg-red-600 hover:bg-red-500 text-white px-4 py-2 text-xs font-semibold rounded-lg shadow-lg hover:shadow-red-500/20"
                onClick={() => {
                  if (onDeleteSession) onDeleteSession(deleteSessionIdConfirm)
                  setDeleteSessionIdConfirm(null)
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Edit Session Number Modal */}
      {editSessionId && (
        <div className="observe-modal-container">
          <div className="observe-modal-backdrop" onClick={() => setEditSessionId(null)} />
          <div className="observe-modal-card text-left max-w-sm p-6 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl relative z-50">
            <h3 className="text-lg font-bold text-white mb-2">Edit Session Day</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter the correct day number sequence for this session record.
            </p>
            <div className="mb-6">
              <input
                type="number"
                min="1"
                required
                className="w-full text-center bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-2xl font-black text-white focus:outline-none focus:border-indigo-500 font-mono tracking-wider"
                value={editSessionNumberInput}
                onChange={(e) => setEditSessionNumberInput(e.target.value)}
                placeholder="Day Number"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn secondary px-4 py-2 text-xs font-semibold rounded-lg"
                onClick={() => setEditSessionId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 text-xs font-semibold rounded-lg shadow-lg"
                onClick={() => {
                  const newNum = parseInt(editSessionNumberInput, 10)
                  if (!isNaN(newNum) && newNum > 0) {
                    if (onEditSessionNumber) onEditSessionNumber(editSessionId, newNum)
                    setEditSessionId(null)
                  } else {
                    alert('Invalid session number. Must be a positive integer.')
                  }
                }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

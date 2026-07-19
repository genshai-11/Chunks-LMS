import { useMemo, useState, useEffect } from 'react'
import {
  Activity,
  CalendarDays,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
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
import { sessionLabel } from '../modules/reporting/session-series'
import type { DomainUser } from '../modules/roster/types'
import type { ResultColor } from '../modules/result-lifecycle/types'
import { COLOR_SCORE } from '../modules/result-lifecycle/types'
import type { MetricSettingsState } from '../modules/metrics/settings'
import type { LiveTestItem } from '../modules/assessment/live-test'
import { liveTestItemIdFromExternalRef } from '../modules/assessment/live-test'
import { listLiveTestItems } from '../lib/live-test-resources'
import { joinLiveTestResults } from '../modules/reporting/live-test-analysis'
import { AnalysisChartsPanel } from './AnalysisChartsPanel'
import { UserAvatar } from './UserAvatar'

type SessionOpt = {
  id: string
  startedAt: string
  completedAt: string | null
  sessionNumber?: number | null
  sessionKind?: 'regular' | 'pretest' | 'posttest'
  sessionFormat?: 'lesson' | 'test'
  promptLanguage?: 'vi' | 'en' | null
  liveTestResourceId?: string | null
  liveTestBlockId?: string | null
}

type Props = {
  mode: 'teacher' | 'learner'
  courseId: string
  courseCode: string
  courseStart: string
  courseEnd?: string | null
  classId?: string
  className?: string
  totalDays?: number | null
  ledger: ResultRecord[]
  users: DomainUser[]
  learnerUserId?: string
  learningSessions?: SessionOpt[]
  emptyHint?: string
  metricSettings?: MetricSettingsState
}

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

function trendTone(key: 'rfc' | 'rac', delta: number | null | undefined): 'up' | 'down' | 'flat' {
  if (delta == null || Math.abs(delta) < 0.05) return 'flat'
  if (key === 'rfc') return delta < 0 ? 'up' : 'down'
  return delta > 0 ? 'up' : 'down'
}

function numericBand(value: number | null | undefined, band: 'all' | 'missing' | 'low' | 'medium' | 'high'): boolean {
  if (band === 'all') return true
  if (value == null) return band === 'missing'
  if (band === 'missing') return false
  if (band === 'low') return value <= 1
  if (band === 'medium') return value > 1 && value <= 3
  return value > 3
}

export function LiveTestAnalysisView({
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
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>(
    learnerUserId ? [learnerUserId] : [],
  )
  const [whoOpen, setWhoOpen] = useState(false)

  useEffect(() => {
    setSelectedLearnerIds(learnerUserId ? [learnerUserId] : [])
  }, [learnerUserId])

  const [tab, setTab] = useState<'overview' | 'charts' | 'items' | 'history'>('overview')
  const [promptLanguageFilter, setPromptLanguageFilter] = useState<'all' | 'vi' | 'en'>('all')
  const [resourceFilter, setResourceFilter] = useState('all')
  const [blockFilter, setBlockFilter] = useState('all')
  const [cciBandFilter, setCciBandFilter] = useState<'all' | 'missing' | 'low' | 'medium' | 'high'>('all')
  const [cvrBandFilter, setCvrBandFilter] = useState<'all' | 'missing' | 'low' | 'medium' | 'high'>('all')
  const [cpdBandFilter, setCpdBandFilter] = useState<'all' | 'missing' | 'low' | 'medium' | 'high'>('all')
  const [liveTestItems, setLiveTestItems] = useState<LiveTestItem[]>([])

  const learners = useMemo(
    () => users.filter((u) => u.roles.includes('learner')),
    [users],
  )

  const testSessions = useMemo(() => {
    return learningSessions.filter((s) => s.sessionFormat === 'test')
  }, [learningSessions])

  const orderedSessions = useMemo(() => {
    return [...testSessions].sort((a, b) => {
      const na = a.sessionNumber ?? 9999
      const nb = b.sessionNumber ?? 9999
      if (na !== nb) return na - nb
      return a.startedAt.localeCompare(b.startedAt)
    })
  }, [testSessions])

  const sessionById = useMemo(
    () => new Map(orderedSessions.map((session) => [session.id, session])),
    [orderedSessions],
  )
  const liveTestResourceIds = useMemo(
    () => [...new Set(orderedSessions.map((s) => s.liveTestResourceId).filter(Boolean))] as string[],
    [orderedSessions],
  )
  const liveTestBlockIds = useMemo(
    () => [...new Set(orderedSessions.map((s) => s.liveTestBlockId).filter(Boolean))] as string[],
    [orderedSessions],
  )

  useEffect(() => {
    if (liveTestBlockIds.length === 0) {
      setLiveTestItems([])
      return
    }
    let cancelled = false
    async function loadItems() {
      const rows: LiveTestItem[] = []
      for (const blockId of liveTestBlockIds) {
        const result = await listLiveTestItems(blockId)
        if (result.ok) rows.push(...result.data)
      }
      if (!cancelled) setLiveTestItems(rows)
    }
    void loadItems()
    return () => {
      cancelled = true
    }
  }, [liveTestBlockIds])

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

  const analysisLedger = useMemo(() => {
    return scopedLedger.filter((record) => {
      const session = sessionById.get(record.learningSessionId)
      if (!session) return false
      if (promptLanguageFilter !== 'all' && session.promptLanguage !== promptLanguageFilter) return false
      if (resourceFilter !== 'all' && session.liveTestResourceId !== resourceFilter) return false
      if (blockFilter !== 'all' && session.liveTestBlockId !== blockFilter) return false
      return true
    })
  }, [scopedLedger, sessionById, promptLanguageFilter, resourceFilter, blockFilter])

  const focusLearnerId = mode === 'learner' ? learnerUserId : (selectedLearnerIds.length === 1 ? selectedLearnerIds[0] : undefined)
  const focusLearner = focusLearnerId
    ? users.find((u) => u.id === focusLearnerId)
    : undefined

  const courseReport = useMemo(() => {
    if (!window || mode === 'learner' || focusLearnerId) return null
    const learnerIds = selectedLearnerIds.length > 0 ? selectedLearnerIds : learners.map((u) => u.id)
    return buildCourseProgressReport(analysisLedger, courseId, window, { learnerIds })
  }, [window, mode, focusLearnerId, analysisLedger, courseId, learners, selectedLearnerIds] )

  const learnerReport = useMemo(() => {
    if (!window || !focusLearnerId) return null
    return buildLearnerProgressReport(analysisLedger, focusLearnerId, window, {
      courseId,
      classId,
    })
  }, [window, focusLearnerId, analysisLedger, courseId, classId])

  const comparison = learnerReport?.comparison ?? courseReport?.overall ?? null

  const baseWindowRecords = useMemo(() => {
    if (!window) return []
    const records = filterResults(analysisLedger, window, {
      courseId,
      classId,
      learnerUserId: focusLearnerId,
    })
    if (selectedLearnerIds.length > 1) {
      return records.filter((r) => selectedLearnerIds.includes(r.learnerUserId))
    }
    return records
  }, [window, analysisLedger, courseId, classId, focusLearnerId, selectedLearnerIds])

  const itemById = useMemo(
    () => new Map(liveTestItems.map((item) => [item.id, item])),
    [liveTestItems],
  )
  const windowRecords = useMemo(() => {
    if (cciBandFilter === 'all' && cvrBandFilter === 'all' && cpdBandFilter === 'all') {
      return baseWindowRecords
    }
    return baseWindowRecords.filter((record) => {
      const itemId = liveTestItemIdFromExternalRef(record.externalRef)
      const item = itemId ? itemById.get(itemId) : null
      return (
        numericBand(item?.cciValue, cciBandFilter) &&
        numericBand(item?.cvrValue, cvrBandFilter) &&
        numericBand(item?.cpdValue, cpdBandFilter)
      )
    })
  }, [baseWindowRecords, itemById, cciBandFilter, cvrBandFilter, cpdBandFilter])

  // Pre-test vs Post-test comparison data
  const prePostData = useMemo(() => {
    // get all results in scope of class/learner
    const learnerFilter = selectedLearnerIds.length > 0 ? selectedLearnerIds : learners.map((u) => u.id)
    const activeLedger = scopedLedger.filter((r) => learnerFilter.includes(r.learnerUserId))
    
    const preRecords = activeLedger.filter((r) => {
      const s = sessionById.get(r.learningSessionId)
      return s?.sessionKind === 'pretest'
    })
    const postRecords = activeLedger.filter((r) => {
      const s = sessionById.get(r.learningSessionId)
      return s?.sessionKind === 'posttest'
    })

    const preCounts = colorCounts(preRecords)
    const postCounts = colorCounts(postRecords)

    const preTotal = preRecords.length
    const postTotal = postRecords.length

    const preRfc = preTotal > 0 ? (preCounts.red + preCounts.yellow) / preTotal : null
    const preRac = preTotal > 0 ? (preCounts.green + preCounts.purple) / preTotal : null

    const postRfc = postTotal > 0 ? (postCounts.red + postCounts.yellow) / postTotal : null
    const postRac = postTotal > 0 ? (postCounts.green + postCounts.purple) / postTotal : null

    return {
      preTotal,
      postTotal,
      preRfc,
      preRac,
      postRfc,
      postRac,
      rfcDelta: (preRfc !== null && postRfc !== null) ? (postRfc - preRfc) * 100 : null,
      racDelta: (preRac !== null && postRac !== null) ? (postRac - preRac) * 100 : null,
    }
  }, [scopedLedger, sessionById, selectedLearnerIds, learners])

  const liveTestRows = useMemo(
    () => joinLiveTestResults({ records: windowRecords, itemById, promptLanguage: 'vi' }),
    [windowRecords, itemById],
  )
  const itemDifficultyRows = useMemo(() => {
    const byItem = new Map<string, typeof liveTestRows>()
    for (const row of liveTestRows) {
      const list = byItem.get(row.liveTestItemId) ?? []
      list.push(row)
      byItem.set(row.liveTestItemId, list)
    }
    return [...byItem.entries()]
      .map(([id, rows]) => {
        const sample = rows.length
        const redYellow = rows.filter((row) => row.effectiveColor === 'red' || row.effectiveColor === 'yellow').length
        const greenPurple = sample - redYellow
        const nCount = rows.filter((row) => row.enteredProbeFlow).length
        const nDepthAvg = nCount > 0 ? rows.reduce((sum, row) => sum + row.probeEventCount, 0) / nCount : null
        const first = rows[0]!
        return {
          id,
          itemNumber: first.itemNumber,
          prompt: first.prompt,
          cci: first.cciValue,
          cvr: first.cvrValue,
          cpd: first.cpdValue,
          sample,
          rfc: sample > 0 ? redYellow / sample : null,
          rac: sample > 0 ? greenPurple / sample : null,
          nCount,
          nDepthAvg,
        }
      })
      .sort((a, b) => (b.rfc ?? 0) - (a.rfc ?? 0) || (b.cpd ?? 0) - (a.cpd ?? 0))
  }, [liveTestRows])

  const counts = colorCounts(windowRecords)
  const total = windowRecords.length
  const maxBar = Math.max(1, ...Object.values(counts))

  const pieData = useMemo(() => {
    return [
      { name: 'Red', value: counts.red, color: '#ef4444' },
      { name: 'Yellow', value: counts.yellow, color: '#eab308' },
      { name: 'Green', value: counts.green, color: '#22c55e' },
      { name: 'Purple', value: counts.purple, color: '#a855f7' },
    ].filter((d) => d.value > 0)
  }, [counts])

  const rfc = comparison ? pickMetric(comparison.current, 'rfc', metricSettings) : null
  const rac = comparison ? pickMetric(comparison.current, 'rac', metricSettings) : null

  const rfcDelta = comparison?.deltas.rfc
  const racDelta = comparison?.deltas.rac
  const rfcTone = trendTone('rfc', rfcDelta)
  const racTone = trendTone('rac', racDelta)

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

  if (analysisLedger.length === 0) {
    return (
      <div className="empty-state analysis-empty">
        <p>
          <strong>No live test results yet</strong>
        </p>
        <p className="meta" style={{ textAlign: 'center' }}>
          {emptyHint ??
            'Launch and complete a Live Test session to view standardized analysis here.'}
        </p>
      </div>
    )
  }

  const subTabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'charts' as const, label: 'Charts' },
    ...(mode === 'teacher' ? [{ id: 'items' as const, label: 'Item difficulty' }] : []),
    { id: 'history' as const, label: 'Test outcomes' },
  ]

  return (
    <div className="analysis">
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

        <div className="analysis-filter-row analysis-dates">
          <label className="analysis-select-wrap">
            <span className="analysis-filter-label">Prompt Lang</span>
            <select className="analysis-select" value={promptLanguageFilter} onChange={(e) => setPromptLanguageFilter(e.target.value as typeof promptLanguageFilter)}>
              <option value="all">All</option>
              <option value="vi">Vietnamese</option>
              <option value="en">English</option>
            </select>
          </label>
          {liveTestResourceIds.length > 0 ? (
            <label className="analysis-select-wrap">
              <span className="analysis-filter-label">Resource</span>
              <select className="analysis-select" value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)}>
                <option value="all">All</option>
                {liveTestResourceIds.map((id) => (
                  <option key={id} value={id}>{id.slice(0, 8)}</option>
                ))}
              </select>
            </label>
          ) : null}
          {liveTestBlockIds.length > 0 ? (
            <label className="analysis-select-wrap">
              <span className="analysis-filter-label">Block</span>
              <select className="analysis-select" value={blockFilter} onChange={(e) => setBlockFilter(e.target.value)}>
                <option value="all">All</option>
                {liveTestBlockIds.map((id) => (
                  <option key={id} value={id}>{id.slice(0, 8)}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {liveTestBlockIds.length > 0 ? (
          <div className="analysis-filter-row analysis-dates">
            {([
              ['CCI band', cciBandFilter, setCciBandFilter],
              ['CVR band', cvrBandFilter, setCvrBandFilter],
              ['CPD band', cpdBandFilter, setCpdBandFilter],
            ] as const).map(([label, value, setter]) => (
              <label className="analysis-select-wrap" key={label}>
                <span className="analysis-filter-label">{label}</span>
                <select className="analysis-select" value={value} onChange={(e) => setter(e.target.value as typeof value)}>
                  <option value="all">All</option>
                  <option value="missing">Missing</option>
                  <option value="low">Low ≤ 1</option>
                  <option value="medium">Medium 1–3</option>
                  <option value="high">High &gt; 3</option>
                </select>
              </label>
            ))}
          </div>
        ) : null}

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
        </p>
      </section>

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
          <div className="stat-grid analysis-kpis" style={{ marginBottom: 20 }}>
            <div className={`stat-card analysis-kpi-rfc${rfcTone === 'up' ? ' is-good' : rfcTone === 'down' ? ' is-warn' : ''}`}>
              <p className="stat-label flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                <span>Struggle (RFC)</span>
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
                <span>Success (RAC)</span>
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
              <p className="stat-label">Results</p>
              <p className="stat-value">{total}</p>
              <p className="meta">
                G/P {counts.green + counts.purple} · R/Y {counts.red + counts.yellow}
              </p>
            </div>
          </div>

          {/* Pre-test vs Post-test baseline-comparison card */}
          {(prePostData.preTotal > 0 || prePostData.postTotal > 0) && (
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-body-inner">
                <p className="panel-title mb-3" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  PRE-TEST VS. POST-TEST COMPARISON
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl text-center">
                    <p className="text-xs text-slate-400 font-medium">Pre-test (Baseline)</p>
                    {prePostData.preTotal > 0 ? (
                      <div className="mt-1">
                        <p className="text-xl font-bold text-white">
                          RFC {(prePostData.preRfc! * 100).toFixed(0)}% · RAC {(prePostData.preRac! * 100).toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">sample={prePostData.preTotal}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 mt-2">No pretest sessions found</p>
                    )}
                  </div>
                  <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl text-center">
                    <p className="text-xs text-slate-400 font-medium">Post-test (Outcome)</p>
                    {prePostData.postTotal > 0 ? (
                      <div className="mt-1">
                        <p className="text-xl font-bold text-white">
                          RFC {(prePostData.postRfc! * 100).toFixed(0)}% · RAC {(prePostData.postRac! * 100).toFixed(0)}%
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">sample={prePostData.postTotal}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 mt-2">No posttest sessions found</p>
                    )}
                  </div>
                  <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-center flex flex-col justify-center">
                    <p className="text-xs text-indigo-300 font-medium">Improvement Delta</p>
                    {prePostData.preTotal > 0 && prePostData.postTotal > 0 ? (
                      <div className="mt-1">
                        <p className="text-lg font-black text-white">
                          Struggle: <span className={prePostData.rfcDelta! <= 0 ? 'text-green-400' : 'text-red-400'}>{prePostData.rfcDelta! > 0 ? '+' : ''}{prePostData.rfcDelta!.toFixed(1)} pp</span>
                        </p>
                        <p className="text-xs text-slate-400 font-bold mt-0.5">
                          Success: <span className={prePostData.racDelta! >= 0 ? 'text-green-400' : 'text-red-400'}>{prePostData.racDelta! > 0 ? '+' : ''}{prePostData.racDelta!.toFixed(1)} pp</span>
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 mt-1">Requires both Pre and Post tests</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="analysis-grid">
            <div className="panel">
              <div className="panel-body-inner">
                <p className="panel-title mb-2">Color mix</p>
                {total === 0 ? (
                  <p className="meta">No data in this filter.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-6 items-center w-full">
                    <div className="dist-bars flex-1 w-full">
                      {(['red', 'yellow', 'green', 'purple'] as ResultColor[]).map((color) => {
                        const n = counts[color]
                        const p = pct(n, total)
                        const width = `${Math.max(n ? 8 : 0, (n / Math.max(maxBar, 1)) * 100)}%`
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
                    {pieData.length > 0 && (
                      <div className="flex-shrink-0" style={{ width: 140, height: 140 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={30}
                              outerRadius={55}
                              paddingAngle={3}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
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
          </div>
        </div>
      )}

      {/* ——— Charts ——— */}
      {tab === 'charts' && (
        <div className="analysis-tab-body">
          <AnalysisChartsPanel
            ledger={analysisLedger}
            learningSessions={orderedSessions}
            courseId={courseId}
            classId={classId}
            learnerUserId={focusLearnerId}
            totalDays={totalDays}
            metricSettings={metricSettings}
          />
        </div>
      )}

      {/* ——— Item Difficulty ——— */}
      {tab === 'items' && mode === 'teacher' && (
        <div className="analysis-tab-body">
          {itemDifficultyRows.length === 0 ? (
            <p className="empty-state">No live-test item results found in this scope.</p>
          ) : (
            <div className="table-wrap">
              <p className="panel-title mb-2">Live-test item difficulty</p>
              <table aria-label="Live-test item difficulty by CPD">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Prompt</th>
                    <th>CCI</th>
                    <th>CVR</th>
                    <th>CPD</th>
                    <th>sample</th>
                    <th>RFC</th>
                    <th>RAC</th>
                    <th>n count</th>
                    <th>n depth avg</th>
                  </tr>
                </thead>
                <tbody>
                  {itemDifficultyRows.map((row) => (
                    <tr key={row.id}>
                      <td>#{String(row.itemNumber).padStart(2, '0')}</td>
                      <td className="def">{row.prompt ?? '—'}</td>
                      <td>{row.cci ?? '—'}</td>
                      <td>{row.cvr ?? '—'}</td>
                      <td>{row.cpd ?? '—'}</td>
                      <td>{row.sample}</td>
                      <td>{row.rfc == null ? '—' : `${(row.rfc * 100).toFixed(1)}%`}</td>
                      <td>{row.rac == null ? '—' : `${(row.rac * 100).toFixed(1)}%`}</td>
                      <td>{row.nCount}</td>
                      <td>{row.nDepthAvg == null ? '—' : row.nDepthAvg.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ——— History ——— */}
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
                    {mode === 'teacher' && !focusLearnerId ? <th scope="col">Learner</th> : null}
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
                                setSelectedLearnerIds([r.learnerUserId])
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

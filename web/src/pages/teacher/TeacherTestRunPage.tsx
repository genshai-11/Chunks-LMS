import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  GripVertical,
  Keyboard,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { listActiveLearners } from '../../modules/roster/service'
import { listTestSections } from '../../lib/test-packages'
import {
  completeStandaloneRun,
  getStandaloneRun,
  getStandaloneRunRuntime,
  listStandaloneAssignments,
  listStandaloneRunItems,
  listStandaloneRuns,
  prepareStandaloneRun,
  recordStandaloneResult,
  startStandaloneRun,
  type StandaloneTestRunRow,
} from '../../lib/standalone-tests'
import { getNarrationPlaybackUrl } from '../../modules/catalog/live-test-generation'
import { triggerConfetti } from '../../lib/confetti'
import { useAppState } from '../../state/useAppState'

type AudioState = 'idle' | 'loading' | 'ready' | 'playing' | 'played' | 'error'
type ResultColor = 'red' | 'yellow' | 'green' | 'purple'
type ReactionKind = 'celebrate' | 'happy' | 'fight'
type Reaction = { kind: ReactionKind; color: ResultColor; id: number } | null

type TestItem = Record<string, any>

const COLORS: Array<{ key: ResultColor; label: string; num: string; hex: string }> = [
  { key: 'red', label: 'Red', num: '0', hex: '#ef4444' },
  { key: 'yellow', label: 'Yellow', num: '1', hex: '#eab308' },
  { key: 'green', label: 'Green', num: '2', hex: '#22c55e' },
  { key: 'purple', label: 'Purple', num: '3', hex: '#a855f7' },
]

const RAIL_W_KEY = 'chunks-lms:live-test-rail-w'
const RAIL_MIN = 168
const RAIL_MAX = 460
const RAIL_DEFAULT = 244
const RAIL_COLLAPSED = 48

function reactionFor(color: ResultColor): ReactionKind {
  if (color === 'purple') return 'celebrate'
  if (color === 'green') return 'happy'
  return 'fight'
}

function getItemSnapshot(item: TestItem | null | undefined) {
  return item?.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots ?? null
}

function getItemColor(item: TestItem | null | undefined): ResultColor | null {
  return (getItemSnapshot(item)?.effective_color as ResultColor) ?? null
}

function isItemFinalized(item: TestItem | null | undefined): boolean {
  return ['finalized', 'corrected'].includes(getItemSnapshot(item)?.status)
}

function cpdValue(item: TestItem | null | undefined): number | null {
  if (!item) return null
  const raw = item.cpd ?? (item.cvr !== undefined && item.cci !== undefined ? Number(item.cvr) * Number(item.cci) : null)
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function readSavedRailWidth(): number {
  try {
    const n = Number(window.localStorage.getItem(RAIL_W_KEY))
    if (Number.isFinite(n)) return Math.min(RAIL_MAX, Math.max(RAIL_MIN, n))
  } catch {
    /* ignore */
  }
  return RAIL_DEFAULT
}

export function TeacherTestRunPage() {
  const { runId } = useParams()
  const [searchParams] = useSearchParams()
  const assignmentIdParam = searchParams.get('assignmentId')
  const navigate = useNavigate()
  const { roster } = useAppState()

  const [runDetails, setRunDetails] = useState<StandaloneTestRunRow | null>(null)
  const [allRuns, setAllRuns] = useState<StandaloneTestRunRow[]>([])
  const [items, setItems] = useState<TestItem[]>([])
  const [introVariantId, setIntroVariantId] = useState<string | null>(null)
  const [isSummaryShown, setIsSummaryShown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioState, setAudioState] = useState<AudioState>('idle')
  const [reaction, setReaction] = useState<Reaction>(null)
  const [message, setMessage] = useState('')
  const [showHeader, setShowHeader] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > 768 : true,
  )
  const [showKeys, setShowKeys] = useState(false)
  const [mapOpen, setMapOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : true,
  )
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT)
  const [resizing, setResizing] = useState(false)
  const railWidthRef = useRef(railWidth)

  useEffect(() => {
    setRailWidth(readSavedRailWidth())
  }, [])

  useEffect(() => {
    railWidthRef.current = railWidth
  }, [railWidth])

  const startRailResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!mapOpen) return
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startW = railWidthRef.current
      setResizing(true)

      const onMove = (ev: PointerEvent) => {
        const next = Math.min(RAIL_MAX, Math.max(RAIL_MIN, startW + (ev.clientX - startX)))
        railWidthRef.current = next
        setRailWidth(next)
      }
      const onUp = () => {
        setResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        try {
          window.localStorage.setItem(RAIL_W_KEY, String(railWidthRef.current))
        } catch {
          /* ignore */
        }
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [mapOpen],
  )

  const playReaction = useCallback((color: ResultColor) => {
    const id = Date.now()
    setReaction({ kind: reactionFor(color), color, id })
    window.setTimeout(() => setReaction((current) => (current?.id === id ? null : current)), 1200)
  }, [])

  const load = useCallback(async () => {
    if (!runId) return
    const primaryRunResult = await getStandaloneRun(runId)
    if (!primaryRunResult.ok || !primaryRunResult.data) {
      setMessage(primaryRunResult.ok ? 'Run not found' : primaryRunResult.error)
      return
    }

    const currentRun = primaryRunResult.data
    setRunDetails(currentRun)
    const assignmentId = assignmentIdParam || currentRun.assignmentId
    let targetRuns: StandaloneTestRunRow[] = [currentRun]

    if (assignmentId) {
      const assignmentRes = await listStandaloneAssignments()
      if (assignmentRes.ok) {
        const assignment = assignmentRes.data.find((a) => a.id === assignmentId)
        if (assignment) {
          const sectionsRes = await listTestSections(assignment.packageVersionId)
          const existingRunsRes = await listStandaloneRuns(assignmentId)
          const existingRuns = existingRunsRes.ok ? existingRunsRes.data : []
          const existingSectionIds = new Set(existingRuns.map((r) => r.testSectionId))
          if (sectionsRes.ok) {
            for (const sec of sectionsRes.data) {
              if (existingSectionIds.has(sec.id)) continue
              const prep = await prepareStandaloneRun(
                assignmentId,
                sec.id,
                currentRun.promptLanguage || 'vi',
                currentRun.voiceId || 'default',
              )
              if (prep.ok && prep.data.canStart) {
                await startStandaloneRun(prep.data.runId, prep.data.readinessToken)
              }
            }
          }
        }
      }

      const runsResult = await listStandaloneRuns(assignmentId)
      if (runsResult.ok && runsResult.data.length > 0) targetRuns = runsResult.data
    }
    setAllRuns(targetRuns)

    const runtimeResult = await getStandaloneRunRuntime(currentRun.id)
    if (runtimeResult.ok && runtimeResult.data.introNarrationVariantId) {
      setIntroVariantId(runtimeResult.data.introNarrationVariantId)
    }

    const itemResults = await Promise.all(targetRuns.map((r) => listStandaloneRunItems(r.id)))
    let globalItemIndex = 1
    const combinedItems: TestItem[] = []
    for (let i = 0; i < targetRuns.length; i += 1) {
      const runItemRes = itemResults[i]
      if (!runItemRes?.ok) continue
      for (const item of runItemRes.data) {
        combinedItems.push({
          ...item,
          global_item_order: globalItemIndex,
          parent_run_id: targetRuns[i]!.id,
          session_number: targetRuns[i]!.sessionNumber,
          cvr: targetRuns[i]!.targetCvrOhm,
          cci: targetRuns[i]!.cciValue,
          cpd: targetRuns[i]!.itemCpd,
        })
        globalItemIndex += 1
      }
    }
    setItems(combinedItems)

    const firstUnfinalized = combinedItems.findIndex((item) => !isItemFinalized(item))
    if (firstUnfinalized !== -1) {
      setSelectedIndex(firstUnfinalized)
      setIsSummaryShown(false)
    } else if (combinedItems.length > 0) {
      setSelectedIndex(combinedItems.length - 1)
      setIsSummaryShown(true)
      triggerConfetti()
    }
  }, [runId, assignmentIdParam])

  useEffect(() => {
    void load()
  }, [load])

  const currentItem = useMemo(() => items[selectedIndex] ?? null, [items, selectedIndex])
  const completedCount = useMemo(() => items.filter(isItemFinalized).length, [items])
  const currentVariantId = currentItem?.narration_variant_id ?? introVariantId ?? null

  useEffect(() => {
    if (!currentVariantId) return
    setAudioUrl('')
    setAudioState('loading')
    setMessage('')
    void getNarrationPlaybackUrl(currentVariantId)
      .then((playback) => {
        setAudioUrl(playback.signedUrl)
        setAudioState('ready')
      })
      .catch((cause) => {
        setAudioState('error')
        setMessage(cause instanceof Error ? cause.message : 'Audio playback failed')
      })
  }, [currentVariantId])

  const handleRecord = useCallback(
    async (color: ResultColor) => {
      if (!currentItem) return
      playReaction(color)
      const result = await recordStandaloneResult(currentItem.id, color)
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      await load()
    },
    [currentItem, load, playReaction],
  )

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!currentItem) return
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault()
        setMapOpen((v) => !v)
        return
      }
      if (e.key === '?') {
        e.preventDefault()
        setShowKeys((v) => !v)
        return
      }
      const found = COLORS.find((k) => k.num === e.key)
      if (found) {
        e.preventDefault()
        void handleRecord(found.key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentItem, handleRecord])

  async function completeAll() {
    for (const r of allRuns) await completeStandaloneRun(r.id)
    navigate('/teacher/tests')
  }

  const sessionsGrouped = useMemo(() => {
    const map = new Map<number, TestItem[]>()
    for (const item of items) {
      const sNum = item.session_number || 1
      if (!map.has(sNum)) map.set(sNum, [])
      map.get(sNum)!.push(item)
    }
    return Array.from(map.entries()).map(([sessionNum, sessionItems]) => ({
      sessionNum,
      items: sessionItems,
    }))
  }, [items])

  const summaryMetrics = useMemo(() => {
    const redCount = items.filter((i) => getItemColor(i) === 'red').length
    const yellowCount = items.filter((i) => getItemColor(i) === 'yellow').length
    const greenCount = items.filter((i) => getItemColor(i) === 'green').length
    const purpleCount = items.filter((i) => getItemColor(i) === 'purple').length
    const cpdValues = items.map(cpdValue).filter((v): v is number => v !== null)
    const finalized = completedCount
    const rfc = finalized > 0 ? Math.round(((redCount + yellowCount) / finalized) * 100) : 0
    const rac = finalized > 0 ? Math.round(((greenCount + purpleCount) / finalized) * 100) : 0
    const avgCpd = cpdValues.length
      ? Math.round(cpdValues.reduce((acc, value) => acc + value, 0) / cpdValues.length)
      : 0
    const minCpd = cpdValues.length ? Math.min(...cpdValues) : null
    const maxCpd = cpdValues.length ? Math.max(...cpdValues) : null
    return { redCount, yellowCount, greenCount, purpleCount, finalized, rfc, rac, avgCpd, minCpd, maxCpd }
  }, [items, completedCount])

  const chartData = useMemo(
    () =>
      items.map((item) => {
        const colorKey = getItemColor(item) ?? undefined
        const finalized = isItemFinalized(item)
        return {
          itemOrder: item.global_item_order,
          label: `Q${item.global_item_order}`,
          cpd: cpdValue(item) ?? 0,
          cvr: item.cvr ?? 0,
          cci: item.cci ?? 0,
          colorKey: finalized ? colorKey : 'pending',
          hex: finalized && colorKey ? (COLORS.find((r) => r.key === colorKey)?.hex ?? '#cbd5e1') : '#cbd5e1',
          prompt: item.prompt_text,
        }
      }),
    [items],
  )

  if (items.length === 0) {
    return (
      <div className="observe-root flex items-center justify-center" role="status">
        <EmptyState icon={ClipboardCheck} title="Loading Full Package Items…" description={message} />
      </div>
    )
  }

  const activeLearners = listActiveLearners(roster)
  const learner = activeLearners.find((l) => l.id === runDetails?.learnerUserId) ?? null
  const learnerName = learner?.displayName ?? 'Learner'
  const learnerAvatarUrl = learner?.avatarUrl ?? null
  const isAllFinalized = completedCount === items.length
  const totalSessions = allRuns.length || 1
  const currentSessionNumber = currentItem?.session_number || 1
  const currentItemNumber = currentItem?.global_item_order ?? selectedIndex + 1
  const currentColor = getItemColor(currentItem)
  const currentCpd = cpdValue(currentItem)
  const railSizeClass = !mapOpen
    ? 'is-narrow'
    : railWidth < 190
      ? 'is-compact'
      : railWidth > 320
        ? 'is-wide'
        : 'is-mid'
  const avatarSize = !mapOpen ? 'sm' : railWidth > 320 ? 'xl' : railWidth > 220 ? 'lg' : 'md'
  const lang = (runDetails?.promptLanguage ?? 'vi').toUpperCase()

  return (
    <div
      className={`observe-root${reaction ? ` is-react-${reaction.kind} is-react-${reaction.color}` : ''}${
        mapOpen ? ' is-map-open' : ''
      }${showHeader ? '' : ' is-header-hidden'}`}
      role="application"
      aria-label={`Live Test · ${learnerName}`}
    >
      <header className={`observe-bar observe-bar-slim${showHeader ? '' : ' is-hidden'}`}>
        <button type="button" className="observe-nav-exit" onClick={() => navigate('/teacher/tests')} aria-label="Exit live test">
          <ChevronLeft aria-hidden strokeWidth={2.5} />
        </button>
        <div className="observe-bar-center">
          <span className="observe-day-badge">Session {currentSessionNumber}/{totalSessions}</span>
          <span className="observe-sep">·</span>
          <span className="observe-mode">
            Q{currentItemNumber}<span className="observe-meta-muted">/{items.length}</span>
          </span>
          <span className="observe-sep observe-hide-phone">·</span>
          <span className="observe-class observe-hide-phone">Live Test · {lang}</span>
        </div>
        <div className="observe-nav-group" role="toolbar" aria-label="Live test tools">
          <button type="button" className={`observe-nav-btn${mapOpen ? ' is-active' : ''}`} onClick={() => setMapOpen((v) => !v)} title="Map (H)">
            {mapOpen ? <PanelLeftClose aria-hidden strokeWidth={2.25} /> : <PanelLeftOpen aria-hidden strokeWidth={2.25} />}
          </button>
          <button type="button" className={`observe-nav-btn observe-hide-phone${showKeys ? ' is-active' : ''}`} onClick={() => setShowKeys((v) => !v)} title="Keys (?)">
            <Keyboard aria-hidden strokeWidth={2.25} />
          </button>
        </div>
      </header>

      <button type="button" className="observe-nav-btn observe-header-toggle" onClick={() => setShowHeader((value) => !value)} title={showHeader ? 'Hide header' : 'Show header'}>
        {showHeader ? <ChevronLeft aria-hidden strokeWidth={2.25} /> : <ChevronRight aria-hidden strokeWidth={2.25} />}
      </button>

      <button type="button" className="observe-finish-fab" onClick={() => (isAllFinalized ? void completeAll() : setIsSummaryShown(true))}>
        {isAllFinalized ? <CheckCircle2 aria-hidden strokeWidth={2.25} /> : <BarChart3 aria-hidden strokeWidth={2.25} />}
        <span>{isAllFinalized ? 'Finish' : 'Summary'}</span>
      </button>

      <aside
        className={`observe-rail ${mapOpen ? 'is-open' : 'is-closed'} ${railSizeClass}${resizing ? ' is-resizing' : ''}`}
        style={{ ['--observe-rail-w']: mapOpen ? `${railWidth}px` : `${RAIL_COLLAPSED}px` } as CSSProperties}
        aria-label="Learner and package item map"
      >
        <div className="observe-rail-person">
          <UserAvatar name={learnerName} avatarUrl={learnerAvatarUrl} size={avatarSize} className="observe-rail-avatar" />
          {mapOpen ? (
            <>
              <p className="observe-rail-name">{learnerName}</p>
              <p className="observe-rail-n">{completedCount}/{items.length} scored</p>
            </>
          ) : null}
        </div>

        {mapOpen ? (
          <div className="observe-rail-map">
            <div className="observe-heat layout-column">
              <div className="observe-heat-summary">
                <span className="observe-heat-metric">Items <strong>{items.length}</strong></span>
                <span className="observe-heat-metric muted">Done <strong>{completedCount}</strong></span>
                <span className="observe-heat-metric tabular">CPD <strong>{summaryMetrics.minCpd ?? '—'}–{summaryMetrics.maxCpd ?? '—'}</strong></span>
                <span className="observe-heat-counts" aria-label="Color counts">
                  {COLORS.map((c) => (
                    <span key={c.key} className={`observe-heat-count is-${c.key}`} title={c.label}>
                      <i aria-hidden />
                      {summaryMetrics[`${c.key}Count` as keyof typeof summaryMetrics] as number}
                    </span>
                  ))}
                </span>
              </div>
              <div className="observe-heat-grid" aria-label="Package item heatmap">
                {sessionsGrouped.flatMap(({ sessionNum, items: sessionItems }) =>
                  sessionItems.map((item) => {
                    const idx = items.findIndex((candidate) => candidate.id === item.id)
                    const color = getItemColor(item)
                    const statusClass = isItemFinalized(item) && color ? `is-${color}` : 'is-empty'
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`observe-heat-dot-btn ${statusClass}${idx === selectedIndex ? ' is-current' : ''}`}
                        title={`Session ${sessionNum} · Q${item.global_item_order}: ${item.prompt_text ?? ''}`}
                        onClick={() => {
                          setSelectedIndex(idx)
                          setIsSummaryShown(false)
                        }}
                      >
                        {item.global_item_order}
                      </button>
                    )
                  }),
                )}
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="observe-rail-peek" onClick={() => setMapOpen(true)} title="Expand">
            <PanelLeftOpen className="h-4 w-4" aria-hidden strokeWidth={1.75} />
          </button>
        )}

        {mapOpen ? (
          <div className="observe-rail-footer">
            <button type="button" className="observe-rail-collapse" onClick={() => setMapOpen(false)} title="Collapse">
              <PanelLeftClose className="h-4 w-4" aria-hidden strokeWidth={1.75} />
            </button>
          </div>
        ) : null}

        {mapOpen ? (
          <div className="observe-rail-resize" role="separator" aria-orientation="vertical" tabIndex={0} onPointerDown={startRailResize}>
            <GripVertical className="observe-rail-resize-grip" aria-hidden strokeWidth={1.75} />
          </div>
        ) : null}
      </aside>

      <main className="observe-stage observe-stage-tight">
        {!isSummaryShown ? (
          <>
            <div className="observe-stage-hero">
              <div className="observe-phone-avatar"><UserAvatar name={learnerName} avatarUrl={learnerAvatarUrl} size="md" /></div>
              <p className="observe-day-line">Session {currentSessionNumber} · Q{currentItemNumber}/{items.length} · {completedCount}/{items.length} finalized</p>
              <h1 className="observe-learner observe-learner-solo flex items-center justify-center gap-2">
                <span>{learnerName}</span>
                <button
                  type="button"
                  className="text-xs bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30 px-3 py-1 rounded-full font-mono font-bold flex items-center gap-1 transition"
                  onClick={() => {
                    const audio = document.querySelector<HTMLAudioElement>('#live-test-current-audio')
                    void audio?.play()
                  }}
                  title="Play current item audio"
                >
                  <Volume2 className="h-3.5 w-3.5" /> Audio
                </button>
              </h1>

              <div className="observe-meta-row">
                <span className="observe-learner-rfc">RFC {summaryMetrics.rfc}%</span>
                <span className="observe-learner-rfc">RAC {summaryMetrics.rac}%</span>
                <span className="observe-learner-rfc">CPD avg {summaryMetrics.avgCpd || '—'}</span>
              </div>

              {showKeys ? <p className="observe-depth-inline text-xs text-slate-400">Shortcuts: 0 Red · 1 Yellow · 2 Green · 3 Purple · H map · ? keys</p> : null}

              <div className="mt-2 w-full max-w-2xl rounded-3xl border border-indigo-300/20 bg-indigo-950/35 p-3 text-center shadow-lg sm:p-4">
                <div className="flex items-center justify-between gap-3 text-xs text-indigo-200 font-mono">
                  <span className="flex items-center gap-1 font-bold"><Volume2 className="h-4 w-4 text-indigo-400" /> Current item audio · {lang}</span>
                  <span className="text-[10px] uppercase opacity-75">{audioState}</span>
                </div>
                {audioUrl ? (
                  <audio id="live-test-current-audio" key={currentVariantId} controls src={audioUrl} onPlay={() => setAudioState('playing')} onEnded={() => setAudioState('played')} onError={() => setAudioState('error')} className="mx-auto my-2 h-8 w-full max-w-sm" />
                ) : null}
                {audioState === 'error' ? (
                  <button
                    type="button"
                    className="ghost text-xs text-rose-300 mt-1"
                    onClick={() => {
                      if (!currentVariantId) return
                      setAudioState('loading')
                      setAudioUrl('')
                      void getNarrationPlaybackUrl(currentVariantId)
                        .then((playback) => {
                          setAudioUrl(playback.signedUrl)
                          setAudioState('ready')
                        })
                        .catch((cause) => {
                          setAudioState('error')
                          setMessage(cause instanceof Error ? cause.message : 'Playback failed')
                        })
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Retry audio
                  </button>
                ) : null}

                <div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-200/80">Item text · Q{currentItemNumber}</p>
                  <p className="mt-1 text-lg font-bold leading-snug text-white sm:text-xl">“{currentItem?.prompt_text ?? 'Select a question'}”</p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-mono sm:grid-cols-6">
                  <span className="rounded bg-indigo-900/60 px-2.5 py-1 text-indigo-100">CVR {currentItem?.cvr ?? '—'}</span>
                  <span className="rounded bg-purple-900/60 px-2.5 py-1 text-purple-100">CCI {currentItem?.cci ?? '—'}</span>
                  <span className="rounded bg-emerald-900/60 px-2.5 py-1 font-bold text-emerald-100">CPD {currentCpd ?? '—'}</span>
                  <span className="rounded bg-slate-900/70 px-2.5 py-1 text-slate-200">Min {summaryMetrics.minCpd ?? '—'}</span>
                  <span className="rounded bg-slate-900/70 px-2.5 py-1 text-slate-200">Max {summaryMetrics.maxCpd ?? '—'}</span>
                  <span className="rounded bg-slate-900/70 px-2.5 py-1 text-slate-200">Avg {summaryMetrics.avgCpd || '—'}</span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-indigo-900/40 pt-3 text-xs">
                  <button type="button" className="ghost text-xs text-slate-300 hover:text-white flex items-center gap-1" disabled={selectedIndex === 0} onClick={() => setSelectedIndex((prev) => Math.max(0, prev - 1))}><ChevronLeft className="h-4 w-4" /> Prev Q</button>
                  <span className="font-mono text-slate-400">Current result: {currentColor ?? 'not scored'}</span>
                  <button type="button" className="ghost text-xs text-slate-300 hover:text-white flex items-center gap-1" disabled={selectedIndex === items.length - 1} onClick={() => setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1))}>Next Q <ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            </div>

            {reaction ? (
              <div key={reaction.id} className={`observe-react observe-react-${reaction.kind}`} aria-hidden>
                <span className="observe-react-symbol"><Check aria-hidden /></span>
                <span className="observe-react-label">{reaction.kind === 'celebrate' ? 'Xuất sắc!' : reaction.kind === 'happy' ? 'Tập trung tốt!' : 'Cần hỗ trợ'}</span>
                <Sparkles className="observe-react-sparkles" aria-hidden />
                <span className="observe-react-burst" />
              </div>
            ) : null}

            <div className={`observe-dock observe-dock-lg${reaction ? ` is-glowing is-${reaction.color}` : ''}`}>
              <div className="observe-dock-colors" role="group" aria-label="Result color">
                {COLORS.map((c) => (
                  <button key={c.key} type="button" className={`observe-dock-color is-${c.key}${currentColor === c.key ? ' is-selected' : ''}`} onClick={() => void handleRecord(c.key)} disabled={!currentItem} title={`${c.num} · ${c.label}`}>
                    <span className="observe-dock-num">{c.num}</span>
                    <span className="observe-dock-label">{c.label}</span>
                  </button>
                ))}
              </div>
              <div className="observe-dock-tools observe-split-tools"><span className="observe-dock-q">Q{currentItemNumber}/{items.length}</span></div>
            </div>
          </>
        ) : (
          <div className="min-h-0 w-full max-w-4xl overflow-y-auto p-4">
            <Panel icon={BarChart3} title={`Màn hình Ghi nhận & Xem Kết quả · ${learnerName}`} description={`Tổng số câu trong Package: ${items.length} | Đã hoàn thành: ${summaryMetrics.finalized}/${items.length}`} collapsible={false}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center"><div className="text-2xl font-bold text-red-500">{summaryMetrics.redCount}</div><div className="text-xs text-red-400 font-semibold">0 · Đỏ</div></div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center"><div className="text-2xl font-bold text-amber-500">{summaryMetrics.yellowCount}</div><div className="text-xs text-amber-400 font-semibold">1 · Vàng</div></div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center"><div className="text-2xl font-bold text-emerald-500">{summaryMetrics.greenCount}</div><div className="text-xs text-emerald-400 font-semibold">2 · Xanh</div></div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center"><div className="text-2xl font-bold text-purple-500">{summaryMetrics.purpleCount}</div><div className="text-xs text-purple-400 font-semibold">3 · Tím</div></div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-900 p-4 text-xs font-mono text-white shadow-inner sm:grid-cols-5">
                <div><span className="text-slate-400">RFC </span><strong className="text-amber-400">{summaryMetrics.rfc}%</strong></div>
                <div><span className="text-slate-400">RAC </span><strong className="text-emerald-400">{summaryMetrics.rac}%</strong></div>
                <div><span className="text-slate-400">CPD min </span><strong className="text-indigo-300">{summaryMetrics.minCpd ?? '—'}</strong></div>
                <div><span className="text-slate-400">CPD max </span><strong className="text-indigo-300">{summaryMetrics.maxCpd ?? '—'}</strong></div>
                <div><span className="text-slate-400">CPD avg </span><strong className="text-indigo-300">{summaryMetrics.avgCpd || '—'}</strong></div>
              </div>

              <div className="space-y-2 pt-5">
                <h3 className="font-bold text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-indigo-500" /> CPD & result colors ({items.length} items)</h3>
                <div className="h-72 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const d = payload[0].payload
                        return <div className="p-3 rounded-lg bg-slate-900 text-white text-xs space-y-1 shadow-lg border border-slate-800"><div className="font-bold text-indigo-400">{d.label}: {d.prompt}</div><div>CPD: <strong>{d.cpd}</strong> (CVR {d.cvr} × CCI {d.cci})</div><div className="capitalize">Kết quả: <strong>{d.colorKey}</strong></div></div>
                      }} />
                      <Bar dataKey="cpd" radius={[4, 4, 0, 0]}>{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.hex} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button type="button" className="ghost flex-1 py-3" onClick={() => setIsSummaryShown(false)}>Quay lại chấm điểm</button>
                {isAllFinalized ? <button type="button" className="primary flex-1 py-3" onClick={() => void completeAll()}><CheckCircle2 className="h-5 w-5" /> Hoàn thành Run & Kết thúc</button> : null}
              </div>
            </Panel>
          </div>
        )}

        {message ? <p className="error-text text-sm p-2 text-center">{message}</p> : null}
      </main>
    </div>
  )
}

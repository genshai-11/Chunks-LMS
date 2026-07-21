import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  RotateCcw,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PageHeader } from '../../components/PageHeader'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { listActiveLearners } from '../../modules/roster/service'
import { listTestSections } from '../../lib/test-packages'
import {
  getStandaloneRun,
  getStandaloneRunRuntime,
  completeStandaloneRun,
  listStandaloneRunItems,
  listStandaloneRuns,
  listStandaloneAssignments,
  prepareStandaloneRun,
  startStandaloneRun,
  recordStandaloneResult,
  type StandaloneTestRunRow,
} from '../../lib/standalone-tests'
import { getNarrationPlaybackUrl } from '../../modules/catalog/live-test-generation'
import { triggerConfetti } from '../../lib/confetti'
import { useAppState } from '../../state/useAppState'

type AudioState = 'idle' | 'loading' | 'ready' | 'playing' | 'played' | 'error'
type ResultColor = 'red' | 'yellow' | 'green' | 'purple'
type ReactionKind = 'celebrate' | 'happy' | 'fight'
type Reaction = { kind: ReactionKind; color: ResultColor; id: number } | null

function reactionFor(color: ResultColor): ReactionKind {
  if (color === 'purple') return 'celebrate'
  if (color === 'green') return 'happy'
  return 'fight'
}

const COLORS: Array<{ key: ResultColor; label: string; num: string; hex: string }> = [
  { key: 'red', label: 'Red', num: '0', hex: '#ef4444' },
  { key: 'yellow', label: 'Yellow', num: '1', hex: '#eab308' },
  { key: 'green', label: 'Green', num: '2', hex: '#22c55e' },
  { key: 'purple', label: 'Purple', num: '3', hex: '#a855f7' },
]

function getItemColor(item: any): ResultColor | null {
  const snap = item?.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots
  return (snap?.effective_color as ResultColor) ?? null
}

export function TeacherTestRunPage() {
  const { runId } = useParams()
  const [searchParams] = useSearchParams()
  const assignmentIdParam = searchParams.get('assignmentId')
  const navigate = useNavigate()
  const { roster } = useAppState()

  const [runDetails, setRunDetails] = useState<StandaloneTestRunRow | null>(null)
  const [allRuns, setAllRuns] = useState<StandaloneTestRunRow[]>([])
  const [items, setItems] = useState<Array<any>>([])
  const [introVariantId, setIntroVariantId] = useState<string | null>(null)
  const [isSummaryShown, setIsSummaryShown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [audioUrl, setAudioUrl] = useState('')
  const [audioState, setAudioState] = useState<AudioState>('idle')
  const [reaction, setReaction] = useState<Reaction>(null)
  const [message, setMessage] = useState('')

  // Reaction trigger
  const playReaction = useCallback((color: ResultColor) => {
    const id = Date.now()
    setReaction({ kind: reactionFor(color), color, id })
    window.setTimeout(() => setReaction((current) => (current?.id === id ? null : current)), 1200)
  }, [])

  // Load full package runs & items across all package sections
  const load = useCallback(async () => {
    if (!runId) return
    const primaryRunResult = await getStandaloneRun(runId)
    if (!primaryRunResult.ok || !primaryRunResult.data) {
      return setMessage(primaryRunResult.ok ? 'Run not found' : primaryRunResult.error)
    }
    const currentRun = primaryRunResult.data
    setRunDetails(currentRun)

    const assignmentId = assignmentIdParam || currentRun.assignmentId
    let targetRuns: StandaloneTestRunRow[] = [currentRun]

    if (assignmentId) {
      // Auto-prepare missing package sections so full package (e.g. 80 items) is loaded
      const assignmentRes = await listStandaloneAssignments()
      if (assignmentRes.ok) {
        const assignment = assignmentRes.data.find((a) => a.id === assignmentId)
        if (assignment) {
          const sectionsRes = await listTestSections(assignment.packageVersionId)
          if (sectionsRes.ok && sectionsRes.data.length > 0) {
            const existingRunsRes = await listStandaloneRuns(assignmentId)
            const existingRuns = existingRunsRes.ok ? existingRunsRes.data : []
            const existingSectionIds = new Set(existingRuns.map((r) => r.testSectionId))

            for (const sec of sectionsRes.data) {
              if (!existingSectionIds.has(sec.id)) {
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
      }

      // Re-fetch all runs for assignment
      const runsResult = await listStandaloneRuns(assignmentId)
      if (runsResult.ok && runsResult.data.length > 0) {
        targetRuns = runsResult.data
      }
    }
    setAllRuns(targetRuns)

    const runtimeResult = await getStandaloneRunRuntime(currentRun.id)
    if (runtimeResult.ok && runtimeResult.data.introNarrationVariantId) {
      setIntroVariantId(runtimeResult.data.introNarrationVariantId)
    }

    // Load items for all runs in assignment
    const itemPromises = targetRuns.map((r) => listStandaloneRunItems(r.id))
    const itemResults = await Promise.all(itemPromises)

    let globalItemIndex = 1
    const combinedItems: Array<any> = []

    for (let i = 0; i < targetRuns.length; i++) {
      const runItemRes = itemResults[i]
      if (runItemRes?.ok) {
        for (const item of runItemRes.data) {
          combinedItems.push({
            ...item,
            global_item_order: globalItemIndex++,
            parent_run_id: targetRuns[i].id,
            session_number: targetRuns[i].sessionNumber,
            cvr: targetRuns[i].targetCvrOhm,
            cci: targetRuns[i].cciValue,
            cpd: targetRuns[i].itemCpd,
          })
        }
      }
    }

    setItems(combinedItems)

    // Find first unfinalized item
    const firstUnfinalized = combinedItems.findIndex((item) => {
      const status = (item as any).standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots?.status
      return !['finalized', 'corrected'].includes(status)
    })

    if (firstUnfinalized !== -1) {
      setSelectedIndex(firstUnfinalized)
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

  const completedCount = useMemo(
    () =>
      items.filter((item: any) =>
        ['finalized', 'corrected'].includes(
          item.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots?.status,
        ),
      ).length,
    [items],
  )

  const currentVariantId = currentItem?.narration_variant_id ?? introVariantId ?? null

  // Audio signed URL fetch
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

  function finishAudio() {
    setAudioState('played')
  }

  // Record rating & trigger reaction
  const handleRecord = useCallback(
    async (color: ResultColor) => {
      if (!currentItem) return
      playReaction(color)
      const result = await recordStandaloneResult(currentItem.id, color)
      if (!result.ok) return setMessage(result.error)

      // Reload item state
      await load()
    },
    [currentItem, load, playReaction],
  )

  // Keyboard shortcut listener (0, 1, 2, 3)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!currentItem) return
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      const found = COLORS.find((k) => k.num === e.key)
      if (found) {
        e.preventDefault()
        void handleRecord(found.key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentItem, handleRecord])

  // Complete all runs
  async function completeAll() {
    for (const r of allRuns) {
      await completeStandaloneRun(r.id)
    }
    navigate('/teacher/tests')
  }

  // Group items by session number for the rail
  const sessionsGrouped = useMemo(() => {
    const map = new Map<number, any[]>()
    for (const item of items) {
      const sNum = item.session_number || 1
      if (!map.has(sNum)) map.set(sNum, [])
      map.get(sNum)!.push(item)
    }
    return Array.from(map.entries()).map(([sessionNum, sItems]) => ({
      sessionNum,
      items: sItems,
    }))
  }, [items])

  // Result Summary Metrics Computation
  const summaryMetrics = useMemo(() => {
    const redCount = items.filter((i) => getItemColor(i) === 'red').length
    const yellowCount = items.filter((i) => getItemColor(i) === 'yellow').length
    const greenCount = items.filter((i) => getItemColor(i) === 'green').length
    const purpleCount = items.filter((i) => getItemColor(i) === 'purple').length
    const finalized = completedCount

    const rfc = finalized > 0 ? Math.round(((redCount + yellowCount) / finalized) * 100) : 0
    const rac = finalized > 0 ? Math.round(((greenCount + purpleCount) / finalized) * 100) : 0
    const avgCpd =
      items.length > 0
        ? Math.round(
            items.reduce((acc, i) => acc + (i.cpd || 0), 0) / items.length,
          )
        : 0

    return { redCount, yellowCount, greenCount, purpleCount, finalized, rfc, rac, avgCpd }
  }, [items, completedCount])

  // CPD Chart Data (computed for Finish Summary screen)
  const chartData = useMemo(() => {
    return items.map((item: any) => {
      const snap = item.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots
      const colorKey = snap?.effective_color as ResultColor | undefined
      const isFinalized = ['finalized', 'corrected'].includes(snap?.status)
      let hex = '#cbd5e1'
      if (isFinalized && colorKey) {
        hex = COLORS.find((r) => r.key === colorKey)?.hex ?? '#cbd5e1'
      }
      return {
        itemOrder: item.global_item_order,
        label: `Q${item.global_item_order}`,
        cpd: item.cpd ?? (item.cvr ?? 1) * (item.cci ?? 1),
        cvr: item.cvr ?? 0,
        cci: item.cci ?? 0,
        colorKey: isFinalized ? colorKey : 'pending',
        hex,
        prompt: item.prompt_text,
      }
    })
  }, [items])

  if (items.length === 0)
    return (
      <EmptyState icon={ClipboardCheck} title="Loading Full Package Items…" description={message} />
    )

  const activeLearners = listActiveLearners(roster)
  const learnerName =
    activeLearners.find((l: any) => l.id === runDetails?.learnerUserId)?.displayName ??
    'Learner'

  const isAllFinalized = completedCount === items.length
  const totalSessions = allRuns.length || 1
  const currentSessionNumber = currentItem?.session_number || 1

  return (
    <>
      <PageHeader
        icon={ClipboardCheck}
        kicker="Standalone Test Room 1–1"
        title={`Session ${currentSessionNumber} of ${totalSessions} · Question ${currentItem?.global_item_order ?? 1} of ${items.length}`}
        subtitle={`Learner: ${learnerName} · ${completedCount}/${items.length} Finalized · Lang: ${(runDetails?.promptLanguage ?? 'vi').toUpperCase()}`}
      />

      {/* Main Container matching Observe Room DOM & CSS styling */}
      <div
        className={`observe-root${reaction ? ` is-react-${reaction.kind} is-react-${reaction.color}` : ''}`}
      >
        <div className="observe-layout">
          {/* Left Rail: Session-Grouped Question Navigation */}
          <aside className="observe-rail max-h-[75vh] overflow-y-auto">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Package Questions ({completedCount}/{items.length})
              </span>
              <button
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                onClick={() => setIsSummaryShown((prev) => !prev)}
              >
                {isSummaryShown ? 'Quan sát' : 'Kết quả'}
              </button>
            </div>

            <div className="p-2 space-y-3">
              {sessionsGrouped.map(({ sessionNum, items: sessionItems }) => (
                <div key={sessionNum} className="space-y-1">
                  <div className="text-[11px] font-bold font-mono text-indigo-500 uppercase px-1 flex items-center justify-between">
                    <span>Session {sessionNum}</span>
                    <span className="text-[10px] text-slate-400">
                      {sessionItems.filter((i: any) => ['finalized', 'corrected'].includes(i.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots?.status)).length}/{sessionItems.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {sessionItems.map((item: any) => {
                      const idx = items.findIndex((i: any) => i.id === item.id)
                      const snap = item.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots
                      const colorKey = snap?.effective_color as ResultColor | undefined
                      const isFinalized = ['finalized', 'corrected'].includes(snap?.status)
                      const isSelected = idx === selectedIndex

                      let btnBg = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      if (isFinalized && colorKey) {
                        if (colorKey === 'red') btnBg = 'bg-red-500 text-white font-bold'
                        else if (colorKey === 'yellow') btnBg = 'bg-amber-500 text-slate-900 font-bold'
                        else if (colorKey === 'green') btnBg = 'bg-emerald-500 text-white font-bold'
                        else if (colorKey === 'purple') btnBg = 'bg-purple-600 text-white font-bold'
                      }

                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedIndex(idx)
                            setIsSummaryShown(false)
                          }}
                          className={`h-8 w-full rounded text-[11px] font-mono flex items-center justify-center transition-all ${btnBg} ${
                            isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 scale-105 shadow-md font-bold' : 'opacity-80 hover:opacity-100'
                          }`}
                          title={`Session ${sessionNum} · Item Q${item.global_item_order}: ${item.prompt_text}`}
                        >
                          {item.global_item_order}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Center Observe Stage */}
          <div className="observe-stage">
            {!isSummaryShown ? (
              <>
                <div className="observe-stage-hero">
                  <div className="observe-phone-avatar">
                    <UserAvatar name={learnerName} size="md" />
                  </div>
                  <p className="observe-day-line">
                    Session {currentSessionNumber} of {totalSessions}
                  </p>
                  <h1 className="observe-learner observe-learner-solo flex items-center justify-center gap-2">
                    <span>{learnerName}</span>
                    <button
                      className="text-xs bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 px-3 py-1 rounded-full font-mono font-bold flex items-center gap-1 transition"
                      onClick={() => setIsSummaryShown(true)}
                      title="Mở Màn hình Ghi nhận & Xem Kết quả"
                    >
                      <BarChart3 className="h-3.5 w-3.5" /> Ghi nhận Kết quả
                    </button>
                  </h1>

                  {/* Audio Prompt Card & Sentence */}
                  <div className="mt-3 rounded-2xl border border-indigo-300/20 bg-indigo-950/40 p-4 text-center shadow-lg w-full max-w-xl mx-auto">
                    <div className="flex items-center justify-between text-xs text-indigo-200 mb-2 font-mono">
                      <span className="flex items-center gap-1 font-bold">
                        <Volume2 className="h-4 w-4 animate-pulse text-indigo-400" />
                        Audio Prompt ({(runDetails?.promptLanguage ?? 'vi').toUpperCase()})
                      </span>
                      <span className="text-[10px] opacity-75 uppercase">{audioState}</span>
                    </div>

                    {audioUrl ? (
                      <audio
                        key={currentVariantId}
                        controls
                        autoPlay
                        src={audioUrl}
                        onPlay={() => setAudioState('playing')}
                        onEnded={finishAudio}
                        onError={() => setAudioState('error')}
                        className="w-full h-8 max-w-sm mx-auto my-1"
                      />
                    ) : null}

                    {audioState === 'error' ? (
                      <button
                        className="ghost text-xs text-rose-400 mt-1"
                        onClick={() => {
                          setAudioState('idle')
                          setAudioUrl('')
                          void getNarrationPlaybackUrl(currentVariantId)
                            .then((playback) => {
                              setAudioUrl(playback.signedUrl)
                              setAudioState('ready')
                            })
                            .catch((cause) =>
                              setMessage(cause instanceof Error ? cause.message : 'Playback failed'),
                            )
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Retry Audio
                      </button>
                    ) : null}

                    {/* Sentence Prompt Text */}
                    <p className="mt-2 text-xl font-bold text-white leading-relaxed">
                      "{currentItem?.prompt_text ?? 'Select a question'}"
                    </p>

                    {/* Metric Tokens (CVR, CCI, CPD) */}
                    {currentItem ? (
                      <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono">
                        <span className="px-2.5 py-1 rounded bg-indigo-900/60 text-indigo-200">
                          CVR {currentItem.cvr ?? '—'}
                        </span>
                        <span className="px-2.5 py-1 rounded bg-purple-900/60 text-purple-200">
                          CCI {currentItem.cci ?? '—'}
                        </span>
                        <span className="px-2.5 py-1 rounded bg-emerald-900/60 text-emerald-200 font-bold">
                          CPD {currentItem.cpd ?? '—'}
                        </span>
                      </div>
                    ) : null}

                    {/* Prev / Next Question Navigation Buttons */}
                    <div className="flex items-center justify-between text-xs pt-3 mt-2 border-t border-indigo-900/40">
                      <button
                        className="ghost text-xs text-slate-300 hover:text-white flex items-center gap-1"
                        disabled={selectedIndex === 0}
                        onClick={() => setSelectedIndex((prev) => Math.max(0, prev - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" /> Prev Q
                      </button>
                      <span className="font-mono text-slate-400">
                        Q{currentItem?.global_item_order ?? 1} of {items.length}
                      </span>
                      <button
                        className="ghost text-xs text-slate-300 hover:text-white flex items-center gap-1"
                        disabled={selectedIndex === items.length - 1}
                        onClick={() => setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1))}
                      >
                        Next Q <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Reaction Flash Symbol */}
                {reaction && reaction.kind === 'happy' ? (
                  <div key={reaction.id} className="observe-react observe-react-happy" aria-hidden>
                    <span className="observe-react-symbol"><Check aria-hidden /></span>
                    <span className="observe-react-label">Tập trung tốt!</span>
                    <Sparkles className="observe-react-sparkles" aria-hidden />
                    <span className="observe-react-burst" />
                  </div>
                ) : null}

                {/* OBSERVE DOCK 4 COLOR BUTTONS (0 Red, 1 Yellow, 2 Green, 3 Purple) - MATCHING OBSERVE ROOM */}
                <div className={`observe-dock observe-dock-lg${reaction ? ` is-glowing is-${reaction.color}` : ''}`}>
                  <div className="observe-dock-colors" role="group" aria-label="Result color">
                    {COLORS.map((c) => {
                      const snap = currentItem?.standalone_test_attempts?.[0]?.standalone_test_attempt_snapshots
                      const colorKey = snap?.effective_color as ResultColor | undefined
                      const isSelected = colorKey === c.key

                      return (
                        <button
                          key={c.key}
                          type="button"
                          className={`observe-dock-color is-${c.key}${isSelected ? ' is-selected' : ''}`}
                          onClick={() => void handleRecord(c.key)}
                          disabled={!currentItem}
                          aria-label={c.label}
                        >
                          <span className="observe-dock-num">{c.num}</span>
                          <span className="observe-dock-label">{c.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="observe-dock-tools observe-split-tools">
                    <span className="observe-dock-q" aria-live="polite">
                      Q{currentItem?.global_item_order ?? 1}/{items.length}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              /* MÀN HÌNH GHI NHẬN KẾT QUẢ & BIỂU ĐỒ CPD (Result Summary Screen) */
              <div className="space-y-6 p-4 max-w-3xl mx-auto">
                <Panel
                  icon={BarChart3}
                  title={`Màn hình Ghi nhận & Xem Kết quả · ${learnerName}`}
                  description={`Tổng số câu trong Package: ${items.length} | Đã hoàn thành: ${summaryMetrics.finalized}/${items.length}`}
                  collapsible={false}
                >
                  {/* Summary Metric Cards Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
                      <div className="text-2xl font-bold text-red-500">{summaryMetrics.redCount}</div>
                      <div className="text-xs text-red-400 font-semibold">0 · Đỏ (Cần hỗ trợ)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                      <div className="text-2xl font-bold text-amber-500">{summaryMetrics.yellowCount}</div>
                      <div className="text-xs text-amber-400 font-semibold">1 · Vàng (Gợi ý)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                      <div className="text-2xl font-bold text-emerald-500">{summaryMetrics.greenCount}</div>
                      <div className="text-xs text-emerald-400 font-semibold">2 · Xanh (Đạt)</div>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center">
                      <div className="text-2xl font-bold text-purple-500">{summaryMetrics.purpleCount}</div>
                      <div className="text-xs text-purple-400 font-semibold">3 · Tím (Xuất sắc)</div>
                    </div>
                  </div>

                  {/* Summary Performance Rates */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 text-white font-mono text-xs my-4 shadow-inner">
                    <div>
                      <span className="text-slate-400">RFC (Focus Rate): </span>
                      <strong className="text-amber-400">{summaryMetrics.rfc}%</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">RAC (Awareness Rate): </span>
                      <strong className="text-emerald-400">{summaryMetrics.rac}%</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Avg CPD Demand: </span>
                      <strong className="text-indigo-400">{summaryMetrics.avgCpd}</strong>
                    </div>
                  </div>

                  {/* Final CPD Progress Chart by Question */}
                  <div className="space-y-2 pt-2">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-indigo-500" />
                      Biểu đồ Đường cong CPD & Màu sắc Kết quả ({items.length} câu)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Giá trị CPD của từng câu hỏi được tô màu theo kết quả ghi nhận (0 Đỏ, 1 Vàng, 2 Xanh, 3 Tím).
                    </p>
                    <div className="h-72 w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} />
                          <YAxis stroke="#94a3b8" fontSize={11} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload
                              return (
                                <div className="p-3 rounded-lg bg-slate-900 text-white text-xs space-y-1 shadow-lg border border-slate-800">
                                  <div className="font-bold text-indigo-400">{d.label}: {d.prompt}</div>
                                  <div>CPD: <strong>{d.cpd}</strong> (CVR {d.cvr} × CCI {d.cci})</div>
                                  <div className="capitalize">Kết quả: <strong>{d.colorKey}</strong></div>
                                </div>
                              )
                            }}
                          />
                          <Bar dataKey="cpd" radius={[4, 4, 0, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.hex} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      className="ghost flex-1 py-3"
                      onClick={() => setIsSummaryShown(false)}
                    >
                      Quay lại Chấm điểm Quan sát
                    </button>
                    {isAllFinalized ? (
                      <button
                        className="primary flex-1 py-3"
                        onClick={() => void completeAll()}
                      >
                        <CheckCircle2 className="h-5 w-5" /> Hoàn thành Run & Kết thúc
                      </button>
                    ) : null}
                  </div>
                </Panel>
              </div>
            )}

            {message ? <p className="error-text text-sm p-2 text-center">{message}</p> : null}
          </div>
        </div>
      </div>
    </>
  )
}



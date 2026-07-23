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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  GripVertical,
  Keyboard,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { UserAvatar } from '../../components/UserAvatar'
import { EmptyState, Panel } from '../../components/ui'
import { PROBE_ACTIONS } from '../../modules/assessment/probe-actions'
import { listActiveLearners } from '../../modules/roster/service'
import { getTestPackageVersion, listTestSections } from '../../lib/test-packages'
import {
  completeStandaloneRun,
  findLatestApprovedNarrationVariant,
  getStandaloneRun,
  getStandaloneRunRuntime,
  listStandaloneAssignments,
  listStandaloneRunItems,
  listStandaloneRuns,
  prepareStandaloneRun,
  recordStandaloneResult,
  resolveStandaloneProbe,
  startStandaloneRun,
  stopStandaloneRun,
  type StandaloneTestRunRow,
} from '../../lib/standalone-tests'
import { getNarrationPlaybackUrl } from '../../modules/catalog/live-test-generation'
import { triggerConfetti } from '../../lib/confetti'
import { useAppState } from '../../state/useAppState'

type AudioState = 'idle' | 'loading' | 'ready' | 'playing' | 'played' | 'error'
type AudioTarget = 'item' | 'session_intro' | 'package_start' | 'part_intro_1' | 'part_intro_2' | 'package_end'
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
const AUDIO_AUTOPLAY_ITEMS_KEY = 'chunks-lms:live-test-autoplay-items'
const AUDIO_AUTOPLAY_INTRO_KEY = 'chunks-lms:live-test-autoplay-intro'
const AUDIO_AUTOPLAY_PACKAGE_START_KEY = 'chunks-lms:live-test-autoplay-package-start'
const AUDIO_AUTOPLAY_PART_INTRO_KEY = 'chunks-lms:live-test-autoplay-part-intro'
const AUDIO_AUTOPLAY_PACKAGE_END_KEY = 'chunks-lms:live-test-autoplay-package-end'
const AUDIO_STANDARD_FLOW_KEY = 'chunks-lms:live-test-standard-audio-flow-v1'
const AUDIO_RATE_KEY = 'chunks-lms:live-test-audio-rate'
const AUDIO_VOLUME_KEY = 'chunks-lms:live-test-audio-volume'
const AUDIO_PANEL_OPEN_KEY = 'chunks-lms:live-test-audio-panel-open'

function reactionFor(color: ResultColor): ReactionKind {
  if (color === 'purple') return 'celebrate'
  if (color === 'green') return 'happy'
  return 'fight'
}

function getItemAttempt(item: TestItem | null | undefined) {
  return item?.standalone_test_attempts?.[0] ?? null
}

function getItemSnapshot(item: TestItem | null | undefined) {
  return getItemAttempt(item)?.standalone_test_attempt_snapshots ?? null
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

function resultColorScore(color: ResultColor | null): number | null {
  if (!color) return null
  if (color === 'red') return 0
  if (color === 'yellow') return 1
  if (color === 'green') return 2
  return 3
}

function achievedCpdValue(item: TestItem | null | undefined): number | null {
  if (!isItemFinalized(item)) return null
  const baseCpd = cpdValue(item)
  if (baseCpd == null) return null
  const snapshot = getItemSnapshot(item)
  const storedScore = Number(snapshot?.effective_score ?? snapshot?.effectiveScore)
  const score = Number.isFinite(storedScore) ? storedScore : resultColorScore(getItemColor(item))
  return score == null ? null : Math.round(baseCpd * score * 100) / 100
}

function metricNumber(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatOhm(value: unknown): string {
  const n = metricNumber(value)
  return n == null ? '—' : `${n} Ω`
}

function formatAmp(value: unknown): string {
  const n = metricNumber(value)
  return n == null ? '—' : `${n}A`
}

function formatVolt(value: unknown): string {
  const n = metricNumber(value)
  return n == null ? '—' : `${Math.round(n * 100) / 100}V`
}

function formatVoltRange(min: unknown, max: unknown): string {
  const a = metricNumber(min)
  const b = metricNumber(max)
  if (a == null && b == null) return '—'
  if (a != null && b != null) return `${formatVolt(a)}–${formatVolt(b)}`
  return formatVolt(a ?? b)
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

function readSavedBoolean(key: string, fallback: boolean): boolean {
  try {
    const saved = window.localStorage.getItem(key)
    if (saved === 'true') return true
    if (saved === 'false') return false
  } catch {
    /* ignore */
  }
  return fallback
}

function clampAudioRate(value: number): number {
  return Math.min(3, Math.max(0.5, Number.isFinite(value) ? value : 1))
}

function readSavedNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const saved = Number(window.localStorage.getItem(key))
    if (Number.isFinite(saved)) return Math.min(max, Math.max(min, saved))
  } catch {
    /* ignore */
  }
  return fallback
}

function readSavedVolume(): number {
  const saved = readSavedNumber(AUDIO_VOLUME_KEY, 0.85, 0, 1)
  return saved <= 0 ? 0.85 : saved
}

function audibleVolume(value: number): number {
  return value <= 0 ? 0.85 : Math.min(1, Math.max(0.05, value))
}

function languageForSectionOrder(
  sectionOrder: number,
  fallback: 'vi' | 'en',
  languagePolicy?: unknown,
): 'vi' | 'en' {
  if (languagePolicy === 'alternating_vi_en') return sectionOrder % 2 === 1 ? 'vi' : 'en'
  if (languagePolicy === 'first4_en_last4_vi') return sectionOrder <= 4 ? 'en' : 'vi'
  return fallback
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
  const [sessionIntroVariantIds, setSessionIntroVariantIds] = useState<Record<number, string | null>>({})
  const [packageStartVariantId, setPackageStartVariantId] = useState<string | null>(null)
  const [partIntroVariantIds, setPartIntroVariantIds] = useState<Record<1 | 2, string | null>>({ 1: null, 2: null })
  const [packageEndVariantId, setPackageEndVariantId] = useState<string | null>(null)
  const [isSummaryShown, setIsSummaryShown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [audioLabel, setAudioLabel] = useState('Current item')
  const [audioState, setAudioState] = useState<AudioState>('idle')
  const [audioRate, setAudioRate] = useState(1)
  const [audioVolume, setAudioVolume] = useState(0.85)
  const [autoPlayItems, setAutoPlayItems] = useState(true)
  const [autoPlaySessionIntro, setAutoPlaySessionIntro] = useState(true)
  const [autoPlayPackageStart, setAutoPlayPackageStart] = useState(true)
  const [autoPlayPartIntro, setAutoPlayPartIntro] = useState(true)
  const [autoPlayPackageEnd, setAutoPlayPackageEnd] = useState(true)
  const [audioPanelOpen, setAudioPanelOpen] = useState(true)
  const [reaction, setReaction] = useState<Reaction>(null)
  const [message, setMessage] = useState('')
  const [showHeader, setShowHeader] = useState(false)
  const [showKeys, setShowKeys] = useState(false)
  const [mapOpen, setMapOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : true,
  )
  const [railWidth, setRailWidth] = useState(RAIL_DEFAULT)
  const [resizing, setResizing] = useState(false)
  const railWidthRef = useRef(railWidth)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeAudioUrlRef = useRef('')
  const itemPlaybackCacheRef = useRef<Record<string, { variantId: string; signedUrl: string }>>({})
  const audioTargetRef = useRef<AudioTarget>('item')
  const playFirstItemAfterIntroRef = useRef(false)
  const firstItemAfterIntroIndexRef = useRef<number | null>(null)
  const pendingFirstItemAudioIndexRef = useRef<number | null>(null)
  const pendingAfterEndNavigationRef = useRef<string | null>(null)
  const suppressNextItemEffectForIdRef = useRef<string | null>(null)
  const partIntroPlayedRef = useRef<Record<1 | 2, boolean>>({ 1: false, 2: false })
  const packageEndPlayedRef = useRef(false)

  useEffect(() => {
    setRailWidth(readSavedRailWidth())
    let forceStandardFlow = false
    try {
      forceStandardFlow = window.localStorage.getItem(AUDIO_STANDARD_FLOW_KEY) !== 'enabled'
      if (forceStandardFlow) {
        window.localStorage.setItem(AUDIO_STANDARD_FLOW_KEY, 'enabled')
        window.localStorage.setItem(AUDIO_AUTOPLAY_ITEMS_KEY, 'true')
        window.localStorage.setItem(AUDIO_AUTOPLAY_INTRO_KEY, 'true')
        window.localStorage.setItem(AUDIO_AUTOPLAY_PACKAGE_START_KEY, 'true')
        window.localStorage.setItem(AUDIO_AUTOPLAY_PART_INTRO_KEY, 'true')
        window.localStorage.setItem(AUDIO_AUTOPLAY_PACKAGE_END_KEY, 'true')
        window.localStorage.setItem(AUDIO_RATE_KEY, '1')
      }
    } catch {
      forceStandardFlow = true
    }
    setAutoPlayItems(forceStandardFlow ? true : readSavedBoolean(AUDIO_AUTOPLAY_ITEMS_KEY, true))
    setAutoPlaySessionIntro(forceStandardFlow ? true : readSavedBoolean(AUDIO_AUTOPLAY_INTRO_KEY, true))
    setAutoPlayPackageStart(forceStandardFlow ? true : readSavedBoolean(AUDIO_AUTOPLAY_PACKAGE_START_KEY, true))
    setAutoPlayPartIntro(forceStandardFlow ? true : readSavedBoolean(AUDIO_AUTOPLAY_PART_INTRO_KEY, true))
    setAutoPlayPackageEnd(forceStandardFlow ? true : readSavedBoolean(AUDIO_AUTOPLAY_PACKAGE_END_KEY, true))
    setAudioRate(clampAudioRate(forceStandardFlow ? 1 : readSavedNumber(AUDIO_RATE_KEY, 1, 0.5, 3)))
    setAudioVolume(readSavedVolume())
    setAudioPanelOpen(readSavedBoolean(AUDIO_PANEL_OPEN_KEY, true))
  }, [])

  useEffect(() => {
    railWidthRef.current = railWidth
  }, [railWidth])

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_AUTOPLAY_ITEMS_KEY, String(autoPlayItems))
    } catch {
      /* ignore */
    }
  }, [autoPlayItems])

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_AUTOPLAY_INTRO_KEY, String(autoPlaySessionIntro))
    } catch {
      /* ignore */
    }
  }, [autoPlaySessionIntro])

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_AUTOPLAY_PACKAGE_START_KEY, String(autoPlayPackageStart))
    } catch {
      /* ignore */
    }
  }, [autoPlayPackageStart])

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_AUTOPLAY_PART_INTRO_KEY, String(autoPlayPartIntro))
    } catch {
      /* ignore */
    }
  }, [autoPlayPartIntro])

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_AUTOPLAY_PACKAGE_END_KEY, String(autoPlayPackageEnd))
    } catch {
      /* ignore */
    }
  }, [autoPlayPackageEnd])

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_PANEL_OPEN_KEY, String(audioPanelOpen))
    } catch {
      /* ignore */
    }
  }, [audioPanelOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem(AUDIO_RATE_KEY, String(audioRate))
    } catch {
      /* ignore */
    }
  }, [audioRate])

  useEffect(() => {
    const nextVolume = audibleVolume(audioVolume)
    if (nextVolume !== audioVolume) {
      setAudioVolume(nextVolume)
      return
    }
    try {
      window.localStorage.setItem(AUDIO_VOLUME_KEY, String(nextVolume))
    } catch {
      /* ignore */
    }
  }, [audioVolume])

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

  const playReaction = useCallback((color: ResultColor, options: { sound?: boolean } = {}) => {
    const id = Date.now()
    setReaction({ kind: reactionFor(color), color, id })
    if (color === 'purple') {
      triggerConfetti()
    }

    if (options.sound !== false) {
      try {
        const audio = new Audio(`/audio/${color}.wav`)
        void audio.play().catch((err) => {
          console.warn('[live-test] reaction audio play failed:', err)
        })
      } catch (e) {
        console.warn('[live-test] reaction audio init failed:', e)
      }
    }

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
    let packageVersionId: string | null = null

    if (assignmentId) {
      const assignmentRes = await listStandaloneAssignments()
      if (assignmentRes.ok) {
        const assignment = assignmentRes.data.find((a) => a.id === assignmentId)
        if (assignment) {
          packageVersionId = assignment.packageVersionId
          const sectionsRes = await listTestSections(assignment.packageVersionId)
          const versionRes = await getTestPackageVersion(assignment.packageVersionId)
          const languagePolicy = versionRes.ok ? versionRes.data?.sourceMetadata?.languagePolicy : null
          const existingRunsRes = await listStandaloneRuns(assignmentId)
          const existingRuns = existingRunsRes.ok ? existingRunsRes.data : []
          const existingSectionIds = new Set(existingRuns.map((r) => r.testSectionId))
          if (sectionsRes.ok) {
            for (const sec of sectionsRes.data) {
              if (existingSectionIds.has(sec.id)) continue
              const prep = await prepareStandaloneRun(
                assignmentId,
                sec.id,
                languageForSectionOrder(sec.sectionOrder, currentRun.promptLanguage || 'vi', languagePolicy),
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

    if (packageVersionId) {
      const partOneLanguage = targetRuns.find((run) => run.sessionNumber === 1)?.promptLanguage ?? targetRuns[0]?.promptLanguage ?? currentRun.promptLanguage ?? 'vi'
      const partTwoLanguage = targetRuns.find((run) => run.sessionNumber === 5)?.promptLanguage ?? targetRuns[4]?.promptLanguage ?? partOneLanguage
      const [startAudio, partOneAudio, partTwoAudio, endAudio] = await Promise.all([
        findLatestApprovedNarrationVariant({
          target: 'package_start',
          packageVersionId,
          language: partOneLanguage,
        }),
        findLatestApprovedNarrationVariant({
          target: 'part_intro',
          packageVersionId,
          part: 1,
          language: partOneLanguage,
        }),
        findLatestApprovedNarrationVariant({
          target: 'part_intro',
          packageVersionId,
          part: 2,
          language: partTwoLanguage,
        }),
        findLatestApprovedNarrationVariant({
          target: 'package_end',
          packageVersionId,
          language: partTwoLanguage,
        }),
      ])
      setPackageStartVariantId(startAudio.ok && startAudio.data ? startAudio.data.id : null)
      setPartIntroVariantIds({
        1: partOneAudio.ok && partOneAudio.data ? partOneAudio.data.id : null,
        2: partTwoAudio.ok && partTwoAudio.data ? partTwoAudio.data.id : null,
      })
      setPackageEndVariantId(endAudio.ok && endAudio.data ? endAudio.data.id : null)
    } else {
      setPackageStartVariantId(null)
      setPartIntroVariantIds({ 1: null, 2: null })
      setPackageEndVariantId(null)
    }

    const runtimeResults = await Promise.all(targetRuns.map((r) => getStandaloneRunRuntime(r.id)))
    const latestIntroResults = await Promise.all(
      targetRuns.map((r) =>
        findLatestApprovedNarrationVariant({
          target: 'section_intro',
          language: r.promptLanguage,
          testSectionId: r.testSectionId,
        }),
      ),
    )
    const nextIntroBySession: Record<number, string | null> = {}
    runtimeResults.forEach((runtimeResult, index) => {
      const sessionNumber = targetRuns[index]?.sessionNumber ?? index + 1
      const latestIntro = latestIntroResults[index]
      nextIntroBySession[sessionNumber] = latestIntro?.ok && latestIntro.data
        ? latestIntro.data.id
        : runtimeResult.ok
          ? runtimeResult.data.introNarrationVariantId
          : null
    })
    setSessionIntroVariantIds(nextIntroBySession)
    setIntroVariantId(nextIntroBySession[currentRun.sessionNumber] ?? null)

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
          prompt_language: targetRuns[i]!.promptLanguage,
          voice_id: targetRuns[i]!.voiceId,
          test_section_id: targetRuns[i]!.testSectionId,
          prompt_vi: (item as any).test_items?.prompt_vi ?? (item as any).prompt_vi ?? null,
          prompt_en: (item as any).test_items?.prompt_en ?? (item as any).prompt_en ?? null,
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
    partIntroPlayedRef.current = { 1: false, 2: false }
    packageEndPlayedRef.current = false
    void load()
  }, [load])

  const currentItem = useMemo(() => items[selectedIndex] ?? null, [items, selectedIndex])
  const completedCount = useMemo(() => items.filter(isItemFinalized).length, [items])
  const currentAttempt = getItemAttempt(currentItem)
  const currentSnapshot = getItemSnapshot(currentItem)
  const probeOpen = currentSnapshot?.status === 'probe_open' || currentSnapshot?.status === 'resolution_required'
  const probeDepth = Number(currentSnapshot?.probe_count ?? currentSnapshot?.probeCount ?? 0)
  const currentSessionNumber = currentItem?.session_number || 1
  const currentItemNumber = currentItem?.global_item_order ?? selectedIndex + 1
  const currentItemLanguage = (currentItem?.prompt_language ?? runDetails?.promptLanguage ?? 'vi') as 'vi' | 'en'
  const currentPrimaryPrompt = currentItem?.prompt_text ?? 'Select a question'
  const alternatePrompt = currentItemLanguage === 'vi'
    ? currentItem?.prompt_en
    : currentItem?.prompt_vi
  const alternateLanguageLabel = currentItemLanguage === 'vi' ? 'EN' : 'VI'
  const currentSessionRun = allRuns.find((r) => r.sessionNumber === currentSessionNumber) ?? null
  const currentItemVariantId = currentItem?.narration_variant_id ?? null
  const currentSessionIntroVariantId = sessionIntroVariantIds[currentSessionNumber] ?? introVariantId ?? null
  const canPlayCurrentItemAudio = Boolean(currentItemVariantId || currentItem?.test_item_id)
  const canPlayCurrentSessionIntro = Boolean(currentSessionIntroVariantId || currentSessionRun?.testSectionId)
  const isFirstItemInSession = useMemo(
    () =>
      currentItem
        ? items.findIndex((item) => item.session_number === currentSessionNumber) === selectedIndex
        : false,
    [currentItem, currentSessionNumber, items, selectedIndex],
  )

  useEffect(() => {
    setShowHeader(false)
  }, [currentSessionNumber])

  const activateAudioUrl = useCallback((
    signedUrl: string,
    label: string,
    shouldPlay: boolean,
    target: AudioTarget,
  ) => {
    audioTargetRef.current = target
    setAudioLabel(label)
    setAudioState('ready')
    setMessage('')

    const audio = audioRef.current
    if (!audio) return
    const sourceChanged = activeAudioUrlRef.current !== signedUrl
    if (sourceChanged) {
      audio.pause()
      activeAudioUrlRef.current = signedUrl
      audio.src = signedUrl
      audio.load()
    } else {
      audio.pause()
      audio.currentTime = 0
    }
    const nextVolume = audibleVolume(audioVolume)
    audio.muted = false
    audio.volume = nextVolume
    audio.playbackRate = audioRate
    if (!shouldPlay) return
    void audio.play().catch(() => {
      setAudioState('ready')
      const pendingPath = pendingAfterEndNavigationRef.current
      pendingAfterEndNavigationRef.current = null
      if (target === 'package_end' && pendingPath) {
        setMessage('End audio was blocked by the browser. Opening analysis now.')
        navigate(pendingPath)
        return
      }
      setMessage('Autoplay was blocked by the browser. Press Play once to enable audio in this run.')
    })
  }, [audioRate, audioVolume, navigate])

  const loadAudioVariant = useCallback(async (
    variantId: string,
    label: string,
    shouldPlay = false,
    target: AudioTarget = 'item',
  ) => {
    setAudioLabel(label)
    setAudioState('loading')
    setMessage('')
    try {
      const playback = await getNarrationPlaybackUrl(variantId)
      activateAudioUrl(playback.signedUrl, label, shouldPlay, target)
    } catch (cause) {
      setAudioState('error')
      setMessage(cause instanceof Error ? cause.message : 'Audio playback failed')
    }
  }, [activateAudioUrl])

  const resolveCurrentItemAudioVariantId = useCallback(async () => {
    if (!currentItem?.test_item_id) return currentItemVariantId
    const latest = await findLatestApprovedNarrationVariant({
      target: 'test_item',
      language: currentItemLanguage,
      testItemId: String(currentItem.test_item_id),
    })
    if (latest.ok && latest.data?.id) return latest.data.id
    return currentItemVariantId
  }, [currentItem?.test_item_id, currentItemLanguage, currentItemVariantId])

  const resolveItemAudioVariantId = useCallback(async (item: TestItem | null | undefined) => {
    if (!item?.test_item_id) return item?.narration_variant_id ?? null
    const language = (item.prompt_language ?? runDetails?.promptLanguage ?? 'vi') as 'vi' | 'en'
    const latest = await findLatestApprovedNarrationVariant({
      target: 'test_item',
      language,
      testItemId: String(item.test_item_id),
    })
    if (latest.ok && latest.data?.id) return latest.data.id
    return item.narration_variant_id ?? null
  }, [runDetails?.promptLanguage])

  const primeItemPlaybackUrl = useCallback(async (item: TestItem | null | undefined) => {
    if (!item?.id) return null
    const cacheKey = String(item.id)
    const cached = itemPlaybackCacheRef.current[cacheKey]
    if (cached?.signedUrl) return cached
    const variantId = await resolveItemAudioVariantId(item)
    if (!variantId) return null
    const playback = await getNarrationPlaybackUrl(variantId)
    const next = { variantId, signedUrl: playback.signedUrl }
    itemPlaybackCacheRef.current[cacheKey] = next
    return next
  }, [resolveItemAudioVariantId])

  const resolveCurrentSessionIntroVariantId = useCallback(async () => {
    if (!currentSessionRun?.testSectionId) return currentSessionIntroVariantId
    const latest = await findLatestApprovedNarrationVariant({
      target: 'section_intro',
      language: currentSessionRun.promptLanguage,
      testSectionId: currentSessionRun.testSectionId,
    })
    if (latest.ok && latest.data?.id) return latest.data.id
    return currentSessionIntroVariantId
  }, [currentSessionIntroVariantId, currentSessionRun?.promptLanguage, currentSessionRun?.testSectionId])

  const playCurrentItemAudio = useCallback(
    async (shouldPlay = true) => {
      const cached = await primeItemPlaybackUrl(currentItem)
      const variantId = cached?.variantId ?? await resolveCurrentItemAudioVariantId()
      if (!variantId) {
        setMessage('No approved item audio is available for the current question/language.')
        return
      }
      playFirstItemAfterIntroRef.current = false
      if (cached?.signedUrl) {
        activateAudioUrl(cached.signedUrl, `Q${currentItemNumber} item`, shouldPlay, 'item')
        return
      }
      await loadAudioVariant(variantId, `Q${currentItemNumber} item`, shouldPlay, 'item')
    },
    [activateAudioUrl, currentItem, currentItemNumber, loadAudioVariant, primeItemPlaybackUrl, resolveCurrentItemAudioVariantId],
  )

  const playPackageStartAudio = useCallback(
    async (shouldPlay = true) => {
      if (!packageStartVariantId) {
        setMessage('No approved Test Start audio is available for this package/language.')
        return
      }
      playFirstItemAfterIntroRef.current = false
      await loadAudioVariant(packageStartVariantId, 'Test Start', shouldPlay, 'package_start')
    },
    [loadAudioVariant, packageStartVariantId],
  )

  const playPackageEndAudio = useCallback(
    async (shouldPlay = true) => {
      if (!packageEndVariantId) {
        setMessage('No approved Test End audio is available for this package/language.')
        return
      }
      packageEndPlayedRef.current = true
      playFirstItemAfterIntroRef.current = false
      await loadAudioVariant(packageEndVariantId, 'Test End', shouldPlay, 'package_end')
    },
    [loadAudioVariant, packageEndVariantId],
  )

  const playPartIntroAudio = useCallback(
    async (part: 1 | 2, shouldPlay = true) => {
      const variantId = partIntroVariantIds[part]
      if (!variantId) {
        setMessage(`No approved Part ${part === 1 ? 'I' : 'II'} intro audio is available for this package/language.`)
        return
      }
      partIntroPlayedRef.current[part] = true
      playFirstItemAfterIntroRef.current = false
      await loadAudioVariant(variantId, part === 1 ? 'Part I intro' : 'Part II intro', shouldPlay, part === 1 ? 'part_intro_1' : 'part_intro_2')
    },
    [loadAudioVariant, partIntroVariantIds],
  )

  const playEndAfterFinalScore = useCallback(async () => {
    setIsSummaryShown(true)
    if (!autoPlayPackageEnd || !packageEndVariantId || packageEndPlayedRef.current) return
    await playPackageEndAudio(true)
  }, [autoPlayPackageEnd, packageEndVariantId, playPackageEndAudio])

  const playCurrentSessionIntro = useCallback(
    async (shouldPlay = true, playFirstItemAfterIntro = true) => {
      const variantId = await resolveCurrentSessionIntroVariantId()
      if (!variantId) {
        setMessage('No approved session intro audio is available for the current session/language.')
        return
      }
      const firstItemIndex = items.findIndex((item) => item.session_number === currentSessionNumber)
      playFirstItemAfterIntroRef.current = playFirstItemAfterIntro && firstItemIndex >= 0
      firstItemAfterIntroIndexRef.current = playFirstItemAfterIntro && firstItemIndex >= 0 ? firstItemIndex : null
      await loadAudioVariant(variantId, `Session ${currentSessionNumber} intro`, shouldPlay, 'session_intro')
    },
    [currentSessionNumber, items, loadAudioVariant, resolveCurrentSessionIntroVariantId],
  )

  useEffect(() => {
    if (!packageStartVariantId || !autoPlayPackageStart) return
    if (!currentItem?.id || completedCount > 0 || currentSessionNumber !== 1 || !isFirstItemInSession) return
    if (audioTargetRef.current === 'package_start') return
    void playPackageStartAudio(true)
  }, [autoPlayPackageStart, completedCount, currentItem?.id, currentSessionNumber, isFirstItemInSession, packageStartVariantId, playPackageStartAudio])

  useEffect(() => {
    if (!currentItem?.id || !canPlayCurrentItemAudio) return
    if (suppressNextItemEffectForIdRef.current === String(currentItem.id)) {
      suppressNextItemEffectForIdRef.current = null
      return
    }
    if (pendingFirstItemAudioIndexRef.current === selectedIndex) return
    const deferForPackageStart = autoPlayPackageStart && currentSessionNumber === 1 && isFirstItemInSession && audioTargetRef.current !== 'package_start'
    const deferForPartIntro = autoPlayPartIntro && isFirstItemInSession && (
      (currentSessionNumber === 1 && !partIntroPlayedRef.current[1] && Boolean(partIntroVariantIds[1])) ||
      (currentSessionNumber === 5 && !partIntroPlayedRef.current[2] && Boolean(partIntroVariantIds[2]))
    )
    const deferForSessionIntro = autoPlaySessionIntro && canPlayCurrentSessionIntro && isFirstItemInSession
    if (deferForPackageStart || deferForPartIntro || deferForSessionIntro) return
    void playCurrentItemAudio(autoPlayItems)
  }, [
    autoPlayItems,
    autoPlayPackageStart,
    autoPlayPartIntro,
    autoPlaySessionIntro,
    canPlayCurrentItemAudio,
    canPlayCurrentSessionIntro,
    currentItem?.id,
    currentSessionNumber,
    isFirstItemInSession,
    partIntroVariantIds,
    playCurrentItemAudio,
    selectedIndex,
  ])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const nextVolume = audibleVolume(audioVolume)
    audio.muted = false
    audio.volume = nextVolume
    audio.playbackRate = audioRate
  }, [audioRate, audioVolume])

  useEffect(() => {
    if (!autoPlayPartIntro || !isFirstItemInSession) return
    if (currentSessionNumber === 1 && !autoPlayPackageStart && !partIntroPlayedRef.current[1] && partIntroVariantIds[1]) {
      void playPartIntroAudio(1, true)
      return
    }
    if (currentSessionNumber === 5 && !partIntroPlayedRef.current[2] && partIntroVariantIds[2]) {
      void playPartIntroAudio(2, true)
    }
  }, [autoPlayPackageStart, autoPlayPartIntro, currentSessionNumber, isFirstItemInSession, partIntroVariantIds, playPartIntroAudio])

  useEffect(() => {
    if (!autoPlaySessionIntro || !canPlayCurrentSessionIntro || !isFirstItemInSession) return
    if (autoPlayPartIntro && currentSessionNumber === 1 && !partIntroPlayedRef.current[1] && partIntroVariantIds[1]) return
    if (autoPlayPartIntro && currentSessionNumber === 5 && !partIntroPlayedRef.current[2] && partIntroVariantIds[2]) return
    void playCurrentSessionIntro(true, true)
  }, [autoPlayPartIntro, autoPlaySessionIntro, canPlayCurrentSessionIntro, currentSessionNumber, isFirstItemInSession, partIntroVariantIds, playCurrentSessionIntro])

  useEffect(() => {
    const nextIndex = items.findIndex((item, index) => index > selectedIndex && !isItemFinalized(item))
    const nextItem = nextIndex >= 0 ? items[nextIndex] : null
    if (!nextItem || nextItem.session_number !== currentItem?.session_number) return
    void primeItemPlaybackUrl(nextItem).catch(() => {
      /* best-effort prefetch */
    })
  }, [currentItem?.id, currentItem?.session_number, items, primeItemPlaybackUrl, selectedIndex])

  useEffect(() => {
    const targetIndex = pendingFirstItemAudioIndexRef.current
    if (targetIndex == null || selectedIndex !== targetIndex) return
    if (!currentItem?.id || !canPlayCurrentItemAudio) return
    pendingFirstItemAudioIndexRef.current = null
    void playCurrentItemAudio(true)
  }, [canPlayCurrentItemAudio, currentItem?.id, playCurrentItemAudio, selectedIndex])

  const playNextQuestionAudioUnderGesture = useCallback((): boolean => {
    if (!autoPlayItems || !currentItem || isItemFinalized(currentItem)) return false
    const nextIndex = items.findIndex((item, index) => index > selectedIndex && !isItemFinalized(item))
    if (nextIndex < 0) return false
    const nextItem = items[nextIndex]
    if (!nextItem || nextItem.session_number !== currentItem.session_number) return false

    setSelectedIndex(nextIndex)
    pendingFirstItemAudioIndexRef.current = null

    const cached = itemPlaybackCacheRef.current[String(nextItem.id)]
    if (!cached?.signedUrl) {
      void primeItemPlaybackUrl(nextItem).catch(() => {
        /* best-effort late prefetch */
      })
      setMessage('Next question audio is still preparing. Press Play if it does not start automatically.')
      return false
    }

    suppressNextItemEffectForIdRef.current = String(nextItem.id)
    const nextNumber = nextItem.global_item_order ?? nextIndex + 1
    activateAudioUrl(cached.signedUrl, `Q${nextNumber} item`, true, 'item')
    return true
  }, [activateAudioUrl, autoPlayItems, currentItem, items, primeItemPlaybackUrl, selectedIndex])

  const handleAudioEnded = useCallback(() => {
    setAudioState('played')
    if (audioTargetRef.current === 'package_end' && pendingAfterEndNavigationRef.current) {
      const pendingPath = pendingAfterEndNavigationRef.current
      pendingAfterEndNavigationRef.current = null
      navigate(pendingPath)
      return
    }
    if (audioTargetRef.current === 'package_start') {
      if (autoPlayPartIntro && partIntroVariantIds[1] && !partIntroPlayedRef.current[1]) {
        void playPartIntroAudio(1, true)
        return
      }
      if (autoPlaySessionIntro && canPlayCurrentSessionIntro) {
        void playCurrentSessionIntro(true, true)
        return
      }
    }
    if (audioTargetRef.current === 'part_intro_1' || audioTargetRef.current === 'part_intro_2') {
      if (autoPlaySessionIntro && canPlayCurrentSessionIntro) {
        void playCurrentSessionIntro(true, true)
        return
      }
      if (autoPlayItems && canPlayCurrentItemAudio) {
        void playCurrentItemAudio(true)
      }
      return
    }
    if (audioTargetRef.current !== 'session_intro' || !playFirstItemAfterIntroRef.current) return
    playFirstItemAfterIntroRef.current = false
    const firstItemIndex = firstItemAfterIntroIndexRef.current
    firstItemAfterIntroIndexRef.current = null
    if (firstItemIndex != null && firstItemIndex >= 0 && firstItemIndex !== selectedIndex) {
      pendingFirstItemAudioIndexRef.current = firstItemIndex
      setSelectedIndex(firstItemIndex)
      return
    }
    void playCurrentItemAudio(true)
  }, [autoPlayItems, autoPlayPartIntro, autoPlaySessionIntro, canPlayCurrentItemAudio, canPlayCurrentSessionIntro, navigate, partIntroVariantIds, playCurrentItemAudio, playCurrentSessionIntro, playPartIntroAudio, selectedIndex])

  const handleRecord = useCallback(
    async (color: ResultColor) => {
      if (!currentItem || probeOpen) return
      const isFinalOutstandingItem = !isItemFinalized(currentItem) && items.filter((item) => !isItemFinalized(item)).length === 1
      const nextAudioStarted = playNextQuestionAudioUnderGesture()
      playReaction(color, { sound: !nextAudioStarted })
      const result = await recordStandaloneResult(currentItem.id, color)
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      await load()
      if (isFinalOutstandingItem) await playEndAfterFinalScore()
    },
    [currentItem, items, load, playEndAfterFinalScore, playNextQuestionAudioUnderGesture, playReaction, probeOpen],
  )

  const handleProbe = useCallback(
    async (outcome: 'fail' | 'continue' | 'done') => {
      if (!currentAttempt?.id || !probeOpen) return
      const isFinalOutstandingItem = outcome !== 'continue' && currentItem && !isItemFinalized(currentItem) && items.filter((item) => !isItemFinalized(item)).length === 1
      const nextAudioStarted = outcome !== 'continue' ? playNextQuestionAudioUnderGesture() : false
      const result = await resolveStandaloneProbe(String(currentAttempt.id), outcome)
      if (!result.ok) {
        setMessage(result.error)
        return
      }
      if (outcome === 'continue') {
        setMessage(`Probe depth n=${result.data.probeCount}`)
      } else {
        playReaction(outcome === 'fail' ? 'yellow' : 'green', { sound: !nextAudioStarted })
        setMessage('')
      }
      await load()
      if (isFinalOutstandingItem) await playEndAfterFinalScore()
    },
    [currentAttempt?.id, currentItem, items, load, playEndAfterFinalScore, playNextQuestionAudioUnderGesture, playReaction, probeOpen],
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
      if (probeOpen) {
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault()
          void handleProbe('fail')
          return
        }
        if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'p') {
          e.preventDefault()
          void handleProbe('continue')
          return
        }
        if (e.key.toLowerCase() === 'd' || e.key === 'Enter') {
          e.preventDefault()
          void handleProbe('done')
          return
        }
      }
      const found = COLORS.find((k) => k.num === e.key)
      if (found) {
        e.preventDefault()
        void handleRecord(found.key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentItem, handleProbe, handleRecord, probeOpen])

  async function completeAll() {
    const assignmentId = assignmentIdParam || runDetails?.assignmentId
    for (const r of allRuns) {
      const result = await completeStandaloneRun(r.id)
      if (!result.ok) {
        setMessage(result.error)
        setIsSummaryShown(true)
        return
      }
    }
    const analysisPath = assignmentId ? `/teacher/tests/analysis/${assignmentId}` : '/teacher/tests'
    if (autoPlayPackageEnd && packageEndVariantId && !packageEndPlayedRef.current) {
      pendingAfterEndNavigationRef.current = analysisPath
      await playPackageEndAudio(true)
      return
    }
    navigate(analysisPath)
  }

  async function stopCurrentSessionAndOpenSummary() {
    if (!runId) return
    const assignmentId = assignmentIdParam || runDetails?.assignmentId
    if (completedCount === 0) {
      const proceed = window.confirm('No questions are finalized yet. Stop this session anyway and open analysis?')
      if (!proceed) return
    } else {
      const proceed = window.confirm(`Stop this session now? Analysis will include ${completedCount}/${items.length} finalized questions.`)
      if (!proceed) return
    }
    const result = await stopStandaloneRun(runId)
    if (!result.ok) {
      setMessage(result.error)
      setIsSummaryShown(true)
      return
    }
    navigate(assignmentId ? `/teacher/tests/analysis/${assignmentId}` : '/teacher/tests')
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
    const cpdValues = items.map(achievedCpdValue).filter((v): v is number => v !== null)
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
          cpd: achievedCpdValue(item) ?? 0,
          baseCpd: cpdValue(item) ?? 0,
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
      {!showHeader ? (
        <div
          className="observe-header-hover-zone"
          onMouseEnter={() => setShowHeader(true)}
          onFocus={() => setShowHeader(true)}
          role="button"
          tabIndex={0}
          aria-label="Show live test header"
        />
      ) : null}

      <header
        className={`observe-bar observe-bar-slim${showHeader ? '' : ' is-hidden'}`}
        onMouseLeave={() => setShowHeader(false)}
      >
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
          <button
            type="button"
            className="observe-nav-finish live-test-header-finish"
            onClick={() => (isAllFinalized ? void completeAll() : setIsSummaryShown(true))}
            title={isAllFinalized ? 'Finish Test / Complete Run' : 'Open summary before finishing'}
          >
            <CheckCircle2 aria-hidden strokeWidth={2.25} />
            <span className="observe-nav-finish-label">Finish Test</span>
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
              <div className="observe-meta-row live-test-rail-meta">
                <span className="observe-learner-rfc is-rfc">RFC {summaryMetrics.rfc}%</span>
                <span className="observe-learner-rfc is-percent-c">%c {summaryMetrics.rac}%</span>
                <span className="observe-learner-rfc is-cpd">Max CPD {formatVolt(summaryMetrics.maxCpd)}</span>
              </div>
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
                <span className="observe-heat-metric tabular">CPD <strong>{formatVoltRange(summaryMetrics.minCpd, summaryMetrics.maxCpd)}</strong></span>
                <span className="observe-heat-counts" aria-label="Color counts">
                  {COLORS.map((c) => (
                    <span key={c.key} className={`observe-heat-count is-${c.key}`} title={c.label}>
                      <i aria-hidden />
                      {summaryMetrics[`${c.key}Count` as keyof typeof summaryMetrics] as number}
                    </span>
                  ))}
                </span>
              </div>
              <div className="live-test-session-heatmap" aria-label="Package item heatmap grouped by session">
                {sessionsGrouped.map(({ sessionNum, items: sessionItems }) => {
                  const sessionDone = sessionItems.filter(isItemFinalized).length
                  const active = sessionNum === currentSessionNumber
                  const firstSessionIndex = items.findIndex((candidate) => candidate.session_number === sessionNum)
                  return (
                    <section key={sessionNum} className={`live-test-heat-session${active ? ' is-active' : ' is-collapsed'}`}>
                      <button
                        type="button"
                        className="live-test-heat-session-head"
                        onClick={() => {
                          if (firstSessionIndex >= 0) {
                            setSelectedIndex(firstSessionIndex)
                            setIsSummaryShown(false)
                          }
                        }}
                        aria-expanded={active}
                      >
                        <strong>Session {sessionNum}</strong>
                        <span>{sessionDone}/{sessionItems.length}</span>
                      </button>
                      {active ? (
                        <div className="live-test-heat-session-grid">
                          {sessionItems.map((item) => {
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
                          })}
                        </div>
                      ) : null}
                    </section>
                  )
                })}
              </div>

              <div className={`live-test-audio-panel${audioPanelOpen ? ' is-open' : ' is-collapsed'}`} aria-label="Audio controls">
                <button
                  type="button"
                  className="live-test-audio-head"
                  onClick={() => setAudioPanelOpen((value) => !value)}
                  aria-expanded={audioPanelOpen}
                >
                  <span><SlidersHorizontal className="h-3.5 w-3.5" /> Audio</span>
                  <strong>{audioState}</strong>
                  {audioPanelOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                <div className="live-test-audio-body" hidden={!audioPanelOpen}>
                    <audio
                      ref={audioRef}
                      id="live-test-current-audio"
                      controls
                      onPlay={() => setAudioState('playing')}
                      onEnded={handleAudioEnded}
                      onError={() => setAudioState('error')}
                      className="live-test-audio-el"
                    />
                    <p className="live-test-audio-label">{audioLabel}</p>
                    <div className="live-test-audio-actions">
                      <button type="button" onClick={() => void playPackageStartAudio(true)} disabled={!packageStartVariantId}>
                        Test Start
                      </button>
                      <button type="button" onClick={() => void playPartIntroAudio(1, true)} disabled={!partIntroVariantIds[1]}>
                        Part I
                      </button>
                      <button type="button" onClick={() => void playPartIntroAudio(2, true)} disabled={!partIntroVariantIds[2]}>
                        Part II
                      </button>
                      <button type="button" onClick={() => void playCurrentSessionIntro(true, true)} disabled={!canPlayCurrentSessionIntro}>
                        Session intro → Q1
                      </button>
                      <button type="button" onClick={() => void playCurrentItemAudio(true)} disabled={!canPlayCurrentItemAudio}>
                        Current Q
                      </button>
                      <button type="button" onClick={() => void playPackageEndAudio(true)} disabled={!packageEndVariantId}>
                        Test End
                      </button>
                    </div>
                    <label className="live-test-audio-toggle">
                      <input
                        type="checkbox"
                        checked={autoPlayItems}
                        onChange={(event) => setAutoPlayItems(event.target.checked)}
                      />
                      Auto-play next question
                    </label>
                    <label className="live-test-audio-toggle">
                      <input
                        type="checkbox"
                        checked={autoPlaySessionIntro}
                        onChange={(event) => setAutoPlaySessionIntro(event.target.checked)}
                      />
                      Auto-play session intro
                    </label>
                    <label className="live-test-audio-toggle">
                      <input
                        type="checkbox"
                        checked={autoPlayPackageStart}
                        onChange={(event) => setAutoPlayPackageStart(event.target.checked)}
                      />
                      Auto-play Test Start
                    </label>
                    <label className="live-test-audio-toggle">
                      <input
                        type="checkbox"
                        checked={autoPlayPartIntro}
                        onChange={(event) => setAutoPlayPartIntro(event.target.checked)}
                      />
                      Auto-play Part I/II intro
                    </label>
                    <label className="live-test-audio-toggle">
                      <input
                        type="checkbox"
                        checked={autoPlayPackageEnd}
                        onChange={(event) => setAutoPlayPackageEnd(event.target.checked)}
                      />
                      Play Test End before analysis
                    </label>
                    <div className="live-test-audio-grid">
                      <label>
                        Speed <span>{audioRate.toFixed(2)}×</span>
                        <select
                          value={[0.75, 1, 1.15, 1.25, 1.5, 1.75, 2].includes(audioRate) ? audioRate : 'custom'}
                          onChange={(event) => {
                            if (event.target.value === 'custom') return
                            setAudioRate(clampAudioRate(Number(event.target.value)))
                          }}
                        >
                          <option value={0.75}>0.75×</option>
                          <option value={1}>1× default</option>
                          <option value={1.15}>1.15×</option>
                          <option value={1.25}>1.25×</option>
                          <option value={1.5}>1.5×</option>
                          <option value={1.75}>1.75×</option>
                          <option value={2}>2×</option>
                          <option value="custom">Custom</option>
                        </select>
                        <input
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.05"
                          value={audioRate}
                          onChange={(event) => setAudioRate(clampAudioRate(Number(event.target.value)))}
                          aria-label="Custom audio speed"
                        />
                      </label>
                      <label>
                        Volume <span>{Math.round(audioVolume * 100)}%</span>
                        <input
                          type="range"
                          min="0.05"
                          max="1"
                          step="0.05"
                          value={audioVolume}
                          onChange={(event) => setAudioVolume(audibleVolume(Number(event.target.value)))}
                        />
                      </label>
                    </div>
                  </div>
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

      <main className="observe-stage observe-stage-tight live-test-stage">
        {!isSummaryShown ? (
          <>
            <div className="observe-stage-hero live-test-stage-hero">
              <div className="observe-phone-avatar"><UserAvatar name={learnerName} avatarUrl={learnerAvatarUrl} size="md" /></div>
              <h1 className="observe-learner observe-learner-solo live-test-learner-title">
                <span>{learnerName}</span>
                <button
                  type="button"
                  className="live-test-title-audio"
                  onClick={() => void playCurrentItemAudio(true)}
                  title="Play current item audio"
                  aria-label="Play current item audio"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
              </h1>

              {showKeys ? <p className="observe-depth-inline live-test-shortcuts">Shortcuts: 0 Red · 1 Yellow · 2 Green · 3 Purple · H map · ? keys</p> : null}
            </div>

            {reaction ? (
              <div key={reaction.id} className={`observe-react observe-react-${reaction.kind}`} aria-hidden>
                <span className="observe-react-symbol"><Check aria-hidden /></span>
                <span className="observe-react-label">{reaction.kind === 'celebrate' ? 'Xuất sắc!' : reaction.kind === 'happy' ? 'Tập trung tốt!' : 'Cần hỗ trợ'}</span>
                <Sparkles className="observe-react-sparkles" aria-hidden />
                <span className="observe-react-burst" />
              </div>
            ) : null}

            <div className={`observe-dock observe-dock-lg live-test-dock-compact${reaction ? ` is-glowing is-${reaction.color}` : ''}`}>
              {probeOpen ? (
                <div className="observe-dock-probe live-test-probe-dock" role="group" aria-label="Resolve probe">
                  <p className="live-test-probe-depth">n=<strong>{probeDepth}</strong></p>
                  {PROBE_ACTIONS.map((action) => (
                    <button
                      key={action.outcome}
                      type="button"
                      className={`observe-dock-probe-btn ${action.className}`}
                      onClick={() => void handleProbe(action.outcome)}
                      aria-label={`${action.label} probe`}
                    >
                      <span>{action.outcome === 'continue' ? 'Continue' : action.label}</span>
                      <kbd>{action.outcome === 'continue' ? 'C' : action.shortcut}</kbd>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="observe-dock-colors" role="group" aria-label="Result color">
                  {COLORS.map((c) => (
                    <button key={c.key} type="button" className={`observe-dock-color is-${c.key}${currentColor === c.key ? ' is-selected' : ''}`} onClick={() => void handleRecord(c.key)} disabled={!currentItem} title={`${c.num} · ${c.label}`}>
                      <span className="observe-dock-num">{c.num}</span>
                      <span className="observe-dock-label">{c.label}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="observe-dock-tools observe-split-tools">
                <p className="observe-day-line live-test-day-line">Session {currentSessionNumber} · Q{currentItemNumber}/{items.length} · {completedCount}/{items.length} finalized</p>
              </div>
            </div>

            <div className="live-test-focus-card">
              <div className="live-test-focus-actions">
                <button type="button" className="ghost" disabled={selectedIndex === 0} onClick={() => setSelectedIndex((prev) => Math.max(0, prev - 1))}>
                  <ChevronLeft className="h-4 w-4" /> Prev
                </button>
                <button
                  type="button"
                  className="live-test-wave-play"
                  onClick={() => void playCurrentItemAudio(true)}
                  aria-label={audioState === 'error' ? 'Retry current item audio' : 'Play current item audio'}
                >
                  {audioState === 'error' ? <RotateCcw className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  <span className="live-test-wave" aria-hidden><i /><i /><i /><i /></span>
                  <span>{audioState === 'error' ? 'Retry' : 'Play'}</span>
                </button>
                <button type="button" className="ghost" disabled={selectedIndex === items.length - 1} onClick={() => setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1))}>
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="live-test-prompt-box">
                <p>Item text · Q{currentItemNumber}</p>
                <strong>“{currentPrimaryPrompt}”</strong>
                {alternatePrompt ? (
                  <span className="live-test-prompt-subtitle">
                    {alternateLanguageLabel}: “{alternatePrompt}”
                  </span>
                ) : null}
              </div>

              <div className="live-test-cpd-row">
                <span className="metric-cvr">CVR {formatOhm(currentItem?.cvr)}</span>
                <span className="metric-cci">CCI {formatAmp(currentItem?.cci)}</span>
                <span className="is-strong metric-cpd">CPD {formatVolt(currentCpd)}</span>
                <span className="metric-cpd">Min {formatVolt(summaryMetrics.minCpd)}</span>
                <span className="metric-cpd">Max {formatVolt(summaryMetrics.maxCpd)}</span>
                <span className="metric-cpd">Avg {formatVolt(summaryMetrics.avgCpd)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="min-h-0 w-full max-w-4xl overflow-y-auto p-4">
            <Panel icon={BarChart3} title={`Màn hình Ghi nhận & Xem Kết quả · ${learnerName}`} description={`Tổng số câu trong Package: ${items.length} | Đã hoàn thành: ${summaryMetrics.finalized}/${items.length}`} collapsible={false}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center"><div className="text-2xl font-bold text-red-500">{summaryMetrics.redCount}</div><div className="text-xs text-red-400 font-semibold">0 · Red</div></div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center"><div className="text-2xl font-bold text-amber-500">{summaryMetrics.yellowCount}</div><div className="text-xs text-amber-400 font-semibold">1 · Yellow</div></div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center"><div className="text-2xl font-bold text-emerald-500">{summaryMetrics.greenCount}</div><div className="text-xs text-emerald-400 font-semibold">2 · Green</div></div>
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center"><div className="text-2xl font-bold text-purple-500">{summaryMetrics.purpleCount}</div><div className="text-xs text-purple-400 font-semibold">3 · Purple</div></div>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-900 p-4 text-xs font-mono text-white shadow-inner sm:grid-cols-5">
                <div><span className="text-slate-400">RFC </span><strong className="text-amber-400">{summaryMetrics.rfc}%</strong></div>
                <div><span className="text-slate-400">%c </span><strong className="text-emerald-400">{summaryMetrics.rac}%</strong></div>
                <div><span className="text-slate-400">CPD min </span><strong className="text-blue-300">{formatVolt(summaryMetrics.minCpd)}</strong></div>
                <div><span className="text-slate-400">CPD max </span><strong className="text-blue-300">{formatVolt(summaryMetrics.maxCpd)}</strong></div>
                <div><span className="text-slate-400">CPD avg </span><strong className="text-blue-300">{formatVolt(summaryMetrics.avgCpd)}</strong></div>
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
                        return <div className="p-3 rounded-lg bg-slate-900 text-white text-xs space-y-1 shadow-lg border border-slate-800"><div className="font-bold text-blue-400">{d.label}: {d.prompt}</div><div>Achieved CPD: <strong className="text-blue-300">{formatVolt(d.cpd)}</strong></div><div>Base: {formatVolt(d.baseCpd)} · CVR <span className="text-rose-300">{formatOhm(d.cvr)}</span> × CCI <span className="text-emerald-300">{formatAmp(d.cci)}</span></div><div className="capitalize">Result: <strong>{d.colorKey}</strong></div></div>
                      }} />
                      <Bar dataKey="cpd" radius={[4, 4, 0, 0]}>{chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.hex} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-6 sm:flex-row">
                <button type="button" className="ghost flex-1 py-3" onClick={() => setIsSummaryShown(false)}>Back to scoring</button>
                {isAllFinalized ? (
                  <button type="button" className="primary flex-1 py-3" onClick={() => void completeAll()}><CheckCircle2 className="h-5 w-5" /> Finish Run & Open Analysis</button>
                ) : (
                  <button type="button" className="primary flex-1 py-3" onClick={() => void stopCurrentSessionAndOpenSummary()}><CheckCircle2 className="h-5 w-5" /> Stop session & Summary</button>
                )}
              </div>
            </Panel>
          </div>
        )}

        {message ? <p className="error-text text-sm p-2 text-center">{message}</p> : null}
      </main>
    </div>
  )
}

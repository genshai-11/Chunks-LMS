import { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, Gauge, ListChecks, Pencil, Play, Plus, RefreshCw, Search, Trash2, Volume2, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import {
  generateNarration,
  generatePackageFromVocab,
  getNarrationPlaybackUrl,
  listFirestoreLessons,
  listTtsModels,
  type FirestoreLesson,
  type NarrationGenerationTarget,
} from '../../modules/catalog/live-test-generation'
import {
  createStandaloneAssignment,
  prepareStandaloneRun,
  startStandaloneRun,
} from '../../lib/standalone-tests'
import { useAppState } from '../../state/useAppState'
import { listActiveLearners } from '../../modules/roster/service'
import { getSupabase } from '../../lib/supabase'
import {
  createDraftTestItem,
  createDraftTestPackage,
  createDraftTestSection,
  deleteDraftTestItem,
  deleteDraftTestSection,
  getSectionSnapshot,
  getTestPackagePublicationReadiness,
  listCciCategories,
  listCciProfiles,
  listSectionNarrationReview,
  listTestItems,
  listTestPackages,
  listTestPackageVersions,
  listTestSections,
  publishTestPackageVersion,
  updateDraftTestItem,
  updateDraftTestSection,
  updateTestPackage,
  type NarrationReviewRecord,
  type TestPackagePublicationReadiness,
} from '../../lib/test-packages'
import {
  audioReadiness,
  audioTargetStatus,
  narrationSourceHash,
  resolveItemSpokenScript,
  resolveNarrationRecord,
  type AudioLanguage,
  type AudioTargetStatus,
} from '../../modules/catalog/spoken-scripts'
import type {
  CciCategory,
  CciProfile,
  SectionMeasurementSnapshot,
  TestItem,
  TestPackageVersion,
  TestSection,
} from '../../modules/catalog/test-package-catalog'

type PackageScope = {
  packageId: string
  packageTitle: string
  packageSlug?: string
  version: TestPackageVersion
}
type PackageCategoryFilter = 'all' | 'green' | 'red'
type ResourceTab = 'sessions' | 'items' | 'cci' | 'audio' | 'flow'

function isGreenPackage(scope: PackageScope): boolean {
  const title = (scope.packageTitle ?? '').toUpperCase()
  const slug = (scope.packageSlug ?? '').toLowerCase()
  return title.startsWith('G') || title.includes('GREEN') || slug.includes('green')
}

function isRedPackage(scope: PackageScope): boolean {
  const title = (scope.packageTitle ?? '').toUpperCase()
  const slug = (scope.packageSlug ?? '').toLowerCase()
  return title.startsWith('R') || title.includes('RED') || slug.includes('red')
}

function matchesPackageCategory(scope: PackageScope, filter: PackageCategoryFilter): boolean {
  if (filter === 'green') return isGreenPackage(scope)
  if (filter === 'red') return isRedPackage(scope)
  return true
}

function parseSsmlBreakTime(script: string | null | undefined): string | null {
  if (!script) return null
  const match = script.match(/<break[^>]*time=["']?(\d+(?:ms|s))["']?[^>]*\/?>/i)
  return match ? match[1] : null
}

function hasSsml(script: string | null | undefined): boolean {
  if (!script) return false
  return script.includes('<break') || script.includes('<speak')
}

function isRedMultiTermItem(item: TestItem, scope: PackageScope | null): boolean {
  if (item.spokenScriptEn?.includes('<break') || item.spokenScriptVi?.includes('<break')) {
    return true
  }
  const termEn = item.termEn?.trim() ?? ''
  if (termEn.includes(';') || termEn.includes('+') || (termEn.includes(',') && termEn.split(',').length > 1)) {
    return true
  }
  if (item.tl != null && item.tl >= 2) {
    return true
  }
  if (scope && isRedPackage(scope) && (termEn.length > 0 || (item.tl != null && item.tl >= 2))) {
    return true
  }
  return false
}

function computePackageCode(params: {
  testType: 'green' | 'red'
  dayNumber: number
  questionCount: number
  targetVoltage: number
  topic?: string
}): string {
  const prefix = params.testType === 'green' ? 'G' : 'R'
  const dayStr = String(params.dayNumber).padStart(2, '0')
  const qStr = `${params.questionCount}Q`
  const vStr = `${params.targetVoltage}V`
  const topicClean = params.topic ? params.topic.trim().replace(/^[-_]+|[-_]+$/g, '') : ''
  const topicSegment = topicClean
    ? topicClean.toLowerCase().startsWith('topic')
      ? `-${topicClean.toLowerCase()}`
      : `-topic${topicClean.toLowerCase()}`
    : ''
  return `${prefix}${dayStr}-${qStr}${topicSegment}-${vStr}`
}

function metricOhm(value: number | null | undefined): string {
  return value == null ? '—' : `${value} Ω`
}

function metricAmp(value: number | null | undefined): string {
  return value == null ? '—' : `${value}A`
}

function metricVolt(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value * 100) / 100}V`
}
type ResourceLanguage = AudioLanguage | 'all'

export function AdminResourcesPage() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [scopes, setScopes] = useState<PackageScope[]>([])
  const [versionId, setVersionId] = useState('')
  const [sections, setSections] = useState<TestSection[]>([])
  const [selectedSectionId, setSelectedSectionId] = useState('')
  const [items, setItems] = useState<TestItem[]>([])
  const [snapshots, setSnapshots] = useState<Record<string, SectionMeasurementSnapshot | null>>({})
  const [profiles, setProfiles] = useState<CciProfile[]>([])
  const [categories, setCategories] = useState<CciCategory[]>([])
  const [activeTab, setActiveTab] = useState<ResourceTab>('sessions')
  const [search, setSearch] = useState('')
  const [sessionSearch, setSessionSearch] = useState('')
  const [sessionAudioFilter, setSessionAudioFilter] = useState<'all' | 'ready' | 'missing'>('all')
  const [language, setLanguage] = useState<AudioLanguage>('vi')
  const [resourceLanguage, setResourceLanguage] = useState<ResourceLanguage>('all')
  const [voiceId, setVoiceId] = useState('google/vi-VN-Neural2-A')
  const [publishVoiceVi, setPublishVoiceVi] = useState('google/vi-VN-Neural2-A')
  const [publishVoiceEn, setPublishVoiceEn] = useState('google/en-US-Journey-F')
  const [ttsModels, setTtsModels] = useState<Array<{ id: string; provider: string; label: string }>>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [previewingVoice, setPreviewingVoice] = useState(false)
  const [generatingItemId, setGeneratingItemId] = useState<string | null>(null)
  const [itemReviewRecords, setItemReviewRecords] = useState<Record<string, NarrationReviewRecord>>({})
  const [, setItemHashes] = useState<Record<string, string>>({})
  const [playingVariantId, setPlayingVariantId] = useState<string | null>(null)
  const [flowVariants, setFlowVariants] = useState<Record<string, any>>({})
  const [, setFlowLoading] = useState(false)
  const [generatingFlowTarget, setGeneratingFlowTarget] = useState<string | null>(null)
  const [flowScripts, setFlowScripts] = useState({
    package_start: '',
    part_intro_1: '',
    part_intro_2: '',
    part_intro_3: '',
    package_end: '',
  })
  const [publication, setPublication] = useState<TestPackagePublicationReadiness | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [audioStatuses, setAudioStatuses] = useState<AudioTargetStatus[]>([])
  const [showItemDetails, setShowItemDetails] = useState(false)
  const [packageCategory, setPackageCategory] = useState<PackageCategoryFilter>('all')
  const [showPackageBuilder, setShowPackageBuilder] = useState(false)
  const [packageBuilderMode, setPackageBuilderMode] = useState<'ai' | 'manual'>('ai')
  const [aiTestType, setAiTestType] = useState<'green' | 'red'>('green')
  const [lessons, setLessons] = useState<FirestoreLesson[]>([])
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [aiQuestionCount, setAiQuestionCount] = useState<21 | 42 | 49>(21)
  const [aiTargetVoltage, setAiTargetVoltage] = useState<number>(12)
  const [aiTopic, setAiTopic] = useState('')
  const [aiPackageTitle, setAiPackageTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [generatingPackage, setGeneratingPackage] = useState(false)
  const [packageEditTitle, setPackageEditTitle] = useState('')
  const [newPackageDraft, setNewPackageDraft] = useState({ title: '', version: 'v1', sessions: '8', items: '1' })
  const [showAddSession, setShowAddSession] = useState(false)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [sessionDraft, setSessionDraft] = useState({ title: '', targetCvr: '1' })
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [showAddItem, setShowAddItem] = useState(false)
  const [promptDraft, setPromptDraft] = useState({ vi: '', en: '' })
  const [newItemDraft, setNewItemDraft] = useState({ vi: '', en: '', tc: '', lc: '', tl: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { roster } = useAppState()
  const learners = listActiveLearners(roster)
  
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [simLearnerId, setSimLearnerId] = useState('')
  const [startingSim, setStartingSim] = useState(false)
  const [generatingSectionId, setGeneratingSectionId] = useState<string | null>(null)
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null)

  useEffect(() => {
    if (learners.length > 0 && !simLearnerId) {
      setSimLearnerId(learners[0].id)
    }
  }, [learners, simLearnerId])

  async function startSimulation() {
    if (!simLearnerId || !versionId || selectedSessionIds.length === 0) {
      setError('Please select a learner and at least one session.')
      return
    }
    setStartingSim(true)
    setError(null)
    setMessage(null)
    try {
      let firstRunId = ''
      for (const secId of selectedSessionIds) {
        // 1. Create assignment
        const assignResult = await createStandaloneAssignment(simLearnerId, versionId)
        if (!assignResult.ok) throw new Error(assignResult.error)
        const assignmentId = assignResult.data

        // 2. Prepare run (will auto-use selected language/voice)
        const prepResult = await prepareStandaloneRun(assignmentId, secId, language, voiceId)
        if (!prepResult.ok) throw new Error(prepResult.error)
        
        if (!prepResult.data.canStart) {
          const expectedItems = sectionItemCounts[secId] ?? 10
          throw new Error(`Session is not ready: requires approved intro + ${expectedItems} approved item audios. Current approved: ${prepResult.data.approvedItemAudioCount}/${expectedItems}. Please generate and approve audio first.`)
        }

        // 3. Start run
        const startResult = await startStandaloneRun(prepResult.data.runId, prepResult.data.readinessToken)
        if (!startResult.ok) throw new Error(startResult.error)
        
        if (!firstRunId) {
          firstRunId = prepResult.data.runId
        }
      }
      
      setMessage(`Successfully created simulation run(s) for ${selectedSessionIds.length} session(s).`)
      setSelectedSessionIds([])
      if (firstRunId) {
        window.location.href = `/teacher/test-runs/${firstRunId}`
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Simulation failed')
    } finally {
      setStartingSim(false)
    }
  }

  async function generateSessionAudio(secId: string) {
    if (!selectedScope) return
    setGeneratingSectionId(secId)
    setGenProgress({ done: 0, total: (sectionItemCounts[secId] ?? 0) + 1 })
    setError(null)
    setMessage(null)
    try {
      const section = sections.find((s) => s.id === secId)
      if (!section) throw new Error('Session not found')
      
      const itemResult = await listTestItems(secId)
      if (!itemResult.ok) throw new Error(itemResult.error)
      const secItems = itemResult.data
      const totalAudioTargets = secItems.length + 1

      let done = 0
      setGenProgress({ done, total: totalAudioTargets })
      await generateNarration({
        packageVersionId: selectedScope.version.id,
        target: 'section_intro',
        testSectionId: secId,
        language,
        voiceId,
      })
      done += 1
      setGenProgress({ done, total: totalAudioTargets })

      for (const item of secItems) {
        await generateNarration({
          packageVersionId: selectedScope.version.id,
          target: 'test_item',
          testItemId: item.id,
          language,
          voiceId,
        })
        done += 1
        setGenProgress({ done, total: totalAudioTargets })
      }

      setMessage(`Successfully generated ${totalAudioTargets} audio assets for Session ${section.sectionOrder} (${language.toUpperCase()})`)
      await loadPublicationReadiness()
      await loadSectionAudioReview()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Batch generation failed')
    } finally {
      setGeneratingSectionId(null)
      setGenProgress(null)
    }
  }

  const selectedScope = scopes.find((scope) => scope.version.id === versionId) ?? null
  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? null
  const isDraftVersion = selectedScope?.version.status === 'draft'
  const selectedSnapshot = selectedSection ? (snapshots[selectedSection.id] ?? null) : null

  useEffect(() => {
    setPackageEditTitle(selectedScope?.packageTitle ?? '')
  }, [selectedScope?.packageTitle])
  const selectedProfile = selectedSnapshot
    ? (profiles.find((profile) => profile.id === selectedSnapshot.cciProfileId) ?? null)
    : null

  const loadRoot = useCallback(async () => {
    setState('loading')
    setError(null)
    const packageResult = await listTestPackages()
    if (!packageResult.ok) {
      setState('error')
      setError(packageResult.error)
      return
    }
    const next: PackageScope[] = []
    for (const pkg of packageResult.data) {
      const versions = await listTestPackageVersions(pkg.id)
      if (!versions.ok) {
        setState('error')
        setError(versions.error)
        return
      }
      for (const version of versions.data)
        next.push({ packageId: pkg.id, packageTitle: pkg.title, packageSlug: pkg.slug, version })
    }
    next.sort(
      (a, b) =>
        Number(b.version.status === 'draft') - Number(a.version.status === 'draft') ||
        a.packageTitle.localeCompare(b.packageTitle),
    )
    setScopes(next)
    setVersionId((current) =>
      next.some((scope) => scope.version.id === current) ? current : (next[0]?.version.id ?? ''),
    )
    setState('ready')
  }, [])

  const filteredScopes = useMemo(() => {
    return scopes.filter((scope) => matchesPackageCategory(scope, packageCategory))
  }, [scopes, packageCategory])

  useEffect(() => {
    if (filteredScopes.length > 0 && !filteredScopes.some((s) => s.version.id === versionId)) {
      setVersionId(filteredScopes[0].version.id)
    }
  }, [filteredScopes, versionId])

  useEffect(() => {
    if (showPackageBuilder && lessons.length === 0 && !lessonsLoading) {
      let active = true
      setLessonsLoading(true)
      listFirestoreLessons()
        .then((data) => {
          if (!active) return
          setLessons(data)
          if (data.length > 0 && !selectedLessonId) {
            setSelectedLessonId(data[0].id)
          }
        })
        .catch((err) => {
          if (!active) return
          setError(err instanceof Error ? err.message : 'Could not load lessons')
        })
        .finally(() => {
          if (active) setLessonsLoading(false)
        })
      return () => {
        active = false
      }
    }
  }, [showPackageBuilder, lessons.length, lessonsLoading, selectedLessonId])

  useEffect(() => {
    if (!titleTouched) {
      const selectedLesson = lessons.find((l) => l.id === selectedLessonId)
      const day = selectedLesson?.dayNumber ?? 1
      setAiPackageTitle(
        computePackageCode({
          testType: aiTestType,
          dayNumber: day,
          questionCount: aiQuestionCount,
          targetVoltage: aiTargetVoltage,
          topic: aiTopic,
        }),
      )
    }
  }, [aiTestType, selectedLessonId, aiQuestionCount, aiTargetVoltage, aiTopic, lessons, titleTouched])

  async function handleAiGeneratePackage() {
    const selectedLesson = lessons.find((l) => l.id === selectedLessonId)
    if (!selectedLesson) {
      setError('Please select a lesson from Firestore vocabulary.')
      return
    }
    const finalTitle =
      aiPackageTitle.trim() ||
      computePackageCode({
        testType: aiTestType,
        dayNumber: selectedLesson.dayNumber,
        questionCount: aiQuestionCount,
        targetVoltage: aiTargetVoltage,
        topic: aiTopic,
      })

    setGeneratingPackage(true)
    setError(null)
    setMessage(null)

    try {
      const result = await generatePackageFromVocab({
        testType: aiTestType,
        lessonId: selectedLesson.id,
        lessonTitle: selectedLesson.lessonTitle,
        levelCode: selectedLesson.levelCode,
        dayNumber: selectedLesson.dayNumber,
        questionCount: aiQuestionCount,
        targetVoltage: aiTargetVoltage,
        title: finalTitle,
        topic: aiTopic.trim() || undefined,
      })

      await loadRoot()
      setVersionId(result.packageVersionId)
      setMessage(`Successfully created package "${result.title}" with ${result.itemsCount} generated items.`)
      setShowPackageBuilder(false)
      setActiveTab('items')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to generate package')
    } finally {
      setGeneratingPackage(false)
    }
  }

  useEffect(() => {
    void loadRoot()
  }, [loadRoot])

  useEffect(() => {
    if (!versionId) {
      setSections([])
      return
    }
    void (async () => {
      setError(null)
      const [sectionResult, profileResult] = await Promise.all([
        listTestSections(versionId),
        listCciProfiles(),
      ])
      if (!sectionResult.ok) return setError(sectionResult.error)
      if (!profileResult.ok) return setError(profileResult.error)
      setSections(sectionResult.data)
      setProfiles(profileResult.data)
      setSelectedSectionId((current) =>
        sectionResult.data.some((section) => section.id === current)
          ? current
          : (sectionResult.data[0]?.id ?? ''),
      )
      const snapshotEntries = await Promise.all(
        sectionResult.data.map(async (section) => {
          const result = await getSectionSnapshot(section.id)
          return [section.id, result.ok ? result.data : null] as const
        }),
      )
      setSnapshots(Object.fromEntries(snapshotEntries))
      const profileIds = [
        ...new Set(snapshotEntries.map(([, snapshot]) => snapshot?.cciProfileId).filter(Boolean)),
      ] as string[]
      const categoryResults = await Promise.all(profileIds.map((id) => listCciCategories(id)))
      setCategories(categoryResults.flatMap((result) => (result.ok ? result.data : [])))
    })()
  }, [versionId])

  const loadItems = useCallback(async () => {
    if (!selectedSectionId) {
      setItems([])
      return
    }
    const result = await listTestItems(selectedSectionId)
    if (result.ok) setItems(result.data)
    else setError(result.error)
  }, [selectedSectionId])
  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const loadSectionAudioReview = useCallback(async () => {
    if (!selectedSection || !selectedScope) {
      setAudioStatuses(Array((items.length || 10) + 1).fill('missing'))
      setItemReviewRecords({})
      setItemHashes({})
      return
    }
    const review = await listSectionNarrationReview({
      packageVersionId: selectedScope.version.id,
      sectionId: selectedSection.id,
      itemIds: items.map((item) => item.id),
      language,
      voiceId,
    })
    if (!review.ok) {
      setError(review.error)
      return
    }
    const introText =
      language === 'vi' ? selectedSection.introTextVi : selectedSection.introTextEn
    const introHash = introText
      ? await narrationSourceHash(introText, language, voiceId)
      : undefined
    const introKey = `section:${selectedSection.id}`
    const statuses = [
      audioTargetStatus(resolveNarrationRecord(review.data, introKey, introHash), introHash),
    ]
    const itemRecs: Record<string, NarrationReviewRecord> = {}
    const nextHashes: Record<string, string> = {}
    for (const item of items) {
      const prompt = language === 'vi' ? item.promptVi : item.promptEn
      const override = language === 'vi' ? item.spokenScriptVi : item.spokenScriptEn
      const script = prompt
        ? resolveItemSpokenScript({ itemOrder: item.itemOrder, prompt, language, override })
        : ''
      const hash = script ? await narrationSourceHash(script, language, voiceId) : undefined
      if (hash) nextHashes[item.id] = hash
      const itemKey = `item:${item.id}`
      const rec = resolveNarrationRecord(review.data, itemKey, hash)
      if (rec) itemRecs[item.id] = rec
      statuses.push(audioTargetStatus(rec, hash))
    }
    setAudioStatuses(statuses)
    setItemReviewRecords(itemRecs)
    setItemHashes(nextHashes)
  }, [items, language, selectedScope, selectedSection, voiceId])

  useEffect(() => {
    void loadSectionAudioReview()
  }, [loadSectionAudioReview])

  useEffect(() => {
    let active = true
    setModelsLoading(true)
    void listTtsModels(language)
      .then((res) => {
        if (!active) return
        setTtsModels(res.models)
        setVoiceId((current) => {
          if (res.models.some((m) => m.id === current)) return current
          const needle = language === 'vi' ? 'vi-' : 'en-'
          return (
            res.models.find((m) => m.id.toLowerCase().includes(needle))?.id ??
            res.models.find((m) => m.id.toLowerCase().includes('multilingual'))?.id ??
            res.models[0]?.id ??
            (language === 'vi' ? 'google/vi-VN-Neural2-A' : 'google/en-US-Journey-F')
          )
        })
      })
      .catch(() => {
        if (!active) return
        const fallbackModels =
          language === 'vi'
            ? [
                { id: 'google/vi-VN-Neural2-A', provider: 'google', label: 'Google vi-VN-Neural2-A (Female)' },
                { id: 'google/vi-VN-Neural2-D', provider: 'google', label: 'Google vi-VN-Neural2-D (Male)' },
                { id: 'google/vi-VN-Wavenet-A', provider: 'google', label: 'Google vi-VN-Wavenet-A (Female)' },
                { id: 'google/vi-VN-Wavenet-C', provider: 'google', label: 'Google vi-VN-Wavenet-C (Male)' },
              ]
            : [
                { id: 'google/en-US-Journey-F', provider: 'google', label: 'Google en-US-Journey-F (Female)' },
                { id: 'google/en-US-Journey-D', provider: 'google', label: 'Google en-US-Journey-D (Male)' },
                { id: 'google/en-US-Neural2-F', provider: 'google', label: 'Google en-US-Neural2-F (Female)' },
                { id: 'google/en-US-Neural2-J', provider: 'google', label: 'Google en-US-Neural2-J (Male)' },
              ]
        setTtsModels(fallbackModels)
      })
      .finally(() => {
        if (active) setModelsLoading(false)
      })
    return () => {
      active = false
    }
  }, [language])

  async function previewVoice(voiceToPreview: string, lang: 'vi' | 'en') {
    const sample =
      lang === 'vi'
        ? 'Xin chào, đây là giọng đọc chuẩn trên Chunks LMS.'
        : 'Hello, this is a sample voice on Chunks LMS.'
    setPreviewingVoice(true)
    setError(null)
    try {
      const apiKey =
        (import.meta as any).env?.VITE_GOOGLE_TTS_KEY ||
        (import.meta as any).env?.VITE_GOOGLE_CLOUD_TTS_API_KEY ||
        'AIzaSyD6j9s-rG4OXgDLmyeCM0KVOj0ErLD-3gQ'
      const cleanVoice = voiceToPreview.replace(/^(google|google-cloud)\//, '')
      const languageCode = lang === 'vi' ? 'vi-VN' : 'en-US'

      const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: sample },
          voice: { languageCode, name: cleanVoice },
          audioConfig: { audioEncoding: 'MP3' },
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.audioContent) {
          const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`)
          audio.onended = () => setPreviewingVoice(false)
          audio.onerror = () => setPreviewingVoice(false)
          await audio.play()
          return
        }
      }
    } catch {
      // Fallback to SpeechSynthesis
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(sample)
      utterance.lang = lang === 'vi' ? 'vi-VN' : 'en-US'
      const voices = window.speechSynthesis.getVoices()
      const matched = voices.find((v) => v.lang.startsWith(lang))
      if (matched) utterance.voice = matched
      utterance.onend = () => setPreviewingVoice(false)
      utterance.onerror = () => setPreviewingVoice(false)
      window.speechSynthesis.speak(utterance)
    } else {
      setPreviewingVoice(false)
    }
  }

  async function playNarrationVariant(variantId: string) {
    setPlayingVariantId(variantId)
    setError(null)
    try {
      const playback = await getNarrationPlaybackUrl(variantId)
      const audio = new Audio(playback.signedUrl)
      audio.onended = () => setPlayingVariantId(null)
      audio.onerror = () => setPlayingVariantId(null)
      await audio.play()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Playback failed')
      setPlayingVariantId(null)
    }
  }

  async function generateSingleItemAudio(item: TestItem) {
    if (!selectedScope) return
    setGeneratingItemId(item.id)
    setError(null)
    try {
      const receipt = await generateNarration({
        packageVersionId: selectedScope.version.id,
        target: 'test_item',
        testItemId: item.id,
        language,
        voiceId,
      })
      if (receipt.status === 'failed') {
        throw new Error(receipt.errorMessage ?? `Generation failed for item #${item.itemOrder}`)
      }
      setMessage(`Generated audio for item #${item.itemOrder} (${language.toUpperCase()} · ${voiceId})`)
      await loadSectionAudioReview()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Item audio generation failed')
    } finally {
      setGeneratingItemId(null)
    }
  }

  useEffect(() => {
    const title = selectedScope?.packageTitle ?? 'Live Test'
    setFlowScripts({
      package_start:
        language === 'vi'
          ? `Bắt đầu bài kiểm tra ${title}. Hãy lắng nghe và trả lời từng câu.`
          : `Start the ${title} test. Listen carefully and answer each item.`,
      part_intro_1:
        language === 'vi'
          ? `Bắt đầu Phần 1 của bài kiểm tra ${title}.`
          : `Start Part 1 of the ${title} test.`,
      part_intro_2:
        language === 'vi'
          ? `Bắt đầu Phần 2 của bài kiểm tra ${title}.`
          : `Start Part 2 of the ${title} test.`,
      part_intro_3:
        language === 'vi'
          ? `Bắt đầu Phần 3 của bài kiểm tra ${title}.`
          : `Start Part 3 of the ${title} test.`,
      package_end:
        language === 'vi'
          ? `Kết thúc bài kiểm tra ${title}. Cảm ơn em đã hoàn thành phần kiểm tra.`
          : `End of the ${title} test. Thank you for completing the test.`,
    })
  }, [language, selectedScope?.packageTitle])

  const loadPackageFlowVariants = useCallback(async () => {
    if (!versionId) {
      setFlowVariants({})
      return
    }
    setFlowLoading(true)
    try {
      const sb = getSupabase()
      if (!sb) return
      const { data, error: vErr } = await sb
        .from('narration_variants')
        .select('*')
        .eq('package_version_id', versionId)
        .eq('language', language)
        .in('narration_target', ['package_start', 'part_intro', 'package_end'])
        .order('created_at', { ascending: false })

      if (vErr || !data) return

      const mapped: Record<string, any> = {}
      for (const row of (data as any[])) {
        let key = row.narration_target
        if (row.narration_target === 'part_intro') {
          const p = row.provider_metadata?.part ?? 1
          key = `part_intro_${p}`
        }
        if (!mapped[key]) {
          mapped[key] = row
        }
      }
      setFlowVariants(mapped)
    } finally {
      setFlowLoading(false)
    }
  }, [language, versionId])

  useEffect(() => {
    void loadPackageFlowVariants()
  }, [loadPackageFlowVariants])

  async function generateFlowAudio(targetKey: 'package_start' | 'part_intro_1' | 'part_intro_2' | 'part_intro_3' | 'package_end') {
    if (!selectedScope) return
    setGeneratingFlowTarget(targetKey)
    setError(null)
    try {
      let target: NarrationGenerationTarget = 'package_start'
      let part: number | undefined = undefined
      if (targetKey === 'package_start') target = 'package_start'
      else if (targetKey === 'package_end') target = 'package_end'
      else if (targetKey === 'part_intro_1') { target = 'part_intro'; part = 1 }
      else if (targetKey === 'part_intro_2') { target = 'part_intro'; part = 2 }
      else if (targetKey === 'part_intro_3') { target = 'part_intro'; part = 3 }

      const textOverride = flowScripts[targetKey]
      const receipt = await generateNarration({
        packageVersionId: selectedScope.version.id,
        target,
        part,
        textOverride,
        language,
        voiceId,
      })
      if (receipt.status === 'failed') {
        throw new Error(receipt.errorMessage ?? `Generation failed for ${targetKey}`)
      }

      if (part && receipt.narrationVariantId) {
        const sb = getSupabase() as any
        if (sb) {
          await sb
            .from('narration_variants')
            .update({ provider_metadata: { part } })
            .eq('id', receipt.narrationVariantId)
        }
      }

      setMessage(`Generated audio for ${targetKey.replace(/_/g, ' ')} (${language.toUpperCase()} · ${voiceId})`)
      await loadPackageFlowVariants()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Flow audio generation failed')
    } finally {
      setGeneratingFlowTarget(null)
    }
  }

  const [sectionsReadiness, setSectionsReadiness] = useState<Record<string, { vi: number; en: number }>>({})
  const [sectionItemCounts, setSectionItemCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!versionId) {
      setSectionsReadiness({})
      setSectionItemCounts({})
      return
    }
    let active = true
    void (async () => {
      const sb = getSupabase()
      if (!sb) return
      
      // 1. Fetch all items for the package version to map item -> section
      const { data: allItemsRaw, error: itemsError } = await sb
        .from('test_items')
        .select('id, section_id')
        .eq('package_version_id', versionId)
        
      if (itemsError || !allItemsRaw) return
      const allItems = allItemsRaw as Array<{ id: string; section_id: string | null }>
      
      // 2. Fetch all approved variants for the package version, regardless of voice/model.
      // The Sessions tab is a dataset/resource overview; model-specific readiness belongs in Audio Prep / Run setup.
      const { data: variantsRaw, error: variantsError } = await sb
        .from('narration_variants')
        .select('test_section_id, test_item_id, language')
        .eq('package_version_id', versionId)
        .eq('approval_status', 'approved')
        .not('audio_asset_id', 'is', null)
        
      if (variantsError || !variantsRaw || !active) return
      const variants = variantsRaw as Array<{ test_section_id: string | null; test_item_id: string | null; language: string }>

      const itemToSection = new Map<string, string>()
      const itemCountMap: Record<string, number> = {}
      for (const item of allItems) {
        if (item.section_id) {
          itemToSection.set(item.id, item.section_id)
          itemCountMap[item.section_id] = (itemCountMap[item.section_id] ?? 0) + 1
        }
      }

      const readinessMap: Record<string, { vi: number; en: number }> = {}
      for (const section of sections) {
        const secId = section.id
        
        // Count for VI
        const introVi = variants.some(v => v.test_section_id === secId && v.language === 'vi')
        const itemsVi = variants.filter(v => v.test_item_id && itemToSection.get(v.test_item_id) === secId && v.language === 'vi').length
        
        // Count for EN
        const introEn = variants.some(v => v.test_section_id === secId && v.language === 'en')
        const itemsEn = variants.filter(v => v.test_item_id && itemToSection.get(v.test_item_id) === secId && v.language === 'en').length

        readinessMap[secId] = {
          vi: (introVi ? 1 : 0) + itemsVi,
          en: (introEn ? 1 : 0) + itemsEn,
        }
      }
      
      if (active) {
        setSectionsReadiness(readinessMap)
        setSectionItemCounts(itemCountMap)
      }
    })()
    return () => {
      active = false
    }
  }, [versionId, sections])

  const loadPublicationReadiness = useCallback(async () => {
    if (!selectedScope) {
      setPublication(null)
      return
    }
    const result = await getTestPackagePublicationReadiness({
      packageVersionId: selectedScope.version.id,
      voiceVi: publishVoiceVi,
      voiceEn: publishVoiceEn,
    })
    if (result.ok) setPublication(result.data)
    else setError(result.error)
  }, [publishVoiceEn, publishVoiceVi, selectedScope])

  useEffect(() => {
    void loadPublicationReadiness()
  }, [loadPublicationReadiness])

  async function refreshSections(packageVersionId = versionId) {
    if (!packageVersionId) return
    const result = await listTestSections(packageVersionId)
    if (!result.ok) return setError(result.error)
    setSections(result.data)
    setSelectedSectionId((current) =>
      result.data.some((section) => section.id === current)
        ? current
        : (result.data[0]?.id ?? ''),
    )
  }

  async function savePackageName() {
    if (!selectedScope || !packageEditTitle.trim()) return
    const result = await updateTestPackage({ packageId: selectedScope.packageId, title: packageEditTitle.trim() })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setMessage('Package name updated.')
    await loadRoot()
  }

  async function createPackageDraft() {
    const category = categories[0]
    const profile = profiles.find((candidate) => candidate.id === category?.profileId) ?? profiles[0]
    if (!category || !profile) {
      setError('Create at least one CCI profile/category before building a package.')
      return
    }
    const sessionCount = Math.max(1, Number(newPackageDraft.sessions) || 8)
    const itemsPerSession = Math.max(1, Number(newPackageDraft.items) || 1)
    const sessions = Array.from({ length: sessionCount }, (_, index) => ({
      sectionOrder: index + 1,
      title: `Session ${index + 1}`,
      targetCvrOhm: 1,
      cciProfileId: profile.id,
      cciCategoryId: category.id,
      cciCategoryLabel: category.label,
      cciValue: category.value,
    }))
    const result = await createDraftTestPackage({
      title: newPackageDraft.title,
      versionLabel: newPackageDraft.version,
      sessionCount,
      itemsPerSession,
      sessions,
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setMessage('Draft package created.')
    setShowPackageBuilder(false)
    await loadRoot()
    setVersionId(result.data.version.id)
  }

  async function addDraftSession() {
    if (!selectedScope) return
    const category = categories[0]
    const profile = profiles.find((candidate) => candidate.id === category?.profileId) ?? profiles[0]
    if (!category || !profile) return setError('Missing CCI profile/category for new session.')
    const result = await createDraftTestSection({
      packageVersionId: selectedScope.version.id,
      title: sessionDraft.title.trim() || null,
      targetCvrOhm: Number(sessionDraft.targetCvr) || 1,
      cciProfileId: profile.id,
      cciCategoryId: category.id,
      cciCategoryLabel: category.label,
      cciValue: category.value,
    })
    if (!result.ok) return setError(result.error)
    setMessage('Session added.')
    setShowAddSession(false)
    setSessionDraft({ title: '', targetCvr: '1' })
    await refreshSections(selectedScope.version.id)
  }

  async function saveDraftSession(section: TestSection) {
    if (!selectedScope) return
    const result = await updateDraftTestSection({
      packageVersionId: selectedScope.version.id,
      sectionId: section.id,
      title: sessionDraft.title.trim() || null,
      sectionOrder: section.sectionOrder,
    })
    if (!result.ok) return setError(result.error)
    setMessage('Session updated.')
    setEditingSessionId(null)
    await refreshSections(selectedScope.version.id)
  }

  async function removeDraftSession(section: TestSection) {
    if (!selectedScope) return
    if (!window.confirm(`Delete Session ${section.sectionOrder} from this draft package?`)) return
    const result = await deleteDraftTestSection({ sectionId: section.id, packageVersionId: selectedScope.version.id })
    if (!result.ok) return setError(result.error)
    setMessage('Session deleted.')
    await refreshSections(selectedScope.version.id)
  }

  async function publishPackage() {
    if (!selectedScope || !publication?.canPublish) return
    if (!window.confirm('Publish this Package Version? Scripts and audio become immutable.')) return
    setPublishing(true)
    setError(null)
    const result = await publishTestPackageVersion({
      packageVersionId: selectedScope.version.id,
      voiceVi: publishVoiceVi,
      voiceEn: publishVoiceEn,
    })
    setPublishing(false)
    if (!result.ok) return setError(result.error)
    setMessage('Package Version published. It is now available in one-to-one Test setup.')
    await loadRoot()
  }

  const readiness = audioReadiness(audioStatuses)
  const totalItemCount = sections.reduce((sum, section) => sum + (sectionItemCounts[section.id] ?? 0), 0)
  const selectedSectionItemCount = selectedSectionId ? (sectionItemCounts[selectedSectionId] ?? items.length) : 0
  const selectedSectionAudioExpected = selectedSectionItemCount + 1
  const filteredSections = useMemo(() => {
    const needle = sessionSearch.trim().toLowerCase()
    return sections.filter((section) => {
      const snap = snapshots[section.id]
      const category = snap ? categories.find((c) => c.id === snap.cciCategoryId) : null
      const readinessForSection = sectionsReadiness[section.id] ?? { vi: 0, en: 0 }
      const expectedAudioCount = (sectionItemCounts[section.id] ?? 10) + 1
      const readyForFilter =
        resourceLanguage === 'all'
          ? readinessForSection.vi >= expectedAudioCount || readinessForSection.en >= expectedAudioCount
          : readinessForSection[resourceLanguage] >= expectedAudioCount
      if (sessionAudioFilter === 'ready' && !readyForFilter) return false
      if (sessionAudioFilter === 'missing' && readyForFilter) return false
      if (!needle) return true
      return `${section.sectionOrder} ${section.title ?? ''} ${snap?.cciCategoryLabel ?? ''} ${category?.description ?? ''}`
        .toLowerCase()
        .includes(needle)
    })
  }, [categories, resourceLanguage, sectionItemCounts, sections, sectionsReadiness, sessionAudioFilter, sessionSearch, snapshots])

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) =>
      `${item.itemOrder} ${item.promptVi ?? ''} ${item.promptEn ?? ''} ${item.termVi ?? ''} ${item.termEn ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [items, search])

  useEffect(() => {
    setSelectedItemIds((current) => current.filter((id) => items.some((item) => item.id === id)))
  }, [items])

  useEffect(() => {
    setSelectedItemIds([])
    setShowAddItem(false)
    setEditingItemId(null)
  }, [selectedSectionId])

  async function savePrompt(item: TestItem) {
    if (!selectedScope) return
    const result = await updateDraftTestItem({
      itemId: item.id,
      packageVersionId: selectedScope.version.id,
      promptVi: promptDraft.vi || null,
      promptEn: promptDraft.en || null,
      tc: item.tc,
      lc: item.lc,
      tl: item.tl,
    })
    if (!result.ok) return setError(result.error)
    setEditingItemId(null)
    setMessage(`Saved Item ${item.itemOrder}. Existing audio is now stale until regenerated.`)
    await loadItems()
  }

  async function addItemToSession() {
    if (!selectedScope || !selectedSectionId) return
    const result = await createDraftTestItem({
      packageVersionId: selectedScope.version.id,
      sectionId: selectedSectionId,
      promptVi: newItemDraft.vi.trim() || null,
      promptEn: newItemDraft.en.trim() || null,
      tc: newItemDraft.tc ? Number(newItemDraft.tc) : null,
      lc: newItemDraft.lc ? Number(newItemDraft.lc) : null,
      tl: newItemDraft.tl ? Number(newItemDraft.tl) : null,
    })
    if (!result.ok) return setError(result.error)
    setNewItemDraft({ vi: '', en: '', tc: '', lc: '', tl: '' })
    setShowAddItem(false)
    setMessage(`Added Item ${result.data.itemOrder}. Generate/approve audio before publishing or starting tests.`)
    await loadItems()
    await loadPublicationReadiness()
  }

  async function deleteSelectedItems() {
    if (!selectedScope || selectedItemIds.length === 0) return
    if (!window.confirm(`Delete ${selectedItemIds.length} item${selectedItemIds.length === 1 ? '' : 's'} from this draft session? Audio variants for deleted items will no longer be used.`)) return
    for (const itemId of selectedItemIds) {
      const result = await deleteDraftTestItem({ itemId, packageVersionId: selectedScope.version.id })
      if (!result.ok) return setError(result.error)
    }
    setMessage(`Deleted ${selectedItemIds.length} item${selectedItemIds.length === 1 ? '' : 's'} from Session ${selectedSection?.sectionOrder ?? '—'}.`)
    setSelectedItemIds([])
    await loadItems()
    await loadPublicationReadiness()
  }

  return (
    <>
      <PageHeader
        icon={Database}
        kicker="Admin"
        title="Test Resources"
        subtitle="Package-first workspace for Sessions, Items/CVR, CCI, and Audio preparation."
        actions={
          <button className="primary" onClick={() => void loadRoot()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />
      <Flash message={message} error={error} />
      {state === 'error' ? (
        <EmptyState
          icon={Database}
          title="Could not load resources"
          description={error ?? 'Unknown error'}
        />
      ) : null}
      {state !== 'error' ? (
        <>
          <Panel
            icon={Database}
            title="Package scope"
            description="Choose one immutable version; the workspace stays inside that package."
            collapsible={false}
          >
            {/* Package Category Filter */}
            <div className="flex flex-wrap items-center gap-2 mb-3 bg-slate-50 border border-slate-200/80 rounded-xl p-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1 pl-1">Category:</span>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[38px] ${
                  packageCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-3xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
                onClick={() => setPackageCategory('all')}
              >
                All Packages
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    packageCategory === 'all' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {scopes.length}
                </span>
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[38px] ${
                  packageCategory === 'green'
                    ? 'bg-emerald-700 text-white shadow-3xs'
                    : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50/60'
                }`}
                onClick={() => setPackageCategory('green')}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                Green Tests (Focus)
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    packageCategory === 'green' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {scopes.filter(isGreenPackage).length}
                </span>
              </button>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[38px] ${
                  packageCategory === 'red'
                    ? 'bg-red-700 text-white shadow-3xs'
                    : 'bg-white text-red-700 border border-red-200 hover:bg-red-50/60'
                }`}
                onClick={() => setPackageCategory('red')}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                Red Tests (Awareness)
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                    packageCategory === 'red' ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {scopes.filter(isRedPackage).length}
                </span>
              </button>
            </div>

            <div className="resource-scope-bar">
              <label className="field">
                Package / Version
                <select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
                  {filteredScopes.length === 0 ? (
                    <option value="">No packages in this category</option>
                  ) : (
                    filteredScopes.map((scope) => (
                      <option key={scope.version.id} value={scope.version.id}>
                        {scope.packageTitle} · {scope.version.versionLabel}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <div className="resource-scope-summary">
                <span
                  className={`badge ${selectedScope?.version.status === 'draft' ? 'experimental' : 'success'}`}
                >
                  {selectedScope?.version.status ?? '—'}
                </span>
                <strong>{sections.length} Sessions</strong>
                <span>{totalItemCount} items</span>
                <span>
                  Audio {readiness.approved}/{readiness.expected || selectedSectionAudioExpected || 0}
                </span>
              </div>
            </div>
            <div className="resource-item-create-card" style={{ marginTop: '0.75rem' }}>
              <div className="resource-dynamic-filters">
                <label className="field">
                  Package name
                  <input value={packageEditTitle} onChange={(event) => setPackageEditTitle(event.target.value)} />
                </label>
                <button className="ghost min-h-[44px]" disabled={!selectedScope || !packageEditTitle.trim()} onClick={() => void savePackageName()}>
                  Save package name
                </button>
                <button className="ghost min-h-[44px] flex items-center gap-1.5" onClick={() => setShowPackageBuilder((value) => !value)}>
                  <Plus className="h-4 w-4" /> New draft package
                </button>
              </div>
              {showPackageBuilder ? (
                <div className="mt-4 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-3xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div>
                      <h3 className="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
                        <WandSparkles className="w-4 h-4 text-indigo-600" />
                        Create New Test Package
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Build an AI-generated assessment from lesson chunks or scaffold a blank draft.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="ghost compact-action-btn text-slate-400 hover:text-slate-700"
                      onClick={() => setShowPackageBuilder(false)}
                      title="Close builder"
                      style={{ padding: '0.25rem 0.5rem' }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Mode Tab Switcher */}
                  <div className="flex items-center gap-2 mb-4 p-1 bg-slate-100/80 rounded-xl max-w-fit">
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                        packageBuilderMode === 'ai'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      onClick={() => setPackageBuilderMode('ai')}
                    >
                      <WandSparkles className="w-3.5 h-3.5 text-indigo-600" />
                      AI Generator (From Lesson Vocab)
                      <span className="text-[9px] font-bold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200/70 px-1.5 py-0.5 rounded-full">
                        Recommended
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer min-h-[38px] flex items-center gap-1.5 ${
                        packageBuilderMode === 'manual'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      onClick={() => setPackageBuilderMode('manual')}
                    >
                      <Plus className="w-3.5 h-3.5 text-slate-500" />
                      Manual Blank Draft
                    </button>
                  </div>

                  {/* AI Generator Tab */}
                  {packageBuilderMode === 'ai' ? (
                    <div className="space-y-4">
                      {/* Test Type Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          1. Test Type
                        </label>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div
                            className={`border-2 rounded-xl p-3.5 cursor-pointer transition-all ${
                              aiTestType === 'green'
                                ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-600'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                            onClick={() => {
                              setAiTestType('green')
                              if (aiTargetVoltage === 56) setAiTargetVoltage(12)
                            }}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <span className="font-display font-bold text-sm text-slate-900">Green Test (Focus)</span>
                              </div>
                              <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                G-Series
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Sentence-based, dynamic CVR difficulty A2→C1, TL=1.0. Fast assessment of focus & sentence fluid production.
                            </p>
                          </div>

                          <div
                            className={`border-2 rounded-xl p-3.5 cursor-pointer transition-all ${
                              aiTestType === 'red'
                                ? 'border-red-600 bg-red-50/40 ring-1 ring-red-600'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                            onClick={() => {
                              setAiTestType('red')
                              if (aiTargetVoltage === 12) setAiTargetVoltage(56)
                              if (aiQuestionCount === 21) setAiQuestionCount(42)
                            }}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                                <span className="font-display font-bold text-sm text-slate-900">Red Test (Awareness)</span>
                              </div>
                              <span className="font-mono text-[10px] font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded-md">
                                R-Series
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Multi-term combine, cognitive traps, TL≥2.0, SSML pause gaps. Measures cognitive resistance and split awareness.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Source Lesson & Question Scale */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            2. Source Lesson (Firestore Vocabulary)
                          </label>
                          {lessonsLoading ? (
                            <div className="flex items-center gap-2 text-xs text-slate-500 py-2.5 px-3 border border-slate-200 rounded-lg min-h-[44px]">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              <span>Loading lessons from Firestore...</span>
                            </div>
                          ) : (
                            <select
                              className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 cursor-pointer min-h-[44px]"
                              value={selectedLessonId}
                              onChange={(e) => setSelectedLessonId(e.target.value)}
                            >
                              {lessons.map((lesson) => (
                                <option key={lesson.id} value={lesson.id}>
                                  Level {lesson.levelCode} - Day {lesson.dayNumber} ({lesson.totalChunks} chunks) · {lesson.lessonTitle}
                                </option>
                              ))}
                            </select>
                          )}
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            Extracts vocabulary chunks to generate assessment items and distractors.
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            3. Question Count & Scale
                          </label>
                          <select
                            className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 cursor-pointer min-h-[44px]"
                            value={aiQuestionCount}
                            onChange={(e) => setAiQuestionCount(Number(e.target.value) as 21 | 42 | 49)}
                          >
                            <option value={21}>21Q (1-1 Fast Test)</option>
                            <option value={42}>42Q (2 Parts of 21)</option>
                            <option value={49}>49Q (7 Sessions Standard)</option>
                          </select>
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            Controls partition depth and assessment duration.
                          </span>
                        </div>
                      </div>

                      {/* Target Voltage & Topic Modifier */}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                            <span>4. Target Voltage / CPD</span>
                            <span className="font-mono text-[11px] text-slate-400 font-normal">
                              Default: {aiTestType === 'green' ? '12V' : '56V'}
                            </span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max="300"
                              className="w-full text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 min-h-[44px]"
                              value={aiTargetVoltage}
                              onChange={(e) => setAiTargetVoltage(Math.max(1, Number(e.target.value) || 1))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-slate-400">
                              Volts
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 mt-1 block">
                            CPD = CVR × CCI (Volts) - định lượng độ khó nhận thức.
                          </span>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            5. Topic Modifier (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. topic12, travel, food"
                            className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-indigo-500 min-h-[44px]"
                            value={aiTopic}
                            onChange={(e) => setAiTopic(e.target.value)}
                          />
                          <span className="text-[11px] text-slate-400 mt-1 block">
                            Optional modifier included in package code (e.g. R01-42Q-topic12-56V).
                          </span>
                        </div>
                      </div>

                      {/* Package Code / Title */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold text-slate-700">
                            6. Package Title / Code (Naming Convention)
                          </label>
                          {titleTouched ? (
                            <button
                              type="button"
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 underline font-semibold cursor-pointer"
                              onClick={() => {
                                setTitleTouched(false)
                                const selectedLesson = lessons.find((l) => l.id === selectedLessonId)
                                setAiPackageTitle(
                                  computePackageCode({
                                    testType: aiTestType,
                                    dayNumber: selectedLesson?.dayNumber ?? 1,
                                    questionCount: aiQuestionCount,
                                    targetVoltage: aiTargetVoltage,
                                    topic: aiTopic,
                                  }),
                                )
                              }}
                            >
                              Reset to suggested format
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Auto-suggested
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          className="w-full text-sm font-mono font-bold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 outline-none focus:border-indigo-500 min-h-[44px]"
                          value={aiPackageTitle}
                          onChange={(e) => {
                            setTitleTouched(true)
                            setAiPackageTitle(e.target.value)
                          }}
                        />
                        <span className="text-[11px] text-slate-500 mt-1 block">
                          Naming convention format: <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">R01-42Q-56V</code>, <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">G01-21Q-12V</code>, or <code className="font-mono text-slate-700 bg-slate-100 px-1 py-0.5 rounded">R01-42Q-topic12-56V</code>.
                        </span>
                      </div>

                      {/* Action Row */}
                      <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                        <button
                          type="button"
                          className="ghost min-h-[44px]"
                          onClick={() => setShowPackageBuilder(false)}
                          disabled={generatingPackage}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="primary flex items-center gap-2 min-h-[44px] px-5 font-display"
                          disabled={generatingPackage || !selectedLessonId}
                          onClick={() => void handleAiGeneratePackage()}
                        >
                          {generatingPackage ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Generating & Building Package...</span>
                            </>
                          ) : (
                            <>
                              <WandSparkles className="w-4 h-4" />
                              <span>Generate & Create Package</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Manual Blank Draft Tab */
                    <div className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <label className="field">
                          Title
                          <input
                            value={newPackageDraft.title}
                            onChange={(event) => setNewPackageDraft((current) => ({ ...current, title: event.target.value }))}
                            placeholder="e.g. CUSTOM-TEST-01"
                          />
                        </label>
                        <label className="field">
                          Version
                          <input
                            value={newPackageDraft.version}
                            onChange={(event) => setNewPackageDraft((current) => ({ ...current, version: event.target.value }))}
                          />
                        </label>
                        <label className="field">
                          Sessions
                          <input
                            type="number"
                            min="1"
                            value={newPackageDraft.sessions}
                            onChange={(event) => setNewPackageDraft((current) => ({ ...current, sessions: event.target.value }))}
                          />
                        </label>
                        <label className="field">
                          Placeholder items/session
                          <input
                            type="number"
                            min="1"
                            value={newPackageDraft.items}
                            onChange={(event) => setNewPackageDraft((current) => ({ ...current, items: event.target.value }))}
                          />
                        </label>
                      </div>
                      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          className="ghost min-h-[44px]"
                          onClick={() => setShowPackageBuilder(false)}
                        >
                          Cancel
                        </button>
                        <button
                          className="primary min-h-[44px] px-5"
                          disabled={!newPackageDraft.title.trim()}
                          onClick={() => void createPackageDraft()}
                        >
                          Create draft package
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <div className="resource-publication-gate">
              <div>
                <strong>
                  {selectedScope?.version.status === 'published'
                    ? 'Published · available for one-to-one Tests'
                    : 'Draft · editable before audio generation'}
                </strong>
                <div className="meta">
                  {selectedScope?.version.status === 'published'
                    ? 'Published Package Versions are immutable. Create a new draft to make changes.'
                    : `Publication requires all 8 Sessions ready (in either Vietnamese or English). VI ${publication?.readyVietnameseSections ?? 0}/8 · EN ${publication?.readyEnglishSections ?? 0}/8 · Ready ${publication?.readyEitherSections ?? 0}/8.`}
                </div>
              </div>
              {selectedScope?.version.status === 'draft' ? (
                <div className="resource-publication-actions">
                  <label className="field">
                    Vietnamese model
                    <input
                      value={publishVoiceVi}
                      onChange={(event) => setPublishVoiceVi(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    English model
                    <input
                      value={publishVoiceEn}
                      onChange={(event) => setPublishVoiceEn(event.target.value)}
                    />
                  </label>
                  <button className="ghost" onClick={() => void loadPublicationReadiness()}>
                    Check readiness
                  </button>
                  <button
                    className="primary"
                    disabled={!publication?.canPublish || publishing}
                    onClick={() => void publishPackage()}
                  >
                    {publishing ? 'Publishing…' : 'Publish for Tests 1-to-1'}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="resource-voice-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.625rem 1rem', background: 'var(--surface-subtle, #f8fafc)', border: '1px solid var(--line-subtle, #e2e8f0)', borderRadius: '0.5rem', margin: '0.75rem 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                <Volume2 className="h-4 w-4 text-indigo-600" />
                <span>TTS Voice:</span>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as AudioLanguage)}
                style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem' }}
                title="Target Audio Language"
              >
                <option value="vi">Vietnamese (VI)</option>
                <option value="en">English (EN)</option>
              </select>
              <select
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                disabled={modelsLoading}
                style={{ fontSize: '0.8125rem', padding: '0.25rem 0.5rem', minWidth: '220px' }}
                title="TTS Voice Model"
              >
                {ttsModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label || m.id}
                  </option>
                ))}
                {ttsModels.length === 0 ? <option value={voiceId}>{voiceId}</option> : null}
              </select>
              <button
                type="button"
                className="ghost"
                disabled={previewingVoice}
                onClick={() => void previewVoice(voiceId, language)}
                title="Nghe thử giọng đọc mẫu với model đã chọn"
                style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <Volume2 className={`h-3.5 w-3.5 ${previewingVoice ? 'text-indigo-600 animate-pulse' : ''}`} />
                <span>{previewingVoice ? 'Đang phát…' : 'Nghe thử model'}</span>
              </button>
            </div>
            <div className="resource-tabs">
              {(['sessions', 'items', 'cci', 'audio', 'flow'] as ResourceTab[]).map((tab) => (
                <button
                  key={tab}
                  className={activeTab === tab ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'items'
                    ? 'Items / CVR'
                    : tab === 'audio'
                      ? 'Audio Prep'
                      : tab === 'flow'
                        ? 'Package Flow Audio'
                        : tab[0].toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </Panel>
          {activeTab === 'sessions' ? (
            <Panel
              icon={ListChecks}
              title="Sessions"
              description="One row per test session; details no longer repeat package/version context."
              collapsible={false}
              actions={
                <div className="resource-dynamic-filters">
                  <label className="field-inline">
                    <Search className="h-4 w-4" />
                    <input
                      value={sessionSearch}
                      onChange={(event) => setSessionSearch(event.target.value)}
                      placeholder="Filter sessions…"
                    />
                  </label>
                  <select
                    value={resourceLanguage}
                    onChange={(e) => setResourceLanguage(e.target.value as ResourceLanguage)}
                    title="Display/filter language"
                  >
                    <option value="all">All languages</option>
                    <option value="vi">Vietnamese</option>
                    <option value="en">English</option>
                  </select>
                  <select value={sessionAudioFilter} onChange={(e) => setSessionAudioFilter(e.target.value as 'all' | 'ready' | 'missing')}>
                    <option value="all">All audio</option>
                    <option value="ready">Ready for selected language</option>
                    <option value="missing">Missing audio</option>
                  </select>
                  {isDraftVersion ? (
                    <button className="ghost" onClick={() => setShowAddSession((value) => !value)}>
                      <Plus className="h-4 w-4" /> Add session
                    </button>
                  ) : null}
                  <span className="meta">Showing {filteredSections.length}/{sections.length}. Audio badges count approved audio across any model.</span>
                </div>
              }
            >
              {selectedSessionIds.length > 0 ? (
                <div className="audio-batch-toolbar" style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <label className="field-inline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Learner:
                    <select value={simLearnerId} onChange={(e) => setSimLearnerId(e.target.value)}>
                      <option value="">Select Learner</option>
                      {learners.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary"
                    disabled={startingSim || !simLearnerId}
                    onClick={() => void startSimulation()}
                  >
                    {startingSim ? 'Starting Live Test Sim…' : `Start Live Test Sim (${selectedSessionIds.length})`}
                  </button>
                  <button className="ghost" onClick={() => setSelectedSessionIds([])}>
                    Cancel
                  </button>
                </div>
              ) : null}
              {showAddSession && isDraftVersion ? (
                <div className="resource-item-create-card" style={{ marginBottom: '1rem' }}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="field">
                      Session title
                      <input value={sessionDraft.title} onChange={(event) => setSessionDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Session title" />
                    </label>
                    <label className="field">
                      Target CVR (Ω)
                      <input type="number" step="0.01" value={sessionDraft.targetCvr} onChange={(event) => setSessionDraft((current) => ({ ...current, targetCvr: event.target.value }))} />
                    </label>
                    <button className="primary" onClick={() => void addDraftSession()}>
                      Add draft session
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="table-wrap compact-resource-table">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={filteredSections.length > 0 && filteredSections.every((section) => selectedSessionIds.includes(section.id))}
                          onChange={(e) =>
                            setSelectedSessionIds(e.target.checked ? filteredSections.map((s) => s.id) : [])
                          }
                        />
                      </th>
                      <th>Session</th>
                      <th>Measurement</th>
                      <th>CPD</th>
                      <th>Items</th>
                      <th>Audio (any model)</th>
                      <th>Batch Actions</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSections.map((section) => {
                      const snap = snapshots[section.id]
                      const category = snap
                        ? categories.find((c) => c.id === snap.cciCategoryId)
                        : null
                      const itemCount = sectionItemCounts[section.id] ?? 0
                      const expectedAudioCount = itemCount + 1
                      return (
                        <tr
                          key={section.id}
                          className={selectedSectionId === section.id ? 'is-selected' : undefined}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedSessionIds.includes(section.id)}
                              onChange={(e) =>
                                setSelectedSessionIds((current) =>
                                  e.target.checked
                                    ? [...new Set([...current, section.id])]
                                    : current.filter((id) => id !== section.id),
                                )
                              }
                            />
                          </td>
                          <td>
                            <strong>Session {section.sectionOrder}</strong>
                            {editingSessionId === section.id ? (
                              <input
                                value={sessionDraft.title}
                                onChange={(event) => setSessionDraft((current) => ({ ...current, title: event.target.value }))}
                                placeholder="Session title"
                              />
                            ) : (
                              <div className="meta">{section.title}</div>
                            )}
                          </td>
                          <td>
                            <span className="badge metric-cvr">CVR {metricOhm(snap?.targetCvrOhm)}</span>{' '}
                            <span className="badge metric-cci">CCI {metricAmp(snap?.cciValue)}</span>
                            <div className="meta">
                              {snap?.cciCategoryLabel ?? 'Unmapped'}
                              {category?.description ? ` · ${category.description}` : ''}
                            </div>
                          </td>
                          <td>
                            <strong>
                              {snap
                                ? metricVolt(snap.targetCvrOhm * snap.cciValue)
                                : '—'}
                            </strong>
                          </td>
                          <td>{itemCount}</td>
                          <td>
                            <div className="resource-audio-badges">
                              {resourceLanguage === 'all' || resourceLanguage === 'vi' ? (
                                <span
                                  className={`badge ${sectionsReadiness[section.id]?.vi === expectedAudioCount ? 'success' : 'experimental'}`}
                                  title="Approved Vietnamese audio across any voice/model"
                                >
                                  VI: {sectionsReadiness[section.id]?.vi ?? 0}/{expectedAudioCount}
                                </span>
                              ) : null}
                              {resourceLanguage === 'all' || resourceLanguage === 'en' ? (
                                <span
                                  className={`badge ${sectionsReadiness[section.id]?.en === expectedAudioCount ? 'success' : 'experimental'}`}
                                  title="Approved English audio across any voice/model"
                                >
                                  EN: {sectionsReadiness[section.id]?.en ?? 0}/{expectedAudioCount}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <button
                              className="ghost"
                              disabled={generatingSectionId !== null}
                              onClick={() => void generateSessionAudio(section.id)}
                            >
                              {generatingSectionId === section.id
                                ? `Generating ${genProgress?.done}/${genProgress?.total}…`
                                : 'Generate Audio'}
                            </button>
                          </td>
                          <td>
                            <div className="resource-row-actions">
                              <button
                                className="ghost"
                                onClick={() => {
                                  setSelectedSectionId(section.id)
                                  setActiveTab('items')
                                }}
                              >
                                Open
                              </button>
                              {isDraftVersion ? (
                                editingSessionId === section.id ? (
                                  <button className="primary" onClick={() => void saveDraftSession(section)}>Save</button>
                                ) : (
                                  <button
                                    className="ghost"
                                    onClick={() => {
                                      setEditingSessionId(section.id)
                                      setSessionDraft({ title: section.title ?? '', targetCvr: String(snap?.targetCvrOhm ?? 1) })
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" /> Edit
                                  </button>
                                )
                              ) : null}
                              {isDraftVersion ? (
                                <button className="ghost" onClick={() => void removeDraftSession(section)}>
                                  <Trash2 className="h-4 w-4" /> Delete
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
          {activeTab === 'items' ? (
            <Panel
              icon={Gauge}
              title={`Session ${selectedSection?.sectionOrder ?? '—'} · Items`}
              description="Primary sentence first; translation and CVR internals stay in row details."
              collapsible={false}
              actions={
                <div className="resource-dynamic-filters">
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        Session {s.sectionOrder}
                      </option>
                    ))}
                  </select>
                  <select
                    value={resourceLanguage}
                    onChange={(e) => setResourceLanguage(e.target.value as ResourceLanguage)}
                    title="Display language"
                  >
                    <option value="all">All languages</option>
                    <option value="vi">Vietnamese</option>
                    <option value="en">English</option>
                  </select>
                  <label className="resource-toggle-pill">
                    <input
                      type="checkbox"
                      checked={showItemDetails}
                      onChange={(event) => setShowItemDetails(event.target.checked)}
                    />
                    Show Translation & CVR details
                  </label>
                  {selectedScope?.version.status === 'draft' ? (
                    <>
                      <button className="ghost" onClick={() => setShowAddItem((value) => !value)}>
                        <Plus className="h-4 w-4" /> Add item
                      </button>
                      <button className="ghost danger" disabled={selectedItemIds.length === 0} onClick={() => void deleteSelectedItems()}>
                        <Trash2 className="h-4 w-4" /> Delete selected {selectedItemIds.length ? `(${selectedItemIds.length})` : ''}
                      </button>
                    </>
                  ) : (
                    <span className="meta">Published items are immutable.</span>
                  )}
                </div>
              }
            >
              {showAddItem && selectedScope?.version.status === 'draft' ? (
                <div className="resource-item-create-card">
                  <label>
                    VI prompt
                    <textarea rows={2} value={newItemDraft.vi} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, vi: event.target.value }))} />
                  </label>
                  <label>
                    EN prompt
                    <textarea rows={2} value={newItemDraft.en} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, en: event.target.value }))} />
                  </label>
                  <div className="resource-item-cvr-grid">
                    <label>TC<input value={newItemDraft.tc} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, tc: event.target.value }))} /></label>
                    <label>LC<input value={newItemDraft.lc} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, lc: event.target.value }))} /></label>
                    <label>TL<input value={newItemDraft.tl} onChange={(event) => setNewItemDraft((draft) => ({ ...draft, tl: event.target.value }))} /></label>
                  </div>
                  <div className="btn-row">
                    <button className="primary" onClick={() => void addItemToSession()}>Add to session</button>
                    <button className="ghost" onClick={() => setShowAddItem(false)}>Cancel</button>
                  </div>
                </div>
              ) : null}

              <label className="field resource-search">
                <Search className="h-4 w-4" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item or sentence…"
                />
              </label>
              <div className="table-wrap compact-resource-table">
                <table>
                  <thead>
                    <tr>
                      <th>
                        {selectedScope?.version.status === 'draft' ? (
                          <input
                            type="checkbox"
                            checked={filteredItems.length > 0 && filteredItems.every((item) => selectedItemIds.includes(item.id))}
                            onChange={(event) => setSelectedItemIds(event.target.checked ? filteredItems.map((item) => item.id) : [])}
                          />
                        ) : null}
                      </th>
                      <th>#</th>
                      <th>Complete Sentence</th>
                      <th>CVR</th>
                      <th>Audio</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const editing = editingItemId === item.id
                      const prompt = resourceLanguage === 'en' ? item.promptEn : item.promptVi
                      const translation = resourceLanguage === 'en' ? item.promptVi : item.promptEn
                      return (
                        <tr key={item.id} className={selectedItemIds.includes(item.id) ? 'is-selected' : undefined}>
                          <td>
                            {selectedScope?.version.status === 'draft' ? (
                              <input
                                type="checkbox"
                                checked={selectedItemIds.includes(item.id)}
                                onChange={(event) =>
                                  setSelectedItemIds((current) =>
                                    event.target.checked
                                      ? [...new Set([...current, item.id])]
                                      : current.filter((id) => id !== item.id),
                                  )
                                }
                              />
                            ) : null}
                          </td>
                          <td>
                            <strong>{item.itemOrder}</strong>
                          </td>
                          <td>
                            {editing ? (
                              <div className="resource-script-edit">
                                <textarea
                                  rows={2}
                                  value={promptDraft.vi}
                                  onChange={(e) =>
                                    setPromptDraft({ ...promptDraft, vi: e.target.value })
                                  }
                                />
                                <textarea
                                  rows={2}
                                  value={promptDraft.en}
                                  onChange={(e) =>
                                    setPromptDraft({ ...promptDraft, en: e.target.value })
                                  }
                                />
                                <div className="btn-row">
                                  <button className="primary" onClick={() => void savePrompt(item)}>
                                    Save
                                  </button>
                                  <button className="ghost" onClick={() => setEditingItemId(null)}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {isRedMultiTermItem(item, selectedScope) ? (
                                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                    <span className="badge badge-warning text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                      Multi-Term + SSML Gap
                                    </span>
                                    {parseSsmlBreakTime(item.spokenScriptEn || item.spokenScriptVi) ? (
                                      <span
                                        className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded"
                                        title={`Semantic gap pause duration: ${parseSsmlBreakTime(item.spokenScriptEn || item.spokenScriptVi)}`}
                                      >
                                        Pause: {parseSsmlBreakTime(item.spokenScriptEn || item.spokenScriptVi)}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                                {resourceLanguage === 'all' ? (
                                  <div className="resource-bilingual-prompt">
                                    <div><span>VI</span>{item.promptVi ?? '—'}</div>
                                    <div><span>EN</span>{item.promptEn ?? '—'}</div>
                                  </div>
                                ) : (
                                  <div>{prompt ?? '—'}</div>
                                )}
                                {(hasSsml(item.spokenScriptVi) || hasSsml(item.spokenScriptEn)) ? (
                                  <div
                                    className="mt-1 text-[11px] font-mono text-amber-800 bg-amber-50/70 border border-amber-200/60 rounded px-2 py-1 flex items-center gap-2 cursor-help"
                                    title={item.spokenScriptEn || item.spokenScriptVi || ''}
                                  >
                                    <span className="font-bold uppercase text-[9px] bg-amber-200/70 text-amber-900 px-1 rounded">
                                      SSML Spoken
                                    </span>
                                    <span className="truncate max-w-[340px]">
                                      {item.spokenScriptEn || item.spokenScriptVi}
                                    </span>
                                    {parseSsmlBreakTime(item.spokenScriptEn || item.spokenScriptVi) ? (
                                      <span className="ml-auto font-bold text-[10px] text-amber-900 shrink-0">
                                        Pause: {parseSsmlBreakTime(item.spokenScriptEn || item.spokenScriptVi)}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                                {showItemDetails ? (
                                  <div className="resource-row-details">
                                    {resourceLanguage !== 'all' ? <div>{translation ?? '—'}</div> : null}
                                    <span>
                                      TC {item.tc ?? '—'} · LC {item.lc ?? '—'} · TL{' '}
                                      {item.tl ?? '—'} · CVR {metricOhm(item.measuredCvr)}
                                    </span>
                                    <span>
                                      Terms: VI {item.termVi ?? '—'} · EN {item.termEn ?? '—'}
                                    </span>
                                    {(item.spokenScriptVi || item.spokenScriptEn) ? (
                                      <div className="text-[11px] text-slate-500 font-mono mt-1 bg-slate-50 p-1.5 rounded border border-slate-200/60">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">Spoken Script Audio:</div>
                                        {item.spokenScriptVi ? <div>VI: {item.spokenScriptVi}</div> : null}
                                        {item.spokenScriptEn ? <div>EN: {item.spokenScriptEn}</div> : null}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td>
                            <span className="badge metric-cvr">
                              {metricOhm(item.measuredCvr ?? selectedSnapshot?.targetCvrOhm)}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <span
                                className={`badge ${
                                  audioStatuses[item.itemOrder] === 'approved'
                                    ? 'success'
                                    : audioStatuses[item.itemOrder] === 'generated'
                                    ? 'info'
                                    : audioStatuses[item.itemOrder] === 'stale'
                                    ? 'experimental'
                                    : ''
                                }`}
                              >
                                {audioStatuses[item.itemOrder] ?? 'missing'}
                              </span>
                              {itemReviewRecords[item.id]?.variant?.id &&
                              (audioStatuses[item.itemOrder] === 'approved' ||
                                audioStatuses[item.itemOrder] === 'generated') ? (
                                <button
                                  type="button"
                                  className="ghost compact-action-btn"
                                  title="Play prompt audio"
                                  style={{ padding: '0.2rem', height: '1.75rem', width: '1.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  disabled={playingVariantId === itemReviewRecords[item.id].variant.id}
                                  onClick={() => void playNarrationVariant(itemReviewRecords[item.id].variant.id)}
                                >
                                  <Play className={`h-3.5 w-3.5 ${playingVariantId === itemReviewRecords[item.id].variant.id ? 'text-indigo-600 animate-pulse' : ''}`} />
                                </button>
                              ) : null}
                              {(audioStatuses[item.itemOrder] === 'missing' ||
                                audioStatuses[item.itemOrder] === 'stale' ||
                                !audioStatuses[item.itemOrder]) ? (
                                <button
                                  type="button"
                                  className="ghost compact-action-btn"
                                  title="Generate TTS for item"
                                  style={{ padding: '0.2rem', height: '1.75rem', width: '1.75rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                  disabled={generatingItemId === item.id}
                                  onClick={() => void generateSingleItemAudio(item)}
                                >
                                  {generatingItemId === item.id ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                                  ) : (
                                    <WandSparkles className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            {selectedScope?.version.status === 'draft' ? (
                              <button
                                className="ghost"
                                onClick={() => {
                                  setEditingItemId(item.id)
                                  setPromptDraft({
                                    vi: item.promptVi ?? '',
                                    en: item.promptEn ?? '',
                                  })
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
          {activeTab === 'cci' ? (
            <Panel
              icon={Database}
              title={
                selectedProfile
                  ? `${selectedProfile.name} · ${selectedProfile.versionLabel}`
                  : 'CCI'
              }
              description="Eight canonical CCI definitions used by the selected Package Version."
              collapsible={false}
            >
              <div className="table-wrap compact-resource-table">
                <table>
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>CCI Name</th>
                      <th>Category</th>
                      <th>Ampe</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories
                      .filter((c) => !selectedProfile || c.profileId === selectedProfile.id)
                      .sort((a, b) => a.categoryOrder - b.categoryOrder)
                      .map((category) => (
                        <tr key={category.id}>
                          <td>{category.categoryOrder}</td>
                          <td>
                            <strong>{category.label}</strong>
                          </td>
                          <td>
                            <span className="badge">
                              {String(category.metadata.mainCategory ?? 'Unmapped')}
                            </span>
                          </td>
                          <td>
                            <strong className="metric-cci-text">{metricAmp(category.value)}</strong>
                          </td>
                          <td>{category.description ?? '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
          {activeTab === 'audio' ? (
            <Panel
              icon={Volume2}
              title={`Session ${selectedSection?.sectionOrder ?? '—'} Audio`}
              description="Prepare scripts before paid generation, then listen, approve, and reach intro + all current items."
              collapsible={false}
            >
              <div className="audio-readiness-card">
                <div>
                  <strong>{readiness.approved}/{selectedSectionAudioExpected || readiness.expected || 0} approved</strong>
                  <div className="meta">
                    {language.toUpperCase()} · {voiceId} · {readiness.stale} stale ·{' '}
                    {readiness.failed} failed
                  </div>
                </div>
                <div className="btn-row">
                  <select
                    value={selectedSectionId}
                    onChange={(e) => setSelectedSectionId(e.target.value)}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        Session {s.sectionOrder}
                      </option>
                    ))}
                  </select>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as AudioLanguage)}
                  >
                    <option value="vi">Vietnamese</option>
                    <option value="en">English</option>
                  </select>
                  <select
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    disabled={modelsLoading}
                    style={{ minWidth: '180px' }}
                    title="Voice Model"
                  >
                    {ttsModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label || m.id}
                      </option>
                    ))}
                    {ttsModels.length === 0 ? <option value={voiceId}>{voiceId}</option> : null}
                  </select>
                  <button
                    type="button"
                    className="ghost"
                    disabled={previewingVoice}
                    onClick={() => void previewVoice(voiceId, language)}
                    title="Nghe thử giọng đọc mẫu"
                  >
                    <Volume2 className={`h-4 w-4 ${previewingVoice ? 'text-indigo-600 animate-pulse' : ''}`} />
                    <span>{previewingVoice ? 'Đang phát…' : 'Nghe thử model'}</span>
                  </button>
                  <Link
                    className="btn primary"
                    to={`/admin/resources/audio?version=${versionId}&section=${selectedSectionId}&language=${language}&voice=${encodeURIComponent(voiceId)}`}
                  >
                    Open Audio Preparation
                  </Link>
                </div>
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--line-subtle, #e2e8f0)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <strong>Package Flow Audio</strong>
                    <div className="meta">
                      Manage package start intro, part transitions (Parts I, II, III), and end outro narration.
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setActiveTab('flow')}
                  >
                    Manage Package Flow Audio →
                  </button>
                </div>
              </div>
            </Panel>
          ) : null}
          {activeTab === 'flow' ? (
            <Panel
              icon={Volume2}
              title="Package Flow Audio"
              description="Manage start intro, part transitions (Parts I, II, III), and end outro narration with exact scripts and instant TTS."
              collapsible={false}
              actions={
                <div className="btn-row" style={{ margin: 0 }}>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as AudioLanguage)}
                    title="Target Language"
                  >
                    <option value="vi">Vietnamese (VI)</option>
                    <option value="en">English (EN)</option>
                  </select>
                  <select
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    disabled={modelsLoading}
                    style={{ minWidth: '180px' }}
                    title="Voice Model"
                  >
                    {ttsModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label || m.id}
                      </option>
                    ))}
                    {ttsModels.length === 0 ? <option value={voiceId}>{voiceId}</option> : null}
                  </select>
                  <button
                    type="button"
                    className="ghost"
                    disabled={previewingVoice}
                    onClick={() => void previewVoice(voiceId, language)}
                    title="Nghe thử giọng đọc mẫu"
                  >
                    <Volume2 className={`h-4 w-4 ${previewingVoice ? 'text-indigo-600 animate-pulse' : ''}`} />
                    <span>{previewingVoice ? 'Đang phát…' : 'Nghe thử model'}</span>
                  </button>
                </div>
              }
            >
              <div className="package-flow-audio-grid" style={{ display: 'grid', gap: '1.25rem' }}>
                {[
                  {
                    key: 'package_start' as const,
                    title: 'Package Start Intro',
                    badge: flowVariants.package_start?.approval_status ?? (flowVariants.package_start ? 'generated' : 'missing'),
                    variant: flowVariants.package_start,
                    description: 'Played once when starting the test package before any sessions.',
                  },
                  {
                    key: 'part_intro_1' as const,
                    title: 'Part I Intro',
                    badge: flowVariants.part_intro_1?.approval_status ?? (flowVariants.part_intro_1 ? 'generated' : 'missing'),
                    variant: flowVariants.part_intro_1,
                    description: 'Played before Part I sessions begin.',
                  },
                  {
                    key: 'part_intro_2' as const,
                    title: 'Part II Intro',
                    badge: flowVariants.part_intro_2?.approval_status ?? (flowVariants.part_intro_2 ? 'generated' : 'missing'),
                    variant: flowVariants.part_intro_2,
                    description: 'Played before Part II sessions begin.',
                  },
                  {
                    key: 'part_intro_3' as const,
                    title: 'Part III Intro',
                    badge: flowVariants.part_intro_3?.approval_status ?? (flowVariants.part_intro_3 ? 'generated' : 'missing'),
                    variant: flowVariants.part_intro_3,
                    description: 'Played before Part III sessions begin.',
                  },
                  {
                    key: 'package_end' as const,
                    title: 'Package End Outro',
                    badge: flowVariants.package_end?.approval_status ?? (flowVariants.package_end ? 'generated' : 'missing'),
                    variant: flowVariants.package_end,
                    description: 'Played at test conclusion after all sessions complete.',
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    style={{
                      border: '1px solid var(--line-subtle, #e2e8f0)',
                      borderRadius: '0.625rem',
                      padding: '1rem',
                      background: 'var(--surface-base, #ffffff)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9375rem' }}>{item.title}</strong>
                        <span className={`badge ${item.badge === 'approved' ? 'success' : item.badge === 'generated' ? 'info' : 'experimental'}`}>
                          {item.badge}
                        </span>
                        {item.variant?.voice_id ? (
                          <span className="meta" style={{ fontSize: '0.75rem' }}>
                            Model: {item.variant.voice_id}
                          </span>
                        ) : null}
                      </div>
                      <div className="meta" style={{ fontSize: '0.75rem' }}>
                        {item.description}
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      value={flowScripts[item.key]}
                      onChange={(e) => setFlowScripts((s) => ({ ...s, [item.key]: e.target.value }))}
                      placeholder={`Spoken script for ${item.title}`}
                      style={{ width: '100%', marginBottom: '0.75rem', fontSize: '0.875rem' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="primary"
                        disabled={generatingFlowTarget !== null || !flowScripts[item.key].trim()}
                        onClick={() => void generateFlowAudio(item.key)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                      >
                        {generatingFlowTarget === item.key ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Generating…</span>
                          </>
                        ) : (
                          <>
                            <WandSparkles className="h-4 w-4" />
                            <span>Generate TTS</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        disabled={!item.variant?.id || playingVariantId === item.variant?.id}
                        onClick={() => void playNarrationVariant(item.variant.id)}
                        title={item.variant?.id ? 'Play audio' : 'No audio asset generated yet'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                      >
                        <Play className={`h-4 w-4 ${playingVariantId === item.variant?.id ? 'text-indigo-600 animate-pulse' : ''}`} />
                        <span>{playingVariantId === item.variant?.id ? 'Playing…' : 'Play Audio'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </>
  )
}

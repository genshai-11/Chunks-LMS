import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Eye,
  FileText,
  Headphones,
  Layers,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { getSupabase } from '../../lib/supabase'
import {
  createDraftTestPackage,
  deleteTestPackage,
  listTestItems,
  listTestPackageVersions,
  listTestPackages,
  listTestSections,
  updateTestPackageMetadata,
} from '../../lib/test-packages'
import type {
  TestItem,
  TestPackage,
  TestPackageVersion,
  TestSection,
} from '../../modules/catalog/test-package-catalog'
import {
  generateNarration,
  generatePackageFromVocab,
  getFirestoreLessonChunks,
  listFirestoreLessons,
  listTtsModels,
  playGoogleCloudTts,
  type FirestoreChunk,
  type FirestoreLesson,
} from '../../modules/catalog/live-test-generation'

type FilterTab = 'all' | 'green' | 'red'

export type PackageSummary = {
  pkg: TestPackage
  version: TestPackageVersion | null
  sections: TestSection[]
  items: TestItem[]
  testType: 'green' | 'red'
  targetVoltage: number
  questionCount: number
  cvrMin: number
  cvrMax: number
  audioApprovedCount: number
  audioTotalCount: number
  isLegacyLive: boolean
}

export function AdminPackageTestsPage() {
  const { message, error, ok, err } = useFlash()

  // State
  const [packageSummaries, setPackageSummaries] = useState<PackageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createTab, setCreateTab] = useState<'ai' | 'manual'>('ai')
  const [creatingPackage, setCreatingPackage] = useState(false)

  // AI Generator fields
  const [lessons, setLessons] = useState<FirestoreLesson[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [lessonChunks, setLessonChunks] = useState<FirestoreChunk[]>([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const [aiTestType, setAiTestType] = useState<'green' | 'red'>('red')
  const [aiQuestionCount, setAiQuestionCount] = useState<21 | 42 | 49>(42)
  const [aiTopic, setAiTopic] = useState('topic12')
  const [aiTargetVoltage, setAiTargetVoltage] = useState(56)
  const [customPackageCode, setCustomPackageCode] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [allowCustomCode, setAllowCustomCode] = useState(false)

  // Manual Blank Draft fields
  const [manualTitle, setManualTitle] = useState('')
  const [manualVersionLabel, setManualVersionLabel] = useState('v1')
  const [manualSessionCount, setManualSessionCount] = useState(6)
  const [manualItemsPerSession, setManualItemsPerSession] = useState(7)

  // Edit Metadata Modal
  const [editingPackage, setEditingPackage] = useState<TestPackage | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingMetadata, setSavingMetadata] = useState(false)

  // Delete Confirmation Modal
  const [deletingPackage, setDeletingPackage] = useState<TestPackage | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Full Preview Modal
  const [previewPackage, setPreviewPackage] = useState<PackageSummary | null>(null)
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null)

  // Audio Studio Modal
  const [audioStudioPackage, setAudioStudioPackage] = useState<PackageSummary | null>(null)
  const [ttsLanguage, setTtsLanguage] = useState<'vi' | 'en'>('en')
  const [ttsVoiceId, setTtsVoiceId] = useState('google/en-US-Neural2-F')
  const [ttsModels, setTtsModels] = useState<Array<{ id: string; provider: string; label: string }>>([])
  const [testingTtsVoice, setTestingTtsVoice] = useState(false)
  const [batchAudioProgress, setBatchAudioProgress] = useState<{ done: number; total: number } | null>(null)
  const [batchGenerating, setBatchGenerating] = useState(false)

  // Default TTS Voice lists
  const defaultViVoices = [
    { id: 'google/vi-VN-Neural2-A', provider: 'google', label: 'Google vi-VN-Neural2-A (Female)' },
    { id: 'google/vi-VN-Neural2-D', provider: 'google', label: 'Google vi-VN-Neural2-D (Male)' },
    { id: 'google/vi-VN-Wavenet-A', provider: 'google', label: 'Google vi-VN-Wavenet-A (Female)' },
    { id: 'google/vi-VN-Wavenet-C', provider: 'google', label: 'Google vi-VN-Wavenet-C (Male)' },
  ]
  const defaultEnVoices = [
    { id: 'google/en-US-Journey-F', provider: 'google', label: 'Google en-US-Journey-F (Female)' },
    { id: 'google/en-US-Journey-D', provider: 'google', label: 'Google en-US-Journey-D (Male)' },
    { id: 'google/en-US-Neural2-F', provider: 'google', label: 'Google en-US-Neural2-F (Female)' },
    { id: 'google/en-US-Neural2-J', provider: 'google', label: 'Google en-US-Neural2-J (Male)' },
  ]

  // Update target voltage automatically when test type changes if not manually set
  useEffect(() => {
    if (!allowCustomCode) {
      setAiTargetVoltage(aiTestType === 'red' ? 56 : 12)
    }
  }, [aiTestType, allowCustomCode])

  // Compute live package code and title
  const computedPackageCode = useMemo(() => {
    const prefix = aiTestType === 'red' ? 'R01' : 'G01'
    const cleanTopic = aiTopic.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const topicSegment = cleanTopic ? `-${cleanTopic}` : ''
    return `${prefix}-${aiQuestionCount}Q${topicSegment}-${aiTargetVoltage}V`
  }, [aiTestType, aiQuestionCount, aiTopic, aiTargetVoltage])

  const selectedLesson = useMemo(() => {
    return lessons.find((l) => l.id === selectedLessonId) ?? null
  }, [lessons, selectedLessonId])

  const computedTitle = useMemo(() => {
    const typeLabel = aiTestType === 'red' ? 'RED (Awareness & Traps)' : 'GREEN (Focus)'
    const lessonLabel = selectedLesson?.lessonTitle || selectedLessonId || 'General'
    return `[${typeLabel}] ${lessonLabel} · ${aiQuestionCount}Q - ${aiTargetVoltage}V`
  }, [aiTestType, selectedLesson, selectedLessonId, aiQuestionCount, aiTargetVoltage])

  const activePackageCode = allowCustomCode && customPackageCode ? customPackageCode : computedPackageCode
  const activeTitle = allowCustomCode && customTitle ? customTitle : computedTitle

  // Load packages catalog
  const loadPackages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listTestPackages()
      if (!res.ok) {
        err(res.error)
        return
      }

      // Build summaries for each package
      const summaries: PackageSummary[] = await Promise.all(
        res.data.map(async (pkg) => {
          const versionsRes = await listTestPackageVersions(pkg.id)
          const version = versionsRes.ok ? versionsRes.data[0] ?? null : null

          let sections: TestSection[] = []
          let items: TestItem[] = []
          let audioApproved = 0

          if (version) {
            const sectionsRes = await listTestSections(version.id)
            if (sectionsRes.ok) {
              sections = sectionsRes.data
              const itemPromises = sections.map((s) => listTestItems(s.id))
              const itemResults = await Promise.all(itemPromises)
              items = itemResults.flatMap((r) => (r.ok ? r.data : []))
            }

            const sb = getSupabase() as any
            if (sb) {
              const { data: variants } = await sb
                .from('narration_variants')
                .select('id, approval_status')
                .eq('package_version_id', version.id)
              audioApproved = (variants ?? []).filter((v: any) => v.approval_status === 'approved').length
            }
          }

          const rawTitle = pkg.title.toUpperCase()
          const isRed =
            pkg.sourceMetadata?.testType === 'red' ||
            rawTitle.includes('RED') ||
            rawTitle.includes('AWARENESS') ||
            pkg.slug.startsWith('r-') ||
            pkg.slug.startsWith('red')
          const testType: 'green' | 'red' = isRed ? 'red' : 'green'

          const targetVoltage = Number(
            pkg.sourceMetadata?.targetVoltage ??
              pkg.sourceMetadata?.targetCpd ??
              (testType === 'red' ? 56 : 12),
          )

          const questionCount = items.length || Number(pkg.sourceMetadata?.questionCount ?? 42)

          const cvrValues = items
            .map((i) => i.measuredCvr)
            .filter((c): c is number => c != null && !isNaN(c))
          const cvrMin = cvrValues.length ? Math.min(...cvrValues) : testType === 'red' ? 3 : 1
          const cvrMax = cvrValues.length ? Math.max(...cvrValues) : testType === 'red' ? 24 : 13

          const isLegacyLive = pkg.title.includes('· LIVE') || version?.versionLabel === 'LIVE'

          return {
            pkg,
            version,
            sections,
            items,
            testType,
            targetVoltage,
            questionCount,
            cvrMin,
            cvrMax,
            audioApprovedCount: audioApproved,
            audioTotalCount: items.length,
            isLegacyLive,
          }
        }),
      )

      setPackageSummaries(summaries)
    } catch (e) {
      err(e instanceof Error ? e.message : 'Failed to load test packages')
    } finally {
      setLoading(false)
    }
  }, [err])

  useEffect(() => {
    loadPackages()
  }, [loadPackages])

  // Load Firestore lessons
  const loadLessons = useCallback(async () => {
    try {
      const data = await listFirestoreLessons()
      setLessons(data)
      if (data.length > 0 && !selectedLessonId) {
        setSelectedLessonId(data[0]!.id)
      }
    } catch (e) {
      // Ignored if offline
    }
  }, [selectedLessonId])

  useEffect(() => {
    loadLessons()
  }, [loadLessons])

  // Load chunks when selected lesson changes
  useEffect(() => {
    if (!selectedLessonId) {
      setLessonChunks([])
      return
    }
    let cancelled = false
    setLoadingChunks(true)
    getFirestoreLessonChunks(selectedLessonId)
      .then((chunks) => {
        if (!cancelled) setLessonChunks(chunks)
      })
      .catch(() => {
        if (!cancelled) setLessonChunks([])
      })
      .finally(() => {
        if (!cancelled) setLoadingChunks(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedLessonId])

  // Load TTS models for Audio studio
  useEffect(() => {
    listTtsModels(ttsLanguage)
      .then((res) => {
        if (res?.models?.length) {
          setTtsModels(res.models)
        } else {
          setTtsModels(ttsLanguage === 'vi' ? defaultViVoices : defaultEnVoices)
        }
      })
      .catch(() => {
        setTtsModels(ttsLanguage === 'vi' ? defaultViVoices : defaultEnVoices)
      })
  }, [ttsLanguage])

  // Filtered packages
  const filteredSummaries = useMemo(() => {
    return packageSummaries.filter((summary) => {
      if (filterTab === 'green' && summary.testType !== 'green') return false
      if (filterTab === 'red' && summary.testType !== 'red') return false

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const cleanTitle = summary.pkg.title.replace(/ · LIVE$/i, '').toLowerCase()
        const slug = summary.pkg.slug.toLowerCase()
        const desc = (summary.pkg.description || '').toLowerCase()
        const code = String(summary.pkg.sourceMetadata?.packageCode || '').toLowerCase()
        return cleanTitle.includes(query) || slug.includes(query) || desc.includes(query) || code.includes(query)
      }
      return true
    })
  }, [packageSummaries, filterTab, searchQuery])

  // Handle AI Package Generation
  async function handleGenerateAiPackage(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLessonId) {
      return err('Please select a lesson')
    }
    setCreatingPackage(true)
    try {
      const res = await generatePackageFromVocab({
        testType: aiTestType,
        lessonId: selectedLessonId,
        targetQuestions: aiQuestionCount,
        targetCpd: aiTargetVoltage,
        packageCode: activePackageCode,
        title: activeTitle,
        versionLabel: 'v1',
        saveDraft: true,
      })

      ok(`Generated and saved package "${res.title}" with ${res.itemsCount} questions!`)
      setShowCreateModal(false)
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'AI package generation failed')
    } finally {
      setCreatingPackage(false)
    }
  }

  // Handle Manual Package Creation
  async function handleCreateManualPackage(e: React.FormEvent) {
    e.preventDefault()
    if (!manualTitle.trim()) return err('Title is required')
    setCreatingPackage(true)
    try {
      const defaultSessions = Array.from({ length: manualSessionCount }, (_, idx) => ({
        sectionOrder: idx + 1,
        title: `Session ${idx + 1}`,
        targetCvrOhm: (idx + 1) * 2 - 1,
        cciProfileId: '',
        cciCategoryId: '',
        cciCategoryLabel: 'Focus Baseline',
        cciValue: 2,
      }))

      const res = await createDraftTestPackage({
        title: manualTitle.trim(),
        versionLabel: manualVersionLabel.trim() || 'v1',
        sessionCount: manualSessionCount,
        itemsPerSession: manualItemsPerSession,
        sessions: defaultSessions,
      })
      if (!res.ok) throw new Error(res.error)

      ok(`Created manual test package "${res.data.package.title}"`)
      setShowCreateModal(false)
      setManualTitle('')
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Manual package creation failed')
    } finally {
      setCreatingPackage(false)
    }
  }

  // Handle Metadata Update
  async function handleSaveMetadata(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPackage) return
    setSavingMetadata(true)
    try {
      await updateTestPackageMetadata(editingPackage.id, {
        title: editTitle,
        slug: editSlug,
        description: editDescription,
      })
      ok('Package metadata updated successfully.')
      setEditingPackage(null)
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Failed to update package metadata')
    } finally {
      setSavingMetadata(false)
    }
  }

  // Handle Package Delete
  async function handleDeletePackage() {
    if (!deletingPackage) return
    setDeleting(true)
    try {
      await deleteTestPackage(deletingPackage.id)
      ok(`Package "${deletingPackage.title}" and all its versions were deleted.`)
      setDeletingPackage(null)
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Failed to delete package')
    } finally {
      setDeleting(false)
    }
  }

  // Audio Play helper for preview
  async function playItemAudio(item: TestItem) {
    const textToSpeak = item.spokenScriptEn || item.promptEn || item.spokenScriptVi || item.promptVi || ''
    if (!textToSpeak) {
      return err('No spoken script or prompt text to play.')
    }
    const lang = item.spokenScriptEn || item.promptEn ? 'en' : 'vi'
    const voice = lang === 'vi' ? 'google/vi-VN-Neural2-A' : 'google/en-US-Neural2-F'
    setPreviewPlayingId(item.id)
    try {
      await playGoogleCloudTts(textToSpeak, lang, voice)
    } catch (e) {
      err(e instanceof Error ? e.message : 'TTS playback failed')
    } finally {
      setPreviewPlayingId(null)
    }
  }

  // Audio Play helper for scripts
  async function playScriptAudio(scriptKey: string, text: string, lang: 'vi' | 'en') {
    if (!text) return
    setPreviewPlayingId(scriptKey)
    const voice = lang === 'vi' ? 'google/vi-VN-Neural2-A' : 'google/en-US-Neural2-F'
    try {
      await playGoogleCloudTts(text, lang, voice)
    } catch (e) {
      err(e instanceof Error ? e.message : 'TTS playback failed')
    } finally {
      setPreviewPlayingId(null)
    }
  }

  // Test voice sample
  async function handleTestTtsVoice() {
    const sample =
      ttsLanguage === 'vi'
        ? 'Xin chào! Đây là giọng đọc nhân tạo chuẩn Google Cloud trên Chunks LMS.'
        : 'Hello! This is a high-fidelity Google Cloud voice model on Chunks LMS.'
    setTestingTtsVoice(true)
    try {
      await playGoogleCloudTts(sample, ttsLanguage, ttsVoiceId)
    } catch (e) {
      err(e instanceof Error ? e.message : 'Failed to preview TTS voice')
    } finally {
      setTestingTtsVoice(false)
    }
  }

  // Batch generate all items
  async function handleBatchGenerate(pkg: PackageSummary) {
    if (!pkg.version) return
    setBatchGenerating(true)
    setBatchAudioProgress({ done: 0, total: pkg.items.length })
    let done = 0
    try {
      for (const item of pkg.items) {
        const lang = item.spokenScriptEn ? 'en' : 'vi'
        const script = item.spokenScriptEn || item.promptEn || item.spokenScriptVi || item.promptVi || ''
        await generateNarration({
          packageVersionId: pkg.version.id,
          target: 'test_item',
          testItemId: item.id,
          language: lang,
          voiceId: ttsVoiceId,
          textOverride: script,
        })
        done++
        setBatchAudioProgress({ done, total: pkg.items.length })
      }
      ok(`Batch generated ${done} items with Google Cloud TTS!`)
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Batch generation stopped with error')
    } finally {
      setBatchGenerating(false)
      setBatchAudioProgress(null)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Package Tests Studio"
        subtitle="Manage focus & awareness packages, generate AI tests from vocab, full hierarchy preview, and Google Cloud audio pipeline."
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="ghost flex items-center gap-2"
              onClick={() => void loadPackages()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="primary flex items-center gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Create Package Test</span>
            </button>
          </div>
        }
      />

      <Flash message={message} error={error} />

      {/* Catalog Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/70 p-1 rounded-xl">
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterTab === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            onClick={() => setFilterTab('all')}
          >
            All ({packageSummaries.length})
          </button>
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filterTab === 'green'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
            onClick={() => setFilterTab('green')}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Green Tests ({packageSummaries.filter((s) => s.testType === 'green').length})</span>
          </button>
          <button
            type="button"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              filterTab === 'red'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
            }`}
            onClick={() => setFilterTab('red')}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>Red Tests ({packageSummaries.filter((s) => s.testType === 'red').length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, code, slug..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Package Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
          <span className="text-sm text-slate-500">Loading test packages catalog...</span>
        </div>
      ) : filteredSummaries.length === 0 ? (
        <EmptyState
          title="No package tests found"
          description={
            searchQuery
              ? `No packages match "${searchQuery}". Try clearing search.`
              : 'Create your first Green Focus or Red Awareness test package with the AI generator.'
          }
          action={
            <button
              type="button"
              className="primary flex items-center gap-2"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Create Package</span>
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSummaries.map((summary) => {
            const cleanTitle = summary.pkg.title.replace(/ · LIVE$/i, '').trim()
            const versionLabel =
              summary.version?.versionLabel && summary.version.versionLabel !== 'LIVE'
                ? summary.version.versionLabel
                : 'v1'
            const isRed = summary.testType === 'red'
            const audioPercent =
              summary.audioTotalCount > 0
                ? Math.round((summary.audioApprovedCount / summary.audioTotalCount) * 100)
                : 0

            return (
              <div
                key={summary.pkg.id}
                className="group relative flex flex-col justify-between bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm hover:shadow-md transition-all hover:border-indigo-300 dark:hover:border-indigo-700"
              >
                <div>
                  {/* Card Header Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${
                        isRed
                          ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                      }`}
                    >
                      {isRed ? <Activity className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
                      {isRed ? 'Red Test (Awareness)' : 'Green Test (Focus)'}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        summary.version?.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'
                      }`}
                    >
                      {summary.version?.status === 'published' ? 'Published' : 'Draft'} · {versionLabel}
                    </span>
                  </div>

                  {/* Title & Code */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 mb-1">
                    {cleanTitle}
                  </h3>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mb-4">
                    {String(summary.pkg.sourceMetadata?.packageCode || summary.pkg.slug)}
                  </div>

                  {/* Metrics Badges Row */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Questions</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {summary.questionCount}Q · {summary.sections.length} Sessions
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Target Voltage</div>
                      <div className="font-bold text-indigo-600 dark:text-indigo-400">
                        {summary.targetVoltage}V CPD
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">CVR Range</div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300">
                        {summary.cvrMin}Ω – {summary.cvrMax}Ω
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Audio Readiness</div>
                      <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                        <span>{summary.audioApprovedCount}/{summary.audioTotalCount}</span>
                        <span className="text-[10px] text-slate-400">{audioPercent}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Audio Progress Bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden mb-4">
                    <div
                      className={`h-full transition-all ${
                        audioPercent === 100
                          ? 'bg-emerald-500'
                          : audioPercent > 0
                          ? 'bg-indigo-500'
                          : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                      style={{ width: `${audioPercent}%` }}
                    />
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 transition-colors"
                      onClick={() => setPreviewPackage(summary)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                      onClick={() => setAudioStudioPackage(summary)}
                    >
                      <Headphones className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Audio Studio</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title="Edit metadata"
                      onClick={() => {
                        setEditingPackage(summary.pkg)
                        setEditTitle(cleanTitle)
                        setEditSlug(summary.pkg.slug)
                        setEditDescription(summary.pkg.description || '')
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Delete package"
                      onClick={() => setDeletingPackage(summary.pkg)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CREATE PACKAGE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <WandSparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Create Test Package</h2>
                  <p className="text-xs text-slate-500">
                    Generate from Firestore Vocab with dual-term cognition or create blank package.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setShowCreateModal(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-3">
              <button
                type="button"
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                  createTab === 'ai'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                onClick={() => setCreateTab('ai')}
              >
                AI Generator (Firestore Vocab)
              </button>
              <button
                type="button"
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                  createTab === 'manual'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
                onClick={() => setCreateTab('manual')}
              >
                Manual Blank Draft
              </button>
            </div>

            {/* Form Body */}
            {createTab === 'ai' ? (
              <form onSubmit={(e) => void handleGenerateAiPackage(e)} className="p-6 space-y-5">
                {/* Lesson Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Source Lesson (Firestore) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                    required
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    {lessons.length === 0 ? (
                      <option value="">Loading lessons from Firestore...</option>
                    ) : (
                      lessons.map((lesson) => (
                        <option key={lesson.id} value={lesson.id}>
                          {lesson.levelCode ? `[${lesson.levelCode}] ` : ''}Day {lesson.dayNumber}: {lesson.lessonTitle} ({lesson.totalChunks} chunks)
                        </option>
                      ))
                    )}
                  </select>
                  {loadingChunks ? (
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading lesson chunks...
                    </div>
                  ) : lessonChunks.length > 0 ? (
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                      ✓ {lessonChunks.length} chunks ready for synthesis
                    </div>
                  ) : null}
                </div>

                {/* Test Type Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Dynamic Test Type <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAiTestType('green')}
                      className={`p-3.5 rounded-xl text-left border-2 transition-all ${
                        aiTestType === 'green'
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5" />
                          Green Test (Focus)
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                          12V CPD
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Baseline cognitive focus test. Single-chunk recognition with latency measurement.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiTestType('red')}
                      className={`p-3.5 rounded-xl text-left border-2 transition-all ${
                        aiTestType === 'red'
                          ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5" />
                          Red Test (Awareness)
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                          56V CPD
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        High cognitive load with dual contrasting terms and 650ms SSML pauses.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Question Count & Topic */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Question Count
                    </label>
                    <div className="flex items-center gap-2">
                      {([21, 42, 49] as const).map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() => setAiQuestionCount(count)}
                          className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                            aiQuestionCount === count
                              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {count}Q
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Topic Keyword (e.g. topic12)
                    </label>
                    <input
                      type="text"
                      value={aiTopic}
                      onChange={(e) => setAiTopic(e.target.value)}
                      placeholder="topic12, animals, verbs..."
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Target CPD Voltage */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Target CPD Voltage (Volts)
                  </label>
                  <input
                    type="number"
                    value={aiTargetVoltage}
                    onChange={(e) => setAiTargetVoltage(Number(e.target.value) || 0)}
                    min={1}
                    max={120}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Standard: 12V for Green Tests (Focus), 56V for Red Tests (Awareness).
                  </span>
                </div>

                {/* Real-time Computed Code & Title Preview */}
                <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                      Auto-computed Metadata:
                    </span>
                    <label className="flex items-center gap-1.5 text-[11px] text-indigo-700 dark:text-indigo-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowCustomCode}
                        onChange={(e) => {
                          setAllowCustomCode(e.target.checked)
                          if (e.target.checked) {
                            setCustomPackageCode(computedPackageCode)
                            setCustomTitle(computedTitle)
                          }
                        }}
                      />
                      <span>Customize manually</span>
                    </label>
                  </div>

                  {allowCustomCode ? (
                    <div className="space-y-2 pt-2">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Package Code</span>
                        <input
                          type="text"
                          value={customPackageCode}
                          onChange={(e) => setCustomPackageCode(e.target.value)}
                          className="w-full text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Package Title</span>
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          className="w-full text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {computedPackageCode}
                      </div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {computedTitle}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    className="ghost text-xs"
                    disabled={creatingPackage}
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary text-xs flex items-center gap-2"
                    disabled={creatingPackage || !selectedLessonId}
                  >
                    {creatingPackage ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Generating & Saving...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Generate & Save Draft Package</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => void handleCreateManualPackage(e)} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Package Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    required
                    placeholder="e.g. Green Test Practice 21Q"
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Version Label
                    </label>
                    <input
                      type="text"
                      value={manualVersionLabel}
                      onChange={(e) => setManualVersionLabel(e.target.value)}
                      placeholder="v1"
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Sessions Count
                    </label>
                    <input
                      type="number"
                      value={manualSessionCount}
                      onChange={(e) => setManualSessionCount(Number(e.target.value) || 1)}
                      min={1}
                      max={10}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Items Per Session
                  </label>
                  <input
                    type="number"
                    value={manualItemsPerSession}
                    onChange={(e) => setManualItemsPerSession(Number(e.target.value) || 1)}
                    min={1}
                    max={20}
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    className="ghost text-xs"
                    disabled={creatingPackage}
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="primary text-xs flex items-center gap-2"
                    disabled={creatingPackage}
                  >
                    {creatingPackage ? 'Creating...' : 'Create Blank Package'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* FULL PACKAGE PREVIEW MODAL */}
      {previewPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
            {/* Preview Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between flex-shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      previewPackage.testType === 'red'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {previewPackage.testType === 'red' ? 'Red Test (Awareness)' : 'Green Test (Focus)'}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {String(previewPackage.pkg.sourceMetadata?.packageCode || previewPackage.pkg.slug)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold">
                    {previewPackage.targetVoltage}V CPD
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {previewPackage.pkg.title.replace(/ · LIVE$/i, '')}
                </h2>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setPreviewPackage(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Preview Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Hierarchy View (Parts breakdown) */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-500" />
                  <span>Test Structure Hierarchy (Sessions & Parts)</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {previewPackage.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Session {sec.sectionOrder}
                        </span>
                        <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                          {sec.targetCvrOhm ?? sec.sectionOrder * 2}Ω CVR
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {sec.title || `Section ${sec.sectionOrder}`}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-2 flex items-center justify-between">
                        <span>Items: {previewPackage.items.filter((i) => i.sectionId === sec.id).length}</span>
                        <span>Intro Spoken ✓</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  <span>Items Table ({previewPackage.items.length} questions)</span>
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Target Term(s)</th>
                        <th className="p-3">Prompt EN / VI</th>
                        <th className="p-3">SSML & Pause</th>
                        <th className="p-3">CVR (TC/LC/TL)</th>
                        <th className="p-3 text-right">TTS Audio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {previewPackage.items.map((item, idx) => {
                        const hasSsml =
                          (item.spokenScriptEn && item.spokenScriptEn.includes('<break')) ||
                          (item.spokenScriptVi && item.spokenScriptVi.includes('<break'))
                        const isPlaying = previewPlayingId === item.id

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="p-3 font-mono font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-medium text-slate-900 dark:text-white">
                              <div>{item.termEn || item.termVi || '—'}</div>
                              {item.termEn && item.termVi && (
                                <div className="text-[11px] text-slate-400">{item.termVi}</div>
                              )}
                            </td>
                            <td className="p-3 space-y-0.5 max-w-xs">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {item.promptEn || item.spokenScriptEn || '—'}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {item.promptVi || item.spokenScriptVi || '—'}
                              </div>
                            </td>
                            <td className="p-3 font-mono text-[10px]">
                              {hasSsml ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                                  Pause 650ms
                                </span>
                              ) : (
                                <span className="text-slate-400">Standard</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {item.measuredCvr ? `${item.measuredCvr}Ω` : '—'}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                TC:{item.tc ?? 1} LC:{item.lc ?? 1} TL:{item.tl ?? 1}
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                type="button"
                                className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 transition-colors inline-flex items-center gap-1"
                                onClick={() => void playItemAudio(item)}
                                disabled={isPlaying}
                                title="Play Google Cloud TTS"
                              >
                                {isPlaying ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Play className="h-3.5 w-3.5 fill-current" />
                                )}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Preview Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-500">
                {previewPackage.items.length} total questions · {previewPackage.sections.length} sessions
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"
                  onClick={() => {
                    const target = previewPackage
                    setPreviewPackage(null)
                    setAudioStudioPackage(target)
                  }}
                >
                  <Headphones className="h-3.5 w-3.5" />
                  <span>Open Audio Studio</span>
                </button>
                <button
                  type="button"
                  className="ghost text-xs"
                  onClick={() => setPreviewPackage(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUDIO STUDIO MODAL */}
      {audioStudioPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Audio Studio: {audioStudioPackage.pkg.title.replace(/ · LIVE$/i, '')}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Google Cloud Text-to-Speech synthesis pipeline & batch generation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                onClick={() => setAudioStudioPackage(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Voice Model Selector */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-4">
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Google Cloud Voice Model
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 font-semibold mb-1">Language</label>
                    <select
                      value={ttsLanguage}
                      onChange={(e) => {
                        const lang = e.target.value as 'vi' | 'en'
                        setTtsLanguage(lang)
                        setTtsVoiceId(
                          lang === 'vi' ? 'google/vi-VN-Neural2-A' : 'google/en-US-Neural2-F',
                        )
                      }}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                    >
                      <option value="en">English (US)</option>
                      <option value="vi">Tiếng Việt (VN)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-500 font-semibold mb-1">
                      Neural / Wavenet Voice
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={ttsVoiceId}
                        onChange={(e) => setTtsVoiceId(e.target.value)}
                        className="flex-1 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200"
                      >
                        {ttsModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => void handleTestTtsVoice()}
                        disabled={testingTtsVoice}
                        className="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        {testingTtsVoice ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                        <span>Nghe thử model</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lifecycle Scripts Preview & Audio */}
              <div className="space-y-3">
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Lifecycle Narrations
                </span>

                <div className="space-y-2">
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Package Start Script</div>
                      <div className="text-[11px] text-slate-500">
                        {audioStudioPackage.testType === 'red'
                          ? 'Bắt đầu bài kiểm tra Red Test (Awareness & Traps). Lắng nghe hai cụm từ và phát âm chính xác.'
                          : 'Bắt đầu bài kiểm tra Green Test (Focus). Hãy lắng nghe và phản xạ nhanh.'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void playScriptAudio(
                          'start',
                          audioStudioPackage.testType === 'red'
                            ? 'Start the Red Test Awareness and Traps assessment. Listen carefully to each term pair.'
                            : 'Start the Green Test Focus assessment. Listen and respond quickly.',
                          'en',
                        )
                      }
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                      title="Play Audio"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">Package Outro Script</div>
                      <div className="text-[11px] text-slate-500">
                        Chúc mừng em đã hoàn thành toàn bộ bài kiểm tra. Em đã thể hiện sự tập trung rất tốt!
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void playScriptAudio(
                          'end',
                          'Congratulations on completing the entire test package. Excellent effort!',
                          'en',
                        )
                      }
                      className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
                      title="Play Audio"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Batch Item Generation Card */}
              <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white">Batch Audio Generation</h4>
                    <p className="text-[11px] text-slate-500">
                      Generate Google Cloud speech assets for all {audioStudioPackage.items.length} questions in this package.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleBatchGenerate(audioStudioPackage)}
                    disabled={batchGenerating || audioStudioPackage.items.length === 0}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {batchGenerating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Generate All Items</span>
                      </>
                    )}
                  </button>
                </div>

                {batchAudioProgress && (
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">
                      <span>Generating audio items...</span>
                      <span>
                        {batchAudioProgress.done} / {batchAudioProgress.total} (
                        {Math.round((batchAudioProgress.done / batchAudioProgress.total) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-indigo-200 dark:bg-indigo-900 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-300"
                        style={{
                          width: `${(batchAudioProgress.done / batchAudioProgress.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Link to Full Studio */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 text-[11px]">
                <span className="text-slate-500">
                  Need waveform editor, approval sign-off, or custom file upload?
                </span>
                {audioStudioPackage.version && (
                  <Link
                    to={`/admin/resources/audio?version=${audioStudioPackage.version.id}`}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                  >
                    <span>Open Advanced Studio</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end flex-shrink-0">
              <button
                type="button"
                className="ghost text-xs"
                onClick={() => setAudioStudioPackage(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT METADATA MODAL */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Edit Package Metadata
            </h3>
            <form onSubmit={(e) => void handleSaveMetadata(e)} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Slug / Code</label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="ghost text-xs"
                  onClick={() => setEditingPackage(null)}
                  disabled={savingMetadata}
                >
                  Cancel
                </button>
                <button type="submit" className="primary text-xs" disabled={savingMetadata}>
                  {savingMetadata ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="h-6 w-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Package?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{deletingPackage.title.replace(/ · LIVE$/i, '')}</strong>? This will cascade-delete all versions, sections, items, and narration assets permanently.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="ghost text-xs"
                onClick={() => setDeletingPackage(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeletePackage()}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

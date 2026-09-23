import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Eye,
  FileText,
  Headphones,
  Layers,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { useFlash } from '../../hooks/useFlash'
import { getSupabase } from '../../lib/supabase'
import {
  batchSaveCciCategories,
  createCciProfile,
  createDraftTestPackage,
  deleteTestPackage,
  listCciCategories,
  listCciProfiles,
  listTestItems,
  listTestPackageVersions,
  listTestPackages,
  listTestSections,
  updateTestPackageMetadata,
} from '../../lib/test-packages'
import {
  calculateCciFromCpd,
  calculateCvr,
  countWords,
  detectPackageTestType,
  validateGreenSentence,
  validateRedCollocations,
  type CciCategory,
  type CciProfile,
  type TestItem,
  type TestPackage,
  type TestPackageVersion,
  type TestSection,
} from '../../modules/catalog/test-package-catalog'
import {
  generateNarration,
  generatePackageFromVocab,
  getFirestoreLessonChunks,
  listFirestoreLessons,
  playGoogleCloudTts,
  uploadNarrationAudio,
  GREEN_TEST_SESSION_LANGUAGES_7X3,
  RED_TEST_SESSION_LANGUAGES_7X3,
  type FirestoreChunk,
  type FirestoreLesson,
  type NarrationGenerationTarget,
} from '../../modules/catalog/live-test-generation'

export { detectPackageTestType }

export type StudioTab = 'packages' | 'content' | 'audio' | 'cci'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { message, error, ok, err } = useFlash()

  // Studio Tab State
  const initialTab = (searchParams.get('tab') as StudioTab) || 'packages'
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab)

  const handleTabChange = (tab: StudioTab) => {
    setActiveTab(tab)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    })
  }

  // Catalog State
  const [packageSummaries, setPackageSummaries] = useState<PackageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Active Selected Package
  const selectedVersionId = searchParams.get('version') ?? ''
  const selectedPackage = useMemo(() => {
    if (!selectedVersionId && packageSummaries.length > 0) return packageSummaries[0]
    return (
      packageSummaries.find((s) => s.version?.id === selectedVersionId) ??
      packageSummaries[0] ??
      null
    )
  }, [packageSummaries, selectedVersionId])

  const selectPackage = (pkg: PackageSummary) => {
    if (!pkg.version) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('version', pkg.version!.id)
      return next
    })
  }

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createTab, setCreateTab] = useState<'ai' | 'manual'>('ai')
  const [creatingPackage, setCreatingPackage] = useState(false)

  // AI Active Generator Fields (Fully customizable CPD, Sessions, Questions, CVR)
  const [lessons, setLessons] = useState<FirestoreLesson[]>([])
  const [selectedLessonId, setSelectedLessonId] = useState('')
  const [lessonChunks, setLessonChunks] = useState<FirestoreChunk[]>([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const [aiTestType, setAiTestType] = useState<'green' | 'red'>('red')
  const [aiSessionCount, setAiSessionCount] = useState<number>(7)
  const [aiQuestionsPerSession, setAiQuestionsPerSession] = useState<number>(3)
  const [aiTargetVoltage, setAiTargetVoltage] = useState(56)
  const aiTopic = 'ecommerce'
  const [customPackageCode, setCustomPackageCode] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [allowCustomCode, setAllowCustomCode] = useState(false)

  // Direct UI controls for CVR = TC x TL x LC
  const [uiTc, setUiTc] = useState<number>(3.0) // Term Complexity, default 3 ohm
  const [uiTl, setUiTl] = useState<number>(2.0) // Topic Level / Latency (1.0 to 2.0)
  const [uiLc, setUiLc] = useState<number>(1.15) // Length Complexity (1.0 to 2.5)
  const [perSessionAmple, setPerSessionAmple] = useState<number[]>([12, 7, 5, 10, 6, 4, 4])

  // Manual Blank Draft fields
  const [manualTitle, setManualTitle] = useState('')
  const [manualVersionLabel, setManualVersionLabel] = useState('v1')
  const [manualSessionCount, setManualSessionCount] = useState(7)
  const [manualItemsPerSession, setManualItemsPerSession] = useState(3)

  // Edit Metadata Modal
  const [editingPackage, setEditingPackage] = useState<TestPackage | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [savingMetadata, setSavingMetadata] = useState(false)

  // Delete Confirmation Modal
  const [deletingPackage, setDeletingPackage] = useState<TestPackage | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Preview Modal
  const [previewPackage, setPreviewPackage] = useState<PackageSummary | null>(null)

  // Audio Studio State
  const [audioVoiceId, setAudioVoiceId] = useState('google/vi-VN-Neural2-A')
  const [audioVoiceLang, setAudioVoiceLang] = useState<'vi' | 'en'>('vi')
  const [testingTtsVoice, setTestingTtsVoice] = useState(false)
  const [playingAudioKey, setPlayingAudioKey] = useState<string | null>(null)
  const [batchAudioProgress, setBatchAudioProgress] = useState<{ done: number; total: number } | null>(
    null,
  )
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [uploadingTargetKey, setUploadingTargetKey] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pendingUploadTarget, setPendingUploadTarget] = useState<{
    target: NarrationGenerationTarget
    part?: number
    testSectionId?: string
    testItemId?: string
    language: 'vi' | 'en'
    text: string
  } | null>(null)

  // CCI Profiles Tab State
  const [cciProfiles, setCciProfiles] = useState<CciProfile[]>([])
  const [selectedCciProfileId, setSelectedCciProfileId] = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<CciCategory[]>([])
  const [loadingCci, setLoadingCci] = useState(false)
  const [savingCci, setSavingCci] = useState(false)
  const [showNewProfileModal, setShowNewProfileModal] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [newProfileDesc, setNewProfileDesc] = useState('')

  // Derived calculations
  const totalQuestions = useMemo(
    () => aiSessionCount * aiQuestionsPerSession,
    [aiSessionCount, aiQuestionsPerSession],
  )

  const computedCvr = useMemo(() => {
    return calculateCvr(uiTc, uiLc, uiTl)
  }, [uiTc, uiLc, uiTl])

  const computedDerivedCci = useMemo(() => {
    return calculateCciFromCpd(aiTargetVoltage, computedCvr)
  }, [aiTargetVoltage, computedCvr])

  // Sync test type defaults for CVR/CPD/Ample
  useEffect(() => {
    if (aiTestType === 'green') {
      setAiTargetVoltage(12)
      setUiTc(3.0)
      setUiTl(1.0)
      setUiLc(1.0)
      setPerSessionAmple([6, 6, 4, 4, 3, 3, 2])
    } else {
      setAiTargetVoltage(56)
      setUiTc(3.0)
      setUiTl(2.0)
      setUiLc(1.15)
      setPerSessionAmple([12, 7, 5, 10, 6, 4, 4])
    }
  }, [aiTestType])

  // Compute live package code and title
  const computedPackageCode = useMemo(() => {
    const prefix = aiTestType === 'red' ? 'R01' : 'G01'
    const cleanTopic = aiTopic.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const topicSegment = cleanTopic ? `-${cleanTopic}` : ''
    return `${prefix}-${totalQuestions}Q${topicSegment}-${aiTargetVoltage}V`
  }, [aiTestType, totalQuestions, aiTopic, aiTargetVoltage])

  const selectedLesson = useMemo(() => {
    return lessons.find((l) => l.id === selectedLessonId) ?? null
  }, [lessons, selectedLessonId])

  const computedTitle = useMemo(() => {
    const typeLabel = aiTestType === 'red' ? 'RED (Awareness & Traps)' : 'GREEN (Focus)'
    const lessonLabel = selectedLesson?.lessonTitle || selectedLessonId || 'General'
    return `[${typeLabel}] ${lessonLabel} · ${totalQuestions}Q - ${aiTargetVoltage}V`
  }, [aiTestType, selectedLesson, selectedLessonId, totalQuestions, aiTargetVoltage])

  const activePackageCode =
    allowCustomCode && customPackageCode ? customPackageCode : computedPackageCode
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
              audioApproved = (variants ?? []).filter(
                (v: any) => v.approval_status === 'approved',
              ).length
            }
          }

          const testType = detectPackageTestType(pkg)
          const targetVoltage = Number(
            pkg.sourceMetadata?.targetVoltage ??
              pkg.sourceMetadata?.targetCpd ??
              (testType === 'red' ? 56 : 12),
          )
          const questionCount =
            items.length || Number(pkg.sourceMetadata?.questionCount ?? 21)

          const cvrValues = items
            .map((i) => i.measuredCvr)
            .filter((c): c is number => c != null && !isNaN(c))
          const cvrMin = cvrValues.length
            ? Math.min(...cvrValues)
            : testType === 'red'
              ? 4.6
              : 2.0
          const cvrMax = cvrValues.length
            ? Math.max(...cvrValues)
            : testType === 'red'
              ? 13.8
              : 6.0

          const isLegacyLive =
            pkg.title.includes('· LIVE') || version?.versionLabel === 'LIVE'

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

  // Load CCI Profiles
  const loadCciProfiles = useCallback(async () => {
    setLoadingCci(true)
    try {
      const res = await listCciProfiles()
      if (res.ok) {
        setCciProfiles(res.data)
        if (res.data.length > 0 && !selectedCciProfileId) {
          setSelectedCciProfileId(res.data[0].id)
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingCci(false)
    }
  }, [selectedCciProfileId])

  // Load Categories for Selected CCI Profile
  useEffect(() => {
    if (!selectedCciProfileId) {
      setSelectedCategories([])
      return
    }
    void (async () => {
      const res = await listCciCategories(selectedCciProfileId)
      if (res.ok) setSelectedCategories(res.data)
    })()
  }, [selectedCciProfileId])

  // Initial Load
  useEffect(() => {
    void loadPackages()
    void loadCciProfiles()
    void (async () => {
      try {
        const loadedLessons = await listFirestoreLessons()
        setLessons(loadedLessons)
        if (loadedLessons.length > 0) {
          setSelectedLessonId(loadedLessons[0].id)
        }
      } catch {
        // fallback
      }
    })()
  }, [loadPackages, loadCciProfiles])

  // Load chunks when lesson changes
  useEffect(() => {
    if (!selectedLessonId) {
      setLessonChunks([])
      return
    }
    setLoadingChunks(true)
    void getFirestoreLessonChunks(selectedLessonId)
      .then((chunks) => setLessonChunks(chunks))
      .catch(() => setLessonChunks([]))
      .finally(() => setLoadingChunks(false))
  }, [selectedLessonId])

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
        return (
          cleanTitle.includes(query) ||
          slug.includes(query) ||
          desc.includes(query) ||
          code.includes(query)
        )
      }
      return true
    })
  }, [packageSummaries, filterTab, searchQuery])

  // Handle AI Package Generation with custom CVR math and Ample
  async function handleGenerateAiPackage(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLessonId) return err('Vui lòng chọn bài học Firestore')
    setCreatingPackage(true)
    try {
      const res = await generatePackageFromVocab({
        testType: aiTestType,
        lessonId: selectedLessonId,
        targetQuestions: totalQuestions,
        sessionCount: aiSessionCount,
        questionsPerSession: aiQuestionsPerSession,
        sessionLayout: `${aiSessionCount}x${aiQuestionsPerSession}`,
        sessionLanguages:
          aiTestType === 'red'
            ? RED_TEST_SESSION_LANGUAGES_7X3
            : GREEN_TEST_SESSION_LANGUAGES_7X3,
        targetCpd: aiTargetVoltage,
        tc: uiTc,
        tl: uiTl,
        lexicalComplexity: uiLc,
        cciProgression: perSessionAmple,
        packageCode: activePackageCode,
        title: activeTitle,
        versionLabel: 'v1',
        saveDraft: true,
      })

      ok(`Đã tạo thành công gói bài test "${res.title}" (${res.itemsCount} câu)!`)
      setShowCreateModal(false)
      await loadPackages()
      handleTabChange('content')
    } catch (e) {
      err(e instanceof Error ? e.message : 'Tạo bài test thất bại')
    } finally {
      setCreatingPackage(false)
    }
  }

  // Handle Manual Package Creation
  async function handleCreateManualPackage(e: React.FormEvent) {
    e.preventDefault()
    if (!manualTitle.trim()) return err('Tiêu đề không được để trống')
    setCreatingPackage(true)
    try {
      const defaultSessions = Array.from({ length: manualSessionCount }, (_, idx) => ({
        sectionOrder: idx + 1,
        title: `Session ${idx + 1}`,
        targetCvrOhm: (idx + 1) * 2 - 1,
        cciProfileId: '',
        cciCategoryId: '',
        cciCategoryLabel: 'Focus Baseline',
        cciValue: 4,
      }))

      const res = await createDraftTestPackage({
        title: manualTitle.trim(),
        versionLabel: manualVersionLabel.trim() || 'v1',
        sessionCount: manualSessionCount,
        itemsPerSession: manualItemsPerSession,
        sessions: defaultSessions,
      })
      if (!res.ok) throw new Error(res.error)

      ok(`Đã tạo gói bài test thủ công "${res.data.package.title}"`)
      setShowCreateModal(false)
      setManualTitle('')
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Tạo gói thủ công thất bại')
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
      ok('Cập nhật thông tin gói thành công.')
      setEditingPackage(null)
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Cập nhật thất bại')
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
      ok(`Đã xóa vĩnh viễn gói "${deletingPackage.title}"`)
      setDeletingPackage(null)
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Xóa gói bài test thất bại')
    } finally {
      setDeleting(false)
    }
  }

  // Inline Test Voice Playback
  async function handleTestVoice() {
    const sample =
      audioVoiceLang === 'vi'
        ? 'Xin chào! Đây là mô hình giọng đọc chuẩn Google Cloud Neural2 trên hệ thống Chunks LMS.'
        : 'Hello! This is a high-fidelity Google Cloud Neural2 voice model on Chunks LMS.'
    setTestingTtsVoice(true)
    try {
      await playGoogleCloudTts(sample, audioVoiceLang, audioVoiceId)
    } catch (e) {
      err(e instanceof Error ? e.message : 'Lỗi nghe thử giọng đọc')
    } finally {
      setTestingTtsVoice(false)
    }
  }

  // Inline Audio Playback for Item / Intro
  async function handlePlayItemAudio(key: string, text: string, lang: 'vi' | 'en') {
    setPlayingAudioKey(key)
    try {
      const voice = lang === 'vi' ? 'google/vi-VN-Neural2-A' : 'google/en-US-Neural2-F'
      await playGoogleCloudTts(text, lang, voice)
    } catch (e) {
      err(e instanceof Error ? e.message : 'Phát âm thanh thất bại')
    } finally {
      setPlayingAudioKey(null)
    }
  }

  // Regenerate Audio via GCP TTS
  async function handleRegenerateAudio(
    target: NarrationGenerationTarget,
    text: string,
    lang: 'vi' | 'en',
    sectionId?: string,
    itemId?: string,
    part?: number,
  ) {
    if (!selectedPackage?.version) return
    const voice = lang === 'vi' ? 'google/vi-VN-Neural2-A' : 'google/en-US-Neural2-F'
    try {
      await generateNarration({
        packageVersionId: selectedPackage.version.id,
        target,
        part,
        testSectionId: sectionId,
        testItemId: itemId,
        language: lang,
        voiceId: voice,
        textOverride: text,
      })
      ok('Đã sinh mới file âm thanh từ Google Cloud TTS!')
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Lỗi sinh âm thanh từ GCP')
    }
  }

  // Trigger Custom Audio Upload File Picker
  function handleTriggerUpload(
    target: NarrationGenerationTarget,
    text: string,
    lang: 'vi' | 'en',
    sectionId?: string,
    itemId?: string,
    part?: number,
  ) {
    setPendingUploadTarget({
      target,
      part,
      testSectionId: sectionId,
      testItemId: itemId,
      language: lang,
      text,
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // Process Uploaded File
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pendingUploadTarget || !selectedPackage?.version) return
    setUploadingTargetKey('uploading')
    try {
      const voice =
        pendingUploadTarget.language === 'vi'
          ? 'google/vi-VN-Neural2-A'
          : 'google/en-US-Neural2-F'
      await uploadNarrationAudio({
        packageVersionId: selectedPackage.version.id,
        target: pendingUploadTarget.target,
        part: pendingUploadTarget.part,
        testSectionId: pendingUploadTarget.testSectionId,
        testItemId: pendingUploadTarget.testItemId,
        language: pendingUploadTarget.language,
        voiceId: voice,
        sourceTextHash: `hash-${Date.now()}`,
        file,
      })
      ok(`Đã tải lên và phê duyệt file audio: "${file.name}"!`)
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Tải lên file audio thất bại')
    } finally {
      setUploadingTargetKey(null)
      setPendingUploadTarget(null)
    }
  }

  // Batch generate all missing audio
  async function handleBatchGenerateAll() {
    if (!selectedPackage?.version) return
    setBatchGenerating(true)
    setBatchAudioProgress({ done: 0, total: selectedPackage.items.length })
    let done = 0
    try {
      for (const item of selectedPackage.items) {
        const sec = selectedPackage.sections.find((s) => s.id === item.sectionId)
        const lang: 'vi' | 'en' =
          selectedPackage.testType === 'green'
            ? sec && sec.sectionOrder <= 3
              ? 'en'
              : 'vi'
            : sec && sec.sectionOrder <= 3
              ? 'vi'
              : 'en'
        const voice = lang === 'vi' ? 'google/vi-VN-Neural2-A' : 'google/en-US-Neural2-F'
        const script =
          lang === 'vi'
            ? item.spokenScriptVi || item.promptVi || ''
            : item.spokenScriptEn || item.promptEn || ''

        await generateNarration({
          packageVersionId: selectedPackage.version.id,
          target: 'test_item',
          testItemId: item.id,
          language: lang,
          voiceId: voice,
          textOverride: script,
        })
        done++
        setBatchAudioProgress({ done, total: selectedPackage.items.length })
      }
      ok(`Đã tạo xong ${done} file âm thanh Google Cloud TTS!`)
      await loadPackages()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Sinh âm thanh hàng loạt dừng do lỗi')
    } finally {
      setBatchGenerating(false)
      setBatchAudioProgress(null)
    }
  }

  // Save CCI Categories (Ample CRUD)
  async function handleSaveCciCategories() {
    if (!selectedCciProfileId) return
    setSavingCci(true)
    try {
      const res = await batchSaveCciCategories(
        selectedCciProfileId,
        selectedCategories.map((c) => ({
          id: c.id,
          categoryOrder: c.categoryOrder,
          label: c.label,
          value: c.value,
          description: c.description,
        })),
      )
      if (!res.ok) throw new Error(res.error)
      ok('Đã lưu thành công các thông số Ample cho profile!')
      await loadCciProfiles()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Lưu CCI thất bại')
    } finally {
      setSavingCci(false)
    }
  }

  // Create new CCI Profile
  async function handleCreateProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newProfileName.trim()) return
    try {
      const sb = getSupabase() as any
      const { data: orgs } = await sb.from('organizations').select('id').limit(1)
      const orgId = orgs?.[0]?.id
      if (!orgId) throw new Error('Organization not found')

      const res = await createCciProfile({
        organizationId: orgId,
        name: newProfileName.trim(),
        description: newProfileDesc.trim() || null,
        status: 'active',
      })
      if (!res.ok) throw new Error(res.error)

      // Add default 7 session categories (Ample)
      await batchSaveCciCategories(res.data.id, [
        { categoryOrder: 1, label: 'Session 1 Ample', value: 6.0 },
        { categoryOrder: 2, label: 'Session 2 Ample', value: 6.0 },
        { categoryOrder: 3, label: 'Session 3 Ample', value: 4.0 },
        { categoryOrder: 4, label: 'Session 4 Ample', value: 4.0 },
        { categoryOrder: 5, label: 'Session 5 Ample', value: 3.0 },
        { categoryOrder: 6, label: 'Session 6 Ample', value: 3.0 },
        { categoryOrder: 7, label: 'Session 7 Ample', value: 2.0 },
      ])

      ok(`Đã tạo hồ sơ CCI mới: "${newProfileName}"!`)
      setShowNewProfileModal(false)
      setNewProfileName('')
      setNewProfileDesc('')
      setSelectedCciProfileId(res.data.id)
      await loadCciProfiles()
    } catch (e) {
      err(e instanceof Error ? e.message : 'Tạo hồ sơ CCI thất bại')
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Hidden File Input for Custom Audio Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => void handleFileSelected(e)}
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        className="hidden"
      />

      <PageHeader
        title="Package Tests Studio"
        subtitle="Quản lý toàn diện gói bài test: CVR/CPD Physics, cấu hình Ample (CCI), kiểm soát nội dung câu hỏi Green & Red test và pipeline âm thanh Google Cloud TTS."
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="ghost flex items-center gap-2"
              onClick={() => void loadPackages()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
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

      {/* Main Studio Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2 py-2">
          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'packages'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            onClick={() => handleTabChange('packages')}
          >
            <Layers className="h-4 w-4" />
            <span>Gói bài test ({packageSummaries.length})</span>
          </button>

          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'content'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            onClick={() => handleTabChange('content')}
          >
            <FileText className="h-4 w-4" />
            <span>Soạn thảo & Nội dung câu</span>
          </button>

          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'audio'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            onClick={() => handleTabChange('audio')}
          >
            <Headphones className="h-4 w-4" />
            <span>Quản lý Audio & Review</span>
          </button>

          <button
            type="button"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'cci'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            onClick={() => handleTabChange('cci')}
          >
            <Zap className="h-4 w-4" />
            <span>Hệ số CCI & Ample CRUD</span>
          </button>
        </div>

        {selectedPackage && activeTab !== 'packages' && (
          <div className="flex items-center gap-2 text-xs py-2 pr-2">
            <span className="text-slate-400">Đang chọn:</span>
            <select
              value={selectedPackage.version?.id ?? ''}
              onChange={(e) => {
                const target = packageSummaries.find((s) => s.version?.id === e.target.value)
                if (target) selectPackage(target)
              }}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 focus:outline-hidden"
            >
              {packageSummaries.map((s) => (
                <option key={s.pkg.id} value={s.version?.id ?? ''}>
                  {s.pkg.title.replace(/ · LIVE$/i, '')} ({s.testType.toUpperCase()} - {s.targetVoltage}V)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PACKAGES CATALOG                                  */}
      {/* ======================================================== */}
      {activeTab === 'packages' && (
        <div className="space-y-6">
          {/* Catalog Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filterTab === 'all'
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setFilterTab('all')}
              >
                Tất cả ({packageSummaries.length})
              </button>
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  filterTab === 'green'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
                onClick={() => setFilterTab('green')}
              >
                <span>Green Tests (Focus 12V)</span>
              </button>
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  filterTab === 'red'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-700 hover:bg-rose-50'
                }`}
                onClick={() => setFilterTab('red')}
              >
                <span>Red Tests (Awareness 56V)</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã gói, bài học..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 transition-all"
              />
            </div>
          </div>

          {/* Packages Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="h-8 w-8 text-slate-400 animate-spin mb-3" />
              <p className="text-xs text-slate-500 font-medium">Đang tải danh mục bài test...</p>
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Không tìm thấy gói bài test</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Chưa có gói bài test nào phù hợp với bộ lọc. Hãy tạo bài test mới bằng AI Generator hoặc làm mới danh sách.
              </p>
              <button
                type="button"
                className="primary text-xs mx-auto"
                onClick={() => setShowCreateModal(true)}
              >
                Tạo Bài Test Đầu Tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSummaries.map((summary) => {
                const isGreen = summary.testType === 'green'
                const cleanTitle = summary.pkg.title.replace(/ · LIVE$/i, '')
                const audioRatio =
                  summary.audioTotalCount > 0
                    ? Math.round((summary.audioApprovedCount / summary.audioTotalCount) * 100)
                    : 0

                return (
                  <div
                    key={summary.pkg.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            isGreen
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                          }`}
                        >
                          {isGreen ? 'GREEN FOCUS' : 'RED AWARENESS'} • {summary.targetVoltage}V
                        </span>

                        <span className="text-[11px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          {summary.questionCount}Q
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors line-clamp-2">
                          {cleanTitle}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {summary.pkg.description || 'Chưa có mô tả chi tiết cho gói bài test.'}
                        </p>
                      </div>

                      {/* Physics & Audio Meter */}
                      <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 space-y-2 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Kháng trở CVR (Ohm):</span>
                          <span className="font-mono font-bold text-slate-800">
                            {summary.cvrMin.toFixed(1)}Ω – {summary.cvrMax.toFixed(1)}Ω
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Tiến độ Audio:</span>
                          <span className="font-bold text-indigo-600">
                            {summary.audioApprovedCount} / {summary.audioTotalCount} ({audioRatio}%)
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              audioRatio === 100
                                ? 'bg-emerald-500'
                                : audioRatio > 0
                                  ? 'bg-indigo-500'
                                  : 'bg-slate-300'
                            }`}
                            style={{ width: `${audioRatio}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            selectPackage(summary)
                            handleTabChange('content')
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Soạn nội dung</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            selectPackage(summary)
                            handleTabChange('audio')
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors flex items-center gap-1"
                        >
                          <Headphones className="h-3.5 w-3.5" />
                          <span>Audio</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewPackage(summary)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Xem trước cấu trúc"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingPackage(summary.pkg)
                            setEditTitle(summary.pkg.title)
                            setEditSlug(summary.pkg.slug)
                            setEditDescription(summary.pkg.description || '')
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Sửa thông tin"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingPackage(summary.pkg)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Xóa vĩnh viễn"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CONTENT & QUESTIONS INSPECTOR                     */}
      {/* ======================================================== */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          {!selectedPackage ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              Vui lòng chọn một gói bài test từ danh mục.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Package Meta Header */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase ${
                        selectedPackage.testType === 'green'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {selectedPackage.testType.toUpperCase()} TEST • {selectedPackage.targetVoltage}V
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Mã: {selectedPackage.pkg.slug}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {selectedPackage.pkg.title.replace(/ · LIVE$/i, '')}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleTabChange('audio')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 transition-all"
                  >
                    <Headphones className="h-4 w-4" />
                    <span>Mở Audio Studio</span>
                  </button>
                </div>
              </div>

              {/* Sessions Accordion List */}
              <div className="space-y-4">
                {selectedPackage.sections.map((sec, secIdx) => {
                  const secItems = selectedPackage.items.filter((i) => i.sectionId === sec.id)
                  const isGreen = selectedPackage.testType === 'green'

                  return (
                    <div
                      key={sec.id}
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
                    >
                      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-slate-200 font-bold text-xs flex items-center justify-center text-slate-700">
                            {sec.sectionOrder}
                          </span>
                          <div>
                            <div className="font-bold text-slate-800 text-xs">
                              {sec.title || `Session ${sec.sectionOrder}`}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {secItems.length} câu hỏi • Mục tiêu CVR: {sec.targetCvrOhm ?? 3}Ω
                            </div>
                          </div>
                        </div>

                        {/* Session Physics Badge */}
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                            CVR: {sec.targetCvrOhm ?? 3}Ω
                          </span>
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-mono">
                            Ample: {perSessionAmple[secIdx] ?? 6}A
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                            CPD: {selectedPackage.targetVoltage}V
                          </span>
                        </div>
                      </div>

                      {/* Items Table */}
                      <div className="divide-y divide-slate-100">
                        {secItems.map((item) => {
                          const wordsVi = countWords(item.promptVi || '')
                          const greenValidation = isGreen
                            ? validateGreenSentence(item.promptVi || '', { minWords: 8, maxWords: 22 })
                            : null

                          const hintsList = !isGreen && item.promptVi ? item.promptVi.split('/') : []
                          const redValidation = !isGreen ? validateRedCollocations(hintsList) : null

                          return (
                            <div key={item.id} className="p-4 hover:bg-slate-50/50 transition-colors space-y-2">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1.5 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      #{item.itemOrder}
                                    </span>
                                    <span className="font-bold text-xs text-slate-800">
                                      {item.termVi || 'Cụm từ trọng tâm'}
                                    </span>
                                    {item.termEn && (
                                      <span className="text-xs text-slate-400 font-medium">
                                        ({item.termEn})
                                      </span>
                                    )}
                                  </div>

                                  {/* Vietnamese Prompt */}
                                  <div className="text-xs text-slate-900 font-medium flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-rose-500 uppercase">VI:</span>
                                    <span>{item.promptVi}</span>
                                  </div>

                                  {/* English Prompt */}
                                  <div className="text-xs text-slate-600 flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase">EN:</span>
                                    <span>{item.promptEn}</span>
                                  </div>
                                </div>

                                {/* Validation Meters */}
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                  {isGreen && greenValidation && (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                        greenValidation.valid
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                                      }`}
                                    >
                                      {greenValidation.valid ? '✓' : '⚠️'} {wordsVi} từ (Giới hạn: 8–22 từ)
                                    </span>
                                  )}

                                  {!isGreen && redValidation && (
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                        redValidation.valid
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                                      }`}
                                    >
                                      {redValidation.valid ? '✓ Zero single words' : '⚠️ Chứa từ đơn'} (
                                      {redValidation.totalHints} hints)
                                    </span>
                                  )}

                                  <div className="text-[10px] font-mono text-slate-400">
                                    TC: {item.tc ?? 2} • LC: {item.lc ?? 1} • TL: {item.tl ?? 1} • CVR: {item.measuredCvr ?? 3}Ω
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: AUDIO MANAGEMENT & REVIEW STUDIO                  */}
      {/* ======================================================== */}
      {activeTab === 'audio' && (
        <div className="space-y-6">
          {!selectedPackage ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-xs">
              Vui lòng chọn một gói bài test từ danh mục để quản lý âm thanh.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Studio Header Toolbar */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Quản lý & Review Audio Google Cloud TTS
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gói bài test: <strong className="text-slate-800">{selectedPackage.pkg.title.replace(/ · LIVE$/i, '')}</strong> • Giọng đọc chuẩn GCP Text-to-Speech API
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={audioVoiceId}
                    onChange={(e) => {
                      setAudioVoiceId(e.target.value)
                      setAudioVoiceLang(e.target.value.includes('vi-VN') ? 'vi' : 'en')
                    }}
                    className="text-xs border border-slate-300 rounded-xl px-3 py-1.5 bg-white text-slate-800 focus:outline-hidden"
                  >
                    <option value="google/vi-VN-Neural2-A">vi-VN-Neural2-A (Nữ - Tiếng Việt)</option>
                    <option value="google/vi-VN-Neural2-D">vi-VN-Neural2-D (Nam - Tiếng Việt)</option>
                    <option value="google/en-US-Neural2-F">en-US-Neural2-F (Nữ - Tiếng Anh)</option>
                    <option value="google/en-US-Neural2-J">en-US-Neural2-J (Nam - Tiếng Anh)</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => void handleTestVoice()}
                    disabled={testingTtsVoice}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {testingTtsVoice ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Volume2 className="h-3.5 w-3.5" />}
                    <span>Test Giọng</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleBatchGenerateAll()}
                    disabled={batchGenerating || selectedPackage.items.length === 0}
                    className="px-4 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {batchGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    <span>Sinh Tất Cả Câu Bằng GCP</span>
                  </button>
                </div>
              </div>

              {/* Batch Progress Bar */}
              {batchAudioProgress && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-xs text-indigo-900 font-bold">
                    <span>Đang gọi Google Cloud TTS sinh âm thanh...</span>
                    <span>
                      {batchAudioProgress.done} / {batchAudioProgress.total} (
                      {Math.round((batchAudioProgress.done / batchAudioProgress.total) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-indigo-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-300"
                      style={{
                        width: `${(batchAudioProgress.done / batchAudioProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {uploadingTargetKey && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                  <span>Đang tải lên và xử lý tệp audio ghi đè...</span>
                </div>
              )}

              {/* 1. Lifecycle Narrations Section */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">1. Audio Giới Thiệu & Kết Thúc (Lifecycle)</h4>
                    <p className="text-[11px] text-slate-500">
                      Bao gồm lời chào đầu bài (package_start), giới thiệu từng phần (part_intro), và lời chúc mừng kết thúc (package_end).
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Package Start */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">Lời Chào Đầu Bài (Package Start)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        package_start
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 italic">
                      "Chào mừng em đến với bài kiểm tra Chunks LMS. Lắng nghe cẩn thận và phát âm chính xác..."
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() =>
                          void handlePlayItemAudio(
                            'pkg_start',
                            'Chào mừng em đến với bài kiểm tra Chunks LMS. Lắng nghe cẩn thận và phát âm chính xác.',
                            'vi',
                          )
                        }
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center gap-1 transition-colors"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>Nghe thử</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleRegenerateAudio(
                            'package_start',
                            'Chào mừng em đến với bài kiểm tra Chunks LMS. Lắng nghe cẩn thận và phát âm chính xác.',
                            'vi',
                          )
                        }
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Sinh GCP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleTriggerUpload(
                            'package_start',
                            'Chào mừng em đến với bài kiểm tra Chunks LMS.',
                            'vi',
                          )
                        }
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                      >
                        <Upload className="h-3 w-3" />
                        <span>Upload File</span>
                      </button>
                    </div>
                  </div>

                  {/* Package End */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800">Lời Chúc Mừng Kết Thúc (Package End)</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        package_end
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 italic">
                      "Chúc mừng em đã hoàn thành toàn bộ bài kiểm tra. Em đã thể hiện sự tập trung và lưu loát rất xuất sắc!"
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                      <button
                        type="button"
                        onClick={() =>
                          void handlePlayItemAudio(
                            'pkg_end',
                            'Chúc mừng em đã hoàn thành toàn bộ bài kiểm tra. Em đã thể hiện sự tập trung và lưu loát rất xuất sắc!',
                            'vi',
                          )
                        }
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 flex items-center gap-1 transition-colors"
                      >
                        <Play className="h-3 w-3 fill-current" />
                        <span>Nghe thử</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleRegenerateAudio(
                            'package_end',
                            'Chúc mừng em đã hoàn thành toàn bộ bài kiểm tra. Em đã thể hiện sự tập trung và lưu loát rất xuất sắc!',
                            'vi',
                          )
                        }
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Sinh GCP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleTriggerUpload(
                            'package_end',
                            'Chúc mừng em đã hoàn thành toàn bộ bài kiểm tra.',
                            'vi',
                          )
                        }
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1 transition-colors"
                      >
                        <Upload className="h-3 w-3" />
                        <span>Upload File</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Test Items Audio Review List */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">2. Audio Từng Câu Hỏi ({selectedPackage.items.length} câu)</h4>
                    <p className="text-[11px] text-slate-500">
                      Nghe thử trực tiếp giọng GCP Neural2, tạo lại (regenerate) hoặc tải lên file audio ghi âm thực tế.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto pr-2">
                  {selectedPackage.items.map((item) => {
                    const sec = selectedPackage.sections.find((s) => s.id === item.sectionId)
                    const lang: 'vi' | 'en' =
                      selectedPackage.testType === 'green'
                        ? sec && sec.sectionOrder <= 3
                          ? 'en'
                          : 'vi'
                        : sec && sec.sectionOrder <= 3
                          ? 'vi'
                          : 'en'
                    const script =
                      lang === 'vi'
                        ? item.spokenScriptVi || item.promptVi || ''
                        : item.spokenScriptEn || item.promptEn || ''

                    return (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50 px-2 rounded-xl transition-colors">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              #{item.itemOrder}
                            </span>
                            <span className="font-bold text-xs text-slate-800">
                              {item.termVi || 'Core Term'}
                            </span>
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">
                              {lang}
                            </span>
                          </div>
                          <div className="text-xs text-slate-700 line-clamp-1 font-medium">
                            {script}
                          </div>
                        </div>

                        {/* Audio Item Controls */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => void handlePlayItemAudio(`item_${item.id}`, script, lang)}
                            disabled={playingAudioKey === `item_${item.id}`}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                            title="Nghe thử"
                          >
                            {playingAudioKey === `item_${item.id}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Play className="h-3.5 w-3.5 fill-current" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleRegenerateAudio('test_item', script, lang, item.sectionId, item.id)
                            }
                            className="p-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                            title="Sinh lại bằng GCP TTS"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleTriggerUpload('test_item', script, lang, item.sectionId, item.id)
                            }
                            className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                            title="Upload audio thay thế"
                          >
                            <Upload className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: CCI & AMPLE PROFILES CRUD                         */}
      {/* ======================================================== */}
      {activeTab === 'cci' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Quản lý Hệ Số CCI & Cường Độ Ample (A)
              </h3>
              <p className="text-xs text-slate-500">
                Thiết lập mức cường độ nhận thức cho từng session (Session 1 đến 7) để phục vụ công thức CPD = CVR × CCI.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedCciProfileId}
                onChange={(e) => setSelectedCciProfileId(e.target.value)}
                className="text-xs border border-slate-300 rounded-xl px-3 py-1.5 bg-white text-slate-800 focus:outline-hidden font-bold"
              >
                {cciProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.versionLabel})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowNewProfileModal(true)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Hồ sơ mới</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSaveCciCategories()}
                disabled={savingCci || selectedCategories.length === 0}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {savingCci ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Lưu Thay Đổi Ample</span>
              </button>
            </div>
          </div>

          {/* Categories Ample Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs">
                Danh mục Session & Giá trị Ample (A)
              </h4>
              <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                {loadingCci && <Loader2 className="h-3 w-3 animate-spin text-amber-600" />}
                <span>{selectedCategories.length} sessions được cấu hình</span>
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {selectedCategories.map((cat, idx) => (
                <div key={cat.id || idx} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-amber-100 font-bold text-xs text-amber-800 flex items-center justify-center">
                      S{cat.categoryOrder}
                    </span>
                    <div>
                      <div className="font-bold text-xs text-slate-800">{cat.label}</div>
                      <div className="text-[11px] text-slate-400">
                        {cat.description || 'Mức độ tiêu hao nhận thức theo phiên'}
                      </div>
                    </div>
                  </div>

                  {/* Ample Value Input */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500">Ample:</span>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        max="24"
                        value={cat.value}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setSelectedCategories((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, value: val } : c)),
                          )
                        }}
                        className="w-16 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center focus:outline-hidden"
                      />
                      <span className="text-xs font-bold text-amber-600">A</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategories((prev) => prev.filter((_, i) => i !== idx))
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Xóa session"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const nextOrder = selectedCategories.length + 1
                  setSelectedCategories((prev) => [
                    ...prev,
                    {
                      id: `temp_${Date.now()}`,
                      profileId: selectedCciProfileId,
                      categoryOrder: nextOrder,
                      label: `Session ${nextOrder} Ample`,
                      value: 4.0,
                      description: `Session ${nextOrder} cognitive rate`,
                      metadata: {},
                    },
                  ])
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Thêm Session Ample</span>
              </button>

              <button
                type="button"
                onClick={() => void handleSaveCciCategories()}
                className="primary text-xs"
                disabled={savingCci}
              >
                {savingCci ? 'Đang lưu...' : 'Lưu Thay Đổi Ample'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ACTIVE PACKAGE CREATOR MODAL                             */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Create Test Package
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tạo bài test chủ động: nhập CPD, số session, số câu, và tùy chỉnh tham số CVR (TC x TL x LC).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Mode Selector */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2">
              <button
                type="button"
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  createTab === 'ai'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setCreateTab('ai')}
              >
                <span className="flex items-center gap-1.5">
                  <WandSparkles className="h-3.5 w-3.5" />
                  <span>AI Generator (Firestore Vocab)</span>
                </span>
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  createTab === 'manual'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                onClick={() => setCreateTab('manual')}
              >
                Manual Blank Draft
              </button>
            </div>

            {/* Modal Body */}
            {createTab === 'ai' ? (
              <form onSubmit={(e) => void handleGenerateAiPackage(e)} className="p-6 space-y-6 text-xs">
                {/* Dynamic Test Type */}
                <div className="space-y-2">
                  <label className="block font-bold text-slate-800">Dynamic Test Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAiTestType('green')}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        aiTestType === 'green'
                          ? 'border-emerald-600 bg-emerald-50/60 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span>Green Focus Test (12V)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        1 câu hoàn chỉnh tự nhiên, đếm từ lũy tiến 9-10w đến 22w max. Continuous rhythm ($TL=1.0$).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAiTestType('red')}
                      className={`p-3.5 rounded-2xl border text-left transition-all ${
                        aiTestType === 'red'
                          ? 'border-rose-600 bg-rose-50/60 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-rose-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span>Red Awareness Test (56V)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Chuỗi collocations (Zero single words, $\ge 2$ từ), anchor từ Chunks, khoảng lặng SSML 650ms.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Firestore Lesson Picker */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-800">
                    Bài học nguồn (Firestore Lessons)
                  </label>
                  <select
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium focus:outline-hidden"
                  >
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        [{l.levelCode}] {l.lessonTitle} (Day {l.dayNumber} • {l.totalChunks} chunks)
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span>
                      {loadingChunks
                        ? 'Đang nạp chunks...'
                        : `Đã nạp ${lessonChunks.length} chunks từ bài học`}
                    </span>
                    <span>Từ vựng chuẩn giáo trình Chunks LMS</span>
                  </div>
                </div>

                {/* Structure: Sessions & Questions */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số Session</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={aiSessionCount}
                      onChange={(e) => setAiSessionCount(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-center font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block text-center">Mặc định: 7 sessions</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Số câu / session</label>
                    <input
                      type="number"
                      min={1}
                      max={15}
                      value={aiQuestionsPerSession}
                      onChange={(e) => setAiQuestionsPerSession(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-center font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block text-center">Mặc định: 3 câu (7x3=21Q)</span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Target CPD (Volt)</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={aiTargetVoltage}
                      onChange={(e) => setAiTargetVoltage(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-center font-bold text-indigo-600"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block text-center">
                      Green: 12V | Red: 56V
                    </span>
                  </div>
                </div>

                {/* Physics CVR Controls: TC, TL, LC */}
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                      <Sliders className="h-3.5 w-3.5" />
                      <span>Tham số CVR = TC × TL × LC</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-700">
                      CVR = {computedCvr}Ω • Suy diễn CCI: {computedDerivedCci}A
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1 font-semibold text-slate-700">
                        <span>TC (Term)</span>
                        <span className="font-mono text-indigo-600">{uiTc}Ω</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="6.0"
                        step="0.5"
                        value={uiTc}
                        onChange={(e) => setUiTc(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                      <span className="text-[9px] text-slate-400">Resource chunks (def 3Ω)</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1 font-semibold text-slate-700">
                        <span>TL (Topic Level)</span>
                        <span className="font-mono text-indigo-600">{uiTl}</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="2.0"
                        step="0.1"
                        value={uiTl}
                        onChange={(e) => setUiTl(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                      <span className="text-[9px] text-slate-400">Level & latency (1.0 - 2.0)</span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1 font-semibold text-slate-700">
                        <span>LC (Length)</span>
                        <span className="font-mono text-indigo-600">{uiLc}</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="2.5"
                        step="0.05"
                        value={uiLc}
                        onChange={(e) => setUiLc(Number(e.target.value))}
                        className="w-full accent-indigo-600"
                      />
                      <span className="text-[9px] text-slate-400">8w=1.0, 15w=1.5, 22w=2.0</span>
                    </div>
                  </div>
                </div>

                {/* Optional Custom Naming */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700">Tùy biến tên & mã gói (tùy chọn)</label>
                    <button
                      type="button"
                      onClick={() => setAllowCustomCode(!allowCustomCode)}
                      className="text-[11px] text-indigo-600 hover:underline font-semibold"
                    >
                      {allowCustomCode ? 'Sử dụng tự động' : 'Tùy chỉnh thủ công'}
                    </button>
                  </div>
                  {allowCustomCode && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Tên gói bài test</label>
                        <input
                          type="text"
                          value={customTitle}
                          onChange={(e) => setCustomTitle(e.target.value)}
                          placeholder="Nhập tên tùy chỉnh..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">Mã gói (Package Code)</label>
                        <input
                          type="text"
                          value={customPackageCode}
                          onChange={(e) => setCustomPackageCode(e.target.value)}
                          placeholder="e.g. GREEN-12V-7X3"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    className="ghost text-xs"
                    onClick={() => setShowCreateModal(false)}
                    disabled={creatingPackage}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="primary text-xs flex items-center gap-1.5"
                    disabled={creatingPackage}
                  >
                    {creatingPackage ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang tạo bài test...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Tạo Gói Bài Test ({totalQuestions}Q)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={(e) => void handleCreateManualPackage(e)} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-semibold mb-1">Package Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Custom Diagnostic Test"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Version</label>
                    <input
                      type="text"
                      placeholder="v1"
                      value={manualVersionLabel}
                      onChange={(e) => setManualVersionLabel(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Session Count</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={manualSessionCount}
                      onChange={(e) => setManualSessionCount(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Questions / Session</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={manualItemsPerSession}
                      onChange={(e) => setManualItemsPerSession(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-4">
                  <button
                    type="button"
                    className="ghost text-xs"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="primary text-xs" disabled={creatingPackage}>
                    {creatingPackage ? 'Đang tạo...' : 'Tạo Bản Thảo Thủ Công'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* NEW CCI PROFILE MODAL */}
      {showNewProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Tạo Hồ Sơ CCI Mới</h3>
            <form onSubmit={(e) => void handleCreateProfileSubmit(e)} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Tên hồ sơ</label>
                <input
                  type="text"
                  placeholder="e.g. Ecommerce 7-Session Ample"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Mô tả</label>
                <textarea
                  placeholder="Mô tả mục tiêu cường độ nhận thức..."
                  value={newProfileDesc}
                  onChange={(e) => setNewProfileDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="ghost text-xs"
                  onClick={() => setShowNewProfileModal(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="primary text-xs">
                  Tạo Hồ Sơ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 flex-shrink-0">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {previewPackage.pkg.title.replace(/ · LIVE$/i, '')}
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {previewPackage.sections.length} Sessions • {previewPackage.items.length} Questions • Target {previewPackage.targetVoltage}V CPD
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPackage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs divide-y divide-slate-100">
              {previewPackage.sections.map((sec) => {
                const sItems = previewPackage.items.filter((i) => i.sectionId === sec.id)
                return (
                  <div key={sec.id} className="pt-4 first:pt-0 space-y-2">
                    <div className="font-bold text-slate-800 flex items-center justify-between">
                      <span>{sec.title || `Session ${sec.sectionOrder}`}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Target CVR: {sec.targetCvrOhm}Ω
                      </span>
                    </div>
                    <div className="space-y-2 pl-3 border-l-2 border-slate-200">
                      {sItems.map((item) => (
                        <div key={item.id} className="space-y-0.5">
                          <div className="font-bold text-slate-800">
                            #{item.itemOrder}. {item.promptVi}
                          </div>
                          <div className="text-slate-500 text-[11px]">{item.promptEn}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end flex-shrink-0">
              <button
                type="button"
                className="primary text-xs"
                onClick={() => setPreviewPackage(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT METADATA MODAL */}
      {editingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Sửa Thông Tin Gói</h3>
            <form onSubmit={(e) => void handleSaveMetadata(e)} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold mb-1">Tiêu đề</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Mã định danh (Slug)</label>
                <input
                  type="text"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Mô tả</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="ghost text-xs"
                  onClick={() => setEditingPackage(null)}
                  disabled={savingMetadata}
                >
                  Hủy
                </button>
                <button type="submit" className="primary text-xs" disabled={savingMetadata}>
                  {savingMetadata ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="h-6 w-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900">Xác nhận xóa gói?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn gói bài test{' '}
              <strong className="text-slate-900">
                {deletingPackage.title.replace(/ · LIVE$/i, '')}
              </strong>
              ? Toàn bộ các phiên bản, câu hỏi, và file âm thanh liên quan sẽ bị xóa sạch khỏi hệ thống.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="ghost text-xs"
                onClick={() => setDeletingPackage(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleDeletePackage()}
                disabled={deleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                {deleting ? 'Đang xóa...' : 'Đồng Ý Xóa Vĩnh Viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

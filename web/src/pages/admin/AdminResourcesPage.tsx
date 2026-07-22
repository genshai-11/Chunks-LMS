import { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, Gauge, ListChecks, Pencil, Plus, RefreshCw, Search, Trash2, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import { generateNarration } from '../../modules/catalog/live-test-generation'
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
  deleteDraftTestItem,
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
  version: TestPackageVersion
}
type ResourceTab = 'sessions' | 'items' | 'cci' | 'audio'
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
  const [voiceId, setVoiceId] = useState('gemini/gemini-2.5-flash-preview-tts')
  const [publishVoiceVi, setPublishVoiceVi] = useState('gemini/gemini-2.5-flash-preview-tts')
  const [publishVoiceEn, setPublishVoiceEn] = useState('gemini/gemini-2.5-flash-preview-tts')
  const [publication, setPublication] = useState<TestPackagePublicationReadiness | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [audioStatuses, setAudioStatuses] = useState<AudioTargetStatus[]>([])
  const [showItemDetails, setShowItemDetails] = useState(false)
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Batch generation failed')
    } finally {
      setGeneratingSectionId(null)
      setGenProgress(null)
    }
  }

  const selectedScope = scopes.find((scope) => scope.version.id === versionId) ?? null
  const selectedSection = sections.find((section) => section.id === selectedSectionId) ?? null
  const selectedSnapshot = selectedSection ? (snapshots[selectedSection.id] ?? null) : null
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
        next.push({ packageId: pkg.id, packageTitle: pkg.title, version })
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

  useEffect(() => {
    if (!selectedSection || !selectedScope) {
      setAudioStatuses(Array((items.length || 10) + 1).fill('missing'))
      return
    }
    void (async () => {
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
      for (const item of items) {
        const prompt = language === 'vi' ? item.promptVi : item.promptEn
        const override = language === 'vi' ? item.spokenScriptVi : item.spokenScriptEn
        const script = prompt
          ? resolveItemSpokenScript({ itemOrder: item.itemOrder, prompt, language, override })
          : ''
        const hash = script ? await narrationSourceHash(script, language, voiceId) : undefined
        const itemKey = `item:${item.id}`
        statuses.push(audioTargetStatus(resolveNarrationRecord(review.data, itemKey, hash), hash))
      }
      setAudioStatuses(statuses)
    })()
  }, [items, language, selectedScope, selectedSection, voiceId])

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
            <div className="resource-scope-bar">
              <label className="field">
                Package / Version
                <select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
                  {scopes.map((scope) => (
                    <option key={scope.version.id} value={scope.version.id}>
                      {scope.packageTitle} · {scope.version.versionLabel}
                    </option>
                  ))}
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
            <div className="resource-tabs">
              {(['sessions', 'items', 'cci', 'audio'] as ResourceTab[]).map((tab) => (
                <button
                  key={tab}
                  className={activeTab === tab ? 'primary' : 'ghost'}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'items'
                    ? 'Items / CVR'
                    : tab === 'audio'
                      ? 'Audio Prep'
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
                            <div className="meta">{section.title}</div>
                          </td>
                          <td>
                            <span className="badge">CVR {snap?.targetCvrOhm ?? '—'}</span>{' '}
                            <span className="badge">CCI {snap?.cciValue ?? '—'}</span>
                            <div className="meta">
                              {snap?.cciCategoryLabel ?? 'Unmapped'}
                              {category?.description ? ` · ${category.description}` : ''}
                            </div>
                          </td>
                          <td>
                            <strong>
                              {snap
                                ? Math.round(snap.targetCvrOhm * snap.cciValue * 100) / 100
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
                            {selectedScope?.version.status === 'draft' ? (
                              <button
                                className="ghost"
                                disabled={generatingSectionId !== null}
                                onClick={() => void generateSessionAudio(section.id)}
                              >
                                {generatingSectionId === section.id
                                  ? `Generating ${genProgress?.done}/${genProgress?.total}…`
                                  : 'Generate Audio'}
                              </button>
                            ) : (
                              <span className="meta">Immutable (Published)</span>
                            )}
                          </td>
                          <td>
                            <button
                              className="ghost"
                              onClick={() => {
                                setSelectedSectionId(section.id)
                                setActiveTab('items')
                              }}
                            >
                              Open
                            </button>
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
                                {resourceLanguage === 'all' ? (
                                  <div className="resource-bilingual-prompt">
                                    <div><span>VI</span>{item.promptVi ?? '—'}</div>
                                    <div><span>EN</span>{item.promptEn ?? '—'}</div>
                                  </div>
                                ) : (
                                  <div>{prompt ?? '—'}</div>
                                )}
                                {showItemDetails ? (
                                  <div className="resource-row-details">
                                    {resourceLanguage !== 'all' ? <div>{translation ?? '—'}</div> : null}
                                    <span>
                                      TC {item.tc ?? '—'} · LC {item.lc ?? '—'} · TL{' '}
                                      {item.tl ?? '—'} · CVR {item.measuredCvr ?? '—'}
                                    </span>
                                    <span>
                                      Terms: VI {item.termVi ?? '—'} · EN {item.termEn ?? '—'}
                                    </span>
                                  </div>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td>
                            <span className="badge">
                              {item.measuredCvr ?? selectedSnapshot?.targetCvrOhm ?? '—'}
                            </span>
                          </td>
                          <td>
                            <span className="badge">
                              {audioStatuses[item.itemOrder] ?? 'missing'}
                            </span>
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
                            <strong>{category.value}</strong>
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
                  <input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} />
                  <Link
                    className="btn primary"
                    to={`/admin/resources/audio?version=${versionId}&section=${selectedSectionId}&language=${language}&voice=${encodeURIComponent(voiceId)}`}
                  >
                    Open Audio Preparation
                  </Link>
                </div>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </>
  )
}

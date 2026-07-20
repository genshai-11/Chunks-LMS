import { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, Gauge, ListChecks, Pencil, RefreshCw, Search, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel } from '../../components/ui'
import {
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
  const [language, setLanguage] = useState<AudioLanguage>('vi')
  const [voiceId, setVoiceId] = useState('gemini/gemini-2.5-flash-preview-tts')
  const [publishVoiceVi, setPublishVoiceVi] = useState('gemini/gemini-2.5-flash-preview-tts')
  const [publishVoiceEn, setPublishVoiceEn] = useState('gemini/gemini-2.5-flash-preview-tts')
  const [publication, setPublication] = useState<TestPackagePublicationReadiness | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [audioStatuses, setAudioStatuses] = useState<AudioTargetStatus[]>(Array(11).fill('missing'))
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [promptDraft, setPromptDraft] = useState({ vi: '', en: '' })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      setAudioStatuses(Array(11).fill('missing'))
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
  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return items
    return items.filter((item) =>
      `${item.itemOrder} ${item.promptVi ?? ''} ${item.promptEn ?? ''} ${item.termVi ?? ''} ${item.termEn ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [items, search])

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
                <span>{sections.length * 10} items</span>
                <span>
                  Audio {readiness.approved}/{readiness.expected || 11}
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
                    : `Publication requires all 8 Sessions ready in both languages. VI ${publication?.readyVietnameseSections ?? 0}/8 · EN ${publication?.readyEnglishSections ?? 0}/8.`}
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
            >
              <div className="table-wrap compact-resource-table">
                <table>
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Measurement</th>
                      <th>CPD</th>
                      <th>Items</th>
                      <th>Audio</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((section) => {
                      const snap = snapshots[section.id]
                      const category = snap
                        ? categories.find((c) => c.id === snap.cciCategoryId)
                        : null
                      return (
                        <tr
                          key={section.id}
                          className={selectedSectionId === section.id ? 'is-selected' : undefined}
                        >
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
                          <td>10</td>
                          <td>
                            {section.id === selectedSectionId ? (
                              <span
                                className={`badge ${readiness.ready ? 'success' : 'experimental'}`}
                              >
                                {readiness.approved}/11
                              </span>
                            ) : (
                              <span className="meta">Select to inspect</span>
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
                </div>
              }
            >
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
                      const prompt = language === 'vi' ? item.promptVi : item.promptEn
                      return (
                        <tr key={item.id}>
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
                                <div>{prompt ?? '—'}</div>
                                <button
                                  className="link-button"
                                  onClick={() =>
                                    setExpandedItemId(expandedItemId === item.id ? null : item.id)
                                  }
                                >
                                  {expandedItemId === item.id
                                    ? 'Hide details'
                                    : 'Translation & CVR details'}
                                </button>
                                {expandedItemId === item.id ? (
                                  <div className="resource-row-details">
                                    <div>{language === 'vi' ? item.promptEn : item.promptVi}</div>
                                    <span>
                                      TC {item.tc ?? '—'} · LC {item.lc ?? '—'} · TL{' '}
                                      {item.tl ?? '—'}
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
              description="Prepare scripts before paid generation, then listen, approve, and reach 11/11."
              collapsible={false}
            >
              <div className="audio-readiness-card">
                <div>
                  <strong>{readiness.approved}/11 approved</strong>
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

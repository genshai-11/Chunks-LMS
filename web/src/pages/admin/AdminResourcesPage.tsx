import { useEffect, useMemo, useState } from 'react'
import {
  Database,
  FileText,
  Gauge,
  ListChecks,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel, StatCard } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import { getSupabase } from '../../lib/supabase'
import {
  archiveCciProfile,
  deleteDraftCciCategory,
  deleteDraftTestItem,
  deleteDraftTestSection,
  getSectionSnapshot,
  listCciCategories,
  listCciProfiles,
  listTestItems,
  listTestPackages,
  listTestPackageVersions,
  listTestSections,
  updateDraftCciCategory,
  updateDraftTestItem,
  updateDraftTestSection,
} from '../../lib/test-packages'
import {
  measuredCvr,
  type CciCategory,
  type TestItem,
  type TestSection,
} from '../../modules/catalog/test-package-catalog'

type LoadState = 'loading' | 'ready' | 'error'
type ResourceTab = 'cvr' | 'cci' | 'sessions'
type StatusFilter = 'all' | 'draft' | 'published' | 'active' | 'archived'

type VersionStatus = 'draft' | 'published' | 'archived'
type ProfileStatus = 'draft' | 'active' | 'archived'

type CvrRow = TestItem & {
  packageTitle: string
  versionLabel: string
  versionStatus: VersionStatus
  sectionTitle: string | null
  sectionOrder: number
}

type CciRow = CciCategory & {
  profileName: string
  profileVersion: string
  profileStatus: ProfileStatus
}

type SessionRow = TestSection & {
  packageTitle: string
  versionLabel: string
  versionStatus: VersionStatus
  itemCount: number
  activeTargetCvrOhm: number | null
  activeCciLabel: string | null
  activeCciValue: number | null
  learningSessionCount: number
}

type CvrDraft = Pick<CvrRow, 'promptVi' | 'promptEn' | 'tc' | 'lc' | 'tl'>
type MainCciCategory = 'Blow' | 'Flow' | 'Chunks'
type CciDraft = Pick<CciRow, 'label' | 'value' | 'description'> & {
  mainCategory: MainCciCategory | ''
}
type SessionDraft = Pick<SessionRow, 'title' | 'sectionOrder'>

function textMatch(value: string, query: string) {
  return value.toLowerCase().includes(query.trim().toLowerCase())
}

function statusLabel(status: string) {
  const color = status === 'draft' ? '#d69e2e' : status === 'archived' ? '#718096' : '#2f855a'
  return (
    <span className="badge" style={{ borderColor: color, color }}>
      {status}
    </span>
  )
}

function draftActionHint(
  kind: 'CVR item' | 'CCI category' | 'Session resource',
  editable: boolean,
) {
  if (editable) return `Draft ${kind}: edit/delete available.`
  return `Locked ${kind}: published, active, archived, or history-linked rows must be archived/superseded instead of edited in place.`
}

function actionTitle(editable: boolean) {
  return editable
    ? 'Edit/delete is enabled for this draft row.'
    : 'This row is immutable from the UI. Create a new draft/version or use archive/supersede instead.'
}

function cciMainCategory(row: Pick<CciRow, 'metadata'>): MainCciCategory | null {
  const value = row.metadata.mainCategory
  return value === 'Blow' || value === 'Flow' || value === 'Chunks' ? value : null
}

async function countLearningSessionsForSection(sectionId: string): Promise<number> {
  const sb = getSupabase() as any
  if (!sb) return 0
  const { count, error } = await sb
    .from('learning_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('test_section_id', sectionId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export function AdminResourcesPage() {
  const { message, error: flashError, ok, err, clear } = useFlash()
  const [state, setState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ResourceTab>('cvr')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showEditableOnly, setShowEditableOnly] = useState(false)

  const [cvrRows, setCvrRows] = useState<CvrRow[]>([])
  const [cciRows, setCciRows] = useState<CciRow[]>([])
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([])
  const [packageCount, setPackageCount] = useState(0)
  const [versionCount, setVersionCount] = useState(0)

  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [cvrDraft, setCvrDraft] = useState<CvrDraft | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [cciDraft, setCciDraft] = useState<CciDraft | null>(null)
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null)

  async function loadResources() {
    clear()
    setState('loading')
    setLoadError(null)
    try {
      const packagesRes = await listTestPackages()
      if (!packagesRes.ok) throw new Error(packagesRes.error)
      const profilesRes = await listCciProfiles()
      if (!profilesRes.ok) throw new Error(profilesRes.error)

      const nextCvrRows: CvrRow[] = []
      const nextSessionRows: SessionRow[] = []
      let nextVersionCount = 0

      for (const pkg of packagesRes.data) {
        const versionsRes = await listTestPackageVersions(pkg.id)
        if (!versionsRes.ok) throw new Error(versionsRes.error)
        nextVersionCount += versionsRes.data.length

        for (const version of versionsRes.data) {
          const sectionsRes = await listTestSections(version.id)
          if (!sectionsRes.ok) throw new Error(sectionsRes.error)

          for (const section of sectionsRes.data) {
            const [itemsRes, snapshotRes, learningSessionCount] = await Promise.all([
              listTestItems(section.id),
              getSectionSnapshot(section.id),
              countLearningSessionsForSection(section.id),
            ])
            if (!itemsRes.ok) throw new Error(itemsRes.error)
            if (!snapshotRes.ok) throw new Error(snapshotRes.error)

            nextSessionRows.push({
              ...section,
              packageTitle: pkg.title,
              versionLabel: version.versionLabel,
              versionStatus: version.status,
              itemCount: itemsRes.data.length,
              activeTargetCvrOhm: snapshotRes.data?.targetCvrOhm ?? null,
              activeCciLabel: snapshotRes.data?.cciCategoryLabel ?? null,
              activeCciValue: snapshotRes.data?.cciValue ?? null,
              learningSessionCount,
            })

            nextCvrRows.push(
              ...itemsRes.data.map((item) => ({
                ...item,
                packageTitle: pkg.title,
                versionLabel: version.versionLabel,
                versionStatus: version.status,
                sectionTitle: section.title,
                sectionOrder: section.sectionOrder,
              })),
            )
          }
        }
      }

      const nextCciRows: CciRow[] = []
      for (const profile of profilesRes.data) {
        const categoriesRes = await listCciCategories(profile.id)
        if (!categoriesRes.ok) throw new Error(categoriesRes.error)
        nextCciRows.push(
          ...categoriesRes.data.map((category) => ({
            ...category,
            profileName: profile.name,
            profileVersion: profile.versionLabel,
            profileStatus: profile.status,
          })),
        )
      }

      setPackageCount(packagesRes.data.length)
      setVersionCount(nextVersionCount)
      setCvrRows(nextCvrRows)
      setCciRows(nextCciRows)
      setSessionRows(nextSessionRows)
      setState('ready')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load resources'
      setLoadError(msg)
      setState('error')
    }
  }

  useEffect(() => {
    void loadResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredCvrRows = useMemo(() => {
    return cvrRows.filter((row) => {
      const haystack = [
        row.packageTitle,
        row.versionLabel,
        row.sectionTitle ?? '',
        row.promptVi ?? '',
        row.promptEn ?? '',
      ].join(' ')
      return (
        textMatch(haystack, search) &&
        (statusFilter === 'all' || row.versionStatus === statusFilter) &&
        (!showEditableOnly || row.versionStatus === 'draft')
      )
    })
  }, [cvrRows, search, statusFilter, showEditableOnly])

  const filteredCciRows = useMemo(() => {
    return cciRows.filter((row) => {
      const haystack = [
        row.profileName,
        row.profileVersion,
        row.label,
        cciMainCategory(row) ?? '',
        row.description ?? '',
      ].join(' ')
      return (
        textMatch(haystack, search) &&
        (statusFilter === 'all' || row.profileStatus === statusFilter) &&
        (!showEditableOnly || row.profileStatus === 'draft')
      )
    })
  }, [cciRows, search, statusFilter, showEditableOnly])

  const filteredSessionRows = useMemo(() => {
    return sessionRows.filter((row) => {
      const haystack = [
        row.packageTitle,
        row.versionLabel,
        row.title ?? '',
        row.activeCciLabel ?? '',
      ].join(' ')
      return (
        textMatch(haystack, search) &&
        (statusFilter === 'all' || row.versionStatus === statusFilter) &&
        (!showEditableOnly || row.versionStatus === 'draft')
      )
    })
  }, [sessionRows, search, statusFilter, showEditableOnly])

  const editableCounts = {
    cvr: cvrRows.filter((row) => row.versionStatus === 'draft').length,
    cci: cciRows.filter((row) => row.profileStatus === 'draft').length,
    sessions: sessionRows.filter((row) => row.versionStatus === 'draft').length,
  }
  const activeTotalCount =
    activeTab === 'cvr' ? cvrRows.length : activeTab === 'cci' ? cciRows.length : sessionRows.length
  const activeEditableCount = editableCounts[activeTab]
  const activeLockedCount = Math.max(0, activeTotalCount - activeEditableCount)

  function beginCvrEdit(row: CvrRow) {
    if (row.versionStatus !== 'draft') {
      err(draftActionHint('CVR item', false))
      return
    }
    setEditingItemId(row.id)
    setCvrDraft({
      promptVi: row.promptVi,
      promptEn: row.promptEn,
      tc: row.tc,
      lc: row.lc,
      tl: row.tl,
    })
  }

  async function saveCvrEdit(row: CvrRow) {
    if (!cvrDraft) return
    const result = await updateDraftTestItem({
      itemId: row.id,
      packageVersionId: row.packageVersionId,
      ...cvrDraft,
    })
    if (!result.ok) return err(result.error)
    setCvrRows((rows) =>
      rows.map((candidate) =>
        candidate.id === row.id ? { ...candidate, ...result.data } : candidate,
      ),
    )
    setEditingItemId(null)
    setCvrDraft(null)
    ok('Saved draft CVR/Test Item metadata.')
  }

  async function deleteCvrRow(row: CvrRow) {
    if (row.versionStatus !== 'draft') {
      err(draftActionHint('CVR item', false))
      return
    }
    if (
      !window.confirm(
        'Delete this draft Test Item? This is allowed only when it is unlinked to Session Questions.',
      )
    )
      return
    const result = await deleteDraftTestItem({
      itemId: row.id,
      packageVersionId: row.packageVersionId,
    })
    if (!result.ok) return err(result.error)
    setCvrRows((rows) => rows.filter((candidate) => candidate.id !== row.id))
    setSessionRows((rows) =>
      rows.map((section) =>
        section.id === row.sectionId
          ? { ...section, itemCount: Math.max(0, section.itemCount - 1) }
          : section,
      ),
    )
    ok('Deleted draft Test Item.')
  }

  function beginCciEdit(row: CciRow) {
    if (row.profileStatus !== 'draft') {
      err(draftActionHint('CCI category', false))
      return
    }
    setEditingCategoryId(row.id)
    setCciDraft({
      label: row.label,
      value: row.value,
      description: row.description,
      mainCategory: cciMainCategory(row) ?? '',
    })
  }

  async function saveCciEdit(row: CciRow) {
    if (!cciDraft) return
    const result = await updateDraftCciCategory({
      categoryId: row.id,
      profileId: row.profileId,
      label: cciDraft.label,
      value: cciDraft.value,
      description: cciDraft.description,
      metadata: {
        ...row.metadata,
        mainCategory: cciDraft.mainCategory || null,
      },
    })
    if (!result.ok) return err(result.error)
    setCciRows((rows) =>
      rows.map((candidate) =>
        candidate.id === row.id ? { ...candidate, ...result.data } : candidate,
      ),
    )
    setEditingCategoryId(null)
    setCciDraft(null)
    ok('Saved draft CCI Category.')
  }

  async function deleteCciRow(row: CciRow) {
    if (row.profileStatus !== 'draft') {
      err(draftActionHint('CCI category', false))
      return
    }
    if (!window.confirm('Delete this draft CCI Category? Referenced categories cannot be deleted.'))
      return
    const result = await deleteDraftCciCategory({ categoryId: row.id, profileId: row.profileId })
    if (!result.ok) return err(result.error)
    setCciRows((rows) => rows.filter((candidate) => candidate.id !== row.id))
    ok('Deleted draft CCI Category.')
  }

  async function archiveProfile(profileId: string) {
    if (
      !window.confirm(
        'Archive this CCI Profile? Existing snapshots keep their historical labels/values.',
      )
    )
      return
    const result = await archiveCciProfile(profileId)
    if (!result.ok) return err(result.error)
    setCciRows((rows) =>
      rows.map((row) =>
        row.profileId === profileId ? { ...row, profileStatus: result.data.status } : row,
      ),
    )
    ok('Archived CCI Profile.')
  }

  function beginSessionEdit(row: SessionRow) {
    if (row.versionStatus !== 'draft') {
      err(draftActionHint('Session resource', false))
      return
    }
    setEditingSectionId(row.id)
    setSessionDraft({ title: row.title, sectionOrder: row.sectionOrder })
  }

  async function saveSessionEdit(row: SessionRow) {
    if (!sessionDraft) return
    const result = await updateDraftTestSection({
      sectionId: row.id,
      packageVersionId: row.packageVersionId,
      ...sessionDraft,
    })
    if (!result.ok) return err(result.error)
    setSessionRows((rows) =>
      rows.map((candidate) =>
        candidate.id === row.id ? { ...candidate, ...result.data } : candidate,
      ),
    )
    setCvrRows((rows) =>
      rows.map((item) =>
        item.sectionId === row.id
          ? { ...item, sectionTitle: result.data.title, sectionOrder: result.data.sectionOrder }
          : item,
      ),
    )
    setEditingSectionId(null)
    setSessionDraft(null)
    ok('Saved draft Test Section metadata.')
  }

  async function deleteSessionRow(row: SessionRow) {
    if (row.versionStatus !== 'draft') {
      err(draftActionHint('Session resource', false))
      return
    }
    if (row.learningSessionCount > 0) {
      err(
        'This Session resource is linked to Learning Sessions. Create a new draft/version instead of deleting history-linked rows.',
      )
      return
    }
    if (
      !window.confirm(
        'Delete this draft Test Section and its draft items/snapshots? Linked sections cannot be deleted.',
      )
    )
      return
    const result = await deleteDraftTestSection({
      sectionId: row.id,
      packageVersionId: row.packageVersionId,
    })
    if (!result.ok) return err(result.error)
    setSessionRows((rows) => rows.filter((candidate) => candidate.id !== row.id))
    setCvrRows((rows) => rows.filter((candidate) => candidate.sectionId !== row.id))
    ok('Deleted draft Test Section.')
  }

  return (
    <>
      <PageHeader
        icon={Database}
        kicker="Admin"
        title="Resources"
        subtitle="Load, view, edit, and safely remove eligible CVR, CCI, and Live Test Session catalog rows. Published/history-linked records are immutable."
        actions={
          <button
            type="button"
            className="primary"
            onClick={() => void loadResources()}
            disabled={state === 'loading'}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            <span>{state === 'loading' ? 'Loading…' : 'Load resources'}</span>
          </button>
        }
      />

      <Flash message={message} error={flashError ?? loadError} />

      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <StatCard label="Packages" value={packageCount} icon={Database} />
        <StatCard label="Versions" value={versionCount} icon={FileText} />
        <StatCard label="Sessions" value={sessionRows.length} icon={ListChecks} />
        <StatCard label="CVR items" value={cvrRows.length} icon={Gauge} />
        <StatCard label="CCI categories" value={cciRows.length} icon={Database} />
        <StatCard
          label="Editable now"
          value={activeEditableCount}
          hint={`Current ${activeTab} tab`}
          icon={Pencil}
        />
        <StatCard
          label="Locked"
          value={activeLockedCount}
          hint="Archive/supersede instead"
          icon={FileText}
        />
      </div>

      <Panel icon={Search} title="Resource filters" collapsible={false}>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className={activeTab === 'cvr' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('cvr')}
          >
            CVR
          </button>
          <button
            type="button"
            className={activeTab === 'cci' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('cci')}
          >
            CCI
          </button>
          <button
            type="button"
            className={activeTab === 'sessions' ? 'primary' : 'ghost'}
            onClick={() => setActiveTab('sessions')}
          >
            Sessions
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(14rem, 1fr) 12rem minmax(12rem, 16rem)',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >
          <label className="field" style={{ margin: 0 }}>
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Package, section, prompt, CCI label…"
            />
          </label>
          <label className="field" style={{ margin: 0 }}>
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="field field-inline" style={{ margin: 0, justifyContent: 'flex-start' }}>
            <input
              type="checkbox"
              checked={showEditableOnly}
              onChange={(event) => setShowEditableOnly(event.target.checked)}
            />
            Editable/deletable now
          </label>
        </div>
        <p className="meta" style={{ margin: '0.75rem 0 0' }}>
          Draft rows can be edited/deleted. Published, active, archived, or history-linked rows stay
          immutable; use archive, supersede, or create a new draft/version instead.
        </p>
      </Panel>

      {state === 'error' ? (
        <EmptyState
          icon={Database}
          title="Could not load resources"
          description={loadError ?? 'Check Supabase connection and migration status.'}
        />
      ) : null}

      {state === 'ready' && activeTab === 'cvr' ? (
        <Panel icon={Gauge} title={`CVR items (${filteredCvrRows.length})`} collapsible={false}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Context</th>
                  <th>Prompt</th>
                  <th>TC</th>
                  <th>LC</th>
                  <th>TL</th>
                  <th>Measured CVR</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCvrRows.map((row) => {
                  const editing = editingItemId === row.id && cvrDraft
                  const editable = row.versionStatus === 'draft'
                  const displayedCvr = editing ? measuredCvr(cvrDraft) : row.measuredCvr
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.packageTitle}</strong>
                        <div className="meta" style={{ margin: 0 }}>
                          {row.versionLabel} · Section {row.sectionOrder}:{' '}
                          {row.sectionTitle ?? 'Untitled'} · Item {row.itemOrder}
                        </div>
                      </td>
                      <td style={{ minWidth: 280 }}>
                        {editing ? (
                          <div style={{ display: 'grid', gap: '0.4rem' }}>
                            <textarea
                              value={cvrDraft.promptVi ?? ''}
                              rows={2}
                              onChange={(event) =>
                                setCvrDraft({ ...cvrDraft, promptVi: event.target.value || null })
                              }
                            />
                            <textarea
                              value={cvrDraft.promptEn ?? ''}
                              rows={2}
                              onChange={(event) =>
                                setCvrDraft({ ...cvrDraft, promptEn: event.target.value || null })
                              }
                            />
                          </div>
                        ) : (
                          <>
                            <div>{row.promptVi ?? '—'}</div>
                            <div className="meta" style={{ margin: 0 }}>
                              {row.promptEn ?? '—'}
                            </div>
                          </>
                        )}
                      </td>
                      {(['tc', 'lc', 'tl'] as const).map((key) => (
                        <td key={key} style={{ width: 84 }}>
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={cvrDraft[key] ?? ''}
                              onChange={(event) =>
                                setCvrDraft({
                                  ...cvrDraft,
                                  [key]:
                                    event.target.value === '' ? null : Number(event.target.value),
                                })
                              }
                              style={{ width: 72 }}
                            />
                          ) : (
                            (row[key] ?? '—')
                          )}
                        </td>
                      ))}
                      <td>
                        <span className="badge">{displayedCvr ?? '—'} Ω</span>
                      </td>
                      <td>{statusLabel(row.versionStatus)}</td>
                      <td>
                        {editing ? (
                          <div className="btn-row" style={{ margin: 0 }}>
                            <button
                              type="button"
                              className="primary"
                              onClick={() => void saveCvrEdit(row)}
                            >
                              <Save className="h-4 w-4" aria-hidden />
                              Save
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => {
                                setEditingItemId(null)
                                setCvrDraft(null)
                              }}
                            >
                              <X className="h-4 w-4" aria-hidden />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="btn-row" style={{ margin: 0 }}>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => beginCvrEdit(row)}
                                title={actionTitle(editable)}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => void deleteCvrRow(row)}
                                title={actionTitle(editable)}
                                style={editable ? { color: '#b91c1c' } : undefined}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                Delete
                              </button>
                            </div>
                            <div className="meta" style={{ margin: '0.25rem 0 0' }}>
                              {draftActionHint('CVR item', editable)}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredCvrRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="meta" style={{ textAlign: 'center' }}>
                      No CVR items match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {state === 'ready' && activeTab === 'cci' ? (
        <Panel
          icon={Database}
          title={`CCI categories (${filteredCciRows.length})`}
          collapsible={false}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Profile</th>
                  <th>Action label</th>
                  <th>Main category</th>
                  <th>Ampe</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCciRows.map((row) => {
                  const editing = editingCategoryId === row.id && cciDraft
                  const editable = row.profileStatus === 'draft'
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.profileName}</strong>
                        <div className="meta" style={{ margin: 0 }}>
                          {row.profileVersion}
                        </div>
                      </td>
                      <td>
                        {editing ? (
                          <input
                            value={cciDraft.label}
                            onChange={(event) =>
                              setCciDraft({ ...cciDraft, label: event.target.value })
                            }
                          />
                        ) : (
                          row.label
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <select
                            value={cciDraft.mainCategory}
                            onChange={(event) =>
                              setCciDraft({
                                ...cciDraft,
                                mainCategory: event.target.value as MainCciCategory | '',
                              })
                            }
                          >
                            <option value="">Unmapped</option>
                            <option value="Blow">Blow</option>
                            <option value="Flow">Flow</option>
                            <option value="Chunks">Chunks</option>
                          </select>
                        ) : cciMainCategory(row) ? (
                          <span className="badge">{cciMainCategory(row)}</span>
                        ) : (
                          <span className="meta">Unmapped</span>
                        )}
                      </td>
                      <td style={{ width: 96 }}>
                        {editing ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={cciDraft.value}
                            onChange={(event) =>
                              setCciDraft({ ...cciDraft, value: Number(event.target.value) })
                            }
                          />
                        ) : (
                          row.value
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input
                            value={cciDraft.description ?? ''}
                            onChange={(event) =>
                              setCciDraft({ ...cciDraft, description: event.target.value || null })
                            }
                          />
                        ) : (
                          (row.description ?? '—')
                        )}
                      </td>
                      <td>{statusLabel(row.profileStatus)}</td>
                      <td>
                        {editing ? (
                          <div className="btn-row" style={{ margin: 0 }}>
                            <button
                              type="button"
                              className="primary"
                              onClick={() => void saveCciEdit(row)}
                            >
                              <Save className="h-4 w-4" aria-hidden />
                              Save
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => {
                                setEditingCategoryId(null)
                                setCciDraft(null)
                              }}
                            >
                              <X className="h-4 w-4" aria-hidden />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="btn-row" style={{ margin: 0 }}>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => beginCciEdit(row)}
                                title={actionTitle(editable)}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => void deleteCciRow(row)}
                                title={actionTitle(editable)}
                                style={editable ? { color: '#b91c1c' } : undefined}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                Delete
                              </button>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => void archiveProfile(row.profileId)}
                                disabled={row.profileStatus === 'archived'}
                                title="Archive keeps existing measurement snapshots historically reproducible."
                              >
                                Archive profile
                              </button>
                            </div>
                            <div className="meta" style={{ margin: '0.25rem 0 0' }}>
                              {draftActionHint('CCI category', editable)}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredCciRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="meta" style={{ textAlign: 'center' }}>
                      No CCI categories match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {state === 'ready' && activeTab === 'sessions' ? (
        <Panel
          icon={ListChecks}
          title={`Session resources (${filteredSessionRows.length})`}
          collapsible={false}
        >
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Package</th>
                  <th>Session / Section</th>
                  <th>Items</th>
                  <th>Measurement snapshot</th>
                  <th>Learning Sessions</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessionRows.map((row) => {
                  const editing = editingSectionId === row.id && sessionDraft
                  const editable = row.versionStatus === 'draft'
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.packageTitle}</strong>
                        <div className="meta" style={{ margin: 0 }}>
                          {row.versionLabel}
                        </div>
                      </td>
                      <td>
                        {editing ? (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '5rem minmax(12rem, 1fr)',
                              gap: '0.5rem',
                            }}
                          >
                            <input
                              type="number"
                              min={1}
                              value={sessionDraft.sectionOrder}
                              onChange={(event) =>
                                setSessionDraft({
                                  ...sessionDraft,
                                  sectionOrder: Number(event.target.value),
                                })
                              }
                            />
                            <input
                              value={sessionDraft.title ?? ''}
                              onChange={(event) =>
                                setSessionDraft({
                                  ...sessionDraft,
                                  title: event.target.value || null,
                                })
                              }
                            />
                          </div>
                        ) : (
                          <>
                            <strong>Session {row.sectionOrder}</strong>
                            <div className="meta" style={{ margin: 0 }}>
                              {row.title ?? 'Untitled'}
                            </div>
                          </>
                        )}
                      </td>
                      <td>{row.itemCount}</td>
                      <td>
                        {row.activeTargetCvrOhm ?? '—'} Ω · {row.activeCciLabel ?? 'No CCI'}{' '}
                        {row.activeCciValue != null ? `(${row.activeCciValue})` : ''}
                      </td>
                      <td>{row.learningSessionCount}</td>
                      <td>{statusLabel(row.versionStatus)}</td>
                      <td>
                        {editing ? (
                          <div className="btn-row" style={{ margin: 0 }}>
                            <button
                              type="button"
                              className="primary"
                              onClick={() => void saveSessionEdit(row)}
                            >
                              <Save className="h-4 w-4" aria-hidden />
                              Save
                            </button>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => {
                                setEditingSectionId(null)
                                setSessionDraft(null)
                              }}
                            >
                              <X className="h-4 w-4" aria-hidden />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="btn-row" style={{ margin: 0 }}>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => beginSessionEdit(row)}
                                title={actionTitle(editable)}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                                Edit
                              </button>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => void deleteSessionRow(row)}
                                title={
                                  row.learningSessionCount > 0
                                    ? 'Delete is blocked because Learning Sessions reference this section.'
                                    : actionTitle(editable)
                                }
                                style={editable ? { color: '#b91c1c' } : undefined}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                Delete
                              </button>
                            </div>
                            <div className="meta" style={{ margin: '0.25rem 0 0' }}>
                              {row.learningSessionCount > 0
                                ? 'History-linked: edit/delete is guarded; create a new draft/version for changes.'
                                : draftActionHint('Session resource', editable)}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filteredSessionRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="meta" style={{ textAlign: 'center' }}>
                      No Session resources match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </>
  )
}

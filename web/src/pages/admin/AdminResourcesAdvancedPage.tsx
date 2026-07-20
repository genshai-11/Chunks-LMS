import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
  createDraftCciCategory,
  createDraftCciProfile,
  createDraftTestPackage,
  createSnapshotOverride,
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
  publishCciProfile,
  updateDraftCciCategory,
  updateDraftTestItem,
  updateDraftTestSection,
} from '../../lib/test-packages'
import {
  measuredCvr,
  type CciCategory,
  type CciProfile,
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
  activeSnapshotId: string | null
  activeTargetCvrOhm: number | null
  activeCciProfileId: string | null
  activeCciCategoryId: string | null
  activeCciLabel: string | null
  activeCciValue: number | null
  snapshotCount: number
  learningSessionCount: number
}

type CvrDraft = Pick<CvrRow, 'promptVi' | 'promptEn' | 'tc' | 'lc' | 'tl'>
type MainCciCategory = 'Blow' | 'Flow' | 'Chunks'
type CciDraft = Pick<CciRow, 'label' | 'value' | 'description'> & {
  mainCategory: MainCciCategory | ''
}
type SessionDraft = Pick<SessionRow, 'title' | 'sectionOrder'>
type NewCciDraft = {
  profileId: string
  profileName: string
  name: string
  value: number
  description: string
  mainCategory: MainCciCategory | ''
}
type MappingDraft = {
  targetCvrOhm: number
  cciProfileId: string
  cciCategoryId: string
  reason: string
}
type PackageDraft = {
  title: string
  versionLabel: string
  sessionCount: number
  itemsPerSession: number
}

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

async function countSnapshotsForSection(sectionId: string): Promise<number> {
  const sb = getSupabase() as any
  if (!sb) return 0
  const { count, error } = await sb
    .from('section_measurement_snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('test_section_id', sectionId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export function AdminResourcesAdvancedPage() {
  const { message, error: flashError, ok, err, clear } = useFlash()
  const [state, setState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ResourceTab>('cvr')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showEditableOnly, setShowEditableOnly] = useState(false)

  const [cvrRows, setCvrRows] = useState<CvrRow[]>([])
  const [cciProfiles, setCciProfiles] = useState<CciProfile[]>([])
  const [cciRows, setCciRows] = useState<CciRow[]>([])
  const [sessionRows, setSessionRows] = useState<SessionRow[]>([])
  const [packageCount, setPackageCount] = useState(0)
  const [versionCount, setVersionCount] = useState(0)

  const [packageFilter, setPackageFilter] = useState('all')
  const [sectionFilter, setSectionFilter] = useState('all')
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null)
  const [mappingSectionId, setMappingSectionId] = useState<string | null>(null)
  const [mappingDraft, setMappingDraft] = useState<MappingDraft | null>(null)
  const [newCciDraft, setNewCciDraft] = useState<NewCciDraft>({
    profileId: '',
    profileName: '',
    name: '',
    value: 2,
    description: '',
    mainCategory: '',
  })
  const [packageDraft, setPackageDraft] = useState<PackageDraft>({
    title: 'Pre-test',
    versionLabel: 'draft-v1',
    sessionCount: 8,
    itemsPerSession: 10,
  })

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
            const [itemsRes, snapshotRes, learningSessionCount, snapshotCount] = await Promise.all([
              listTestItems(section.id),
              getSectionSnapshot(section.id),
              countLearningSessionsForSection(section.id),
              countSnapshotsForSection(section.id),
            ])
            if (!itemsRes.ok) throw new Error(itemsRes.error)
            if (!snapshotRes.ok) throw new Error(snapshotRes.error)

            nextSessionRows.push({
              ...section,
              packageTitle: pkg.title,
              versionLabel: version.versionLabel,
              versionStatus: version.status,
              itemCount: itemsRes.data.length,
              activeSnapshotId: snapshotRes.data?.id ?? null,
              activeTargetCvrOhm: snapshotRes.data?.targetCvrOhm ?? null,
              activeCciProfileId: snapshotRes.data?.cciProfileId ?? null,
              activeCciCategoryId: snapshotRes.data?.cciCategoryId ?? null,
              activeCciLabel: snapshotRes.data?.cciCategoryLabel ?? null,
              activeCciValue: snapshotRes.data?.cciValue ?? null,
              snapshotCount,
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
      setCciProfiles(profilesRes.data)
      setCciRows(nextCciRows)
      setSessionRows(nextSessionRows)
      setNewCciDraft((draft) => ({
        ...draft,
        profileId:
          draft.profileId ||
          profilesRes.data.find((profile) => profile.status === 'draft')?.id ||
          '',
      }))
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
        (!showEditableOnly || row.versionStatus === 'draft') &&
        (packageFilter === 'all' || row.packageVersionId === packageFilter) &&
        (sectionFilter === 'all' || row.sectionId === sectionFilter)
      )
    })
  }, [cvrRows, packageFilter, search, sectionFilter, statusFilter, showEditableOnly])

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
        (!showEditableOnly || row.versionStatus === 'draft') &&
        (packageFilter === 'all' || row.packageVersionId === packageFilter)
      )
    })
  }, [packageFilter, search, sessionRows, statusFilter, showEditableOnly])

  const packageOptions = useMemo(() => {
    const byId = new Map<
      string,
      {
        packageVersionId: string
        packageTitle: string
        versionLabel: string
        sessions: number
        items: number
      }
    >()
    for (const row of sessionRows) {
      byId.set(row.packageVersionId, {
        packageVersionId: row.packageVersionId,
        packageTitle: row.packageTitle,
        versionLabel: row.versionLabel,
        sessions: (byId.get(row.packageVersionId)?.sessions ?? 0) + 1,
        items: (byId.get(row.packageVersionId)?.items ?? 0) + row.itemCount,
      })
    }
    return [...byId.values()].sort((a, b) => a.packageTitle.localeCompare(b.packageTitle))
  }, [sessionRows])

  const selectedPackageSummary =
    packageFilter === 'all'
      ? null
      : packageOptions.find((option) => option.packageVersionId === packageFilter)

  const sectionOptions = useMemo(() => {
    const byId = new Map<
      string,
      Pick<CvrRow, 'sectionId' | 'sectionOrder' | 'sectionTitle' | 'packageTitle' | 'versionLabel'>
    >()
    for (const row of cvrRows) {
      if (packageFilter !== 'all' && row.packageVersionId !== packageFilter) continue
      byId.set(row.sectionId, {
        sectionId: row.sectionId,
        sectionOrder: row.sectionOrder,
        sectionTitle: row.sectionTitle,
        packageTitle: row.packageTitle,
        versionLabel: row.versionLabel,
      })
    }
    return [...byId.values()].sort((a, b) => a.sectionOrder - b.sectionOrder)
  }, [cvrRows, packageFilter])

  const editableCounts = {
    cvr: cvrRows.filter((row) => row.versionStatus === 'draft').length,
    cci: cciRows.filter((row) => row.profileStatus === 'draft').length,
    sessions: sessionRows.filter((row) => row.versionStatus === 'draft').length,
  }
  const activeTotalCount =
    activeTab === 'cvr' ? cvrRows.length : activeTab === 'cci' ? cciRows.length : sessionRows.length
  const activeEditableCount = editableCounts[activeTab]
  const activeLockedCount = Math.max(0, activeTotalCount - activeEditableCount)
  const draftCciProfiles = cciProfiles.filter((profile) => profile.status === 'draft')
  const selectableCciProfiles = cciProfiles.filter((profile) => profile.status !== 'archived')
  const selectedNewCciProfile = cciProfiles.find((profile) => profile.id === newCciDraft.profileId)
  const cciCategoriesForMapping = (profileId: string) =>
    cciRows
      .filter((row) => row.profileId === profileId)
      .sort((a, b) => a.categoryOrder - b.categoryOrder)

  function switchTab(tab: ResourceTab) {
    setActiveTab(tab)
    setSectionFilter('all')
  }

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

  async function createCciCategory() {
    const requestedProfile = cciProfiles.find((candidate) => candidate.id === newCciDraft.profileId)
    let profile = requestedProfile
    if (!profile) {
      if (!newCciDraft.profileName.trim())
        return err('Choose a draft CCI Profile or enter a new profile name.')
      const profileResult = await createDraftCciProfile({
        name: newCciDraft.profileName.trim(),
        versionLabel: 'draft',
        description: 'Created from Admin Resources.',
      })
      if (!profileResult.ok) return err(profileResult.error)
      profile = profileResult.data
      setCciProfiles((rows) => [...rows, profileResult.data])
    }
    if (!newCciDraft.name.trim()) return err('CCI name is required.')
    if (!newCciDraft.mainCategory) return err('Choose category: Blow, Flow, or Chunks.')
    const result = await createDraftCciCategory({
      profileId: profile.id,
      label: newCciDraft.name,
      value: newCciDraft.value,
      description: newCciDraft.description || null,
      metadata: { mainCategory: newCciDraft.mainCategory, source: 'admin-resources-crud' },
    })
    if (!result.ok) return err(result.error)
    setCciRows((rows) => [
      ...rows,
      {
        ...result.data,
        profileName: profile.name,
        profileVersion: profile.versionLabel,
        profileStatus: profile.status,
      },
    ])
    setNewCciDraft((draft) => ({ ...draft, name: '', value: 2, description: '', mainCategory: '' }))
    ok('Created CCI Category.')
  }

  async function publishProfile(profileId: string) {
    if (
      !window.confirm('Publish this CCI Profile? Once active it can no longer be edited directly.')
    )
      return
    const result = await publishCciProfile(profileId)
    if (!result.ok) return err(result.error)
    setCciProfiles((rows) => rows.map((row) => (row.id === profileId ? result.data : row)))
    setCciRows((rows) =>
      rows.map((row) =>
        row.profileId === profileId ? { ...row, profileStatus: result.data.status } : row,
      ),
    )
    ok('Published CCI Profile as active.')
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

  function beginMapping(row: SessionRow) {
    if (row.versionStatus !== 'draft')
      return err('Only draft Session resources can change CCI/CVR mapping.')
    const firstProfileId = row.activeCciProfileId ?? selectableCciProfiles[0]?.id ?? ''
    const firstCategory = row.activeCciCategoryId
      ? cciRows.find((category) => category.id === row.activeCciCategoryId)
      : cciCategoriesForMapping(firstProfileId)[0]
    setMappingSectionId(row.id)
    setMappingDraft({
      targetCvrOhm: row.activeTargetCvrOhm ?? 3,
      cciProfileId: firstProfileId,
      cciCategoryId: firstCategory?.id ?? '',
      reason: row.activeSnapshotId ? 'Admin resource mapping update' : '',
    })
  }

  async function saveMapping(row: SessionRow) {
    if (!mappingDraft) return
    const category = cciRows.find((candidate) => candidate.id === mappingDraft.cciCategoryId)
    if (!category) return err('Choose a CCI Category for this Session mapping.')
    if (mappingDraft.targetCvrOhm <= 0) return err('Target CVR must be greater than 0.')
    if (row.activeSnapshotId && !mappingDraft.reason.trim())
      return err('Reason is required when overriding an existing mapping.')
    const result = await createSnapshotOverride({
      sectionId: row.id,
      packageVersionId: row.packageVersionId,
      targetCvrOhm: mappingDraft.targetCvrOhm,
      cciProfileId: category.profileId,
      cciCategoryId: category.id,
      cciCategoryLabel: cciMainCategory(category) ?? category.label,
      cciValue: category.value,
      supersedesSnapshotId: row.activeSnapshotId,
      overrideReason: mappingDraft.reason.trim() || 'Initial Admin Resources mapping',
    })
    if (!result.ok) return err(result.error)
    setSessionRows((rows) =>
      rows.map((candidate) =>
        candidate.id === row.id
          ? {
              ...candidate,
              activeSnapshotId: result.data.id,
              activeTargetCvrOhm: result.data.targetCvrOhm,
              activeCciProfileId: result.data.cciProfileId,
              activeCciCategoryId: result.data.cciCategoryId,
              activeCciLabel: result.data.cciCategoryLabel,
              activeCciValue: result.data.cciValue,
              snapshotCount: candidate.snapshotCount + 1,
            }
          : candidate,
      ),
    )
    setMappingSectionId(null)
    setMappingDraft(null)
    ok('Saved Session CCI/CVR mapping.')
  }

  async function createPackageFromBuilder() {
    if (cciRows.length === 0)
      return err('Create at least one CCI Category before creating a Test Package.')
    const defaults = [3, 5, 7, 9, 11, 13, 15, 17]
    const categories = [...cciRows].sort((a, b) => a.categoryOrder - b.categoryOrder)
    const sessions = Array.from({ length: packageDraft.sessionCount }, (_, idx) => {
      const category = categories[idx % categories.length]
      return {
        sectionOrder: idx + 1,
        title: `Session ${idx + 1}`,
        targetCvrOhm: defaults[idx] ?? defaults[defaults.length - 1],
        cciProfileId: category.profileId,
        cciCategoryId: category.id,
        cciCategoryLabel: cciMainCategory(category) ?? category.label,
        cciValue: category.value,
      }
    })
    const result = await createDraftTestPackage({ ...packageDraft, sessions })
    if (!result.ok) return err(result.error)
    ok(
      `Created ${result.data.package.title} with ${packageDraft.sessionCount} sessions × ${packageDraft.itemsPerSession} CVR sentence slots.`,
    )
    await loadResources()
    setActiveTab('sessions')
  }

  return (
    <>
      <PageHeader
        icon={Database}
        kicker="Admin"
        title="Resources"
        subtitle="Load, view, edit, and safely remove eligible CVR, CCI, and Live Test Session catalog rows. Published/history-linked records are immutable."
        actions={
          <div className="btn-row">
            <Link className="btn ghost" to="/admin/resources/audio">Audio review</Link>
            <button
              type="button"
              className="primary"
              onClick={() => void loadResources()}
              disabled={state === 'loading'}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              <span>{state === 'loading' ? 'Loading…' : 'Load resources'}</span>
            </button>
          </div>
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
            onClick={() => switchTab('cvr')}
          >
            CVR
          </button>
          <button
            type="button"
            className={activeTab === 'cci' ? 'primary' : 'ghost'}
            onClick={() => switchTab('cci')}
          >
            CCI
          </button>
          <button
            type="button"
            className={activeTab === 'sessions' ? 'primary' : 'ghost'}
            onClick={() => switchTab('sessions')}
          >
            Sessions
          </button>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(14rem, 1.2fr) minmax(14rem, 1fr) 12rem minmax(14rem, 1fr) minmax(12rem, 16rem)',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >
          <label className="field" style={{ margin: 0 }}>
            Test Package
            <select
              value={packageFilter}
              onChange={(event) => {
                setPackageFilter(event.target.value)
                setSectionFilter('all')
              }}
            >
              <option value="all">All packages</option>
              {packageOptions.map((option) => (
                <option key={option.packageVersionId} value={option.packageVersionId}>
                  {option.packageTitle} · {option.versionLabel} · {option.sessions} sessions ·{' '}
                  {option.items} items
                </option>
              ))}
            </select>
          </label>
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
          <label className="field" style={{ margin: 0 }}>
            CVR Section
            <select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              disabled={activeTab !== 'cvr'}
            >
              <option value="all">All sections</option>
              {sectionOptions.map((section) => (
                <option key={section.sectionId} value={section.sectionId}>
                  {section.packageTitle} · {section.versionLabel} · Session {section.sectionOrder}:{' '}
                  {section.sectionTitle ?? 'Untitled'}
                </option>
              ))}
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
          {selectedPackageSummary
            ? `${selectedPackageSummary.packageTitle} · ${selectedPackageSummary.versionLabel}: ${selectedPackageSummary.sessions} sessions, ${selectedPackageSummary.items} sentence items.`
            : 'Select a Test Package to manage sessions and CVR sentence items package-first.'}{' '}
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
        <>
          <Panel
            icon={Database}
            title={`CCI categories (${filteredCciRows.length})`}
            collapsible={false}
          >
            <div style={{ marginBottom: '1rem', display: 'grid', gap: '0.75rem' }}>
              <strong>Create CCI</strong>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 0.75fr 1fr 1.5fr auto',
                  gap: '0.75rem',
                  alignItems: 'end',
                }}
              >
                <label className="field" style={{ margin: 0 }}>
                  Draft profile
                  <select
                    value={newCciDraft.profileId}
                    onChange={(event) =>
                      setNewCciDraft({ ...newCciDraft, profileId: event.target.value })
                    }
                  >
                    <option value="">New profile…</option>
                    {draftCciProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} ({profile.versionLabel})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  New profile name
                  <input
                    value={newCciDraft.profileName}
                    onChange={(event) =>
                      setNewCciDraft({ ...newCciDraft, profileName: event.target.value })
                    }
                    placeholder="Chunks CCI Profile"
                    disabled={Boolean(selectedNewCciProfile)}
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  Name
                  <input
                    value={newCciDraft.name}
                    onChange={(event) =>
                      setNewCciDraft({ ...newCciDraft, name: event.target.value })
                    }
                    placeholder="Give it a shot"
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  Category
                  <select
                    value={newCciDraft.mainCategory}
                    onChange={(event) =>
                      setNewCciDraft({
                        ...newCciDraft,
                        mainCategory: event.target.value as MainCciCategory | '',
                      })
                    }
                  >
                    <option value="">Choose…</option>
                    <option value="Blow">Blow</option>
                    <option value="Flow">Flow</option>
                    <option value="Chunks">Chunks</option>
                  </select>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  Unit (Ampe)
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={newCciDraft.value}
                    onChange={(event) =>
                      setNewCciDraft({ ...newCciDraft, value: Number(event.target.value) })
                    }
                  />
                </label>
                <button type="button" className="primary" onClick={() => void createCciCategory()}>
                  Create
                </button>
              </div>
              <label className="field" style={{ margin: 0 }}>
                Description
                <input
                  value={newCciDraft.description}
                  onChange={(event) =>
                    setNewCciDraft({ ...newCciDraft, description: event.target.value })
                  }
                  placeholder="Linear 1 on 1 as Blow"
                />
              </label>
            </div>
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
                                setCciDraft({
                                  ...cciDraft,
                                  description: event.target.value || null,
                                })
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
                                  onClick={() => void publishProfile(row.profileId)}
                                  disabled={row.profileStatus !== 'draft'}
                                  title="Publish draft profile to active so it can be selected for sessions."
                                >
                                  Publish profile
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
                                {row.profileStatus === 'draft' ? (
                                  <>
                                    <button
                                      type="button"
                                      className="ghost"
                                      onClick={() => void publishProfile(row.profileId)}
                                      title="Publish profile to active. Once active, direct edits are disabled."
                                    >
                                      Publish profile
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost"
                                      onClick={() => {
                                        setNewCciDraft((d) => ({
                                          ...d,
                                          profileId: row.profileId,
                                          profileName: row.profileName,
                                          name: '',
                                          value: 2,
                                          description: '',
                                          mainCategory: '',
                                        }))
                                      }}
                                      title="Pre-fill the Add Category form below for this draft profile."
                                    >
                                      Add category
                                    </button>
                                  </>
                                ) : null}
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
          {/* T7: inline create-category form, shown when "Add category" is clicked on a draft profile row */}
          {newCciDraft.profileId ? (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                background: 'var(--bg-card)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border)',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                Add CCI Category to: {newCciDraft.profileName}
              </strong>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))',
                  gap: '0.5rem',
                }}
              >
                <label className="field" style={{ margin: 0 }}>
                  Name / Label
                  <input
                    value={newCciDraft.name}
                    onChange={(e) => setNewCciDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Current 5"
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  Ampe / Value
                  <input
                    type="number"
                    step="0.01"
                    value={newCciDraft.value}
                    onChange={(e) =>
                      setNewCciDraft((d) => ({ ...d, value: Number(e.target.value) }))
                    }
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  Main Category
                  <select
                    value={newCciDraft.mainCategory}
                    onChange={(e) =>
                      setNewCciDraft((d) => ({
                        ...d,
                        mainCategory: e.target.value as MainCciCategory | '',
                      }))
                    }
                  >
                    <option value="">Unmapped</option>
                    <option value="Blow">Blow</option>
                    <option value="Flow">Flow</option>
                    <option value="Chunks">Chunks</option>
                  </select>
                </label>
                <label className="field" style={{ margin: 0 }}>
                  Description
                  <input
                    value={newCciDraft.description}
                    onChange={(e) => setNewCciDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder="Optional"
                  />
                </label>
              </div>
              <div className="btn-row" style={{ marginTop: '0.5rem' }}>
                <button type="button" className="primary" onClick={() => void createCciCategory()}>
                  <Save className="h-4 w-4" aria-hidden />
                  Save category
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    setNewCciDraft((d) => ({
                      ...d,
                      profileId: '',
                      name: '',
                      description: '',
                      mainCategory: '',
                    }))
                  }
                >
                  <X className="h-4 w-4" aria-hidden />
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {state === 'ready' && activeTab === 'sessions' ? (
        <Panel
          icon={ListChecks}
          title={`Session resources (${filteredSessionRows.length})`}
          collapsible={false}
        >
          <div style={{ marginBottom: '1rem', display: 'grid', gap: '0.75rem' }}>
            <strong>Create Test Package</strong>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 0.75fr 0.75fr auto',
                gap: '0.75rem',
                alignItems: 'end',
              }}
            >
              <label className="field" style={{ margin: 0 }}>
                Package name
                <input
                  value={packageDraft.title}
                  onChange={(event) =>
                    setPackageDraft({ ...packageDraft, title: event.target.value })
                  }
                  placeholder="Pre-test"
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                Version
                <input
                  value={packageDraft.versionLabel}
                  onChange={(event) =>
                    setPackageDraft({ ...packageDraft, versionLabel: event.target.value })
                  }
                  placeholder="draft-v1"
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                Sessions
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={packageDraft.sessionCount}
                  onChange={(event) =>
                    setPackageDraft({
                      ...packageDraft,
                      sessionCount: Number(event.target.value) || 8,
                    })
                  }
                />
              </label>
              <label className="field" style={{ margin: 0 }}>
                Sentences/session
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={packageDraft.itemsPerSession}
                  onChange={(event) =>
                    setPackageDraft({
                      ...packageDraft,
                      itemsPerSession: Number(event.target.value) || 10,
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="primary"
                onClick={() => void createPackageFromBuilder()}
              >
                Create package
              </button>
            </div>
            <p className="meta" style={{ margin: 0 }}>
              Creates a draft package with {packageDraft.sessionCount} sessions ×{' '}
              {packageDraft.itemsPerSession} CVR sentence slots. Each session is mapped to CCI by
              order and default target CVR sequence 3,5,7,9,11,13,15,17 for CPD calculation.
            </p>
          </div>
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
                {filteredSessionRows.flatMap((row) => {
                  const editing = editingSectionId === row.id && sessionDraft
                  const editable = row.versionStatus === 'draft'
                  const hasSnapshot = row.activeTargetCvrOhm !== null
                  const showMapping = mappingSectionId === row.id && mappingDraft
                  const mappingProfileCategories = mappingDraft
                    ? cciCategoriesForMapping(mappingDraft.cciProfileId)
                    : []

                  const mainRow = (
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
                      <td>
                        {/* T2: drill-in toggle */}
                        <button
                          type="button"
                          className="ghost"
                          style={{ padding: '0.1rem 0.3rem', fontSize: '0.8rem' }}
                          onClick={() =>
                            setExpandedSectionId(expandedSectionId === row.id ? null : row.id)
                          }
                        >
                          {row.itemCount} items ▾
                        </button>
                      </td>
                      <td style={{ minWidth: 220 }}>
                        {/* T3: no-snapshot warning + T4: inline mapping form */}
                        {showMapping ? (
                          <div style={{ display: 'grid', gap: '0.35rem' }}>
                            <label className="field" style={{ margin: 0 }}>
                              Target CVR (Ω)
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={mappingDraft.targetCvrOhm}
                                onChange={(e) =>
                                  setMappingDraft({
                                    ...mappingDraft,
                                    targetCvrOhm: Number(e.target.value),
                                  })
                                }
                                placeholder="e.g. 12"
                              />
                            </label>
                            <label className="field" style={{ margin: 0 }}>
                              CCI Profile
                              <select
                                value={mappingDraft.cciProfileId}
                                onChange={(e) =>
                                  setMappingDraft({
                                    ...mappingDraft,
                                    cciProfileId: e.target.value,
                                    cciCategoryId: '',
                                  })
                                }
                              >
                                <option value="">— Select profile —</option>
                                {selectableCciProfiles.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} ({p.versionLabel}) [{p.status}]
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field" style={{ margin: 0 }}>
                              CCI Category
                              <select
                                value={mappingDraft.cciCategoryId}
                                onChange={(e) =>
                                  setMappingDraft({
                                    ...mappingDraft,
                                    cciCategoryId: e.target.value,
                                  })
                                }
                              >
                                <option value="">— Select category —</option>
                                {mappingProfileCategories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.label} (val {c.value})
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field" style={{ margin: 0 }}>
                              Reason{row.activeSnapshotId ? ' (required)' : ' (optional)'}
                              <input
                                value={mappingDraft.reason}
                                onChange={(e) =>
                                  setMappingDraft({ ...mappingDraft, reason: e.target.value })
                                }
                                placeholder="e.g. Approved measurement review"
                              />
                            </label>
                            <div className="btn-row" style={{ margin: 0 }}>
                              <button
                                type="button"
                                className="primary"
                                onClick={() => void saveMapping(row)}
                              >
                                <Save className="h-4 w-4" aria-hidden />
                                Save
                              </button>
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => {
                                  setMappingSectionId(null)
                                  setMappingDraft(null)
                                }}
                              >
                                <X className="h-4 w-4" aria-hidden />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {hasSnapshot ? (
                              <div>
                                {row.activeTargetCvrOhm} Ω · {row.activeCciLabel ?? 'No CCI'}{' '}
                                {row.activeCciValue != null ? `(${row.activeCciValue})` : ''}
                              </div>
                            ) : (
                              <span
                                className="badge"
                                style={{ borderColor: '#d69e2e', color: '#d69e2e' }}
                              >
                                ⚠ No snapshot set
                              </span>
                            )}
                            <div style={{ marginTop: '0.25rem' }}>
                              <button
                                type="button"
                                className="ghost"
                                style={{ fontSize: '0.8rem', padding: '0.1rem 0.35rem' }}
                                onClick={() => beginMapping(row)}
                              >
                                {hasSnapshot ? 'Override mapping' : 'Set mapping'}
                              </button>
                            </div>
                          </div>
                        )}
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

                  if (expandedSectionId !== row.id) return [mainRow]

                  // T2: drill-in items sub-table
                  const sectionItems = cvrRows.filter((item) => item.sectionId === row.id)
                  const expandedRow = (
                    <tr key={`${row.id}-items`}>
                      <td
                        colSpan={7}
                        style={{
                          padding: '0.5rem 1rem 0.75rem',
                          background: 'var(--bg-page)',
                          borderTop: 'none',
                        }}
                      >
                        {sectionItems.length === 0 ? (
                          <div className="meta" style={{ margin: 0, textAlign: 'center' }}>
                            No items in this section.
                          </div>
                        ) : (
                          <table style={{ width: '100%', fontSize: '0.85rem' }}>
                            <thead>
                              <tr>
                                <th style={{ width: 32 }}>#</th>
                                <th>Prompt (VI)</th>
                                <th>Prompt (EN)</th>
                                <th style={{ width: 56 }}>TC</th>
                                <th style={{ width: 56 }}>LC</th>
                                <th style={{ width: 56 }}>TL</th>
                                <th style={{ width: 80 }}>CVR (Ω)</th>
                                <th style={{ width: 80 }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sectionItems.map((item) => (
                                <tr key={item.id}>
                                  <td>{item.itemOrder}</td>
                                  <td>{item.promptVi ?? '—'}</td>
                                  <td className="meta" style={{ margin: 0 }}>
                                    {item.promptEn ?? '—'}
                                  </td>
                                  <td>{item.tc ?? '—'}</td>
                                  <td>{item.lc ?? '—'}</td>
                                  <td>{item.tl ?? '—'}</td>
                                  <td>
                                    <span className="badge">{item.measuredCvr ?? '—'} Ω</span>
                                  </td>
                                  <td>{statusLabel(item.versionStatus)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )
                  return [mainRow, expandedRow]
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

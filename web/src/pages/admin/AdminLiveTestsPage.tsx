import { useEffect, useMemo, useState } from 'react'
import {
  FlaskConical,
  Languages,
  ListChecks,
  Play,
  Check,
  X,
  Upload,
  Settings,
  ShieldCheck,
  FileText,
  PlusCircle,
} from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel, StatCard } from '../../components/ui'
import { getSupabase } from '../../lib/supabase'
import type { LiveTestBlock, LiveTestItem, LiveTestResource } from '../../modules/assessment/live-test'
import { blockSummary } from '../../modules/assessment/live-test'
import { listLiveTestBlocks, listLiveTestItems, listLiveTestResources, audioUrl } from '../../lib/live-test-resources'
import {
  listTestPackages,
  listTestPackageVersions,
  listTestSections,
  listTestItems as listV2Items,
  listCciProfiles,
  listCciCategories,
  getSectionSnapshot,
  createSnapshotOverride,
  listNarrationVariants,
  type NarrationVariant,
} from '../../lib/test-packages'
import type {
  TestPackage,
  TestPackageVersion,
  TestSection,
  TestItem,
  SectionMeasurementSnapshot,
  CciProfile,
  CciCategory,
} from '../../modules/catalog/test-package-catalog'
import { SupabaseLiveTestGeneration } from '../../modules/catalog/live-test-generation'

type ResourceBundle = {
  resource: LiveTestResource
  blocks: Array<LiveTestBlock & { items: LiveTestItem[] }>
}

type LoadState = 'loading' | 'ready' | 'error'

function completeness(items: LiveTestItem[]) {
  const total = items.length
  const viReady = items.filter((item) => item.promptVi && item.cvrValue != null).length
  const enReady = items.filter((item) => item.promptEn && item.cvrValue != null).length
  const cciReady = items.filter((item) => item.cciValue != null).length
  const cpdReady = items.filter((item) => item.cpdValue != null || (item.cvrValue != null && item.cciValue != null)).length
  return { total, viReady, enReady, cciReady, cpdReady }
}

export function AdminLiveTestsPage() {
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [bundles, setBundles] = useState<ResourceBundle[]>([])

  // Tab state: 'v2' (new package catalog) or 'legacy' (v1 resources)
  const [activeTab, setActiveTab] = useState<'v2' | 'legacy' | 'narrations' | 'import' | 'generate'>('v2')

  // V2 Catalog State
  const [packages, setPackages] = useState<TestPackage[]>([])
  const [selectedPkgId, setSelectedPkgId] = useState<string>('')
  const [versions, setVersions] = useState<TestPackageVersion[]>([])
  const [selectedVerId, setSelectedVerId] = useState<string>('')
  const [sections, setSections] = useState<TestSection[]>([])
  const [selectedSecId, setSelectedSecId] = useState<string>('')
  const [v2Items, setV2Items] = useState<TestItem[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<SectionMeasurementSnapshot | null>(null)

  // Override Form State
  const [cciProfiles, setCciProfiles] = useState<CciProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [cciCategories, setCciCategories] = useState<CciCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const [overrideReason, setOverrideReason] = useState<string>('')
  const [overrideStatus, setOverrideStatus] = useState<string>('')

  // Narration approvals State
  const [selectedItemIdForNarration, setSelectedItemIdForNarration] = useState<string>('')
  const [narrationVariants, setNarrationVariants] = useState<NarrationVariant[]>([])
  const [narrationStatus, setNarrationStatus] = useState<string>('')

  // CSV Import State
  const [csvContent, setCsvContent] = useState<string>('')
  const [csvPreviewItems, setCsvPreviewItems] = useState<any[]>([])

  const generator = useMemo(() => new SupabaseLiveTestGeneration(), [])
  const [ttsStatus, setTtsStatus] = useState<string>('')

  // Generate CVR State (Phase 4)
  type CvrGeneratedItem = {
    termVi: string
    termEn: string
    promptVi: string
    promptEn: string
    tc: number
    lc: number
    tl: number
    measuredCvr: number
    approved: boolean
  }
  const [cvrTopic, setCvrTopic] = useState<string>('')
  const [cvrTargetOhm, setCvrTargetOhm] = useState<number>(9)
  const [cvrCount, setCvrCount] = useState<number>(5)
  const [cvrGenStatus, setCvrGenStatus] = useState<string>('')
  const [cvrPreviewItems, setCvrPreviewItems] = useState<CvrGeneratedItem[]>([]
  )
  const [cvrSaveStatus, setCvrSaveStatus] = useState<string>('')

  // Package Builder State
  const [packageTitle, setPackageTitle] = useState<string>('')
  const [versionLabel, setVersionLabel] = useState<string>('')
  const [numSessions, setNumSessions] = useState<number>(8)
  const [defaultProfileId, setDefaultProfileId] = useState<string>('')
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('')
  const [defaultCategories, setDefaultCategories] = useState<CciCategory[]>([])
  const [builderStatus, setBuilderStatus] = useState<string>('')
  const [publishStatus, setPublishStatus] = useState<string>('')
  const [importStatus, setImportStatus] = useState<string>('')

  // Sync default profile with categories
  useEffect(() => {
    if (!defaultProfileId) return
    void listCciCategories(defaultProfileId).then((res) => {
      if (res.ok) {
        setDefaultCategories(res.data)
        if (res.data[0]) {
          setDefaultCategoryId(res.data[0].id)
        }
      }
    })
  }, [defaultProfileId])

  // Sync defaultProfileId when cciProfiles loads
  useEffect(() => {
    if (cciProfiles.length > 0 && !defaultProfileId) {
      setDefaultProfileId(cciProfiles[0].id)
    }
  }, [cciProfiles, defaultProfileId])

  // Load V1 legacy resources
  useEffect(() => {
    let cancelled = false
    async function load() {
      const resources = await listLiveTestResources()
      if (!resources.ok) {
        if (!cancelled) {
          setError(resources.error)
          setState('error')
        }
        return
      }
      const next: ResourceBundle[] = []
      for (const resource of resources.data) {
        const blocks = await listLiveTestBlocks(resource.id)
        if (!blocks.ok) continue
        const blockRows: ResourceBundle['blocks'] = []
        for (const block of blocks.data) {
          const items = await listLiveTestItems(block.id)
          blockRows.push({ ...block, items: items.ok ? items.data : [] })
        }
        next.push({ resource, blocks: blockRows })
      }
      if (!cancelled) {
        setBundles(next)
        setState('ready')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // Load V2 packages
  useEffect(() => {
    void listTestPackages().then((res) => {
      if (res.ok && res.data[0]) {
        setPackages(res.data)
        setSelectedPkgId(res.data[0].id)
      }
    })
    void listCciProfiles().then((res) => {
      if (res.ok && res.data[0]) {
        setCciProfiles(res.data)
        setSelectedProfileId(res.data[0].id)
      }
    })
  }, [])

  // Load versions when package changes
  useEffect(() => {
    if (!selectedPkgId) return
    void listTestPackageVersions(selectedPkgId).then((res) => {
      if (res.ok) {
        setVersions(res.data)
        if (res.data[0]) {
          setSelectedVerId(res.data[0].id)
        } else {
          setSelectedVerId('')
          setSections([])
          setV2Items([])
        }
      }
    })
  }, [selectedPkgId])

  // Load sections when version changes
  useEffect(() => {
    if (!selectedVerId) return
    void listTestSections(selectedVerId).then((res) => {
      if (res.ok) {
        setSections(res.data)
        if (res.data[0]) {
          setSelectedSecId(res.data[0].id)
        } else {
          setSelectedSecId('')
          setV2Items([])
        }
      }
    })
  }, [selectedVerId])

  // Load items and active snapshot when section changes
  useEffect(() => {
    if (!selectedSecId) return
    void listV2Items(selectedSecId).then((res) => {
      if (res.ok) {
        setV2Items(res.data)
        if (res.data[0]) {
          setSelectedItemIdForNarration(res.data[0].id)
        }
      }
    })
    void getSectionSnapshot(selectedSecId).then((res) => {
      if (res.ok) {
        setSelectedSnapshot(res.data)
      }
    })
  }, [selectedSecId])

  // Load CCI categories when profile changes
  useEffect(() => {
    if (!selectedProfileId) return
    void listCciCategories(selectedProfileId).then((res) => {
      if (res.ok) {
        setCciCategories(res.data)
        if (res.data[0]) {
          setSelectedCategoryId(res.data[0].id)
        }
      }
    })
  }, [selectedProfileId])

  // Load narration variants for item selection
  useEffect(() => {
    if (!selectedItemIdForNarration) return
    void listNarrationVariants(selectedItemIdForNarration).then((res) => {
      if (res.ok) {
        setNarrationVariants(res.data)
      }
    })
  }, [selectedItemIdForNarration])

  const totals = useMemo(() => {
    const items = bundles.flatMap((bundle) => bundle.blocks.flatMap((block) => block.items))
    return {
      resources: bundles.length,
      blocks: bundles.reduce((sum, bundle) => sum + bundle.blocks.length, 0),
      ...completeness(items),
    }
  }, [bundles])

  // Handle Snapshot override creation
  const handleCreateOverride = async () => {
    if (!selectedSecId || !selectedVerId || !selectedCategoryId) return
    const cat = cciCategories.find((c) => c.id === selectedCategoryId)
    if (!cat) return
    setOverrideStatus('Creating override...')

    const res = await createSnapshotOverride({
      sectionId: selectedSecId,
      packageVersionId: selectedVerId,
      targetCvrOhm: selectedSnapshot?.targetCvrOhm || 3,
      cciProfileId: selectedProfileId,
      cciCategoryId: selectedCategoryId,
      cciCategoryLabel: cat.label,
      cciValue: cat.value,
      supersedesSnapshotId: selectedSnapshot?.id ?? null,
      overrideReason: overrideReason || 'Manual administrator adjustment override',
    })

    if (res.ok) {
      setSelectedSnapshot(res.data)
      setOverrideReason('')
      setOverrideStatus('Override applied successfully!')
    } else {
      setOverrideStatus(`Error: ${res.error}`)
    }
  }

  // Handle Narration Audio Approval
  const handleApproveNarration = async (generationJobId: string | null) => {
    if (!generationJobId) {
      setNarrationStatus('Cannot approve: this narration variant is missing its generation job reference.')
      return
    }
    setNarrationStatus('Processing approval...')
    try {
      const res = await generator.approveGeneratedAsset({
        generationJobId,
        notes: 'Approved by administrator',
      })
      if (res && res.narrationVariantId) {
        setNarrationStatus('Narration variant approved!')
        // Refresh local list
        if (selectedItemIdForNarration) {
          const r = await listNarrationVariants(selectedItemIdForNarration)
          if (r.ok) setNarrationVariants(r.data)
        }
      } else {
        setNarrationStatus('Approval failed')
      }
    } catch (e: any) {
      setNarrationStatus(`Error: ${e.message}`)
    }
  }

  // Rejection requires a separate audited server action; do not route it through approval.
  const handleRejectNarration = () => {
    setNarrationStatus('Reject is not wired yet. Leave this variant generated, or approve it after review.')
  }

  const handleGenerateSectionIntro = async (sectionId: string, lang: 'vi' | 'en' = 'vi') => {
    if (!selectedVerId) return
    setTtsStatus(`Generating section intro narration (${lang.toUpperCase()})...`)
    try {
      const activeVoice = lang === 'vi' ? 'vi-VN-Standard-A' : 'en-US-Standard-C'
      const receipt = await generator.generateNarration({
        packageVersionId: selectedVerId,
        target: 'section_intro',
        testSectionId: sectionId,
        language: lang,
        voiceId: activeVoice,
      })
      if (receipt.status === 'succeeded') {
        setTtsStatus(`Section intro narration (${lang.toUpperCase()}) generated! (Job ID: ${receipt.jobId})`)
      } else {
        setTtsStatus(`Section intro narration generation failed: ${receipt.error?.message || 'Unknown error'}`)
      }
    } catch (e: any) {
      setTtsStatus(`Error: ${e.message}`)
    }
  }

  const handleGenerateItemNarration = async (itemId: string, lang: 'vi' | 'en') => {
    if (!selectedVerId) return
    setTtsStatus(`Generating item narration (${lang.toUpperCase()})...`)
    try {
      const activeVoice = lang === 'vi' ? 'vi-VN-Standard-A' : 'en-US-Standard-C'
      const receipt = await generator.generateNarration({
        packageVersionId: selectedVerId,
        target: 'test_item',
        testItemId: itemId,
        language: lang,
        voiceId: activeVoice,
      })
      if (receipt.status === 'succeeded') {
        setTtsStatus(`Item narration (${lang.toUpperCase()}) generated! (Job ID: ${receipt.jobId})`)
        if (selectedItemIdForNarration === itemId) {
          const r = await listNarrationVariants(itemId)
          if (r.ok) setNarrationVariants(r.data)
        }
      } else {
        setTtsStatus(`Item narration generation failed: ${receipt.error?.message || 'Unknown error'}`)
      }
    } catch (e: any) {
      setTtsStatus(`Error: ${e.message}`)
    }
  }

  const handleCreatePackageVersion = async () => {
    if (!packageTitle.trim()) {
      setBuilderStatus('Error: Package title is required.')
      return
    }
    if (!versionLabel.trim()) {
      setBuilderStatus('Error: Version label is required.')
      return
    }
    if (!defaultCategoryId) {
      setBuilderStatus('Error: Default CCI category is required.')
      return
    }

    setBuilderStatus('Creating package and version draft...')
    const sb = getSupabase() as any
    if (!sb) {
      setBuilderStatus('Error: Supabase is not configured.')
      return
    }

    try {
      // 1. Get singleton org id
      const { data: orgs, error: orgErr } = await sb.from('organizations').select('id').limit(1)
      if (orgErr) throw new Error(orgErr.message)
      const orgId = orgs?.[0]?.id || '00000000-0000-0000-0000-000000000000'

      // 2. Insert or get package
      let pkgId = ''
      const existingPkg = packages.find(p => p.title.toLowerCase() === packageTitle.toLowerCase())
      if (existingPkg) {
        pkgId = existingPkg.id
      } else {
        const { data: newPkg, error: pkgErr } = await sb
          .from('test_packages')
          .insert({
            organization_id: orgId,
            title: packageTitle.trim(),
            slug: packageTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          })
          .select()
          .single()
        if (pkgErr) throw new Error(pkgErr.message)
        pkgId = newPkg.id
      }

      // 3. Create version draft
      const { data: newVer, error: verErr } = await sb
        .from('test_package_versions')
        .insert({
          package_id: pkgId,
          version_label: versionLabel.trim(),
          status: 'draft',
        })
        .select()
        .single()
      if (verErr) throw new Error(verErr.message)
      const verId = newVer.id

      // 4. Create sections & snapshots
      const selectedCat = defaultCategories.find(c => c.id === defaultCategoryId)
      const catLabel = selectedCat?.label || 'Default CCI'
      const catValue = selectedCat?.value || 3.0

      for (let i = 1; i <= numSessions; i++) {
        const { data: section, error: secErr } = await sb
          .from('test_sections')
          .insert({
            package_version_id: verId,
            section_order: i,
            title: `Session ${i}`,
          })
          .select()
          .single()
        if (secErr) throw new Error(secErr.message)

        // Insert default snapshot
        const { error: snapErr } = await sb
          .from('section_measurement_snapshots')
          .insert({
            test_section_id: section.id,
            package_version_id: verId,
            target_cvr_ohm: 3, // Default CVR to 3 ohm
            cci_profile_id: defaultProfileId,
            cci_category_id: defaultCategoryId,
            cci_category_label: catLabel,
            cci_value: catValue,
          })
        if (snapErr) throw new Error(snapErr.message)
      }

      setBuilderStatus(`Successfully created package version draft! Created ${numSessions} sections with CCI = ${catValue} (${catLabel}).`)
      
      // Clear inputs
      setPackageTitle('')
      setVersionLabel('')

      // Reload packages
      const pkgsRes = await listTestPackages()
      if (pkgsRes.ok) {
        setPackages(pkgsRes.data)
        setSelectedPkgId(pkgId)
      }
    } catch (e: any) {
      setBuilderStatus(`Error: ${e.message}`)
    }
  }

  const handlePublishVersion = async () => {
    if (!selectedVerId) return
    if (!window.confirm('Are you sure you want to PUBLISH this version? Once published, it will be frozen and cannot be modified.')) {
      return
    }

    setPublishStatus('Publishing...')
    const sb = getSupabase() as any
    if (!sb) {
      setPublishStatus('Supabase not configured')
      return
    }

    const { error } = await sb
      .from('test_package_versions')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', selectedVerId)

    if (error) {
      setPublishStatus(`Error: ${error.message}`)
    } else {
      setPublishStatus('Published successfully!')
      // Reload versions
      if (selectedPkgId) {
        const res = await listTestPackageVersions(selectedPkgId)
        if (res.ok) {
          setVersions(res.data)
          setSelectedVerId(selectedVerId)
        }
      }
    }
  }

  const handleSaveImportedItems = async () => {
    if (!selectedVerId) {
      setImportStatus('Error: Please select a Package Version under the Test Packages (V2) tab first.')
      return
    }
    if (csvPreviewItems.length === 0) {
      setImportStatus('Error: No items to import. Paste CSV and preview first.')
      return
    }

    setImportStatus('Saving items...')
    const sb = getSupabase() as any
    if (!sb) {
      setImportStatus('Error: Supabase not configured.')
      return
    }

    try {
      // 1. Check if the selected version is a draft
      const { data: ver, error: verErr } = await sb
        .from('test_package_versions')
        .select('status')
        .eq('id', selectedVerId)
        .maybeSingle()
      if (verErr || !ver) {
        throw new Error(verErr?.message || 'Selected version not found')
      }
      if (ver.status !== 'draft') {
        throw new Error('You can only import items into a DRAFT package version.')
      }

      // 2. Fetch all sections for the selected version to map sectionOrder
      const { data: dbSections, error: secErr } = await sb
        .from('test_sections')
        .select('id, section_order')
        .eq('package_version_id', selectedVerId)
      if (secErr) throw new Error(secErr.message)

      // 3. Loop and insert items
      let count = 0
      for (const item of csvPreviewItems) {
        const matchSec = dbSections?.find((s: any) => s.section_order === item.sectionOrder)
        if (!matchSec) {
          console.warn(`Section order ${item.sectionOrder} not found in this package version. Skipping.`)
          continue
        }

        const { error: itemErr } = await sb
          .from('test_items')
          .insert({
            package_version_id: selectedVerId,
            section_id: matchSec.id,
            item_order: item.itemNumber,
            prompt_vi: item.promptVi,
            prompt_en: item.promptEn,
            term_vi: item.termVi,
            term_en: item.termEn,
            tc: item.tc,
            lc: item.lc,
            tl: item.tl,
          })
        if (itemErr) throw new Error(itemErr.message)
        count++
      }

      setImportStatus(`Successfully saved ${count} items into the draft package version!`)
      if (selectedSecId) {
        const r = await listV2Items(selectedSecId)
        if (r.ok) setV2Items(r.data)
      }
    } catch (e: any) {
      setImportStatus(`Error: ${e.message}`)
    }
  }

  // Parse CSV line taking quotes and nested commas into account
  const parseCSVRow = (text: string): string[] => {
    const result: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < text.length; i++) {
      const c = text[i]
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"'
          i++ // skip next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim())
        cur = ''
      } else {
        cur += c
      }
    }
    result.push(cur.trim())
    return result.map((val) => {
      if (val.startsWith('"') && val.endsWith('"')) {
        return val.slice(1, -1).trim()
      }
      return val
    })
  }

  // Robust CSV parsing with header detection
  const handleParseCsv = () => {
    if (!csvContent.trim()) return
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim())
    if (lines.length <= 1) return

    const header = parseCSVRow(lines[0])
    const isChunksFormat = header.includes('Complete Sentence (Vie)') || header.includes('Tiếng Việt')

    const parsed = []
    const sectionItemCounters: Record<number, number> = {}

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVRow(lines[i])
      if (cols.length < 5) continue

      if (isChunksFormat) {
        // Chunks-resource CSV mapping
        const sectionOrder = parseInt(cols[header.indexOf('Session No.')]) || 1
        sectionItemCounters[sectionOrder] = (sectionItemCounters[sectionOrder] || 0) + 1
        const itemNumber = sectionItemCounters[sectionOrder]

        parsed.push({
          itemNumber,
          termVi: cols[header.indexOf('Tiếng Việt')] ?? '',
          termEn: cols[header.indexOf('Tiếng Anh')] ?? '',
          promptVi: cols[header.indexOf('Complete Sentence (Vie)')] ?? '',
          promptEn: cols[header.indexOf('Complete Sentence (Eng)')] ?? '',
          tc: parseFloat(cols[header.indexOf('TC')]) || 3.0,
          lc: parseFloat(cols[header.indexOf('LC')]) || 1.0,
          tl: parseFloat(cols[header.indexOf('TL')]) || 1.0,
          sectionOrder,
        })
      } else {
        // Default / placeholder mapping
        const sectionOrder = parseInt(cols[8]) || 1
        const itemNumber = parseInt(cols[0]) || i
        parsed.push({
          itemNumber,
          termVi: cols[1] ?? '',
          termEn: cols[2] ?? '',
          promptVi: cols[3] ?? '',
          promptEn: cols[4] ?? '',
          tc: parseFloat(cols[5]) || 1.0,
          lc: parseFloat(cols[6]) || 1.0,
          tl: parseFloat(cols[7]) || 1.0,
          sectionOrder,
        })
      }
    }
    setCsvPreviewItems(parsed)
  }

  // ---- Generate CVR handlers (Phase 4) ----

  const handleGenerateCVR = async () => {
    if (!selectedVerId || !selectedSecId) {
      setCvrGenStatus('Error: Please select a Package Version and Section first (use the Test Packages tab).')
      return
    }
    if (cvrTargetOhm <= 0) {
      setCvrGenStatus('Error: Target Ohm must be a positive number.')
      return
    }
    setCvrGenStatus(`Generating ${cvrCount} sentence(s) at ${cvrTargetOhm} Ohm for "${cvrTopic || 'selected section'}"…`)
    setCvrPreviewItems([])
    setCvrSaveStatus('')
    try {
      const result = await generator.generateCVRPreview({
        packageVersionId: selectedVerId,
        sectionId: selectedSecId,
        topic: cvrTopic.trim() || `Section ${sections.find(s => s.id === selectedSecId)?.sectionOrder ?? ''}`,
        targetOhm: cvrTargetOhm,
        count: cvrCount,
      })
      const items: CvrGeneratedItem[] = result.items.map(item => ({ ...item, approved: true }))
      setCvrPreviewItems(items)
      setCvrGenStatus(`Generated ${items.length} sentence(s). Review below, edit if needed, then save.`)
    } catch (e: any) {
      setCvrGenStatus(`Error: ${e.message}`)
    }
  }

  const handleRegenerateItem = async (idx: number) => {
    if (!selectedVerId || !selectedSecId) return
    const item = cvrPreviewItems[idx]
    setCvrGenStatus(`Regenerating item ${idx + 1}…`)
    try {
      const result = await generator.generateCVRPreview({
        packageVersionId: selectedVerId,
        sectionId: selectedSecId,
        topic: cvrTopic.trim() || `Section ${sections.find(s => s.id === selectedSecId)?.sectionOrder ?? ''}`,
        targetOhm: item.measuredCvr,
        count: 1,
      })
      if (result.items[0]) {
        const updated = [...cvrPreviewItems]
        updated[idx] = { ...result.items[0], approved: true }
        setCvrPreviewItems(updated)
        setCvrGenStatus(`Item ${idx + 1} regenerated.`)
      }
    } catch (e: any) {
      setCvrGenStatus(`Regenerate error: ${e.message}`)
    }
  }

  const handleSaveCVRItems = async () => {
    if (!selectedVerId || !selectedSecId) {
      setCvrSaveStatus('Error: No version/section selected.')
      return
    }
    const toSave = cvrPreviewItems.filter(i => i.approved)
    if (toSave.length === 0) {
      setCvrSaveStatus('Error: No approved items to save.')
      return
    }
    setCvrSaveStatus('Saving…')
    const sb = getSupabase() as any
    if (!sb) {
      setCvrSaveStatus('Error: Supabase not configured.')
      return
    }
    try {
      // Check version is draft
      const { data: ver, error: verErr } = await sb
        .from('test_package_versions')
        .select('status')
        .eq('id', selectedVerId)
        .maybeSingle()
      if (verErr || !ver) throw new Error(verErr?.message || 'Version not found')
      if (ver.status !== 'draft') throw new Error('Can only save to a DRAFT package version.')

      // Get existing item count for ordering
      const { data: existingItems } = await sb
        .from('test_items')
        .select('item_order')
        .eq('section_id', selectedSecId)
        .order('item_order', { ascending: false })
        .limit(1)
      const nextOrder = (existingItems?.[0]?.item_order ?? 0) + 1

      let saved = 0
      for (let i = 0; i < toSave.length; i++) {
        const item = toSave[i]
        const { error: itemErr } = await sb
          .from('test_items')
          .insert({
            package_version_id: selectedVerId,
            section_id: selectedSecId,
            item_order: nextOrder + i,
            term_vi: item.termVi,
            term_en: item.termEn,
            prompt_vi: item.promptVi,
            prompt_en: item.promptEn,
            tc: item.tc,
            lc: item.lc,
            tl: item.tl,
          })
        if (itemErr) throw new Error(itemErr.message)
        saved++
      }
      setCvrSaveStatus(`Saved ${saved} item(s) into the draft section!`)
      setCvrPreviewItems([])
      // Refresh V2 items in main tab
      const r = await listV2Items(selectedSecId)
      if (r.ok) setV2Items(r.data)
    } catch (e: any) {
      setCvrSaveStatus(`Error: ${e.message}`)
    }
  }

  return (
    <>
      <PageHeader
        icon={FlaskConical}
        kicker="Admin"
        title="Live Tests"
        subtitle="Manage flexible package versions, measurement catalog overrides, prompt narrations, and review queues."
      />

      <div className="btn-row" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <button className={activeTab === 'v2' ? 'primary' : 'ghost'} onClick={() => setActiveTab('v2')}>
          Test Packages (V2)
        </button>
        <button className={activeTab === 'narrations' ? 'primary' : 'ghost'} onClick={() => setActiveTab('narrations')}>
          TTS Narrations Review
        </button>
        <button className={activeTab === 'import' ? 'primary' : 'ghost'} onClick={() => setActiveTab('import')}>
          CSV Package Preview
        </button>
        <button className={activeTab === 'generate' ? 'primary' : 'ghost'} onClick={() => setActiveTab('generate')}>
          ⚡ Generate CVR
        </button>
        <button className={activeTab === 'legacy' ? 'primary' : 'ghost'} onClick={() => setActiveTab('legacy')}>
          Legacy Resources (V1)
        </button>
      </div>

      {activeTab === 'v2' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
            {/* Left selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Panel icon={Settings} title="Section Selector" collapsible={false}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Test Package</span>
                    <select
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                      value={selectedPkgId}
                      onChange={(e) => setSelectedPkgId(e.target.value)}
                    >
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.title}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Package Version</span>
                    <select
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                      value={selectedVerId}
                      onChange={(e) => setSelectedVerId(e.target.value)}
                    >
                      {versions.map((ver) => (
                        <option key={ver.id} value={ver.id}>
                          {ver.versionLabel} ({ver.status})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Test Section</span>
                    <select
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                      value={selectedSecId}
                      onChange={(e) => setSelectedSecId(e.target.value)}
                    >
                      {sections.map((sec) => (
                        <option key={sec.id} value={sec.id}>
                          Section {sec.sectionOrder}: {sec.title ?? 'Untitled'}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </Panel>

              {/* Publish/Status panel */}
              {versions.find(v => v.id === selectedVerId)?.status === 'draft' && (
                <Panel icon={ShieldCheck} title="Publish Gói Test" collapsible={false}>
                  {publishStatus && (
                    <div style={{ marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#2d3748', color: '#f6ad55', fontSize: '0.85rem' }}>
                      {publishStatus}
                    </div>
                  )}
                  <button className="primary" style={{ width: '100%', backgroundColor: '#d69e2e', color: '#fff' }} onClick={handlePublishVersion}>
                    Publish Phiên bản này (Khóa đề)
                  </button>
                </Panel>
              )}

              {/* Package Builder Panel */}
              <Panel icon={PlusCircle} title="Tạo Gói Test Mới (Draft)" collapsible={true}>
                {builderStatus && (
                  <div style={{ marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#2b6cb0', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }}>
                    {builderStatus}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Tên Gói (Package Title)</span>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Pretest Package"
                      value={packageTitle}
                      onChange={(e) => setPackageTitle(e.target.value)}
                      style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                    />
                  </label>
                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Nhãn Phiên Bản (Version)</span>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: v1.0.0"
                      value={versionLabel}
                      onChange={(e) => setVersionLabel(e.target.value)}
                      style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                    />
                  </label>
                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Số lượng Session</span>
                    <input 
                      type="number" 
                      min={1} 
                      max={12} 
                      value={numSessions}
                      onChange={(e) => setNumSessions(parseInt(e.target.value) || 8)}
                      style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                    />
                  </label>
                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Default CCI Profile</span>
                    <select
                      style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                      value={defaultProfileId}
                      onChange={(e) => setDefaultProfileId(e.target.value)}
                    >
                      {cciProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Default CCI Category</span>
                    <select
                      style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                      value={defaultCategoryId}
                      onChange={(e) => setDefaultCategoryId(e.target.value)}
                    >
                      {defaultCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} ({c.value} Ampe)
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className="primary" style={{ marginTop: '0.5rem' }} onClick={handleCreatePackageVersion}>
                    Khởi tạo Gói Test & Sessions
                  </button>
                </div>
              </Panel>

              {/* Snapshot Override Form */}
              <Panel icon={ShieldCheck} title="Measurement Override" collapsible={false}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>CCI Profile</span>
                    <select
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                    >
                      {cciProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.versionLabel})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>CCI Category</span>
                    <select
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                    >
                      {cciCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label} (value: {c.value})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Override Reason</span>
                    <input
                      type="text"
                      placeholder="Why is this override needed?"
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                    />
                  </label>

                  <button className="primary" style={{ marginTop: '0.5rem' }} onClick={handleCreateOverride}>
                    Apply Override Snapshot
                  </button>

                  {overrideStatus && (
                    <div className="meta" style={{ marginTop: '0.5rem', color: '#ffc107', fontStyle: 'italic' }}>
                      {overrideStatus}
                    </div>
                  )}
                </div>
              </Panel>
            </div>

            {/* Right details view */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Panel icon={FileText} title="Active Section Snapshot & Items" collapsible={false}>
                {ttsStatus && (
                  <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', backgroundColor: '#2b6cb0', color: '#fff', borderRadius: '4px', fontSize: '0.85rem' }}>
                    {ttsStatus}
                  </div>
                )}
                {selectedSnapshot ? (
                  <div style={{ marginBottom: '1.25rem', padding: '0.75rem', backgroundColor: '#2d3748', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>
                      Active Snapshot ID: <span style={{ color: '#63b3ed' }}>{selectedSnapshot.id}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                      <span>CCI Category: <strong>{selectedSnapshot.cciCategoryLabel}</strong></span>
                      <span>CCI Value: <strong>{selectedSnapshot.cciValue}</strong></span>
                    </div>
                    {selectedSnapshot.overrideReason && (
                      <div className="meta" style={{ marginTop: '0.5rem', color: '#f6ad55' }}>
                        Override Reason: {selectedSnapshot.overrideReason}
                      </div>
                    )}
                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #4a5568', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: '#a0aec0' }}>TTS Narration:</span>
                      <button 
                        className="primary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => handleGenerateSectionIntro(selectedSnapshot.sectionId, 'vi')}
                      >
                        Gen Intro (VI)
                      </button>
                      <button 
                        className="primary" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => handleGenerateSectionIntro(selectedSnapshot.sectionId, 'en')}
                      >
                        Gen Intro (EN)
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="meta" style={{ marginBottom: '1rem' }}>No measurement snapshot active for this section.</p>
                )}

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>VI Prompt</th>
                        <th>EN Prompt</th>
                        <th>TC</th>
                        <th>LC</th>
                        <th>TL</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v2Items.map((item) => (
                        <tr key={item.id}>
                          <td><strong>Item {item.itemOrder}</strong></td>
                          <td>{item.promptVi ?? '—'}</td>
                          <td>{item.promptEn ?? '—'}</td>
                          <td>{item.tc ?? '—'}</td>
                          <td>{item.lc ?? '—'}</td>
                          <td>{item.tl ?? '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button 
                                className="ghost" 
                                style={{ padding: '0.15rem 0.3rem', fontSize: '0.75rem' }}
                                onClick={() => handleGenerateItemNarration(item.id, 'vi')}
                              >
                                Gen VI
                              </button>
                              <button 
                                className="ghost" 
                                style={{ padding: '0.15rem 0.3rem', fontSize: '0.75rem' }}
                                onClick={() => handleGenerateItemNarration(item.id, 'en')}
                              >
                                Gen EN
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {v2Items.length === 0 && (
                        <tr>
                          <td colSpan={8} className="meta" style={{ textAlign: 'center' }}>
                            No items exist in this section.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </div>
          </div>
        </>
      )}

      {activeTab === 'narrations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          {/* Selector */}
          <Panel icon={Settings} title="Item Selector" collapsible={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Test Section</span>
                <select
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  value={selectedSecId}
                  onChange={(e) => setSelectedSecId(e.target.value)}
                >
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      Section {sec.sectionOrder}: {sec.title ?? 'Untitled'}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Test Item</span>
                <select
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  value={selectedItemIdForNarration}
                  onChange={(e) => setSelectedItemIdForNarration(e.target.value)}
                >
                  {v2Items.map((item) => (
                    <option key={item.id} value={item.id}>
                      Item {item.itemOrder}: {item.promptVi?.substring(0, 30) ?? 'Untitled'}...
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Panel>

          {/* Narration variants list */}
          <Panel icon={Languages} title="Narration Variants Approval Queue" collapsible={false}>
            {narrationStatus && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#2d3748', borderLeft: '4px solid #63b3ed', fontStyle: 'italic' }}>
                {narrationStatus}
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Language</th>
                    <th>Voice</th>
                    <th>Status</th>
                    <th>Audio Asset</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {narrationVariants.map((v) => (
                    <tr key={v.id}>
                      <td><strong>{v.language.toUpperCase()}</strong></td>
                      <td>{v.voiceLabel ?? v.voiceId}</td>
                      <td>
                        <span className={`badge ${v.approvalStatus === 'approved' ? 'green' : v.approvalStatus === 'rejected' ? 'red' : 'yellow'}`}>
                          {v.approvalStatus}
                        </span>
                      </td>
                      <td>
                        {v.audioAssetId ? (
                          <button className="ghost" onClick={async () => {
                            const url = await audioUrl(v.audioAssetId)
                            if (url) {
                              const audio = new Audio(url)
                              void audio.play()
                            } else {
                              alert('Audio asset not found or access restricted.')
                            }
                          }}>
                            <Play className="h-3 w-3 inline" /> Play
                          </button>
                        ) : 'Pending generation'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button
                            className="ghost"
                            style={{ padding: '0.25rem' }}
                            title="Approve Narration"
                            disabled={!v.generationJobId || v.approvalStatus === 'approved'}
                            onClick={() => handleApproveNarration(v.generationJobId)}
                          >
                            <Check className="h-4 w-4 text-green" />
                          </button>
                          <button className="ghost" style={{ padding: '0.25rem' }} title="Reject Narration" onClick={handleRejectNarration}>
                            <X className="h-4 w-4 text-red" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {narrationVariants.length === 0 && (
                    <tr>
                      <td colSpan={5} className="meta" style={{ textAlign: 'center' }}>
                        No narration variants registered for this item yet. Request generation through the live-test-generation Edge Function.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {activeTab === 'import' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          <Panel icon={Upload} title="Paste CSV Data" collapsible={false}>
            {importStatus && (
              <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#2d3748', borderLeft: '4px solid #63b3ed', fontStyle: 'italic', fontSize: '0.85rem' }}>
                {importStatus}
              </div>
            )}
            <textarea
              style={{ width: '100%', height: '200px', padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}
              placeholder="item_number,term_vi,term_en,prompt_vi,prompt_en,tc,lc,tl,section_order&#10;1,Chữ A,Letter A,Nhấn màu xanh...,Press green...,1.0,1.2,1.1,1"
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
            />
            <button className="primary" style={{ width: '100%', marginTop: '0.75rem' }} onClick={handleParseCsv}>
              Preview CSV Items
            </button>

            <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #4a5568' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                Import into Draft Version
              </span>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#a0aec0' }}>Package</span>
                <select
                  style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                  value={selectedPkgId}
                  onChange={(e) => setSelectedPkgId(e.target.value)}
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.title}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#a0aec0' }}>Version</span>
                <select
                  style={{ width: '100%', padding: '0.4rem', marginTop: '0.25rem' }}
                  value={selectedVerId}
                  onChange={(e) => setSelectedVerId(e.target.value)}
                >
                  {versions.map((ver) => (
                    <option key={ver.id} value={ver.id}>
                      {ver.versionLabel} ({ver.status})
                    </option>
                  ))}
                </select>
              </label>
              <button 
                className="primary" 
                style={{ width: '100%', backgroundColor: '#38a169', color: '#fff' }} 
                onClick={handleSaveImportedItems}
                disabled={!selectedVerId || csvPreviewItems.length === 0 || versions.find(v => v.id === selectedVerId)?.status !== 'draft'}
              >
                Save Items to Draft Version
              </button>
            </div>
          </Panel>

          <Panel icon={FileText} title="CSV Import Preview" collapsible={false}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Item #</th>
                    <th>Term (VI/EN)</th>
                    <th>Prompt (VI/EN)</th>
                    <th>TC / LC / TL</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreviewItems.map((item, idx) => (
                    <tr key={idx}>
                      <td><strong>{item.itemNumber}</strong></td>
                      <td>{item.termVi} / {item.termEn}</td>
                      <td>{item.promptVi?.substring(0, 15)}... / {item.promptEn?.substring(0, 15)}...</td>
                      <td>{item.tc} / {item.lc} / {item.tl}</td>
                    </tr>
                  ))}
                  {csvPreviewItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="meta" style={{ textAlign: 'center' }}>
                        Paste CSV content and click Preview to verify structure.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {activeTab === 'generate' && (
        <>
          {/* Generate CVR Form */}
          <Panel icon={Play} title="Generate CVR Sentences" collapsible={false}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Context summary */}
              <div style={{ padding: '0.6rem 0.9rem', backgroundColor: '#1a2035', borderRadius: '6px', fontSize: '0.85rem', borderLeft: '3px solid #63b3ed' }}>
                <strong>Section:</strong>{' '}
                {selectedSecId
                  ? `${sections.find(s => s.id === selectedSecId)?.title ?? 'Untitled'} (${sections.find(s => s.id === selectedSecId)?.sectionOrder ?? '?'})`
                  : <span style={{ color: '#fc8181' }}>No section selected — go to Test Packages tab first</span>}
                {' · '}
                <strong>Version:</strong>{' '}
                {selectedVerId
                  ? versions.find(v => v.id === selectedVerId)?.versionLabel ?? selectedVerId
                  : <span style={{ color: '#fc8181' }}>None</span>}
              </div>

              {/* Parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                <label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Topic / Day (optional)</span>
                  <input
                    type="text"
                    placeholder="e.g. Day 1, Session 3, Travel vocabulary"
                    value={cvrTopic}
                    onChange={e => setCvrTopic(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
                <label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Target Ohm (CVR)</span>
                  <select
                    value={cvrTargetOhm}
                    onChange={e => setCvrTargetOhm(Number(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  >
                    {[3, 5, 7, 9, 11, 13, 15, 17].map(ohm => (
                      <option key={ohm} value={ohm}>{ohm} Ohm</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Count</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={cvrCount}
                    onChange={e => setCvrCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
              </div>

              {/* CVR formula hint */}
              <div style={{ fontSize: '0.8rem', color: '#90cdf4', padding: '0.4rem 0.6rem', backgroundColor: '#162032', borderRadius: '4px' }}>
                TC(3) × LC({cvrTargetOhm <= 3 ? 1 : cvrTargetOhm <= 9 ? 1.5 : 2.0}) × TL({Math.round((cvrTargetOhm / (3 * (cvrTargetOhm <= 3 ? 1 : cvrTargetOhm <= 9 ? 1.5 : 2.0))) * 100) / 100}) = <strong>{cvrTargetOhm} Ohm</strong>
              </div>

              <button
                className="primary"
                onClick={handleGenerateCVR}
                disabled={!selectedVerId || !selectedSecId}
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Play className="h-4 w-4" aria-hidden />
                Generate {cvrCount} Sentence(s) at {cvrTargetOhm} Ohm
              </button>

              {cvrGenStatus && (
                <div style={{
                  padding: '0.6rem 0.9rem',
                  backgroundColor: cvrGenStatus.startsWith('Error') ? '#742a2a' : '#1a365d',
                  color: cvrGenStatus.startsWith('Error') ? '#feb2b2' : '#bee3f8',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                }}>
                  {cvrGenStatus}
                </div>
              )}
            </div>
          </Panel>

          {/* Preview and approval table */}
          {cvrPreviewItems.length > 0 && (
            <Panel icon={ListChecks} title={`Review Generated Items (${cvrPreviewItems.filter(i => i.approved).length}/${cvrPreviewItems.length} approved)`} collapsible={false}>
              <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="primary"
                  onClick={handleSaveCVRItems}
                  disabled={cvrPreviewItems.filter(i => i.approved).length === 0}
                >
                  <Check className="h-4 w-4 inline" style={{ marginRight: '0.3rem' }} aria-hidden />
                  Save {cvrPreviewItems.filter(i => i.approved).length} Approved Items
                </button>
                <button
                  className="ghost"
                  onClick={() => setCvrPreviewItems(items => items.map(i => ({ ...i, approved: true })))}
                >
                  Approve All
                </button>
                <button
                  className="ghost"
                  onClick={() => setCvrPreviewItems([])}
                >
                  Clear
                </button>
              </div>

              {cvrSaveStatus && (
                <div style={{
                  marginBottom: '0.75rem',
                  padding: '0.6rem 0.9rem',
                  backgroundColor: cvrSaveStatus.startsWith('Error') ? '#742a2a' : '#22543d',
                  color: cvrSaveStatus.startsWith('Error') ? '#feb2b2' : '#c6f6d5',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                }}>
                  {cvrSaveStatus}
                </div>
              )}

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '2rem' }}>✓</th>
                      <th>#</th>
                      <th>Term VI / EN</th>
                      <th>Câu tiếng Việt (promptVi)</th>
                      <th>English Sentence (promptEn)</th>
                      <th style={{ whiteSpace: 'nowrap' }}>TC × LC × TL</th>
                      <th>Ohm</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cvrPreviewItems.map((item, idx) => (
                      <tr key={idx} style={{ opacity: item.approved ? 1 : 0.45 }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={item.approved}
                            onChange={e => {
                              const updated = [...cvrPreviewItems]
                              updated[idx] = { ...updated[idx], approved: e.target.checked }
                              setCvrPreviewItems(updated)
                            }}
                          />
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#a0aec0' }}>{idx + 1}</td>
                        <td style={{ fontSize: '0.8rem' }}>
                          <div style={{ fontWeight: 'bold' }}>{item.termVi}</div>
                          <div style={{ color: '#718096' }}>{item.termEn}</div>
                        </td>
                        <td>
                          <textarea
                            value={item.promptVi}
                            rows={2}
                            style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem', backgroundColor: '#1a202c', color: '#e2e8f0', border: '1px solid #2d3748', borderRadius: '3px', resize: 'vertical' }}
                            onChange={e => {
                              const updated = [...cvrPreviewItems]
                              updated[idx] = { ...updated[idx], promptVi: e.target.value }
                              setCvrPreviewItems(updated)
                            }}
                          />
                        </td>
                        <td>
                          <textarea
                            value={item.promptEn}
                            rows={2}
                            style={{ width: '100%', fontSize: '0.8rem', padding: '0.3rem', backgroundColor: '#1a202c', color: '#e2e8f0', border: '1px solid #2d3748', borderRadius: '3px', resize: 'vertical' }}
                            onChange={e => {
                              const updated = [...cvrPreviewItems]
                              updated[idx] = { ...updated[idx], promptEn: e.target.value }
                              setCvrPreviewItems(updated)
                            }}
                          />
                        </td>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: '#a0aec0' }}>
                          {item.tc} × {item.lc} × {item.tl}
                        </td>
                        <td>
                          <span className="badge" style={{ backgroundColor: item.measuredCvr >= 9 ? '#2b6cb0' : '#276749' }}>
                            {item.measuredCvr} Ω
                          </span>
                        </td>
                        <td>
                          <button
                            className="ghost"
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            title="Regenerate this item"
                            onClick={() => handleRegenerateItem(idx)}
                          >
                            ↺
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}

      {activeTab === 'legacy' && (
        <>
          <div className="stat-grid" style={{ marginBottom: '1rem' }}>
            <StatCard label="Resources" value={totals.resources} icon={FlaskConical} />
            <StatCard label="Blocks" value={totals.blocks} icon={ListChecks} hint="Expected 8 per resource" />
            <StatCard label="Items" value={totals.total} icon={ListChecks} hint="Expected 80 per resource" />
            <StatCard label="CPD ready" value={`${totals.cpdReady}/${totals.total || 0}`} hint="CVR × CCI available" />
          </div>

          {state === 'loading' ? (
            <EmptyState icon={FlaskConical} title="Loading live-test resources…" />
          ) : null}

          {state === 'error' ? (
            <EmptyState
              icon={FlaskConical}
              title="Could not load live-test resources"
              description={error ?? 'Check Supabase connection and migration status.'}
            />
          ) : null}

          {state === 'ready' && bundles.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No live-test resources seeded"
              description="Run scripts/import-live-test-resource.mjs --dry-run to validate the CSV, then use the approved seed/apply path."
            />
          ) : null}

          {bundles.map(({ resource, blocks }) => {
            const items = blocks.flatMap((block) => block.items)
            const ready = completeness(items)
            return (
              <Panel
                key={resource.id}
                icon={FlaskConical}
                title={`${resource.title} · ${resource.version}`}
                description={`${resource.status} · ${ready.total} items · VI ${ready.viReady}/${ready.total} · EN ${ready.enReady}/${ready.total}`}
                collapsible={false}
              >
                <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
                  <span className="badge">CCI {ready.cciReady}/{ready.total}</span>
                  <span className="badge">CPD {ready.cpdReady}/{ready.total}</span>
                  <span className="badge">Source: {resource.sourceFilename ?? '—'}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Block</th>
                        <th>Summary</th>
                        <th>VI prompts</th>
                        <th>EN prompts</th>
                        <th>CCI</th>
                        <th>CVR</th>
                        <th>CPD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blocks.map((block) => {
                        const c = completeness(block.items)
                        return (
                          <tr key={block.id}>
                            <td>
                              <strong>Session {block.blockNumber}</strong>
                              <div className="meta" style={{ margin: 0 }}>{block.title ?? 'Untitled'}</div>
                            </td>
                            <td>{blockSummary(block)}</td>
                            <td><Languages className="h-3 w-3 inline" aria-hidden /> {c.viReady}/{c.total}</td>
                            <td><Languages className="h-3 w-3 inline" aria-hidden /> {c.enReady}/{c.total}</td>
                            <td>{block.cciMin ?? '—'}–{block.cciMax ?? '—'}</td>
                            <td>{block.cvrMin ?? '—'}–{block.cvrMax ?? '—'}</td>
                            <td>{block.cpdMin ?? '—'}–{block.cpdMax ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Panel>
            )
          })}
        </>
      )}
    </>
  )
}

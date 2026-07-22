import { getSupabase } from './supabase'
import type {
  TestPackage,
  TestPackageVersion,
  TestSection,
  TestItem,
  SectionMeasurementSnapshot,
  CciProfile,
  CciCategory,
} from '../modules/catalog/test-package-catalog'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

function client() {
  return getSupabase() as any
}

function mapTestPackage(row: any): TestPackage {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    slug: row.slug,
    createdByUserId: row.created_by_user_id,
    archivedAt: row.archived_at,
  }
}

function mapTestPackageVersion(row: any): TestPackageVersion {
  return {
    id: row.id,
    packageId: row.package_id,
    versionLabel: row.version_label,
    status: row.status,
    snapshotHash: row.snapshot_hash,
    publishedAt: row.published_at,
  }
}

function mapTestSection(row: any): TestSection {
  return {
    id: row.id,
    packageVersionId: row.package_version_id,
    sectionOrder: row.section_order,
    title: row.title,
    introTextVi: row.intro_text_vi ?? null,
    introTextEn: row.intro_text_en ?? null,
    targetCvrOhm: row.target_cvr_ohm == null ? null : Number(row.target_cvr_ohm),
    cciProfileId: row.cci_profile_id ?? null,
    cciCategoryId: row.cci_category_id ?? null,
  }
}

function mapTestItem(row: any): TestItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    packageVersionId: row.package_version_id,
    itemOrder: row.item_order,
    termVi: row.term_vi ?? null,
    termEn: row.term_en ?? null,
    promptVi: row.prompt_vi,
    promptEn: row.prompt_en,
    spokenScriptVi: row.spoken_script_vi ?? null,
    spokenScriptEn: row.spoken_script_en ?? null,
    tc: row.tc ? Number(row.tc) : null,
    lc: row.lc ? Number(row.lc) : null,
    tl: row.tl ? Number(row.tl) : null,
    measuredCvr: row.measured_cvr ? Number(row.measured_cvr) : null,
  }
}

function mapCciProfile(row: any): CciProfile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    versionLabel: row.version_label,
    status: row.status,
  }
}

function mapCciCategory(row: any): CciCategory {
  return {
    id: row.id,
    profileId: row.profile_id,
    categoryOrder: row.category_order,
    label: row.label,
    value: Number(row.value),
    description: row.description,
    metadata: row.metadata ?? {},
  }
}

function mapSectionMeasurementSnapshot(row: any): SectionMeasurementSnapshot {
  return {
    id: row.id,
    sectionId: row.test_section_id,
    packageVersionId: row.package_version_id,
    targetCvrOhm: Number(row.target_cvr_ohm),
    cciProfileId: row.cci_profile_id,
    cciCategoryId: row.cci_category_id,
    cciCategoryLabel: row.cci_category_label,
    cciValue: Number(row.cci_value),
    supersedesSnapshotId: row.supersedes_snapshot_id,
    overrideReason: row.override_reason,
    createdAt: row.created_at,
  }
}

export async function listTestPackages(): Promise<Result<TestPackage[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('test_packages')
    .select('*')
    .is('archived_at', null)
    .order('title')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(mapTestPackage) }
}

export async function listTestPackageVersions(
  packageId: string,
): Promise<Result<TestPackageVersion[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('test_package_versions')
    .select('*')
    .eq('package_id', packageId)
    .order('published_at', { ascending: false, nullsFirst: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(mapTestPackageVersion) }
}

export type TestPackagePublicationReadiness = {
  packageVersionId: string
  status: 'draft' | 'published' | 'archived'
  sectionCount: number
  itemCount: number
  voiceVi: string
  voiceEn: string
  readyVietnameseSections: number
  readyEnglishSections: number
  readyEitherSections?: number
  canPublish: boolean
  snapshotHash?: string
  publishedAt?: string
}

export async function getTestPackagePublicationReadiness(input: {
  packageVersionId: string
  voiceVi: string
  voiceEn: string
}): Promise<Result<TestPackagePublicationReadiness>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb.rpc('get_test_package_publication_readiness', {
    p_package_version_id: input.packageVersionId,
    p_voice_vi: input.voiceVi,
    p_voice_en: input.voiceEn,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as TestPackagePublicationReadiness }
}

export async function publishTestPackageVersion(input: {
  packageVersionId: string
  voiceVi: string
  voiceEn: string
}): Promise<Result<TestPackagePublicationReadiness>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb.rpc('publish_test_package_version', {
    p_package_version_id: input.packageVersionId,
    p_voice_vi: input.voiceVi,
    p_voice_en: input.voiceEn,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as TestPackagePublicationReadiness }
}

export async function listTestSections(versionId: string): Promise<Result<TestSection[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('test_sections')
    .select('*')
    .eq('package_version_id', versionId)
    .order('section_order')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(mapTestSection) }
}

export async function listTestItems(sectionId: string): Promise<Result<TestItem[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('test_items')
    .select('*')
    .eq('section_id', sectionId)
    .order('item_order')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(mapTestItem) }
}

export async function listCciProfiles(): Promise<Result<CciProfile[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb.from('cci_profiles').select('*').order('name')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(mapCciProfile) }
}

export async function listCciCategories(profileId: string): Promise<Result<CciCategory[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('cci_categories')
    .select('*')
    .eq('profile_id', profileId)
    .order('category_order')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(mapCciCategory) }
}

export async function getSectionSnapshot(
  sectionId: string,
): Promise<Result<SectionMeasurementSnapshot | null>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('section_measurement_snapshots')
    .select('*')
    .eq('test_section_id', sectionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ? mapSectionMeasurementSnapshot(data) : null }
}

export async function createSnapshotOverride(input: {
  sectionId: string
  packageVersionId: string
  targetCvrOhm: number
  cciProfileId: string
  cciCategoryId: string
  cciCategoryLabel: string
  cciValue: number
  supersedesSnapshotId: string | null
  overrideReason: string
}): Promise<Result<SectionMeasurementSnapshot>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('section_measurement_snapshots')
    .insert([
      {
        test_section_id: input.sectionId,
        package_version_id: input.packageVersionId,
        target_cvr_ohm: input.targetCvrOhm,
        cci_profile_id: input.cciProfileId,
        cci_category_id: input.cciCategoryId,
        cci_category_label: input.cciCategoryLabel,
        cci_value: input.cciValue,
        supersedes_snapshot_id: input.supersedesSnapshotId,
        override_reason: input.overrideReason,
      },
    ])
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: mapSectionMeasurementSnapshot(data) }
}

export type NarrationVariant = {
  id: string
  packageVersionId: string
  testSectionId: string | null
  testItemId: string | null
  narrationTarget: 'section_intro' | 'test_item'
  language: 'vi' | 'en'
  voiceId: string
  voiceLabel: string | null
  sourceTextHash: string
  approvalStatus: 'draft' | 'generated' | 'approved' | 'rejected' | 'archived'
  audioAssetId: string | null
  generationJobId: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export type NarrationAudioAsset = {
  id: string
  storageBucket: string
  storagePath: string
  mimeType: string
  durationMs: number | null
  bytes: number | null
  createdAt: string
}

export type NarrationGenerationJob = {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  errorMessage: string | null
  requestedAt: string
  completedAt: string | null
}

export type NarrationReviewRecord = {
  variant: NarrationVariant
  audio: NarrationAudioAsset | null
  job: NarrationGenerationJob | null
}

function mapNarrationVariant(row: any): NarrationVariant {
  return {
    id: row.id,
    packageVersionId: row.package_version_id,
    testSectionId: row.test_section_id,
    testItemId: row.test_item_id,
    narrationTarget: row.narration_target,
    language: row.language,
    voiceId: row.voice_id,
    voiceLabel: row.voice_label,
    sourceTextHash: row.source_text_hash,
    approvalStatus: row.approval_status,
    audioAssetId: row.audio_asset_id,
    generationJobId: row.generation_job_id,
    approvedAt: row.approved_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listApprovedSectionVoiceIds(
  sectionId: string,
  language: 'vi' | 'en',
): Promise<Result<string[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('narration_variants')
    .select('voice_id')
    .eq('test_section_id', sectionId)
    .eq('narration_target', 'section_intro')
    .eq('language', language)
    .eq('approval_status', 'approved')
    .not('audio_asset_id', 'is', null)
  if (error) return { ok: false, error: error.message }
  const voiceIds: string[] = (data ?? [])
    .map((row: any) => String(row.voice_id ?? ''))
    .filter((value: string) => value.length > 0)
  return { ok: true, data: [...new Set<string>(voiceIds)].sort() }
}

export async function listNarrationVariants(itemId: string): Promise<Result<NarrationVariant[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('narration_variants')
    .select('*')
    .eq('test_item_id', itemId)
    .order('created_at', { ascending: false })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(mapNarrationVariant) }
}

export async function listSectionNarrationReview(input: {
  packageVersionId: string
  sectionId: string
  itemIds: string[]
  language: 'vi' | 'en'
  voiceId?: string
}): Promise<Result<NarrationReviewRecord[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  let query = sb
    .from('narration_variants')
    .select('*')
    .eq('package_version_id', input.packageVersionId)
    .eq('language', input.language)
  if (input.voiceId) query = query.eq('voice_id', input.voiceId)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return { ok: false, error: error.message }
  const itemIds = new Set(input.itemIds)
  const variants = (data ?? [])
    .map(mapNarrationVariant)
    .filter(
      (variant: NarrationVariant) =>
        variant.testSectionId === input.sectionId ||
        (variant.testItemId !== null && itemIds.has(variant.testItemId)),
    )
  const audioIds = [
    ...new Set(variants.map((v: NarrationVariant) => v.audioAssetId).filter(Boolean)),
  ]
  const jobIds = [
    ...new Set(variants.map((v: NarrationVariant) => v.generationJobId).filter(Boolean)),
  ]
  const [{ data: audioRows, error: audioError }, { data: jobRows, error: jobError }] =
    await Promise.all([
      audioIds.length
        ? sb.from('audio_assets').select('*').in('id', audioIds)
        : Promise.resolve({ data: [], error: null }),
      jobIds.length
        ? sb.from('generation_jobs').select('*').in('id', jobIds)
        : Promise.resolve({ data: [], error: null }),
    ])
  if (audioError) return { ok: false, error: audioError.message }
  if (jobError) return { ok: false, error: jobError.message }
  const audioById = new Map(
    (audioRows ?? []).map((row: any) => [
      row.id,
      {
        id: row.id,
        storageBucket: row.storage_bucket,
        storagePath: row.storage_path,
        mimeType: row.mime_type,
        durationMs: row.duration_ms == null ? null : Number(row.duration_ms),
        bytes: row.bytes == null ? null : Number(row.bytes),
        createdAt: row.created_at,
      } satisfies NarrationAudioAsset,
    ]),
  )
  const jobById = new Map(
    (jobRows ?? []).map((row: any) => [
      row.id,
      {
        id: row.id,
        status: row.status,
        errorMessage: row.error_message ?? null,
        requestedAt: row.requested_at,
        completedAt: row.completed_at ?? null,
      } satisfies NarrationGenerationJob,
    ]),
  )
  return {
    ok: true,
    data: variants.map((variant: NarrationVariant) => ({
      variant,
      audio: variant.audioAssetId
        ? ((audioById.get(variant.audioAssetId) as NarrationAudioAsset | undefined) ?? null)
        : null,
      job: variant.generationJobId
        ? ((jobById.get(variant.generationJobId) as NarrationGenerationJob | undefined) ?? null)
        : null,
    })),
  }
}

export async function setNarrationReviewStatus(
  variantId: string,
  status: 'rejected' | 'archived',
): Promise<Result<true>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { error } = await sb
    .from('narration_variants')
    .update({ approval_status: status, approved_at: null, approved_by_user_id: null })
    .eq('id', variantId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

async function assertDraftPackageVersion(packageVersionId: string): Promise<Result<true>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('test_package_versions')
    .select('status')
    .eq('id', packageVersionId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Package Version not found' }
  if (data.status !== 'draft') {
    return {
      ok: false,
      error:
        'Published or archived Package Versions are immutable. Create a new draft/version instead.',
    }
  }
  return { ok: true, data: true }
}

async function assertDraftCciProfile(profileId: string): Promise<Result<true>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('cci_profiles')
    .select('status')
    .eq('id', profileId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'CCI Profile not found' }
  if (data.status !== 'draft') {
    return {
      ok: false,
      error:
        'Only draft CCI Profiles/Categories can be edited directly. Archive or supersede active catalogs instead.',
    }
  }
  return { ok: true, data: true }
}

async function countRows(table: string, column: string, value: string): Promise<Result<number>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { count, error } = await sb
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq(column, value)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: count ?? 0 }
}

async function countItemExternalRefs(itemId: string): Promise<Result<number>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { count, error } = await sb
    .from('session_questions')
    .select('id', { count: 'exact', head: true })
    .like('external_ref', `live-test-item:${itemId}%`)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: count ?? 0 }
}

async function firstOrganizationId(): Promise<Result<string>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb.from('organizations').select('id').limit(1)
  if (error) return { ok: false, error: error.message }
  const id = data?.[0]?.id
  if (!id) return { ok: false, error: 'No organization found for catalog creation' }
  return { ok: true, data: id }
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function createDraftTestItem(input: {
  packageVersionId: string
  sectionId: string
  promptVi: string | null
  promptEn: string | null
  tc: number | null
  lc: number | null
  tl: number | null
}): Promise<Result<TestItem>> {
  const draft = await assertDraftPackageVersion(input.packageVersionId)
  if (!draft.ok) return draft
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data: existing, error: orderError } = await sb
    .from('test_items')
    .select('item_order')
    .eq('section_id', input.sectionId)
    .order('item_order', { ascending: false })
    .limit(1)
  if (orderError) return { ok: false, error: orderError.message }
  const nextOrder = (existing?.[0]?.item_order ?? 0) + 1
  const { data, error } = await sb
    .from('test_items')
    .insert({
      package_version_id: input.packageVersionId,
      section_id: input.sectionId,
      item_order: nextOrder,
      prompt_vi: input.promptVi,
      prompt_en: input.promptEn,
      tc: input.tc,
      lc: input.lc,
      tl: input.tl,
      source_metadata: { source: 'admin-resources-manual' },
    })
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: mapTestItem(data) }
}

export async function updateDraftTestItem(input: {
  itemId: string
  packageVersionId: string
  promptVi: string | null
  promptEn: string | null
  tc: number | null
  lc: number | null
  tl: number | null
  spokenScriptVi?: string | null
  spokenScriptEn?: string | null
}): Promise<Result<TestItem>> {
  const draft = await assertDraftPackageVersion(input.packageVersionId)
  if (!draft.ok) return draft
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const values: Record<string, unknown> = {
    prompt_vi: input.promptVi,
    prompt_en: input.promptEn,
    tc: input.tc,
    lc: input.lc,
    tl: input.tl,
  }
  if ('spokenScriptVi' in input) values.spoken_script_vi = input.spokenScriptVi ?? null
  if ('spokenScriptEn' in input) values.spoken_script_en = input.spokenScriptEn ?? null
  const { data, error } = await sb
    .from('test_items')
    .update(values)
    .eq('id', input.itemId)
    .eq('package_version_id', input.packageVersionId)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: mapTestItem(data) }
}

export async function deleteDraftTestItem(input: {
  itemId: string
  packageVersionId: string
}): Promise<Result<true>> {
  const draft = await assertDraftPackageVersion(input.packageVersionId)
  if (!draft.ok) return draft
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { error } = await sb
    .from('test_items')
    .delete()
    .eq('id', input.itemId)
    .eq('package_version_id', input.packageVersionId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

export async function updateDraftTestSection(input: {
  sectionId: string
  packageVersionId: string
  title: string | null
  sectionOrder: number
  introTextVi?: string | null
  introTextEn?: string | null
}): Promise<Result<TestSection>> {
  const draft = await assertDraftPackageVersion(input.packageVersionId)
  if (!draft.ok) return draft
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const values: Record<string, unknown> = { title: input.title, section_order: input.sectionOrder }
  if ('introTextVi' in input) values.intro_text_vi = input.introTextVi ?? null
  if ('introTextEn' in input) values.intro_text_en = input.introTextEn ?? null
  const { data, error } = await sb
    .from('test_sections')
    .update(values)
    .eq('id', input.sectionId)
    .eq('package_version_id', input.packageVersionId)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: mapTestSection(data) }
}

export async function deleteDraftTestSection(input: {
  sectionId: string
  packageVersionId: string
}): Promise<Result<true>> {
  const draft = await assertDraftPackageVersion(input.packageVersionId)
  if (!draft.ok) return draft
  const sessions = await countRows('learning_sessions', 'test_section_id', input.sectionId)
  if (!sessions.ok) return sessions
  if (sessions.data > 0) {
    return {
      ok: false,
      error:
        'This Test Section is linked to Learning Sessions. It cannot be deleted; archive or create a new version instead.',
    }
  }
  const items = await listTestItems(input.sectionId)
  if (!items.ok) return items
  for (const item of items.data) {
    const refs = await countItemExternalRefs(item.id)
    if (!refs.ok) return refs
    if (refs.data > 0) {
      return {
        ok: false,
        error:
          'This Test Section contains items linked to Session Questions. It cannot be deleted.',
      }
    }
  }
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { error } = await sb
    .from('test_sections')
    .delete()
    .eq('id', input.sectionId)
    .eq('package_version_id', input.packageVersionId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

export async function createDraftCciProfile(input: {
  name: string
  versionLabel?: string
  description?: string | null
}): Promise<Result<CciProfile>> {
  const org = await firstOrganizationId()
  if (!org.ok) return org
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('cci_profiles')
    .insert({
      organization_id: org.data,
      name: input.name.trim(),
      version_label: input.versionLabel?.trim() || 'draft',
      status: 'draft',
      description: input.description ?? null,
    })
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: mapCciProfile(data) }
}

export async function createDraftCciCategory(input: {
  profileId: string
  label: string
  value: number
  description: string | null
  metadata?: Record<string, unknown>
}): Promise<Result<CciCategory>> {
  const draft = await assertDraftCciProfile(input.profileId)
  if (!draft.ok) return draft
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data: existing, error: maxError } = await sb
    .from('cci_categories')
    .select('category_order')
    .eq('profile_id', input.profileId)
    .order('category_order', { ascending: false })
    .limit(1)
  if (maxError) return { ok: false, error: maxError.message }
  const nextOrder = (existing?.[0]?.category_order ?? 0) + 1
  const { data, error } = await sb
    .from('cci_categories')
    .insert({
      profile_id: input.profileId,
      category_order: nextOrder,
      label: input.label.trim(),
      value: input.value,
      description: input.description,
      metadata: input.metadata ?? {},
    })
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: mapCciCategory(data) }
}

export async function updateDraftCciCategory(input: {
  categoryId: string
  profileId: string
  label: string
  value: number
  description: string | null
  metadata?: Record<string, unknown>
}): Promise<Result<CciCategory>> {
  const draft = await assertDraftCciProfile(input.profileId)
  if (!draft.ok) return draft
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('cci_categories')
    .update({
      label: input.label,
      value: input.value,
      description: input.description,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    })
    .eq('id', input.categoryId)
    .eq('profile_id', input.profileId)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: mapCciCategory(data) }
}

export async function deleteDraftCciCategory(input: {
  categoryId: string
  profileId: string
}): Promise<Result<true>> {
  const draft = await assertDraftCciProfile(input.profileId)
  if (!draft.ok) return draft
  const snapshots = await countRows(
    'section_measurement_snapshots',
    'cci_category_id',
    input.categoryId,
  )
  if (!snapshots.ok) return snapshots
  if (snapshots.data > 0) {
    return {
      ok: false,
      error:
        'This CCI Category is referenced by measurement snapshots. Archive/supersede the catalog instead of deleting it.',
    }
  }
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { error } = await sb
    .from('cci_categories')
    .delete()
    .eq('id', input.categoryId)
    .eq('profile_id', input.profileId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

export async function publishCciProfile(profileId: string): Promise<Result<CciProfile>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data: current, error: currentError } = await sb
    .from('cci_profiles')
    .select('status')
    .eq('id', profileId)
    .maybeSingle()
  if (currentError) return { ok: false, error: currentError.message }
  if (!current) return { ok: false, error: 'CCI Profile not found' }
  if (current.status !== 'draft') {
    return { ok: false, error: 'Only draft CCI Profiles can be published to active.' }
  }
  const { data, error } = await sb
    .from('cci_profiles')
    .update({ status: 'active' })
    .eq('id', profileId)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: mapCciProfile(data) }
}

export async function archiveCciProfile(profileId: string): Promise<Result<CciProfile>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('cci_profiles')
    .update({ status: 'archived', archived_at: new Date().toISOString() })
    .eq('id', profileId)
    .select()
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: mapCciProfile(data) }
}

export async function createDraftTestPackage(input: {
  title: string
  versionLabel: string
  sessionCount: number
  itemsPerSession: number
  sessions: Array<{
    sectionOrder: number
    title: string
    targetCvrOhm: number
    cciProfileId: string
    cciCategoryId: string
    cciCategoryLabel: string
    cciValue: number
  }>
}): Promise<Result<{ package: TestPackage; version: TestPackageVersion }>> {
  const org = await firstOrganizationId()
  if (!org.ok) return org
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  if (!input.title.trim()) return { ok: false, error: 'Package name is required' }
  if (!input.versionLabel.trim()) return { ok: false, error: 'Package Version label is required' }
  if (input.sessionCount < 1 || input.itemsPerSession < 1) {
    return { ok: false, error: 'Session count and items/session must be positive' }
  }
  const slug = `${slugify(input.title) || 'test-package'}-${Date.now().toString(36)}`

  try {
    const { data: pkgRow, error: pkgError } = await sb
      .from('test_packages')
      .insert({
        organization_id: org.data,
        title: input.title.trim(),
        slug,
        description: 'Created from Admin Resources package builder.',
        source_metadata: { source: 'admin-resources-builder' },
      })
      .select()
      .single()
    if (pkgError) throw new Error(pkgError.message)

    const { data: versionRow, error: versionError } = await sb
      .from('test_package_versions')
      .insert({
        package_id: pkgRow.id,
        version_label: input.versionLabel.trim(),
        status: 'draft',
        source_metadata: {
          source: 'admin-resources-builder',
          sessionCount: input.sessionCount,
          itemsPerSession: input.itemsPerSession,
        },
      })
      .select()
      .single()
    if (versionError) throw new Error(versionError.message)

    for (const session of input.sessions.slice(0, input.sessionCount)) {
      const { data: sectionRow, error: sectionError } = await sb
        .from('test_sections')
        .insert({
          package_version_id: versionRow.id,
          section_order: session.sectionOrder,
          title: session.title,
          target_cvr_ohm: session.targetCvrOhm,
          cci_profile_id: session.cciProfileId,
          cci_category_id: session.cciCategoryId,
          cci_snapshot: {
            label: session.cciCategoryLabel,
            value: session.cciValue,
            unit: 'Ampe',
            targetCvrOhm: session.targetCvrOhm,
            source: 'admin-resources-builder',
          },
        })
        .select()
        .single()
      if (sectionError) throw new Error(sectionError.message)

      const { error: snapshotError } = await sb.from('section_measurement_snapshots').insert({
        test_section_id: sectionRow.id,
        package_version_id: versionRow.id,
        target_cvr_ohm: session.targetCvrOhm,
        cci_profile_id: session.cciProfileId,
        cci_category_id: session.cciCategoryId,
        cci_category_label: session.cciCategoryLabel,
        cci_value: session.cciValue,
        snapshot_metadata: {
          source: 'admin-resources-builder',
          unit: 'Ampe',
          sectionOrder: session.sectionOrder,
        },
      })
      if (snapshotError) throw new Error(snapshotError.message)

      const itemRows = Array.from({ length: input.itemsPerSession }, (_, idx) => ({
        package_version_id: versionRow.id,
        section_id: sectionRow.id,
        item_order: idx + 1,
        source_metadata: {
          source: 'admin-resources-builder',
          placeholder: true,
        },
      }))
      const { error: itemsError } = await sb.from('test_items').insert(itemRows)
      if (itemsError) throw new Error(itemsError.message)
    }

    return {
      ok: true,
      data: { package: mapTestPackage(pkgRow), version: mapTestPackageVersion(versionRow) },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not create Test Package' }
  }
}

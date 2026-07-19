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
  }
}

function mapTestItem(row: any): TestItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    packageVersionId: row.package_version_id,
    itemOrder: row.item_order,
    promptVi: row.prompt_vi,
    promptEn: row.prompt_en,
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
  const { data, error } = await sb.from('test_packages').select('*').order('title')
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
  approvalStatus: 'draft' | 'generated' | 'approved' | 'rejected' | 'archived'
  audioAssetId: string | null
  generationJobId: string | null
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
    approvalStatus: row.approval_status,
    audioAssetId: row.audio_asset_id,
    generationJobId: row.generation_job_id,
  }
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

export async function updateDraftTestItem(input: {
  itemId: string
  packageVersionId: string
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
  const { data, error } = await sb
    .from('test_items')
    .update({
      prompt_vi: input.promptVi,
      prompt_en: input.promptEn,
      tc: input.tc,
      lc: input.lc,
      tl: input.tl,
    })
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
  const refs = await countItemExternalRefs(input.itemId)
  if (!refs.ok) return refs
  if (refs.data > 0) {
    return {
      ok: false,
      error:
        'This Test Item is linked to Session Questions. It cannot be deleted; create a new draft/version instead.',
    }
  }
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
}): Promise<Result<TestSection>> {
  const draft = await assertDraftPackageVersion(input.packageVersionId)
  if (!draft.ok) return draft
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('test_sections')
    .update({ title: input.title, section_order: input.sectionOrder })
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

export async function updateDraftCciCategory(input: {
  categoryId: string
  profileId: string
  label: string
  value: number
  description: string | null
}): Promise<Result<CciCategory>> {
  const draft = await assertDraftCciProfile(input.profileId)
  if (!draft.ok) return draft
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('cci_categories')
    .update({ label: input.label, value: input.value, description: input.description })
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

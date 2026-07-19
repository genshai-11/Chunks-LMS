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

export async function listTestPackageVersions(packageId: string): Promise<Result<TestPackageVersion[]>> {
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

export async function getSectionSnapshot(sectionId: string): Promise<Result<SectionMeasurementSnapshot | null>> {
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
  item_id: string
  language_code: string
  voice_name: string
  approval_status: 'generated' | 'approved' | 'rejected'
  audio_asset_id: string | null
}

export async function listNarrationVariants(itemId: string): Promise<Result<NarrationVariant[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('narration_variants')
    .select('*')
    .eq('item_id', itemId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}

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

export async function listTestPackages(): Promise<Result<TestPackage[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb.from('test_packages').select('*').order('title')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
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
  return { ok: true, data: data ?? [] }
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
  return { ok: true, data: data ?? [] }
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
  return { ok: true, data: data ?? [] }
}

export async function listCciProfiles(): Promise<Result<CciProfile[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb.from('cci_profiles').select('*').order('name')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
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
  return { ok: true, data: data ?? [] }
}

export async function getSectionSnapshot(sectionId: string): Promise<Result<SectionMeasurementSnapshot | null>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('section_measurement_snapshots')
    .select('*')
    .eq('section_id', sectionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? null }
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
        section_id: input.sectionId,
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
  return { ok: true, data }
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

import { getSupabase } from './supabase'
import type {
  PromptLanguage,
  StandaloneAssignmentStatus,
  StandaloneRunStatus,
} from '../modules/standalone-tests/types'

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export type StandaloneTestAssignmentRow = {
  id: string
  organizationId: string
  learnerUserId: string
  packageVersionId: string
  assignedByUserId: string
  assignmentNumber: number
  status: StandaloneAssignmentStatus
  assignedAt: string
}

export type StandaloneTestRunRow = {
  id: string
  assignmentId: string
  learnerUserId: string
  testSectionId: string
  measurementSnapshotId: string
  attemptNumber: number
  promptLanguage: PromptLanguage
  voiceId: string
  sessionNumber: number
  targetCvrOhm: number
  cciSourceId: string
  cciName: string
  cciValue: number
  itemCpd: number
  status: StandaloneRunStatus
}

function client() {
  return getSupabase() as any
}

function assignment(row: any): StandaloneTestAssignmentRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    learnerUserId: row.learner_user_id,
    packageVersionId: row.package_version_id,
    assignedByUserId: row.assigned_by_user_id,
    assignmentNumber: row.assignment_number,
    status: row.status,
    assignedAt: row.assigned_at,
  }
}

function run(row: any): StandaloneTestRunRow {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    learnerUserId: row.learner_user_id,
    testSectionId: row.test_section_id,
    measurementSnapshotId: row.section_measurement_snapshot_id,
    attemptNumber: row.attempt_number,
    promptLanguage: row.prompt_language,
    voiceId: row.voice_id,
    sessionNumber: row.session_number,
    targetCvrOhm: Number(row.target_cvr_ohm),
    cciSourceId: row.cci_source_id,
    cciName: row.cci_name,
    cciValue: Number(row.cci_value),
    itemCpd: Number(row.item_cpd),
    status: row.status,
  }
}

export async function listStandaloneAssignments(
  learnerUserId?: string,
): Promise<Result<StandaloneTestAssignmentRow[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  let query = sb
    .from('standalone_test_assignments')
    .select('*')
    .order('assigned_at', { ascending: false })
  if (learnerUserId) query = query.eq('learner_user_id', learnerUserId)
  const { data, error } = await query
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(assignment) }
}

export async function listStandaloneRuns(
  assignmentId: string,
): Promise<Result<StandaloneTestRunRow[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('standalone_test_runs')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('session_number')
    .order('attempt_number')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(run) }
}

export async function getStandaloneRun(
  runId: string,
): Promise<Result<StandaloneTestRunRow | null>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('standalone_test_runs')
    .select('*')
    .eq('id', runId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ? run(data) : null }
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<Result<T>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb.rpc(name, args)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data as T }
}

export const createStandaloneAssignment = (learnerUserId: string, packageVersionId: string) =>
  rpc<string>('create_standalone_test_assignment', {
    p_learner_user_id: learnerUserId,
    p_package_version_id: packageVersionId,
  })

export const prepareStandaloneRun = (
  assignmentId: string,
  sectionId: string,
  language: PromptLanguage,
  voiceId: string,
) =>
  rpc<{
    runId: string
    status?: 'draft' | 'ready' | 'in_progress'
    canStart: boolean
    readinessToken: string
    approvedItemAudioCount: number
    sessionNumber: number
    targetCvrOhm: number
    cciName: string
    cciValue: number
    itemCpd: number
  }>('prepare_standalone_test_run', {
    p_assignment_id: assignmentId,
    p_test_section_id: sectionId,
    p_language: language,
    p_voice_id: voiceId,
  })

export const startStandaloneRun = (runId: string, readinessToken: string) =>
  rpc<{ runId: string; status: 'in_progress'; itemCount: number }>('start_standalone_test_run', {
    p_run_id: runId,
    p_readiness_token: readinessToken,
  })

export const recordStandaloneResult = (
  runItemId: string,
  color: 'red' | 'yellow' | 'green' | 'purple',
) =>
  rpc<{ attemptId: string; status: string; effectiveColor: string | null; probeCount: number }>(
    'record_standalone_provisional_result',
    { p_run_item_id: runItemId, p_color: color },
  )

export const resolveStandaloneProbe = (attemptId: string, outcome: 'fail' | 'continue' | 'done') =>
  rpc<{ attemptId: string; status: string; effectiveColor: string | null; probeCount: number }>(
    'resolve_standalone_probe',
    { p_attempt_id: attemptId, p_outcome: outcome },
  )

export const completeStandaloneRun = (runId: string) =>
  rpc<{ runId: string; status: 'completed'; finalizedItems: number }>(
    'complete_standalone_test_run',
    { p_run_id: runId },
  )

export const stopStandaloneRun = (runId: string) =>
  rpc<{ runId: string; status: 'completed'; partial: boolean; finalizedItems: number; totalItems: number }>(
    'stop_standalone_test_run',
    { p_run_id: runId },
  )

export const getLearnerStandaloneResults = (learnerUserId: string) =>
  rpc<{
    learnerUserId: string
    runCount: number
    averageLearnerCpdScore: number | null
    runs: Array<Record<string, unknown>>
  }>('get_learner_standalone_test_results', {
    p_learner_user_id: learnerUserId,
    p_package_id: null,
  })

export async function getStandaloneRunRuntime(runId: string): Promise<
  Result<{
    id: string
    status: string
    promptLanguage: 'vi' | 'en'
    voiceId: string
    introNarrationVariantId: string | null
  }>
> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('standalone_test_runs')
    .select('id, status, prompt_language, voice_id, intro_narration_variant_id')
    .eq('id', runId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Standalone Test Run not found' }
  return {
    ok: true,
    data: {
      id: data.id,
      status: data.status,
      promptLanguage: data.prompt_language,
      voiceId: data.voice_id,
      introNarrationVariantId: data.intro_narration_variant_id,
    },
  }
}

export async function listStandaloneRunItems(
  runId: string,
): Promise<Result<Array<Record<string, unknown>>>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb
    .from('standalone_test_run_items')
    .select('*, test_items(prompt_vi, prompt_en), standalone_test_attempts(*, standalone_test_attempt_snapshots(*))')
    .eq('run_id', runId)
    .order('item_order')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ?? [] }
}

export async function findLatestApprovedNarrationVariant(input: {
  target: 'package_start' | 'package_end' | 'section_intro' | 'test_item'
  language: PromptLanguage
  packageVersionId?: string | null
  testSectionId?: string | null
  testItemId?: string | null
}): Promise<Result<{ id: string; audioAssetId: string } | null>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  let query = sb
    .from('narration_variants')
    .select('id, audio_asset_id')
    .eq('narration_target', input.target)
    .eq('language', input.language)
    .eq('approval_status', 'approved')
    .not('audio_asset_id', 'is', null)
    .order('approved_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)

  if (input.target === 'package_start' || input.target === 'package_end') {
    if (!input.packageVersionId) return { ok: true, data: null }
    query = query.eq('package_version_id', input.packageVersionId)
  } else if (input.target === 'section_intro') {
    if (!input.testSectionId) return { ok: true, data: null }
    query = query.eq('test_section_id', input.testSectionId)
  } else {
    if (!input.testItemId) return { ok: true, data: null }
    query = query.eq('test_item_id', input.testItemId)
  }

  const { data, error } = await query.maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ? { id: data.id, audioAssetId: data.audio_asset_id } : null }
}

export async function deleteStandaloneAssignment(assignmentId: string): Promise<Result<true>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { error } = await sb.from('standalone_test_assignments').delete().eq('id', assignmentId)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: true }
}

export async function getStandaloneAssignmentAnalysis(assignmentId: string): Promise<
  Result<{
    assignment: StandaloneTestAssignmentRow | null
    runs: StandaloneTestRunRow[]
    items: Array<Record<string, unknown>>
  }>
> {
  const assignments = await listStandaloneAssignments()
  if (!assignments.ok) return assignments
  const runs = await listStandaloneRuns(assignmentId)
  if (!runs.ok) return runs
  const itemResults = await Promise.all(runs.data.map((r) => listStandaloneRunItems(r.id)))
  const items: Array<Record<string, unknown>> = []
  for (let i = 0; i < runs.data.length; i += 1) {
    const result = itemResults[i]
    if (!result?.ok) return result ?? { ok: false, error: 'Could not load run items' }
    for (const item of result.data) {
      items.push({
        ...item,
        parent_run_id: runs.data[i]!.id,
        session_number: runs.data[i]!.sessionNumber,
        prompt_language: runs.data[i]!.promptLanguage,
        voice_id: runs.data[i]!.voiceId,
        target_cvr_ohm: runs.data[i]!.targetCvrOhm,
        cci_name: runs.data[i]!.cciName,
        cci_value: runs.data[i]!.cciValue,
        item_cpd: runs.data[i]!.itemCpd,
      })
    }
  }
  return {
    ok: true,
    data: {
      assignment: assignments.data.find((a) => a.id === assignmentId) ?? null,
      runs: runs.data,
      items,
    },
  }
}

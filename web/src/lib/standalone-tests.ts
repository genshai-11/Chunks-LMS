import { getSupabase } from './supabase'
import type { PromptLanguage, StandaloneAssignmentStatus, StandaloneRunStatus } from '../modules/standalone-tests/types'

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

export async function listStandaloneAssignments(learnerUserId?: string): Promise<Result<StandaloneTestAssignmentRow[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  let query = sb.from('standalone_test_assignments').select('*').order('assigned_at', { ascending: false })
  if (learnerUserId) query = query.eq('learner_user_id', learnerUserId)
  const { data, error } = await query
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(assignment) }
}

export async function listStandaloneRuns(assignmentId: string): Promise<Result<StandaloneTestRunRow[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb.from('standalone_test_runs').select('*').eq('assignment_id', assignmentId).order('session_number').order('attempt_number')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []).map(run) }
}

export async function getStandaloneRun(runId: string): Promise<Result<StandaloneTestRunRow | null>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const { data, error } = await sb.from('standalone_test_runs').select('*').eq('id', runId).maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data ? run(data) : null }
}

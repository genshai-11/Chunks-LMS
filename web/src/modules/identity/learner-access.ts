import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '../../lib/supabase'
import type { ResultRecord } from '../reporting/progress'
import type { RosterState } from '../roster/types'
import { emptySchedulingState } from '../scheduling/session-lifecycle'
import type { SchedulingState } from '../scheduling/types'

export type LearnerAccessGrant = {
  tokenId: string
  learnerUserId: string
  classId: string | null
  expiresAt: string
  learnerDisplayName: string
  learnerEmail: string | null
  className: string | null
}

export type LearnerAccessSnapshot = {
  grant: LearnerAccessGrant
  roster: RosterState
  scheduling: SchedulingState
  ledger: ResultRecord[]
}

export type IssueLearnerAccessInput = {
  learnerUserId: string
  classId: string
  ttlSeconds?: number
  origin?: string
}

export type IssueLearnerAccessResult = {
  tokenId: string
  urlToken: string
  url: string
  expiresAt: string
}

function db(): SupabaseClient | null {
  return getSupabase() as unknown as SupabaseClient | null
}

export function learnerAccessUrl(
  urlToken: string,
  origin = typeof window !== 'undefined' ? window.location.origin : '',
): string {
  const base = origin || ''
  return `${base}/access?token=${encodeURIComponent(urlToken)}`
}

export function learnerAccessMailto(input: {
  learnerEmail: string
  learnerDisplayName: string
  url: string
}): string {
  const subject = encodeURIComponent('Your Chunks LMS progress link')
  const body = encodeURIComponent(
    `Hi ${input.learnerDisplayName},\n\nOpen your learning portal (attendance & progress):\n\n${input.url}\n\nThis signed link expires and can be revoked by your teacher.\n`,
  )
  return `mailto:${input.learnerEmail.trim()}?subject=${subject}&body=${body}`
}

export async function issueLearnerAccess(
  input: IssueLearnerAccessInput,
): Promise<{ ok: true; value: IssueLearnerAccessResult } | { ok: false; error: string }> {
  const sb = db()
  if (!sb) return { ok: false, error: 'Supabase is not configured; signed learner access requires the database RPC.' }

  const { data, error } = await sb.rpc('issue_learner_access_token', {
    p_learner_user_id: input.learnerUserId,
    p_class_id: input.classId,
    p_ttl_seconds: input.ttlSeconds ?? 60 * 60 * 24 * 30,
  })
  if (error) return { ok: false, error: error.message }

  const row = Array.isArray(data) ? data[0] : data
  if (!row?.url_token || !row?.token_id || !row?.expires_at) {
    return { ok: false, error: 'Token issuer returned an invalid response.' }
  }

  const urlToken = String(row.url_token)
  return {
    ok: true,
    value: {
      tokenId: String(row.token_id),
      urlToken,
      url: learnerAccessUrl(urlToken, input.origin),
      expiresAt: String(row.expires_at),
    },
  }
}

function parseGrant(row: Record<string, unknown>): LearnerAccessGrant {
  return {
    tokenId: String(row.token_id),
    learnerUserId: String(row.learner_user_id),
    classId: row.class_id == null ? null : String(row.class_id),
    expiresAt: String(row.expires_at),
    learnerDisplayName: String(row.learner_display_name),
    learnerEmail: row.learner_email == null ? null : String(row.learner_email),
    className: row.class_name == null ? null : String(row.class_name),
  }
}

function snapshotFromJson(raw: unknown, fallbackGrant: LearnerAccessGrant): LearnerAccessSnapshot {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    grant: value.grant && typeof value.grant === 'object'
      ? (value.grant as LearnerAccessGrant)
      : fallbackGrant,
    roster: value.roster as RosterState,
    scheduling: (value.scheduling as SchedulingState) ?? emptySchedulingState(),
    ledger: Array.isArray(value.ledger) ? (value.ledger as ResultRecord[]) : [],
  }
}

export async function verifyLearnerAccess(
  urlToken: string,
): Promise<{ ok: true; value: LearnerAccessGrant } | { ok: false; error: string }> {
  const sb = db()
  if (!sb) return { ok: false, error: 'Supabase is not configured; signed learner access requires the database RPC.' }
  const { data, error } = await sb.rpc('verify_learner_access', { p_url_token: urlToken })
  if (error) return { ok: false, error: error.message }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { ok: false, error: 'Learner access link is expired, revoked, or invalid.' }
  return { ok: true, value: parseGrant(row as Record<string, unknown>) }
}

export async function loadLearnerAccessSnapshot(
  urlToken: string,
): Promise<{ ok: true; value: LearnerAccessSnapshot } | { ok: false; error: string }> {
  const verified = await verifyLearnerAccess(urlToken)
  if (!verified.ok) return verified
  const sb = db()
  if (!sb) return { ok: false, error: 'Supabase is not configured; signed learner access requires the database RPC.' }
  const { data, error } = await sb.rpc('learner_access_snapshot', { p_url_token: urlToken })
  if (error) return { ok: false, error: error.message }
  return { ok: true, value: snapshotFromJson(data, verified.value) }
}

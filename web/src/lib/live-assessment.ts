/**
 * Live observation capture.
 *
 * Strategy: **local-first**. Domain capture always works in the browser so teachers
 * are never blocked by cloud lag/RLS. When Supabase is reachable we also:
 *   1) upsert the open learning_session
 *   2) try RPC create/record/resolve
 * Local domain results still feed the progress ledger via appendFinalizedFromCapture.
 */
import {
  addSessionQuestion,
  type AssessmentAttempt,
  type CaptureSessionState,
  type SessionQuestion,
} from '../modules/assessment/session-capture'
import type { CaptureMode } from '../modules/assessment/capture-mode'
import { applyLifecycleCommand } from '../modules/result-lifecycle/state-machine'
import type { AssessmentSnapshot, ResultColor } from '../modules/result-lifecycle/types'
import type { RosterState } from '../modules/roster/types'
import type { ResultRecord } from '../modules/reporting/progress'
import type { LearningSession } from '../modules/scheduling/types'
import { getSupabase } from './supabase'

type DbSnapshot = {
  attempt_id: string
  status: AssessmentSnapshot['status']
  provisional_color: ResultColor | null
  effective_color: ResultColor | null
  effective_score: number | null
  probe_count: number
  max_probe_count: number
  entered_probe_flow: boolean
  finalized_at: string | null
  updated_at: string
}

type DbQuestion = {
  id: string
  learning_session_id: string
  sequence_number: number
  external_ref: string | null
}

type DbAttempt = {
  id: string
  learning_session_id: string
  session_question_id: string
  learner_user_id: string
  teacher_user_id: string
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

function client() {
  return getSupabase() as any
}

function snapshotFromDb(row: DbSnapshot): AssessmentSnapshot {
  return {
    status: row.status,
    provisionalColor: row.provisional_color,
    effectiveColor: row.effective_color,
    effectiveScore: row.effective_score,
    probeCount: row.probe_count,
    maxProbeCount: row.max_probe_count,
    enteredProbeFlow: row.entered_probe_flow,
    finalizedAt: row.finalized_at,
  }
}

function attemptFromDb(row: DbAttempt, snapshot: DbSnapshot): AssessmentAttempt {
  return {
    id: row.id,
    learningSessionId: row.learning_session_id,
    sessionQuestionId: row.session_question_id,
    learnerUserId: row.learner_user_id,
    teacherUserId: row.teacher_user_id,
    snapshot: snapshotFromDb(snapshot),
  }
}

function localAddQuestion(
  capture: CaptureSessionState,
  externalRef?: string | null,
): Result<CaptureSessionState> {
  const r = addSessionQuestion(capture, { externalRef: externalRef ?? null })
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true, data: r.state }
}

function localMutateAttempt(
  attempt: AssessmentAttempt,
  command: Parameters<typeof applyLifecycleCommand>[1],
): Result<AssessmentAttempt> {
  const r = applyLifecycleCommand(attempt.snapshot, command)
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true, data: { ...attempt, snapshot: r.snapshot } }
}

/**
 * Force-upsert one open learning session so RPCs can find it.
 * Does not depend on full workspace debounce sync.
 */
export async function ensureLearningSessionOnServer(
  session: LearningSession,
): Promise<Result<true>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }

  const classCheck = await sb.from('classes').select('id').eq('id', session.classId).maybeSingle()
  if (classCheck.error) return { ok: false, error: classCheck.error.message }
  if (!classCheck.data) {
    return {
      ok: false,
      error: 'Class is not on the server yet. Open Teacher → Classes, then Sync.',
    }
  }

  // scheduled_session_id must exist or be null (FK)
  let scheduledId = session.scheduledSessionId
  if (scheduledId) {
    const sched = await sb
      .from('scheduled_sessions')
      .select('id')
      .eq('id', scheduledId)
      .maybeSingle()
    if (sched.error || !sched.data) scheduledId = null
  }

  const fullRow = {
    id: session.id,
    class_id: session.classId,
    scheduled_session_id: scheduledId,
    status: session.status,
    planned_question_count: session.plannedQuestionCount,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    max_probe_count: session.maxProbeCount,
    session_number: session.sessionNumber,
    owner_user_id: session.ownerUserId,
    lock_expires_at: session.lockExpiresAt,
    session_kind: session.sessionKind ?? 'regular',
    participant_learner_ids: session.participantLearnerIds,
  }

  let { error } = await sb.from('learning_sessions').upsert(fullRow, { onConflict: 'id' })
  if (error) {
    // Retry minimal columns (older schema / optional columns)
    const minimal = {
      id: fullRow.id,
      class_id: fullRow.class_id,
      scheduled_session_id: fullRow.scheduled_session_id,
      status: fullRow.status,
      planned_question_count: fullRow.planned_question_count,
      started_at: fullRow.started_at,
      completed_at: fullRow.completed_at,
      max_probe_count: fullRow.max_probe_count,
    }
    const retry = await sb.from('learning_sessions').upsert(minimal, { onConflict: 'id' })
    if (retry.error) {
      return { ok: false, error: `learning_sessions upsert: ${retry.error.message}` }
    }
  }

  return { ok: true, data: true as const }
}

export async function loadLiveCapture(input: {
  learningSessionId: string
  teacherUserId: string
  learnerIds: string[]
  sessionStatus: 'open' | 'completed'
  maxProbeCount: number
  mode?: CaptureMode
  /** Keep existing local board when cloud is empty/unavailable */
  fallback?: CaptureSessionState | null
}): Promise<Result<CaptureSessionState>> {
  const compatibleFallback =
    input.fallback &&
    input.fallback.learningSessionId === input.learningSessionId &&
    input.fallback.learnerIds.length === input.learnerIds.length &&
    input.learnerIds.every((id) => input.fallback?.learnerIds.includes(id))
      ? input.fallback
      : null

  const sb = client()
  if (!sb) {
    if (compatibleFallback) return { ok: true, data: compatibleFallback }
    return { ok: false, error: 'Supabase is not configured' }
  }

  const [questionsResult, attemptsResult] = await Promise.all([
    sb
      .from('session_questions')
      .select('*')
      .eq('learning_session_id', input.learningSessionId)
      .order('sequence_number'),
    sb.from('assessment_attempts').select('*').eq('learning_session_id', input.learningSessionId),
  ])

  // Cloud read failed → keep local board
  if (questionsResult.error || attemptsResult.error) {
    if (compatibleFallback) return { ok: true, data: compatibleFallback }
    return {
      ok: false,
      error: questionsResult.error?.message ?? attemptsResult.error?.message ?? 'load failed',
    }
  }

  const dbQuestions = (questionsResult.data ?? []) as DbQuestion[]
  const dbAttempts = (attemptsResult.data ?? []) as DbAttempt[]

  // Cloud empty but we already have local questions → keep local (local-first)
  if (dbQuestions.length === 0 && compatibleFallback && compatibleFallback.questions.length > 0) {
    return { ok: true, data: compatibleFallback }
  }

  const attemptIds = dbAttempts.map((attempt) => attempt.id)
  let snapshots: DbSnapshot[] = []
  if (attemptIds.length > 0) {
    const snapshotResult = await sb
      .from('assessment_attempt_snapshots')
      .select('*')
      .in('attempt_id', attemptIds)
    if (snapshotResult.error) {
      if (compatibleFallback) return { ok: true, data: compatibleFallback }
      return { ok: false, error: snapshotResult.error.message }
    }
    snapshots = (snapshotResult.data ?? []) as DbSnapshot[]
  }

  const snapshotByAttempt = new Map(snapshots.map((snapshot) => [snapshot.attempt_id, snapshot]))
  const attemptByQuestion = new Map(
    dbAttempts.map((attempt) => [attempt.session_question_id, attempt]),
  )
  const questions: SessionQuestion[] = dbQuestions.flatMap((question) => {
    const attempt = attemptByQuestion.get(question.id)
    return attempt
      ? [
          {
            id: question.id,
            learningSessionId: question.learning_session_id,
            sequenceNumber: question.sequence_number,
            externalRef: question.external_ref,
            assignedLearnerUserId: attempt.learner_user_id,
          },
        ]
      : []
  })
  const attempts = dbAttempts.flatMap((attempt) => {
    const snapshot = snapshotByAttempt.get(attempt.id)
    return snapshot ? [attemptFromDb(attempt, snapshot)] : []
  })

  // Prefer richer board (local vs cloud)
  if (compatibleFallback && compatibleFallback.questions.length > questions.length) {
    return { ok: true, data: compatibleFallback }
  }

  return {
    ok: true,
    data: {
      learningSessionId: input.learningSessionId,
      teacherUserId: input.teacherUserId,
      learnerIds: [...input.learnerIds],
      sessionStatus: input.sessionStatus,
      questions,
      attempts,
      maxProbeCount: input.maxProbeCount,
      position: {
        mode: input.mode ?? compatibleFallback?.position.mode ?? 'question_first',
        questionIndex: Math.max(0, questions.length - 1),
        learnerIndex:
          questions.length > 0
            ? Math.max(0, input.learnerIds.indexOf(questions.at(-1)!.assignedLearnerUserId))
            : 0,
      },
    },
  }
}

export async function createLiveQuestion(input: {
  capture: CaptureSessionState
  externalRef?: string | null
  /** Open learning session — required to push session row before RPC */
  openSession?: LearningSession | null
}): Promise<Result<CaptureSessionState>> {
  if (input.capture.learnerIds.length === 0) return { ok: false, error: 'No active learners' }

  const sb = client()

  // No supabase → pure local
  if (!sb) return localAddQuestion(input.capture, input.externalRef)

  // Best-effort: ensure open day exists on server
  if (input.openSession) {
    const ensured = await ensureLearningSessionOnServer(input.openSession)
    if (!ensured.ok) {
      // Still observe locally
      console.warn('[live] ensure session:', ensured.error)
      return localAddQuestion(input.capture, input.externalRef)
    }
  } else {
    // Try soft check; if missing, local
    const remote = await sb
      .from('learning_sessions')
      .select('id, status')
      .eq('id', input.capture.learningSessionId)
      .maybeSingle()
    if (remote.error || !remote.data || remote.data.status !== 'open') {
      return localAddQuestion(input.capture, input.externalRef)
    }
  }

  const learnerIndex = input.capture.questions.length % input.capture.learnerIds.length
  const learnerUserId = input.capture.learnerIds[learnerIndex]!
  const result = await sb.rpc('create_session_question_attempt', {
    p_learning_session_id: input.capture.learningSessionId,
    p_teacher_user_id: input.capture.teacherUserId,
    p_learner_user_id: learnerUserId,
    p_external_ref: input.externalRef ?? null,
  })

  if (result.error) {
    console.warn('[live] create_session_question_attempt:', result.error.message)
    return localAddQuestion(input.capture, input.externalRef)
  }

  // Reload cloud board; if empty, keep local add
  const local = localAddQuestion(input.capture, input.externalRef)
  const loaded = await loadLiveCapture({
    learningSessionId: input.capture.learningSessionId,
    teacherUserId: input.capture.teacherUserId,
    learnerIds: input.capture.learnerIds,
    sessionStatus: input.capture.sessionStatus,
    maxProbeCount: input.capture.maxProbeCount,
    mode: input.capture.position.mode,
    fallback: local.ok ? local.data : input.capture,
  })
  return loaded
}

async function mutateSnapshot(
  attempt: AssessmentAttempt,
  rpc: string,
  params: Record<string, unknown>,
  localCommand: Parameters<typeof applyLifecycleCommand>[1],
): Promise<Result<AssessmentAttempt>> {
  const sb = client()
  if (!sb) return localMutateAttempt(attempt, localCommand)

  const result = await sb.rpc(rpc, params)
  if (result.error) {
    console.warn(`[live] ${rpc}:`, result.error.message)
    return localMutateAttempt(attempt, localCommand)
  }
  const row = result.data as DbSnapshot
  return { ok: true, data: { ...attempt, snapshot: snapshotFromDb(row) } }
}

export async function recordLiveColor(
  attempt: AssessmentAttempt,
  color: ResultColor,
): Promise<Result<AssessmentAttempt>> {
  const at = new Date().toISOString()
  if (attempt.snapshot.status === 'finalized' || attempt.snapshot.status === 'corrected') {
    return mutateSnapshot(
      attempt,
      'correct_final_result',
      {
        p_attempt_id: attempt.id,
        p_color: color,
        p_reason: 'Changed during live observation',
        p_actor_user_id: attempt.teacherUserId,
      },
      { type: 'correct', color, reason: 'Changed during observation', at, actorId: attempt.teacherUserId },
    )
  }
  return mutateSnapshot(
    attempt,
    'record_provisional_result',
    {
      p_attempt_id: attempt.id,
      p_color: color,
      p_actor_user_id: attempt.teacherUserId,
    },
    { type: 'record_provisional', color, at },
  )
}

export async function resolveLiveProbe(
  attempt: AssessmentAttempt,
  outcome: 'fail' | 'continue' | 'done',
): Promise<Result<AssessmentAttempt>> {
  const at = new Date().toISOString()
  return mutateSnapshot(
    attempt,
    'resolve_probe',
    {
      p_attempt_id: attempt.id,
      p_outcome: outcome,
      p_actor_user_id: attempt.teacherUserId,
    },
    { type: 'resolve_probe', outcome, at },
  )
}

export async function loadLiveLedger(roster: RosterState): Promise<Result<ResultRecord[]>> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase is not configured' }
  const classBySession = new Map<string, { classId: string; courseId: string }>()
  const classById = new Map(roster.classes.map((row) => [row.id, row]))
  const sessionsResult = await sb.from('learning_sessions').select('id,class_id')
  if (sessionsResult.error) return { ok: false, error: sessionsResult.error.message }
  for (const session of sessionsResult.data ?? []) {
    const klass = classById.get(session.class_id as string)
    if (klass)
      classBySession.set(session.id as string, { classId: klass.id, courseId: klass.courseId })
  }
  const sessionIds = [...classBySession.keys()]
  if (sessionIds.length === 0) return { ok: true, data: [] }

  const attemptsResult = await sb
    .from('assessment_attempts')
    .select('*')
    .in('learning_session_id', sessionIds)
  if (attemptsResult.error) return { ok: false, error: attemptsResult.error.message }
  const attempts = (attemptsResult.data ?? []) as DbAttempt[]
  if (attempts.length === 0) return { ok: true, data: [] }

  const snapshotsResult = await sb
    .from('assessment_attempt_snapshots')
    .select('*')
    .in(
      'attempt_id',
      attempts.map((row) => row.id),
    )
    .in('status', ['finalized', 'corrected'])
  if (snapshotsResult.error) return { ok: false, error: snapshotsResult.error.message }
  const snapshots = (snapshotsResult.data ?? []) as DbSnapshot[]
  const attemptById = new Map(attempts.map((row) => [row.id, row]))
  const rows: ResultRecord[] = []
  for (const snapshot of snapshots) {
    const attempt = attemptById.get(snapshot.attempt_id)
    const scope = attempt ? classBySession.get(attempt.learning_session_id) : null
    if (!attempt || !scope || !snapshot.effective_color || !snapshot.finalized_at) continue
    rows.push({
      id: snapshot.attempt_id,
      organizationId: roster.organization.id,
      courseId: scope.courseId,
      classId: scope.classId,
      learningSessionId: attempt.learning_session_id,
      learnerUserId: attempt.learner_user_id,
      teacherUserId: attempt.teacher_user_id,
      sessionQuestionId: attempt.session_question_id,
      effectiveColor: snapshot.effective_color,
      enteredProbeFlow: snapshot.entered_probe_flow,
      probeEventCount: snapshot.probe_count,
      finalizedAt: snapshot.finalized_at,
    })
  }
  return { ok: true, data: rows }
}

export function replaceLiveAttempt(
  capture: CaptureSessionState,
  attempt: AssessmentAttempt,
): CaptureSessionState {
  return {
    ...capture,
    attempts: capture.attempts.map((current) => (current.id === attempt.id ? attempt : current)),
  }
}

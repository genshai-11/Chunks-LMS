import {
  COLOR_SCORE,
  DEFAULT_MAX_PROBE_COUNT,
  type AssessmentEventType,
  type AssessmentSnapshot,
  type LifecycleCommand,
  type LifecycleResult,
  type ResultColor,
} from './types'

export function createDraftSnapshot(maxProbeCount = DEFAULT_MAX_PROBE_COUNT): AssessmentSnapshot {
  if (maxProbeCount < 1) {
    throw new Error('maxProbeCount must be a positive integer')
  }
  return {
    status: 'draft',
    provisionalColor: null,
    effectiveColor: null,
    effectiveScore: null,
    probeCount: 0,
    maxProbeCount,
    enteredProbeFlow: false,
    recordedColors: [],
    finalizedAt: null,
  }
}

function finalize(
  snapshot: AssessmentSnapshot,
  color: ResultColor,
  at: string,
  updatedRecordedColors?: ResultColor[],
): AssessmentSnapshot {
  const recorded = updatedRecordedColors ?? (
    snapshot.recordedColors.length > 0 ? snapshot.recordedColors : [color]
  )
  return {
    ...snapshot,
    status: 'finalized',
    effectiveColor: color,
    effectiveScore: COLOR_SCORE[color],
    recordedColors: recorded,
    finalizedAt: at,
  }
}

/**
 * Pure domain transitions for Assessment Attempt result lifecycle.
 * UI callers must not re-implement these rules; DB functions mirror them for authority.
 */
export function applyLifecycleCommand(
  snapshot: AssessmentSnapshot,
  command: LifecycleCommand,
): LifecycleResult {
  switch (command.type) {
    case 'record_provisional':
      return recordProvisional(snapshot, command.color, command.at)
    case 'resolve_probe':
      return resolveProbe(snapshot, command.outcome, command.at)
    case 'correct':
      return correctResult(snapshot, command.color, command.reason, command.at)
    default: {
      const _exhaustive: never = command
      return { ok: false, error: `Unknown command: ${JSON.stringify(_exhaustive)}` }
    }
  }
}

function recordProvisional(
  snapshot: AssessmentSnapshot,
  color: ResultColor,
  at: string,
): LifecycleResult {
  if (snapshot.status !== 'draft') {
    return { ok: false, error: 'Provisional result can only be recorded on a draft attempt' }
  }

  const events: AssessmentEventType[] = ['provisional_recorded']
  const base: AssessmentSnapshot = {
    ...snapshot,
    provisionalColor: color,
  }

  if (color === 'green') {
    return {
      ok: true,
      snapshot: {
        ...base,
        status: 'probe_open',
        enteredProbeFlow: true,
        recordedColors: ['green'],
      },
      events,
    }
  }

  // Directly finalizing colors (Red, Orange, Purple, etc.)
  events.push('result_finalized')
  return {
    ok: true,
    snapshot: finalize(base, color, at, [color]),
    events,
  }
}

function resolveProbe(
  snapshot: AssessmentSnapshot,
  outcome: 'fail' | 'continue' | 'done',
  at: string,
): LifecycleResult {
  if (snapshot.status !== 'probe_open' && snapshot.status !== 'resolution_required') {
    return { ok: false, error: 'Probe resolution requires an open Green probe' }
  }

  const currentRecorded: ResultColor[] =
    snapshot.recordedColors && snapshot.recordedColors.length > 0
      ? [...snapshot.recordedColors]
      : ['green']

  if (outcome === 'fail') {
    const events: AssessmentEventType[] = ['probe_failed', 'result_finalized']
    const nextRecorded: ResultColor[] = [...currentRecorded, 'yellow']
    return {
      ok: true,
      snapshot: finalize(
        {
          ...snapshot,
          probeCount: snapshot.probeCount + (snapshot.status === 'probe_open' ? 1 : 0),
        },
        'yellow',
        at,
        nextRecorded,
      ),
      events,
    }
  }

  if (outcome === 'done') {
    const events: AssessmentEventType[] = ['probe_completed', 'result_finalized']
    const nextRecorded: ResultColor[] = [...currentRecorded, 'indigo']
    return {
      ok: true,
      snapshot: finalize(
        {
          ...snapshot,
          probeCount: snapshot.probeCount + (snapshot.status === 'probe_open' ? 1 : 0),
        },
        'indigo',
        at,
        nextRecorded,
      ),
      events,
    }
  }

  // Continue — record 'blue' step, increment probeCount, keep probe open
  const nextCount = snapshot.probeCount + 1
  const nextRecorded: ResultColor[] = [...currentRecorded, 'blue']
  return {
    ok: true,
    snapshot: {
      ...snapshot,
      probeCount: nextCount,
      recordedColors: nextRecorded,
      status: 'probe_open',
    },
    events: ['probe_continued'],
  }
}

function correctResult(
  snapshot: AssessmentSnapshot,
  color: ResultColor,
  reason: string,
  at: string,
): LifecycleResult {
  if (snapshot.status !== 'finalized' && snapshot.status !== 'corrected') {
    return { ok: false, error: 'Only finalized results can be corrected' }
  }
  if (!reason.trim()) {
    return { ok: false, error: 'Correction requires a non-empty reason' }
  }

  return {
    ok: true,
    snapshot: {
      ...snapshot,
      status: 'corrected',
      effectiveColor: color,
      effectiveScore: COLOR_SCORE[color],
      recordedColors: snapshot.recordedColors.length > 0 ? snapshot.recordedColors : [color],
      finalizedAt: at,
    },
    events: ['result_corrected'],
  }
}

/** Effective finalized results only — excludes open probes and drafts. */
export function isFinalizedForMetrics(snapshot: AssessmentSnapshot): boolean {
  return (
    (snapshot.status === 'finalized' || snapshot.status === 'corrected') &&
    snapshot.effectiveColor !== null
  )
}

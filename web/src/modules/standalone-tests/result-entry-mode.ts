import {
  PRIMARY_OBSERVATION_COLORS,
  RESULT_COLORS,
  RESULT_COLOR_META,
  type ProbeOutcome,
  type ResultColor,
} from '../result-lifecycle/types'

export type OptimisticStandaloneProbePatch = {
  status: 'probe_open' | 'finalized'
  effective_color: ResultColor | null
  entered_probe_flow: true
  probe_count: number
  client_revision: number
}

export function isStandaloneCorrectionMode(status: unknown): boolean {
  return status === 'finalized' || status === 'corrected'
}

export function standaloneResultColorChoices(status: unknown): readonly ResultColor[] {
  return isStandaloneCorrectionMode(status) ? RESULT_COLORS : PRIMARY_OBSERVATION_COLORS
}

export function correctionColorForShortcut(
  status: unknown,
  rawKey: string,
): ResultColor | null {
  if (!isStandaloneCorrectionMode(status)) return null
  const key = rawKey.trim().toLowerCase()
  return (
    RESULT_COLORS.find(
      (color) => RESULT_COLOR_META[color].shortcut.toLowerCase() === key,
    ) ?? null
  )
}

export function optimisticStandaloneProbePatch(
  outcome: ProbeOutcome,
  currentProbeCount: number,
  clientRevision: number,
): OptimisticStandaloneProbePatch {
  return {
    status: outcome === 'continue' ? 'probe_open' : 'finalized',
    effective_color:
      outcome === 'fail' ? 'yellow' : outcome === 'done' ? 'indigo' : null,
    entered_probe_flow: true,
    probe_count: outcome === 'continue' ? currentProbeCount + 1 : currentProbeCount,
    client_revision: clientRevision,
  }
}

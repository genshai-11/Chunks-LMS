import {
  isResultColor,
  type ResultColor,
} from '../result-lifecycle/types'

export type StandaloneProbeStep = {
  eventSequence: number
  color: ResultColor
  label: string
  kind: 'entered' | 'continued' | 'resolved'
}

type EventLike = {
  event_sequence?: unknown
  eventSequence?: unknown
  event_type?: unknown
  eventType?: unknown
  payload?: unknown
}

type SnapshotLike = {
  status?: unknown
  effective_color?: unknown
  effectiveColor?: unknown
  entered_probe_flow?: unknown
  enteredProbeFlow?: unknown
  probe_count?: unknown
  probeCount?: unknown
}

type AttemptLike = {
  standalone_test_attempt_snapshots?: SnapshotLike | null
  standaloneTestAttemptSnapshots?: SnapshotLike | null
  standalone_test_events?: EventLike[] | null
  standaloneTestEvents?: EventLike[] | null
}

export type StandaloneRunItemLike = {
  standalone_test_attempts?: AttemptLike[] | null
  standaloneTestAttempts?: AttemptLike[] | null
  [key: string]: unknown
}

export type ProjectedStandaloneItem<T extends StandaloneRunItemLike> = {
  item: T
  completed: boolean
  effectiveColor: ResultColor | null
  nCount: number
  nDepth: number | null
  probeSteps: StandaloneProbeStep[]
}

export type StandaloneRunProjection<T extends StandaloneRunItemLike> = {
  items: Array<ProjectedStandaloneItem<T>>
  mainQuestions: number
  completedMainQuestions: number
  probeSteps: number
  expandedTotal: number
  nCount: number
  nDepthMax: number | null
  nDepthAvg: number | null
}

function number(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function firstAttempt(item: StandaloneRunItemLike): AttemptLike | null {
  return item.standalone_test_attempts?.[0] ?? item.standaloneTestAttempts?.[0] ?? null
}

function snapshot(attempt: AttemptLike | null): SnapshotLike | null {
  return (
    attempt?.standalone_test_attempt_snapshots ??
    attempt?.standaloneTestAttemptSnapshots ??
    null
  )
}

function payloadColor(event: EventLike): ResultColor | null {
  const payload = event.payload
  if (!payload || typeof payload !== 'object') return null
  const color = (payload as Record<string, unknown>).color
  return isResultColor(color) ? color : null
}

function stepFromEvent(event: EventLike): StandaloneProbeStep | null {
  const type = String(event.event_type ?? event.eventType ?? '')
  const eventSequence = number(event.event_sequence ?? event.eventSequence)
  if (type === 'provisional_recorded' || type === 'result_corrected') {
    if (payloadColor(event) !== 'green') return null
    return { eventSequence, color: 'green', label: 'Entered probe', kind: 'entered' }
  }
  if (type === 'probe_continued') {
    return { eventSequence, color: 'blue', label: 'Continue', kind: 'continued' }
  }
  if (type === 'probe_failed') {
    return { eventSequence, color: 'yellow', label: 'Fail', kind: 'resolved' }
  }
  if (type === 'probe_completed') {
    return { eventSequence, color: 'indigo', label: 'Done', kind: 'resolved' }
  }
  return null
}

function fallbackSteps(snap: SnapshotLike | null): StandaloneProbeStep[] {
  if (!snap) return []
  const entered = Boolean(snap.entered_probe_flow ?? snap.enteredProbeFlow)
  const probeCount = number(snap.probe_count ?? snap.probeCount)
  if (!entered && probeCount <= 0) return []
  const steps: StandaloneProbeStep[] = [
    { eventSequence: 0, color: 'green', label: 'Entered probe', kind: 'entered' },
  ]
  for (let index = 0; index < probeCount; index += 1) {
    steps.push({ eventSequence: index + 1, color: 'blue', label: 'Continue', kind: 'continued' })
  }
  const effective = snap.effective_color ?? snap.effectiveColor
  if (effective === 'yellow') {
    steps.push({ eventSequence: steps.length, color: 'yellow', label: 'Fail', kind: 'resolved' })
  } else if (effective === 'indigo') {
    steps.push({ eventSequence: steps.length, color: 'indigo', label: 'Done', kind: 'resolved' })
  }
  return steps
}

function depthForSteps(steps: StandaloneProbeStep[]): number | null {
  let current = 0
  let max = 0
  for (const step of steps) {
    if (step.kind === 'entered') current = 1
    else if (step.kind === 'continued') current = Math.max(1, current + 1)
    else current = 0
    max = Math.max(max, current)
  }
  return max || null
}

export function projectStandaloneRunItems<T extends StandaloneRunItemLike>(
  sourceItems: T[],
): StandaloneRunProjection<T> {
  const items = sourceItems.map((item): ProjectedStandaloneItem<T> => {
    const attempt = firstAttempt(item)
    const snap = snapshot(attempt)
    const events = [
      ...(attempt?.standalone_test_events ?? attempt?.standaloneTestEvents ?? []),
    ].sort(
      (a, b) =>
        number(a.event_sequence ?? a.eventSequence) - number(b.event_sequence ?? b.eventSequence),
    )
    const eventSteps = events.map(stepFromEvent).filter((step): step is StandaloneProbeStep => Boolean(step))
    const probeSteps = eventSteps.length > 0 ? eventSteps : fallbackSteps(snap)
    const effective = snap?.effective_color ?? snap?.effectiveColor
    const status = String(snap?.status ?? '')
    return {
      item,
      completed: status === 'finalized' || status === 'corrected',
      effectiveColor: isResultColor(effective) ? effective : null,
      nCount: probeSteps.filter((step) => step.kind === 'entered').length,
      nDepth: depthForSteps(probeSteps),
      probeSteps,
    }
  })

  const depths = items
    .map((item) => item.nDepth)
    .filter((value): value is number => value !== null)
  const probeSteps = items.reduce((sum, item) => sum + item.probeSteps.length, 0)
  return {
    items,
    mainQuestions: items.length,
    completedMainQuestions: items.filter((item) => item.completed).length,
    probeSteps,
    expandedTotal: items.length + probeSteps,
    nCount: items.reduce((sum, item) => sum + item.nCount, 0),
    nDepthMax: depths.length > 0 ? Math.max(...depths) : null,
    nDepthAvg: depths.length > 0 ? depths.reduce((sum, value) => sum + value, 0) / depths.length : null,
  }
}

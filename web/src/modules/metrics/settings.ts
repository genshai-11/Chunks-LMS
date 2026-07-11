import { METRIC_CATALOG, type MetricKey, type MetricStatus } from './calculate'

export type MetricSetting = {
  key: MetricKey
  /** Shown on analysis / reports */
  enabled: boolean
  status: MetricStatus
  /** Minimum sample size before value is shown (null when below) */
  minSample: number
  /** Admin display label (optional override) */
  label: string
  definition: string
}

export type MetricSettingsState = {
  /** Default probe max for new sessions (org setting) */
  defaultMaxProbeCount: number
  metrics: MetricSetting[]
}

const LABELS: Record<MetricKey, string> = {
  rfc: 'RFC',
  rac: 'RAC',
  average_performance: 'Average performance',
  purple_mastery_rate: 'Purple mastery',
  clarification_rate: 'Clarification rate',
  clarification_depth: 'Clarification depth',
  awareness_recovery: 'Awareness recovery',
  focus_stability: 'Focus stability',
}

export function createDefaultMetricSettings(): MetricSettingsState {
  return {
    defaultMaxProbeCount: 2,
    metrics: METRIC_CATALOG.map((m) => ({
      key: m.key,
      enabled: true,
      status: m.status,
      minSample: m.minSample,
      label: LABELS[m.key],
      definition: m.definition,
    })),
  }
}

export function getEnabledMetricKeys(settings: MetricSettingsState): MetricKey[] {
  return settings.metrics.filter((m) => m.enabled).map((m) => m.key)
}

export function getMetricSetting(
  settings: MetricSettingsState,
  key: MetricKey,
): MetricSetting | undefined {
  return settings.metrics.find((m) => m.key === key)
}

export function updateMetricSetting(
  settings: MetricSettingsState,
  key: MetricKey,
  patch: Partial<Omit<MetricSetting, 'key'>>,
): MetricSettingsState {
  return {
    ...settings,
    metrics: settings.metrics.map((m) => (m.key === key ? { ...m, ...patch } : m)),
  }
}

export function setDefaultMaxProbeCount(
  settings: MetricSettingsState,
  value: number,
): MetricSettingsState {
  const n = Math.floor(value)
  if (n < 1) return settings
  return { ...settings, defaultMaxProbeCount: n }
}

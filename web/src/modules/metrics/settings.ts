import { DEFAULT_COLOR_WEIGHTS, type ResultColor } from '../result-lifecycle/types'
import {
  METRIC_CATALOG,
  type ColorWeights,
  type MetricKey,
  type MetricStatus,
} from './calculate'

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

export type WeightPreset = 'linear' | 'custom'

export type MetricSettingsState = {
  /** Default probe max for new sessions (org setting) */
  defaultMaxProbeCount: number
  metrics: MetricSetting[]
  weightPreset: WeightPreset
  colorWeights: ColorWeights
}

const LABELS: Record<MetricKey, string> = {
  rfc: 'RFC (Struggle rate)',
  rac: 'RAC (%c achievement)',
  average_performance: 'Average performance',
  purple_mastery_rate: 'Purple mastery',
  clarification_rate: 'Clarification rate',
  clarification_depth: 'Probe depth avg (legacy)',
  n_count: 'Probe count',
  n_depth_max: 'Max probe depth',
  n_depth_avg: 'Avg probe depth',
  awareness_recovery: 'Awareness recovery',
  focus_stability: 'Focus stability',
  average_cpd: 'Average CPD',
}

export function createDefaultMetricSettings(): MetricSettingsState {
  return {
    defaultMaxProbeCount: 2,
    weightPreset: 'linear',
    colorWeights: { ...DEFAULT_COLOR_WEIGHTS },
    metrics: METRIC_CATALOG.map((m) => ({
      key: m.key,
      enabled: true,
      status: m.status,
      minSample: m.minSample,
      label: LABELS[m.key] ?? m.key,
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

export function setColorWeight(
  settings: MetricSettingsState,
  color: ResultColor,
  weight: number,
): MetricSettingsState {
  const clamped = Math.max(0, Math.min(1, weight))
  return {
    ...settings,
    weightPreset: 'custom',
    colorWeights: {
      ...settings.colorWeights,
      [color]: clamped,
    },
  }
}

export function setWeightPreset(
  settings: MetricSettingsState,
  preset: WeightPreset,
): MetricSettingsState {
  if (preset === 'linear') {
    return {
      ...settings,
      weightPreset: 'linear',
      colorWeights: { ...DEFAULT_COLOR_WEIGHTS },
    }
  }
  return {
    ...settings,
    weightPreset: 'custom',
  }
}

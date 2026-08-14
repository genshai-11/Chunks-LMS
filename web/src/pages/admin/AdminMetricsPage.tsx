import { useState } from 'react'
import { Gauge, Sliders } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { Flash } from '../../components/Flash'
import { useFlash } from '../../hooks/useFlash'
import type { MetricKey, MetricStatus } from '../../modules/metrics/calculate'
import {
  setColorWeight,
  setWeightPreset,
  updateMetricSetting,
  type WeightPreset,
} from '../../modules/metrics/settings'
import {
  RESULT_COLORS,
  RESULT_COLOR_META,
  isWarmColor,
  type ResultColor,
} from '../../modules/result-lifecycle/types'
import { useAppState } from '../../state/useAppState'

const SEVEN_COLORS = RESULT_COLORS.map((key) => ({
  key,
  label: RESULT_COLOR_META[key].label,
  bgHex: RESULT_COLOR_META[key].hex,
  textHex: key === 'yellow' ? '#1e293b' : '#ffffff',
  isWarm: isWarmColor(key),
}))

export function AdminMetricsPage() {
  const { metricSettings, setMetricSettings } = useAppState()
  const { message, error, ok, err } = useFlash()
  const [activeTab, setActiveTab] = useState<'metrics' | 'weights'>('metrics')

  function toggle(key: MetricKey, enabled: boolean) {
    setMetricSettings(updateMetricSetting(metricSettings, key, { enabled }))
    ok(enabled ? `Enabled ${key}` : `Hidden ${key} from reports`)
  }

  function setStatus(key: MetricKey, status: MetricStatus) {
    setMetricSettings(updateMetricSetting(metricSettings, key, { status }))
    ok(`Marked ${key} as ${status}`)
  }

  function setMinSample(key: MetricKey, minSample: number) {
    if (minSample < 0 || Number.isNaN(minSample)) return err('Min sample must be ≥ 0')
    setMetricSettings(updateMetricSetting(metricSettings, key, { minSample }))
  }

  function handlePresetChange(preset: WeightPreset) {
    setMetricSettings(setWeightPreset(metricSettings, preset))
    ok(`Switched weight matrix to ${preset === 'linear' ? 'Linear 0..1 Preset' : 'Custom Weights'}`)
  }

  function handleWeightChange(color: ResultColor, val: number) {
    if (Number.isNaN(val) || val < 0 || val > 1) {
      return err('Color weight must be a number between 0.0 and 1.0')
    }
    setMetricSettings(setColorWeight(metricSettings, color, val))
  }

  return (
    <>
      <PageHeader
        icon={Gauge}
        title="Metrics & Color Matrix"
        subtitle="Configure operational metrics, 7-color spectrum weights (0..1), dynamic Question CPD formulas, and reporting minimums."
      />
      <Flash message={message} error={error} />

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'metrics' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('metrics')}
        >
          <Gauge size={16} style={{ marginRight: 6 }} />
          Metrics Catalog
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'weights' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('weights')}
        >
          <Sliders size={16} style={{ marginRight: 6 }} />
          7-Color CPD Weights Matrix
        </button>
      </div>

      {activeTab === 'weights' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>CPD Color Weight Presets ($x \in [0, 1]$)</h3>
            <p className="meta" style={{ margin: '0 0 1rem 0' }}>
              Formula: <code>Question CPD = CVR × CCI × mean(x_recorded_colors)</code>.
              Warm colors (Red, Orange, Yellow) contribute to Struggle (RFC), while Cool colors (Green, Blue, Indigo, Purple) contribute to Achievement (RAC).
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="weightPreset"
                  checked={metricSettings.weightPreset === 'linear'}
                  onChange={() => handlePresetChange('linear')}
                />
                <strong>Linear 0..1 Preset (Default)</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="weightPreset"
                  checked={metricSettings.weightPreset === 'custom'}
                  onChange={() => handlePresetChange('custom')}
                />
                <strong>Custom Radio / Numeric Weights</strong>
              </label>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Color</th>
                  <th scope="col">Group</th>
                  <th scope="col">Weight (x: 0.0 → 1.0)</th>
                  <th scope="col">Percentage (%)</th>
                  <th scope="col">Probe Role</th>
                </tr>
              </thead>
              <tbody>
                {SEVEN_COLORS.map((c) => {
                  const weight = metricSettings.colorWeights[c.key] ?? 0
                  return (
                    <tr key={c.key}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              backgroundColor: c.bgHex,
                              border: '1px solid rgba(0,0,0,0.1)',
                            }}
                          />
                          <strong>{c.label}</strong>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            backgroundColor: c.isWarm ? '#fee2e2' : '#dcfce7',
                            color: c.isWarm ? '#991b1b' : '#166534',
                          }}
                        >
                          {c.isWarm ? 'Warm (Struggle / RFC)' : 'Cool (Achievement / RAC)'}
                        </span>
                      </td>
                      <td style={{ width: 140 }}>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          value={Number(weight.toFixed(3))}
                          onChange={(e) => handleWeightChange(c.key, Number(e.target.value))}
                          disabled={metricSettings.weightPreset === 'linear'}
                          aria-label={`Weight for ${c.label}`}
                          style={{ width: 100, padding: '4px 8px' }}
                        />
                      </td>
                      <td>
                        <strong>{(weight * 100).toFixed(1)}%</strong>
                      </td>
                      <td className="meta" style={{ margin: 0 }}>
                        {c.key === 'green' && 'Probe Initiator (Primary button)'}
                        {c.key === 'yellow' && 'Probe Fail outcome'}
                        {c.key === 'blue' && 'Probe Continue step'}
                        {c.key === 'indigo' && 'Probe Done outcome'}
                        {c.key === 'red' && 'Direct Failure (Primary button)'}
                        {c.key === 'orange' && 'Direct Mild Struggle (Primary button)'}
                        {c.key === 'purple' && 'Direct Exceptional Mastery (Primary button)'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <p className="meta" style={{ marginBottom: '0.75rem' }}>
            <strong>Probe count</strong> = Green entries · <strong>Probe depth</strong> starts at 1
            when Green opens probe and each Continue adds 1 · <strong>Max/avg depth</strong> = peak/mean observed probe depth.
            Total sample size includes initial questions plus all probe steps.
          </p>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Show</th>
                  <th scope="col">Status</th>
                  <th scope="col" title="Minimum finalized sample before chart shows a value">
                    Min sample
                  </th>
                  <th scope="col">Definition / formula</th>
                </tr>
              </thead>
              <tbody>
                {metricSettings.metrics.map((m) => (
                  <tr key={m.key}>
                    <td>
                      <strong>{m.label}</strong>
                      <div className="meta" style={{ margin: 0 }}>
                        <code style={{ fontSize: 11 }}>{m.key}</code>
                      </div>
                    </td>
                    <td>
                      <label className="metric-toggle">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={(e) => toggle(m.key, e.target.checked)}
                          aria-label={`Show ${m.label}`}
                        />
                        <span>{m.enabled ? 'On' : 'Off'}</span>
                      </label>
                    </td>
                    <td>
                      <select
                        value={m.status}
                        onChange={(e) => setStatus(m.key, e.target.value as MetricStatus)}
                        aria-label={`Status for ${m.label}`}
                      >
                        <option value="operational">Operational</option>
                        <option value="experimental">Experimental</option>
                      </select>
                    </td>
                    <td style={{ width: 88 }}>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={m.minSample}
                        onChange={(e) => setMinSample(m.key, Number(e.target.value))}
                        aria-label={`Minimum sample for ${m.label}`}
                        style={{ width: 72 }}
                      />
                    </td>
                    <td className="def">{m.definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

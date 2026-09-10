import { useState } from 'react'
import { Gauge } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { Flash } from '../../components/Flash'
import { useFlash } from '../../hooks/useFlash'
import type { MetricKey, MetricStatus } from '../../modules/metrics/calculate'
import { updateMetricSetting } from '../../modules/metrics/settings'
import {
  STANDALONE_FORMULA_VARIABLES,
  type StandaloneTestMetricSetting,
  type StandaloneTestMetricUnit,
} from '../../modules/metrics/standalone-settings'
import { useAppState } from '../../state/useAppState'

export function AdminMetricsPage() {
  const { metricSettings, setMetricSettings } = useAppState()
  const { message, error, ok, err } = useFlash()
  const [customLabel, setCustomLabel] = useState('')
  const [customFormula, setCustomFormula] = useState('')
  const [customUnit, setCustomUnit] = useState<StandaloneTestMetricUnit>('number')

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

  function updateStandaloneMetric(
    key: string,
    patch: Partial<Omit<StandaloneTestMetricSetting, 'key' | 'custom'>>,
  ) {
    setMetricSettings({
      ...metricSettings,
      standaloneTestMetrics: metricSettings.standaloneTestMetrics.map((m) =>
        m.key === key ? { ...m, ...patch } : m,
      ),
    })
  }

  function addCustomMetric() {
    const label = customLabel.trim()
    const formula = customFormula.trim()
    if (!label) return err('Custom metric label is required')
    if (!formula) return err('Custom metric formula is required')
    const baseKey =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40) || 'custom_metric'
    const existing = new Set(metricSettings.standaloneTestMetrics.map((m) => m.key))
    let key = `custom_${baseKey}`
    let suffix = 2
    while (existing.has(key)) {
      key = `custom_${baseKey}_${suffix}`
      suffix += 1
    }
    setMetricSettings({
      ...metricSettings,
      standaloneTestMetrics: [
        ...metricSettings.standaloneTestMetrics,
        {
          key,
          enabled: true,
          status: 'experimental',
          label,
          definition: 'Custom standalone Tests 1-1 metric.',
          formula,
          unit: customUnit,
          custom: true,
        },
      ],
    })
    setCustomLabel('')
    setCustomFormula('')
    setCustomUnit('number')
    ok(`Added ${label}`)
  }

  function deleteCustomMetric(key: string) {
    setMetricSettings({
      ...metricSettings,
      standaloneTestMetrics: metricSettings.standaloneTestMetrics.filter((m) => m.key !== key || !m.custom),
    })
    ok(`Deleted ${key}`)
  }

  return (
    <>
      <PageHeader
        icon={Gauge}
        title="Metrics"
        subtitle="Enabled metrics feed Teacher/Learner charts (real ledger only). Labels & definitions are tooltips. Chunks Number has no ceiling: chunks count / max chunks number / avg chunks number."
      />
      <Flash message={message} error={error} />

      <p className="meta" style={{ marginBottom: '0.75rem' }}>
        <strong>chunks count</strong> = Green (2) entries · <strong>chunks number</strong> starts at 1
        when Green opens probe and each Continue adds 1 · <strong>max/avg chunks number</strong> = peak/mean observed chunks number. There is no chunks number ceiling;
        Fail/Done are teacher decisions. Sample size is never labeled chunks number.
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

      <section style={{ marginTop: '1.5rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Tests 1-1 Metrics</h2>
        <p className="meta" style={{ marginBottom: '0.75rem' }}>
          These settings control standalone Tests 1-1 metric cards and the Metrics menu. The package
          metric label is always auto-detected as <strong>%r</strong> for packages whose name/code starts
          with R, otherwise <strong>%c</strong>. Supported formula variables:{' '}
          <code>{STANDALONE_FORMULA_VARIABLES.join(', ')}</code>.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Show</th>
                <th scope="col">Label</th>
                <th scope="col">Formula</th>
                <th scope="col">Unit</th>
                <th scope="col">Definition</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {metricSettings.standaloneTestMetrics.map((m) => {
                const labelLocked = m.key === 'package_percent'
                return (
                  <tr key={m.key}>
                    <td>
                      <strong>{labelLocked ? '%c/%r' : m.label}</strong>
                      <div className="meta" style={{ margin: 0 }}>
                        <code style={{ fontSize: 11 }}>{m.key}</code>
                        {m.custom ? ' custom' : ''}
                      </div>
                    </td>
                    <td>
                      <label className="metric-toggle">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={(e) => updateStandaloneMetric(m.key, { enabled: e.target.checked })}
                          aria-label={`Show ${m.label}`}
                        />
                        <span>{m.enabled ? 'On' : 'Off'}</span>
                      </label>
                    </td>
                    <td style={{ minWidth: 130 }}>
                      <input
                        type="text"
                        value={labelLocked ? '%c/%r auto' : m.label}
                        disabled={labelLocked}
                        onChange={(e) => updateStandaloneMetric(m.key, { label: e.target.value })}
                        aria-label={`Label for ${m.key}`}
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <input
                        type="text"
                        value={m.formula}
                        onChange={(e) => updateStandaloneMetric(m.key, { formula: e.target.value })}
                        aria-label={`Formula for ${m.label}`}
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td>
                      <select
                        value={m.unit}
                        onChange={(e) => updateStandaloneMetric(m.key, { unit: e.target.value as StandaloneTestMetricUnit })}
                        aria-label={`Unit for ${m.label}`}
                      >
                        <option value="percent">Percent</option>
                        <option value="number">Number</option>
                        <option value="ohm">CVR</option>
                        <option value="amp">CCI</option>
                        <option value="volt">CPD</option>
                        <option value="count">Count</option>
                      </select>
                    </td>
                    <td style={{ minWidth: 220 }}>
                      <textarea
                        value={m.definition}
                        onChange={(e) => updateStandaloneMetric(m.key, { definition: e.target.value })}
                        aria-label={`Definition for ${m.label}`}
                        rows={2}
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td>
                      {m.custom ? (
                        <button type="button" className="ghost" onClick={() => deleteCustomMetric(m.key)}>
                          Delete
                        </button>
                      ) : (
                        <span className="meta">Built-in</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <td>
                  <strong>Add custom</strong>
                  <div className="meta" style={{ margin: 0 }}>Derived at runtime</div>
                </td>
                <td><span className="meta">On</span></td>
                <td>
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Metric label"
                    aria-label="Custom metric label"
                    style={{ width: '100%' }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={customFormula}
                    onChange={(e) => setCustomFormula(e.target.value)}
                    placeholder="(avgPercentX + legacyRac) / 2"
                    aria-label="Custom metric formula"
                    style={{ width: '100%' }}
                  />
                </td>
                <td>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value as StandaloneTestMetricUnit)}
                    aria-label="Custom metric unit"
                  >
                    <option value="percent">Percent</option>
                    <option value="number">Number</option>
                    <option value="ohm">CVR</option>
                    <option value="amp">CCI</option>
                    <option value="volt">CPD</option>
                    <option value="count">Count</option>
                  </select>
                </td>
                <td className="def">Formula is evaluated with the whitelist above.</td>
                <td>
                  <button type="button" className="primary" onClick={addCustomMetric}>
                    Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

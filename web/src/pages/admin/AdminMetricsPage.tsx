import { Gauge } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { Flash } from '../../components/Flash'
import { useFlash } from '../../hooks/useFlash'
import type { MetricKey, MetricStatus } from '../../modules/metrics/calculate'
import {
  setDefaultMaxProbeCount,
  updateMetricSetting,
} from '../../modules/metrics/settings'
import { useAppState } from '../../state/useAppState'

export function AdminMetricsPage() {
  const { metricSettings, setMetricSettings } = useAppState()
  const { message, error, ok, err } = useFlash()

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

  return (
    <>
      <PageHeader
        icon={Gauge}
        title="Metrics"
        subtitle="Show/hide on Analysis · min sample · operational vs experimental"
        actions={
          <label className="field field-inline" style={{ margin: 0 }}>
            Max probes
            <input
              type="number"
              min={1}
              max={10}
              value={metricSettings.defaultMaxProbeCount}
              onChange={(e) => {
                const next = setDefaultMaxProbeCount(metricSettings, Number(e.target.value))
                setMetricSettings(next)
                ok(`Max probes = ${next.defaultMaxProbeCount}`)
              }}
            />
          </label>
        }
      />
      <Flash message={message} error={error} />

      <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Show</th>
                <th scope="col">Status</th>
                <th scope="col">Min n</th>
                <th scope="col">Definition</th>
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
  )
}

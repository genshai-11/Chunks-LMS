import { useEffect, useMemo, useState } from 'react'
import { FlaskConical, Languages, ListChecks } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel, StatCard } from '../../components/ui'
import type { LiveTestBlock, LiveTestItem, LiveTestResource } from '../../modules/assessment/live-test'
import { blockSummary } from '../../modules/assessment/live-test'
import { listLiveTestBlocks, listLiveTestItems, listLiveTestResources } from '../../lib/live-test-resources'

type ResourceBundle = {
  resource: LiveTestResource
  blocks: Array<LiveTestBlock & { items: LiveTestItem[] }>
}

type LoadState = 'loading' | 'ready' | 'error'

function completeness(items: LiveTestItem[]) {
  const total = items.length
  const viReady = items.filter((item) => item.promptVi && item.cvrValue != null).length
  const enReady = items.filter((item) => item.promptEn && item.cvrValue != null).length
  const cciReady = items.filter((item) => item.cciValue != null).length
  const cpdReady = items.filter((item) => item.cpdValue != null || (item.cvrValue != null && item.cciValue != null)).length
  return { total, viReady, enReady, cciReady, cpdReady }
}

export function AdminLiveTestsPage() {
  const [state, setState] = useState<LoadState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [bundles, setBundles] = useState<ResourceBundle[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setState('loading')
      const resources = await listLiveTestResources()
      if (!resources.ok) {
        if (!cancelled) {
          setError(resources.error)
          setState('error')
        }
        return
      }
      const next: ResourceBundle[] = []
      for (const resource of resources.data) {
        const blocks = await listLiveTestBlocks(resource.id)
        if (!blocks.ok) continue
        const blockRows: ResourceBundle['blocks'] = []
        for (const block of blocks.data) {
          const items = await listLiveTestItems(block.id)
          blockRows.push({ ...block, items: items.ok ? items.data : [] })
        }
        next.push({ resource, blocks: blockRows })
      }
      if (!cancelled) {
        setBundles(next)
        setState('ready')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const totals = useMemo(() => {
    const items = bundles.flatMap((bundle) => bundle.blocks.flatMap((block) => block.items))
    return {
      resources: bundles.length,
      blocks: bundles.reduce((sum, bundle) => sum + bundle.blocks.length, 0),
      ...completeness(items),
    }
  }, [bundles])

  return (
    <>
      <PageHeader
        icon={FlaskConical}
        kicker="Admin"
        title="Live Tests"
        subtitle="Resource status for 8×10 live-test blocks, prompt language readiness, and CVR × CCI → CPD metadata."
      />

      <div className="stat-grid" style={{ marginBottom: '1rem' }}>
        <StatCard label="Resources" value={totals.resources} icon={FlaskConical} />
        <StatCard label="Blocks" value={totals.blocks} icon={ListChecks} hint="Expected 8 per resource" />
        <StatCard label="Items" value={totals.total} icon={ListChecks} hint="Expected 80 per resource" />
        <StatCard label="CPD ready" value={`${totals.cpdReady}/${totals.total || 0}`} hint="CVR × CCI available" />
      </div>

      {state === 'loading' ? (
        <EmptyState icon={FlaskConical} title="Loading live-test resources…" />
      ) : null}

      {state === 'error' ? (
        <EmptyState
          icon={FlaskConical}
          title="Could not load live-test resources"
          description={error ?? 'Check Supabase connection and migration status.'}
        />
      ) : null}

      {state === 'ready' && bundles.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No live-test resources seeded"
          description="Run scripts/import-live-test-resource.mjs --dry-run to validate the CSV, then use the approved seed/apply path."
        />
      ) : null}

      {bundles.map(({ resource, blocks }) => {
        const items = blocks.flatMap((block) => block.items)
        const ready = completeness(items)
        return (
          <Panel
            key={resource.id}
            icon={FlaskConical}
            title={`${resource.title} · ${resource.version}`}
            description={`${resource.status} · ${ready.total} items · VI ${ready.viReady}/${ready.total} · EN ${ready.enReady}/${ready.total}`}
            collapsible={false}
          >
            <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
              <span className="badge">CCI {ready.cciReady}/{ready.total}</span>
              <span className="badge">CPD {ready.cpdReady}/{ready.total}</span>
              <span className="badge">Source: {resource.sourceFilename ?? '—'}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Summary</th>
                    <th>VI prompts</th>
                    <th>EN prompts</th>
                    <th>CCI</th>
                    <th>CVR</th>
                    <th>CPD</th>
                  </tr>
                </thead>
                <tbody>
                  {blocks.map((block) => {
                    const c = completeness(block.items)
                    return (
                      <tr key={block.id}>
                        <td>
                          <strong>Session {block.blockNumber}</strong>
                          <div className="meta" style={{ margin: 0 }}>{block.title ?? 'Untitled'}</div>
                        </td>
                        <td>{blockSummary(block)}</td>
                        <td><Languages className="h-3 w-3 inline" aria-hidden /> {c.viReady}/{c.total}</td>
                        <td><Languages className="h-3 w-3 inline" aria-hidden /> {c.enReady}/{c.total}</td>
                        <td>{block.cciMin ?? '—'}–{block.cciMax ?? '—'}</td>
                        <td>{block.cvrMin ?? '—'}–{block.cvrMax ?? '—'}</td>
                        <td>{block.cpdMin ?? '—'}–{block.cpdMax ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        )
      })}
    </>
  )
}

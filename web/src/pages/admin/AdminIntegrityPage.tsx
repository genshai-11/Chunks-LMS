import { useCallback, useState } from 'react'
import { Database, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Flash } from '../../components/Flash'
import { PageHeader } from '../../components/PageHeader'
import { EmptyState, Panel, StatCard } from '../../components/ui'
import { useFlash } from '../../hooks/useFlash'
import {
  rebuildLedgerFromCloud,
  runCloudReconciliation,
  type ReconciliationReport,
} from '../../lib/reconciliation-fetch'
import { isSupabaseConfigured } from '../../lib/supabase-sync'
import { useAppState } from '../../state/useAppState'

/**
 * Phase D diagnostics: rebuild ledger from snapshots; event vs snapshot reconciliation.
 */
export function AdminIntegrityPage() {
  const { roster, setLedger, reloadFromSupabase, lastSyncedAt, backendStatus } = useAppState()
  const { message, error, ok, err } = useFlash()
  const [report, setReport] = useState<ReconciliationReport | null>(null)
  const [busy, setBusy] = useState(false)
  const cloud = isSupabaseConfigured()

  const runCheck = useCallback(async () => {
    setBusy(true)
    const r = await runCloudReconciliation(roster)
    setBusy(false)
    if (!r.ok) return err(r.error)
    setReport(r.data)
    ok(
      r.data.ok
        ? `Integrity OK · ${r.data.attemptCount} attempts`
        : `${r.data.divergences.length} divergence(s) found`,
    )
  }, [roster, ok, err])

  const rebuild = useCallback(async () => {
    setBusy(true)
    const r = await rebuildLedgerFromCloud(roster)
    setBusy(false)
    if (!r.ok) return err(r.error)
    setLedger(r.data)
    ok(`Ledger rebuilt · ${r.data.length} effective result(s)`)
  }, [roster, setLedger, ok, err])

  return (
    <>
      <PageHeader
        icon={ShieldCheck}
        kicker="Admin"
        title="Data integrity"
        subtitle="Multi-user safe sync diagnostics — ledger rebuild and event/snapshot reconciliation."
      />
      <Flash message={message} error={error} />

      <div className="stat-grid">
        <StatCard
          icon={Database}
          label="Backend"
          value={cloud ? backendStatus : 'local'}
          hint={lastSyncedAt ? `Last sync ${new Date(lastSyncedAt).toLocaleTimeString()}` : '—'}
        />
        <StatCard
          icon={ShieldCheck}
          label="Last check"
          value={report ? (report.ok ? 'OK' : 'Issues') : '—'}
          hint={
            report
              ? `${report.attemptCount} attempts · ${report.eventRowCount} events`
              : 'Run reconciliation'
          }
        />
        <StatCard
          icon={TriangleAlert}
          label="Divergences"
          value={report ? report.divergences.length : '—'}
          hint="Event vs snapshot"
        />
      </div>

      <Panel
        icon={ShieldCheck}
        title="Actions"
        description="Upsert-only workspace sync is default. Assessment capture uses path RPCs (not full replace)."
      >
        <div className="btn-row">
          <button
            type="button"
            className="primary"
            disabled={busy || !cloud}
            onClick={() => void runCheck()}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            <span>Run reconciliation</span>
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy || !cloud}
            onClick={() => void rebuild()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            <span>Rebuild ledger from cloud</span>
          </button>
          <button
            type="button"
            className="ghost"
            disabled={busy || !cloud}
            onClick={() => void reloadFromSupabase()}
          >
            <Database className="h-4 w-4" aria-hidden />
            <span>Reload workspace</span>
          </button>
        </div>
        {!cloud ? (
          <p className="meta mt-3">
            Supabase not configured — integrity checks need a connected project. Local mode never
            deletes remote sessions.
          </p>
        ) : (
          <p className="meta mt-3">
            Sync policy: entity upsert; open learning sessions are never pruned; assessment attempts
            only written via live capture RPCs.
          </p>
        )}
      </Panel>

      <Panel
        icon={TriangleAlert}
        title="Divergences"
        description="Events are authoritative; snapshots must match last finalization/correction."
      >
        {!report ? (
          <EmptyState
            icon={ShieldCheck}
            title="No report yet"
            description="Run reconciliation after teachers have captured assessments on Supabase."
          />
        ) : report.divergences.length === 0 ? (
          <p className="meta">No divergences — snapshots match event finals.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Attempt</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {report.divergences.map((d) => (
                  <tr key={`${d.attemptId}-${d.reason}`}>
                    <td className="font-mono text-xs">{d.attemptId}</td>
                    <td>{d.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}

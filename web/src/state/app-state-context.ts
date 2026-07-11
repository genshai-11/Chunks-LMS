import { createContext } from 'react'
import type { CaptureSessionState } from '../modules/assessment/session-capture'
import type { MetricSettingsState } from '../modules/metrics/settings'
import type { CorrectResultInput } from '../modules/ops/audit'
import type { OpsAuditEvent } from '../modules/ops/types'
import type { ResultRecord } from '../modules/reporting/progress'
import type { RosterState } from '../modules/roster/types'
import type { SchedulingState } from '../modules/scheduling/types'

export type BackendStatus = 'booting' | 'online' | 'offline' | 'syncing' | 'error'

export type AppStateValue = {
  roster: RosterState
  setRoster: (next: RosterState) => void
  scheduling: SchedulingState
  setScheduling: (next: SchedulingState) => void
  capture: CaptureSessionState | null
  setCapture: (next: CaptureSessionState | null) => void
  ledger: ResultRecord[]
  setLedger: (next: ResultRecord[]) => void
  metricSettings: MetricSettingsState
  setMetricSettings: (next: MetricSettingsState) => void
  /** Append-only operational audit (finalize / correct) */
  auditLog: OpsAuditEvent[]
  appendFinalizedFromCapture: (capture: CaptureSessionState) => void
  /** Post-session correction with required reason */
  correctResult: (
    input: CorrectResultInput,
  ) => { ok: true } | { ok: false; error: string }
  /** Clear all local data (empty org) and push empty to cloud on next sync */
  resetAll: () => void
  backendStatus: BackendStatus
  backendError: string | null
  lastSyncedAt: string | null
  syncNow: () => Promise<void>
  reloadFromSupabase: () => Promise<void>
  supabaseEnabled: boolean
  /** Which learner portal is active (email / invite link) */
  activeLearnerUserId: string | null
  setActiveLearnerUserId: (id: string | null) => void
  /** Teacher workspace active class */
  activeClassId: string | null
  setActiveClassId: (id: string | null) => void
  /** Learner portal active class (multi-enrollment) */
  activeLearnerClassId: string | null
  setActiveLearnerClassId: (id: string | null) => void
}

export const AppStateContext = createContext<AppStateValue | null>(null)

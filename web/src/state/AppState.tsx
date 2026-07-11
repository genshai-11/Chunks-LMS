import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CaptureSessionState } from '../modules/assessment/session-capture'
import {
  createDefaultMetricSettings,
  type MetricSettingsState,
} from '../modules/metrics/settings'
import { appendResult, type ResultRecord } from '../modules/reporting/progress'
import { createEmptyRoster } from '../modules/roster/seed'
import type { RosterState } from '../modules/roster/types'
import { emptySchedulingState } from '../modules/scheduling/session-lifecycle'
import type { SchedulingState } from '../modules/scheduling/types'
import {
  isSupabaseConfigured,
  loadWorkspaceFromSupabase,
  normalizeIdsForDb,
  saveWorkspaceToSupabase,
} from '../lib/supabase-sync'
import { AppStateContext, type BackendStatus } from './app-state-context'
import {
  clearPersistedAppState,
  loadPersistedAppState,
  savePersistedAppState,
} from './persist'

function ledgerFromCapture(
  capture: CaptureSessionState,
  roster: RosterState,
  existing: ResultRecord[],
): ResultRecord[] {
  const klass =
    roster.classes.find((c) => c.teacherUserId === capture.teacherUserId) ??
    roster.classes[0]
  const course = roster.courses.find((c) => c.id === klass?.courseId) ?? roster.courses[0]
  if (!klass || !course) return existing

  let next = existing
  for (const a of capture.attempts) {
    if (!a.snapshot.effectiveColor || !a.snapshot.finalizedAt) continue
    const already = next.some(
      (r) =>
        r.sessionQuestionId === a.sessionQuestionId &&
        r.learnerUserId === a.learnerUserId &&
        r.learningSessionId === a.learningSessionId &&
        r.effectiveColor === a.snapshot.effectiveColor,
    )
    if (already) continue
    next = appendResult(next, {
      organizationId: roster.organization.id,
      courseId: course.id,
      classId: klass.id,
      learningSessionId: a.learningSessionId,
      learnerUserId: a.learnerUserId,
      teacherUserId: a.teacherUserId,
      sessionQuestionId: a.sessionQuestionId,
      effectiveColor: a.snapshot.effectiveColor,
      enteredProbeFlow: a.snapshot.enteredProbeFlow,
      probeEventCount: a.snapshot.probeCount,
      finalizedAt: a.snapshot.finalizedAt,
    })
  }
  return next
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const local = loadPersistedAppState()
  const [roster, setRoster] = useState<RosterState>(
    () => local?.roster ?? createEmptyRoster(),
  )
  const [scheduling, setScheduling] = useState<SchedulingState>(
    () => local?.scheduling ?? emptySchedulingState(),
  )
  const [capture, setCapture] = useState<CaptureSessionState | null>(
    () => local?.capture ?? null,
  )
  const [ledger, setLedger] = useState<ResultRecord[]>(() => local?.ledger ?? [])
  const [metricSettings, setMetricSettings] = useState<MetricSettingsState>(
    () => local?.metricSettings ?? createDefaultMetricSettings(),
  )
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('booting')
  const [backendError, setBackendError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  const bootDone = useRef(false)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextSync = useRef(false)

  // Boot: prefer Supabase, fall back to localStorage
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isSupabaseConfigured()) {
        setBackendStatus('offline')
        bootDone.current = true
        return
      }
      const loaded = await loadWorkspaceFromSupabase()
      if (cancelled) return
      if (!loaded.ok) {
        setBackendStatus('error')
        setBackendError(loaded.error)
        bootDone.current = true
        return
      }

      const remote = loaded.data
      const hasRemote =
        remote.roster.courses.length > 0 ||
        remote.roster.users.length > 0 ||
        remote.roster.classes.length > 0 ||
        remote.scheduling.scheduledSessions.length > 0

      const hasLocal =
        (local?.roster.courses.length ?? 0) > 0 ||
        (local?.roster.users.length ?? 0) > 0 ||
        (local?.roster.classes.length ?? 0) > 0

      skipNextSync.current = true
      if (hasRemote) {
        setRoster(remote.roster)
        setScheduling(remote.scheduling)
      } else if (hasLocal && local) {
        // First cloud push from browser workspace
        setRoster(local.roster)
        setScheduling(local.scheduling)
        skipNextSync.current = false
      } else {
        setRoster(remote.roster)
        setScheduling(remote.scheduling)
      }

      setBackendStatus('online')
      setBackendError(null)
      setLastSyncedAt(new Date().toISOString())
      bootDone.current = true
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, [])

  // Local cache always
  useEffect(() => {
    savePersistedAppState({
      roster,
      scheduling,
      capture,
      ledger,
      metricSettings,
    })
  }, [roster, scheduling, capture, ledger, metricSettings])

  // Debounced Supabase save
  useEffect(() => {
    if (!bootDone.current) return
    if (!isSupabaseConfigured()) return
    if (skipNextSync.current) {
      skipNextSync.current = false
      return
    }

    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(async () => {
      setBackendStatus('syncing')
      const normalized = normalizeIdsForDb({ roster, scheduling })
      // If IDs were remapped, update UI once so future saves match DB
      if (
        normalized.roster.organization.id !== roster.organization.id ||
        normalized.roster.users.some((u, i) => u.id !== roster.users[i]?.id)
      ) {
        skipNextSync.current = true
        setRoster(normalized.roster)
        setScheduling(normalized.scheduling)
      }
      const result = await saveWorkspaceToSupabase(normalized)
      if (result.ok) {
        setBackendStatus('online')
        setBackendError(null)
        setLastSyncedAt(new Date().toISOString())
      } else {
        setBackendStatus('error')
        setBackendError(result.error)
      }
    }, 700)

    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current)
    }
  }, [roster, scheduling])

  const resetAll = useCallback(() => {
    clearPersistedAppState()
    setRoster(createEmptyRoster())
    setScheduling(emptySchedulingState())
    setCapture(null)
    setLedger([])
    setMetricSettings(createDefaultMetricSettings())
  }, [])

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setBackendStatus('offline')
      return
    }
    setBackendStatus('syncing')
    const result = await saveWorkspaceToSupabase({ roster, scheduling })
    if (result.ok) {
      setBackendStatus('online')
      setBackendError(null)
      setLastSyncedAt(new Date().toISOString())
    } else {
      setBackendStatus('error')
      setBackendError(result.error)
    }
  }, [roster, scheduling])

  const reloadFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) return
    setBackendStatus('syncing')
    const loaded = await loadWorkspaceFromSupabase()
    if (!loaded.ok) {
      setBackendStatus('error')
      setBackendError(loaded.error)
      return
    }
    skipNextSync.current = true
    setRoster(loaded.data.roster)
    setScheduling(loaded.data.scheduling)
    setBackendStatus('online')
    setBackendError(null)
    setLastSyncedAt(new Date().toISOString())
  }, [])

  const appendFinalizedFromCapture = useCallback(
    (nextCapture: CaptureSessionState) => {
      setLedger((prev) => ledgerFromCapture(nextCapture, roster, prev))
    },
    [roster],
  )

  const value = useMemo(
    () => ({
      roster,
      setRoster,
      scheduling,
      setScheduling,
      capture,
      setCapture,
      ledger,
      setLedger,
      metricSettings,
      setMetricSettings,
      appendFinalizedFromCapture,
      resetAll,
      backendStatus,
      backendError,
      lastSyncedAt,
      syncNow,
      reloadFromSupabase,
      supabaseEnabled: isSupabaseConfigured(),
    }),
    [
      roster,
      scheduling,
      capture,
      ledger,
      metricSettings,
      appendFinalizedFromCapture,
      resetAll,
      backendStatus,
      backendError,
      lastSyncedAt,
      syncNow,
      reloadFromSupabase,
    ],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

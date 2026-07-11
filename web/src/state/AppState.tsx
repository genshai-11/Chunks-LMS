import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CaptureSessionState } from '../modules/assessment/session-capture'
import { createDefaultMetricSettings, type MetricSettingsState } from '../modules/metrics/settings'
import { appendResult, type ResultRecord } from '../modules/reporting/progress'
import { createEmptyRoster, LOCAL_ORG_ID } from '../modules/roster/seed'
import type { RosterState } from '../modules/roster/types'
import { emptySchedulingState } from '../modules/scheduling/session-lifecycle'
import type { SchedulingState } from '../modules/scheduling/types'
import {
  ensureClerkWorkspace,
  isSupabaseConfigured,
  loadWorkspaceFromSupabase,
  normalizeIdsForDb,
  saveWorkspaceToSupabase,
} from '../lib/supabase-sync'
import { AppStateContext, type BackendStatus } from './app-state-context'
import { clearPersistedAppState, loadPersistedAppState, savePersistedAppState } from './persist'
import { loadActiveLearnerId, saveActiveLearnerId } from './active-learner'
import {
  loadActiveClassId,
  loadActiveLearnerClassId,
  saveActiveClassId,
  saveActiveLearnerClassId,
} from './workspace-prefs'
import { loadLiveLedger } from '../lib/live-assessment'
import { useStaffSession } from '../auth/useStaffSession'

function ledgerFromCapture(
  capture: CaptureSessionState,
  roster: RosterState,
  existing: ResultRecord[],
): ResultRecord[] {
  const klass =
    roster.classes.find((c) => c.teacherUserId === capture.teacherUserId) ?? roster.classes[0]
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

function rosterWeight(r: RosterState, s: SchedulingState): number {
  return (
    r.users.length * 4 +
    r.courses.length * 3 +
    r.classes.length * 3 +
    r.enrollments.length * 2 +
    s.scheduledSessions.length +
    s.learningSessions.length
  )
}

function rebaseRosterOrganization(
  r: RosterState,
  organizationId: string,
  name: string,
): RosterState {
  return {
    ...r,
    organization: { id: organizationId, name },
    courses: r.courses.map((course) => ({ ...course, organizationId })),
  }
}

function ensureStableOrg(r: RosterState): RosterState {
  if (r.organization.id === 'org-local' || r.organization.id.startsWith('org-local')) {
    return {
      ...r,
      organization: { ...r.organization, id: LOCAL_ORG_ID },
      courses: r.courses.map((c) =>
        c.organizationId === r.organization.id || c.organizationId === 'org-local'
          ? { ...c, organizationId: LOCAL_ORG_ID }
          : c,
      ),
    }
  }
  return r
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const staffSession = useStaffSession()
  const persistedRef = useRef(loadPersistedAppState())
  const [roster, setRoster] = useState<RosterState>(() =>
    staffSession.clerkEnabled
      ? createEmptyRoster()
      : ensureStableOrg(persistedRef.current?.roster ?? createEmptyRoster()),
  )
  const [scheduling, setScheduling] = useState<SchedulingState>(() =>
    staffSession.clerkEnabled
      ? emptySchedulingState()
      : (persistedRef.current?.scheduling ?? emptySchedulingState()),
  )
  const [capture, setCapture] = useState<CaptureSessionState | null>(null)
  const [ledger, setLedger] = useState<ResultRecord[]>([])
  const [metricSettings, setMetricSettings] = useState<MetricSettingsState>(
    () => persistedRef.current?.metricSettings ?? createDefaultMetricSettings(),
  )
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('booting')
  const [backendError, setBackendError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [activeLearnerUserId, setActiveLearnerUserIdState] = useState<string | null>(() =>
    loadActiveLearnerId(),
  )
  const [activeClassId, setActiveClassIdState] = useState<string | null>(() => loadActiveClassId())
  const [activeLearnerClassId, setActiveLearnerClassIdState] = useState<string | null>(() =>
    loadActiveLearnerClassId(),
  )

  const setActiveLearnerUserId = useCallback((id: string | null) => {
    saveActiveLearnerId(id)
    setActiveLearnerUserIdState(id)
  }, [])

  const setActiveClassId = useCallback((id: string | null) => {
    saveActiveClassId(id)
    setActiveClassIdState(id)
  }, [])

  const setActiveLearnerClassId = useCallback((id: string | null) => {
    saveActiveLearnerClassId(id)
    setActiveLearnerClassIdState(id)
  }, [])

  const bootDone = useRef(false)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextSync = useRef(false)
  /** After intentional Clear data, allow empty cloud wipe once */
  const allowEmptyWipeOnce = useRef(false)
  /** Latest in-memory workspace for boot merge (avoid clobbering mid-edit) */
  const liveRef = useRef({ roster, scheduling })
  liveRef.current = { roster, scheduling }

  // Boot: authenticated cloud is authoritative. Local data is used only once to
  // bootstrap an empty Clerk-linked workspace, then cloud wins on every browser.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      bootDone.current = false
      if (staffSession.clerkEnabled && !staffSession.ready) return
      if (staffSession.clerkEnabled && !staffSession.signedIn) {
        setRoster(createEmptyRoster())
        setScheduling(emptySchedulingState())
        setCapture(null)
        setLedger([])
        setBackendStatus('offline')
        return
      }
      if (!isSupabaseConfigured()) {
        setBackendStatus('offline')
        bootDone.current = true
        return
      }

      let organizationId: string | undefined
      if (staffSession.userId) {
        const provisioned = await ensureClerkWorkspace({
          clerkUserId: staffSession.userId,
          email: staffSession.email,
          displayName: staffSession.displayName ?? staffSession.email ?? 'Chunks Staff',
          roles: staffSession.staffRoles,
        })
        if (!provisioned.ok) {
          setBackendStatus('error')
          setBackendError(provisioned.error)
          return
        }
        organizationId = provisioned.organizationId
      }

      const loaded = await loadWorkspaceFromSupabase({ organizationId })
      if (cancelled) return
      if (!loaded.ok) {
        setBackendStatus('error')
        setBackendError(loaded.error)
        bootDone.current = true
        return
      }

      const remote = {
        roster: ensureStableOrg(loaded.data.roster),
        scheduling: loaded.data.scheduling,
      }
      const localRoster = ensureStableOrg(
        persistedRef.current?.roster ?? liveRef.current.roster,
      )
      const live = {
        roster: organizationId
          ? rebaseRosterOrganization(localRoster, organizationId, remote.roster.organization.name)
          : localRoster,
        scheduling: persistedRef.current?.scheduling ?? liveRef.current.scheduling,
      }
      const wRemote = rosterWeight(remote.roster, remote.scheduling)
      const wLive = rosterWeight(live.roster, live.scheduling)

      skipNextSync.current = true

      let authoritativeRoster = remote.roster
      if (wRemote > 0) {
        // Once cloud has data, it is always authoritative across browsers.
        setRoster(remote.roster)
        setScheduling(remote.scheduling)
      } else if (wLive > 0) {
        // One-time migration from this browser into the empty Clerk workspace.
        authoritativeRoster = live.roster
        setRoster(live.roster)
        setScheduling(live.scheduling)
        skipNextSync.current = false
      } else {
        setRoster(remote.roster)
        setScheduling(remote.scheduling)
      }

      const liveLedger = await loadLiveLedger(authoritativeRoster)
      if (!cancelled && liveLedger.ok) setLedger(liveLedger.data)

      setBackendStatus('online')
      setBackendError(null)
      setLastSyncedAt(new Date().toISOString())
      bootDone.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [staffSession])

  // Local cache always
  useEffect(() => {
    savePersistedAppState({
      roster,
      scheduling,
      capture: null,
      ledger: [],
      metricSettings,
    })
  }, [roster, scheduling, metricSettings])

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
      const stable = {
        roster: ensureStableOrg(roster),
        scheduling,
      }
      const normalized = normalizeIdsForDb(stable)
      if (
        normalized.roster.organization.id !== roster.organization.id ||
        normalized.roster.users.some((u, i) => u.id !== roster.users[i]?.id) ||
        normalized.roster.courses.some((c, i) => c.id !== roster.courses[i]?.id)
      ) {
        skipNextSync.current = true
        setRoster(normalized.roster)
        setScheduling(normalized.scheduling)
      }
      const wipe = allowEmptyWipeOnce.current
      allowEmptyWipeOnce.current = false
      const result = await saveWorkspaceToSupabase(normalized, {
        allowEmptyWipe: wipe,
      })
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
    saveActiveLearnerId(null)
    setActiveLearnerUserIdState(null)
    allowEmptyWipeOnce.current = true
    skipNextSync.current = false
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
    const result = await saveWorkspaceToSupabase(
      { roster: ensureStableOrg(roster), scheduling },
      { allowEmptyWipe: allowEmptyWipeOnce.current },
    )
    allowEmptyWipeOnce.current = false
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
    if (!isSupabaseConfigured() || !staffSession.userId) return
    setBackendStatus('syncing')
    const provisioned = await ensureClerkWorkspace({
      clerkUserId: staffSession.userId,
      email: staffSession.email,
      displayName: staffSession.displayName ?? staffSession.email ?? 'Chunks Staff',
      roles: staffSession.staffRoles,
    })
    if (!provisioned.ok) {
      setBackendStatus('error')
      setBackendError(provisioned.error)
      return
    }
    const loaded = await loadWorkspaceFromSupabase({
      organizationId: provisioned.organizationId,
    })
    if (!loaded.ok) {
      setBackendStatus('error')
      setBackendError(loaded.error)
      return
    }
    skipNextSync.current = true
    const remoteRoster = ensureStableOrg(loaded.data.roster)
    setRoster(remoteRoster)
    setScheduling(loaded.data.scheduling)
    setCapture(null)
    const liveLedger = await loadLiveLedger(remoteRoster)
    if (liveLedger.ok) setLedger(liveLedger.data)
    setBackendStatus('online')
    setBackendError(null)
    setLastSyncedAt(new Date().toISOString())
  }, [staffSession])

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
      activeLearnerUserId,
      setActiveLearnerUserId,
      activeClassId,
      setActiveClassId,
      activeLearnerClassId,
      setActiveLearnerClassId,
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
      activeLearnerUserId,
      setActiveLearnerUserId,
      activeClassId,
      setActiveClassId,
      activeLearnerClassId,
      setActiveLearnerClassId,
    ],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

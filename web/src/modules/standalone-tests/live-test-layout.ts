export const LIVE_TEST_RAIL_DEFAULT = 240
export const LIVE_TEST_RAIL_MIN = 168
export const LIVE_TEST_RAIL_MAX = 420

export function resolveLiveTestRailWidth(saved: string | null): number {
  if (!saved) return LIVE_TEST_RAIL_DEFAULT
  const n = Number(saved)
  if (!Number.isFinite(n)) return LIVE_TEST_RAIL_DEFAULT
  return Math.min(LIVE_TEST_RAIL_MAX, Math.max(LIVE_TEST_RAIL_MIN, n))
}

export function resolveLiveTestAudioPanelOpen(saved: string | null): boolean {
  if (saved === 'true') return true
  return false
}

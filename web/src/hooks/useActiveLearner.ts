import { useMemo } from 'react'
import type { DomainUser } from '../modules/roster/types'
import { useAppState } from '../state/useAppState'

/**
 * Active learner for portal views.
 * Only the profile opened via invite/email session — never fall back to “first learner”
 * (that would leak other students’ progress).
 */
export function useActiveLearner(): DomainUser | null {
  const { roster, activeLearnerUserId } = useAppState()

  return useMemo(() => {
    if (!activeLearnerUserId) return null
    const match = roster.users.find(
      (u) => u.id === activeLearnerUserId && u.roles.includes('learner'),
    )
    return match ?? null
  }, [roster.users, activeLearnerUserId])
}

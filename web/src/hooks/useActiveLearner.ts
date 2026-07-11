import { useMemo } from 'react'
import type { DomainUser } from '../modules/roster/types'
import { useAppState } from '../state/useAppState'

/** Resolve the active learner for portal views (invite / email / first learner fallback). */
export function useActiveLearner(): DomainUser | null {
  const { roster, activeLearnerUserId } = useAppState()

  return useMemo(() => {
    const learners = roster.users.filter((u) => u.roles.includes('learner'))
    if (learners.length === 0) return null
    if (activeLearnerUserId) {
      const match = learners.find((u) => u.id === activeLearnerUserId)
      if (match) return match
    }
    return learners[0] ?? null
  }, [roster.users, activeLearnerUserId])
}

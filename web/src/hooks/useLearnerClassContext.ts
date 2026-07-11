import { useEffect, useMemo } from 'react'
import {
  listLearnerEnrollmentOptions,
  resolveLearnerClassId,
  type LearnerEnrollmentOption,
} from '../modules/roster/class-context'
import { useActiveLearner } from './useActiveLearner'
import { useAppState } from '../state/useAppState'

export type LearnerClassContext = {
  learner: ReturnType<typeof useActiveLearner>
  options: LearnerEnrollmentOption[]
  option: LearnerEnrollmentOption | null
  classRow: LearnerEnrollmentOption['classRow'] | null
  course: LearnerEnrollmentOption['course']
  activeClassId: string | null
  setActiveLearnerClassId: (id: string | null) => void
  hasMultiple: boolean
}

/** Active class for multi-enrolled learner portal. */
export function useLearnerClassContext(): LearnerClassContext {
  const { roster, activeLearnerClassId, setActiveLearnerClassId } = useAppState()
  const learner = useActiveLearner()

  const options = useMemo(
    () => (learner ? listLearnerEnrollmentOptions(roster, learner.id) : []),
    [roster, learner],
  )

  const activeClassId = useMemo(
    () => resolveLearnerClassId(options, activeLearnerClassId),
    [options, activeLearnerClassId],
  )

  const option = useMemo(
    () => options.find((o) => o.classRow.id === activeClassId) ?? null,
    [options, activeClassId],
  )

  useEffect(() => {
    const resolved = resolveLearnerClassId(options, activeLearnerClassId)
    if (resolved && resolved !== activeLearnerClassId) {
      setActiveLearnerClassId(resolved)
    } else if (!resolved && activeLearnerClassId) {
      setActiveLearnerClassId(null)
    }
  }, [options, activeLearnerClassId, setActiveLearnerClassId])

  return {
    learner,
    options,
    option,
    classRow: option?.classRow ?? null,
    course: option?.course ?? null,
    activeClassId,
    setActiveLearnerClassId,
    hasMultiple: options.length > 1,
  }
}

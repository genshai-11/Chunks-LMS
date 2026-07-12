import { useEffect, useMemo } from 'react'
import {
  listTeacherOperableClasses,
  resolveActiveClass,
  toClassOption,
  type ClassOption,
} from '../modules/roster/class-context'
import { useAppState } from '../state/useAppState'
import { useStaffSession } from '../auth/useStaffSession'

export type TeacherClassContext = {
  options: ClassOption[]
  classRow: ClassOption['classRow'] | null
  course: ClassOption['course']
  teacher: ClassOption['teacher']
  seats: number
  activeClassId: string | null
  setActiveClassId: (id: string | null) => void
  hasMultiple: boolean
}

/** Active class for Teacher workspace (multi-class switcher). */
export function useTeacherClassContext(): TeacherClassContext {
  const { roster, activeClassId, setActiveClassId } = useAppState()
  const staffSession = useStaffSession()
  const signedInTeacher = roster.users.find(
    (user) =>
      user.roles.includes('teacher') &&
      Boolean(staffSession.email) &&
      user.email?.toLowerCase() === staffSession.email?.toLowerCase(),
  )

  const classes = useMemo(() => {
    const all = listTeacherOperableClasses(roster)
    return staffSession.canAccess('admin') || !signedInTeacher
      ? all
      : all.filter((row) => row.teacherUserId === signedInTeacher.id)
  }, [roster, staffSession, signedInTeacher])
  const options = useMemo(() => classes.map((row) => toClassOption(roster, row)), [classes, roster])
  const classRow = useMemo(
    () => resolveActiveClass(classes, activeClassId),
    [classes, activeClassId],
  )

  useEffect(() => {
    const resolved = resolveActiveClass(classes, activeClassId)
    if (resolved && resolved.id !== activeClassId) {
      setActiveClassId(resolved.id)
    } else if (!resolved && activeClassId) {
      setActiveClassId(null)
    }
  }, [classes, activeClassId, setActiveClassId])

  const option = classRow ? toClassOption(roster, classRow) : null

  return {
    options,
    classRow: option?.classRow ?? null,
    course: option?.course ?? null,
    teacher: option?.teacher ?? null,
    seats: option?.seats ?? 0,
    activeClassId: option?.classRow.id ?? null,
    setActiveClassId,
    hasMultiple: options.length > 1,
  }
}

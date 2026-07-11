import { CalendarDays, ChartColumn, Radio } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { RoleWorkspace } from '../../components/RoleWorkspace'
import { activeEnrollmentsForClass } from '../../modules/roster/service'
import { useAppState } from '../../state/useAppState'

const ITEMS = [
  { to: '/teacher/calendar', label: 'Schedule', icon: CalendarDays },
  { to: '/teacher/session', label: 'Live session', icon: Radio },
  { to: '/teacher/analysis', label: 'Analysis', icon: ChartColumn },
]

export function TeacherLayout() {
  const { roster } = useAppState()
  const { pathname } = useLocation()
  const teacher = roster.users.find((u) => u.roles.includes('teacher'))
  const classRow = roster.classes.find((c) => c.teacherUserId === teacher?.id) ?? roster.classes[0]
  const seats = classRow ? activeEnrollmentsForClass(roster, classRow.id).length : 0

  if (pathname === '/teacher' || pathname === '/teacher/') {
    return <Navigate to="/teacher/session" replace />
  }

  return (
    <RoleWorkspace
      title="Teaching"
      subtitle={
        classRow ? `${classRow.name} · ${seats}/${classRow.capacity}` : 'No class'
      }
      navLabel="Teacher menu"
      items={ITEMS}
    />
  )
}

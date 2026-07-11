import { BookOpen, Gauge, School, UserPlus, Users } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { RoleWorkspace } from '../../components/RoleWorkspace'
import { useAppState } from '../../state/useAppState'

const ITEMS = [
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/classes', label: 'Classes', icon: School },
  { to: '/admin/people', label: 'People', icon: Users },
  { to: '/admin/enrollments', label: 'Enrollments', icon: UserPlus },
  { to: '/admin/metrics', label: 'Metrics', icon: Gauge },
]

export function AdminLayout() {
  const { roster } = useAppState()
  const { pathname } = useLocation()

  if (pathname === '/admin' || pathname === '/admin/') {
    return <Navigate to="/admin/courses" replace />
  }

  return (
    <RoleWorkspace
      title="Admin"
      subtitle={roster.organization.name}
      navLabel="Admin menu"
      items={ITEMS}
    />
  )
}

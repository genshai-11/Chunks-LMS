import { BookMarked, ChartColumn, ClipboardCheck } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import { RoleWorkspace } from '../../components/RoleWorkspace'
import { UserAvatar } from '../../components/UserAvatar'
import { useActiveLearner } from '../../hooks/useActiveLearner'

const ITEMS = [
  { to: '/learner/enrollments', label: 'My classes', icon: BookMarked },
  { to: '/learner/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/learner/analysis', label: 'Analysis', icon: ChartColumn },
]

export function LearnerLayout() {
  const learner = useActiveLearner()
  const { pathname } = useLocation()

  // Share-link session required — no Clerk for learners
  if (!learner) {
    return <Navigate to="/access" replace />
  }

  if (pathname === '/learner' || pathname === '/learner/') {
    return <Navigate to="/learner/enrollments" replace />
  }

  return (
    <RoleWorkspace
      title="Learning"
      subtitle={learner.displayName}
      leading={
        <UserAvatar name={learner.displayName} avatarUrl={learner.avatarUrl} size="md" />
      }
      navLabel="Learner menu"
      items={ITEMS}
    />
  )
}

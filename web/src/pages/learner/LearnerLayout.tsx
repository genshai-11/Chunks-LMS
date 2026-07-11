import { BookMarked, ChartColumn, ClipboardCheck, Home } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { ClassContextSelect } from '../../components/ClassContextSelect'
import { RoleWorkspace } from '../../components/RoleWorkspace'
import { UserAvatar } from '../../components/UserAvatar'
import { useLearnerClassContext } from '../../hooks/useLearnerClassContext'

const ITEMS = [
  { to: '/learner', label: 'Home', icon: Home, end: true },
  { to: '/learner/enrollments', label: 'My classes', icon: BookMarked },
  { to: '/learner/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/learner/analysis', label: 'Analysis', icon: ChartColumn },
]

export function LearnerLayout() {
  const {
    learner,
    options,
    classRow,
    course,
    activeClassId,
    setActiveLearnerClassId,
    hasMultiple,
  } = useLearnerClassContext()

  // Share-link session required — no Clerk for learners
  if (!learner) {
    return <Navigate to="/access" replace />
  }

  const subtitle = classRow
    ? `${classRow.name}${course?.code ? ` · ${course.code}` : ''}`
    : 'No active class'

  return (
    <RoleWorkspace
      title="Learning"
      subtitle={subtitle}
      leading={
        <UserAvatar name={learner.displayName} avatarUrl={learner.avatarUrl} size="md" />
      }
      contextSlot={
        hasMultiple || options.length > 0 ? (
          <ClassContextSelect
            variant="learner"
            options={options}
            value={activeClassId}
            onChange={(id) => setActiveLearnerClassId(id)}
            compact
          />
        ) : undefined
      }
      navLabel="Learner menu"
      items={ITEMS}
    />
  )
}

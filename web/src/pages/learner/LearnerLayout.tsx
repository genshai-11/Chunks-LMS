import { BookMarked, ChartColumn, Home, TrendingUp } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { ClassContextSelect } from '../../components/ClassContextSelect'
import { RoleWorkspace } from '../../components/RoleWorkspace'
import { EditableAvatar } from '../../components/EditableAvatar'
import { useLearnerClassContext } from '../../hooks/useLearnerClassContext'
import { useAppState } from '../../state/useAppState'
import { updateUserProfile } from '../../modules/roster/service'

const ITEMS = [
  { to: '/learner', label: 'Home', icon: Home, end: true },
  { to: '/learner/enrollments', label: 'My classes', icon: BookMarked },
  { to: '/learner/analysis', label: 'Progress Analysis', icon: ChartColumn },
  { to: '/learner/test-analysis', label: 'Live Test Analysis', icon: TrendingUp },
]

export function LearnerLayout() {
  const { roster, setRoster, syncNow } = useAppState()
  const {
    learner,
    options,
    classRow,
    course,
    activeClassId,
    setActiveLearnerClassId,
    hasMultiple,
  } = useLearnerClassContext()

  // Signed learner access required — no Supabase Auth account for learners
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
        <EditableAvatar
          name={learner.displayName}
          avatarUrl={learner.avatarUrl}
          size="md"
          onSave={async (url) => {
            const r = updateUserProfile(roster, learner.id, { avatarUrl: url })
            if (r.ok) {
              setRoster(r.state)
              await syncNow({ roster: r.state })
            }
          }}
        />
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

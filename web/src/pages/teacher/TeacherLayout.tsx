import { Archive, ChartColumn, Radio, School, Users } from 'lucide-react'
import { ClassContextSelect } from '../../components/ClassContextSelect'
import { RoleWorkspace } from '../../components/RoleWorkspace'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { useAppState } from '../../state/useAppState'
import { useStaffSession } from '../../auth/useStaffSession'
import { updateUserProfile } from '../../modules/roster/service'
import { EditableAvatar } from '../../components/EditableAvatar'

const ITEMS = [
  { to: '/teacher', label: 'Learners', icon: Users, end: true },
  { to: '/teacher/classes', label: 'Classes', icon: School },
  { to: '/teacher/session', label: 'Live session', icon: Radio },
  { to: '/teacher/archive', label: 'Archive', icon: Archive },
  { to: '/teacher/analysis', label: 'Analysis', icon: ChartColumn },
]

export function TeacherLayout() {
  const { roster, setRoster, syncNow, scheduling, capture } = useAppState()
  const staffSession = useStaffSession()
  const { options, classRow, seats, activeClassId, setActiveClassId } = useTeacherClassContext()

  const currentUser = roster.users.find(
    (user) =>
      Boolean(staffSession.email) &&
      user.email?.toLowerCase() === staffSession.email?.toLowerCase(),
  )

  const liveOpen = Boolean(
    classRow &&
    scheduling.learningSessions.some((s) => s.classId === classRow.id && s.status === 'open') &&
    capture?.sessionStatus === 'open',
  )

  const items = ITEMS.map((item) =>
    item.to === '/teacher/session' && liveOpen ? { ...item, label: 'Live · resume' } : item,
  )

  return (
    <RoleWorkspace
      title="Teaching"
      subtitle={
        classRow
          ? `${seats} learners · cap ${classRow.capacity}${liveOpen ? ' · LIVE' : ''}`
          : 'No class assigned'
      }
      leading={
        currentUser ? (
          <EditableAvatar
            name={currentUser.displayName}
            avatarUrl={currentUser.avatarUrl}
            size="md"
            onSave={async (url) => {
              const r = updateUserProfile(roster, currentUser.id, { avatarUrl: url })
              if (r.ok) {
                setRoster(r.state)
                await syncNow({ roster: r.state })
              }
            }}
          />
        ) : undefined
      }
      contextSlot={
        <ClassContextSelect
          variant="teacher"
          options={options}
          value={activeClassId}
          onChange={(id) => setActiveClassId(id)}
          compact
        />
      }
      navLabel="Teacher menu"
      items={items}
    />
  )
}


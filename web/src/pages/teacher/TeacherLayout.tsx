import { Archive, CalendarDays, ChartColumn, Home, Radio, School } from 'lucide-react'
import { ClassContextSelect } from '../../components/ClassContextSelect'
import { RoleWorkspace } from '../../components/RoleWorkspace'
import { useTeacherClassContext } from '../../hooks/useTeacherClassContext'
import { useAppState } from '../../state/useAppState'

const ITEMS = [
  { to: '/teacher', label: 'Home', icon: Home, end: true },
  { to: '/teacher/classes', label: 'Classes', icon: School },
  { to: '/teacher/calendar', label: 'Schedule', icon: CalendarDays },
  { to: '/teacher/session', label: 'Live session', icon: Radio },
  { to: '/teacher/archive', label: 'Archive', icon: Archive },
  { to: '/teacher/analysis', label: 'Analysis', icon: ChartColumn },
]

export function TeacherLayout() {
  const { scheduling, capture } = useAppState()
  const { options, classRow, seats, activeClassId, setActiveClassId } = useTeacherClassContext()

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
          ? `${seats}/${classRow.capacity} seats${liveOpen ? ' · LIVE' : ''}`
          : 'No class assigned'
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

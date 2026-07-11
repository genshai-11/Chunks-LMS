import {
  BookOpen,
  ChartColumn,
  ClipboardCheck,
  Gauge,
  History,
  LayoutDashboard,
  Radio,
  School,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { RoleWorkspace } from '../../components/RoleWorkspace'
import { useAppState } from '../../state/useAppState'

const ITEMS = [
  { to: '/admin', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/admin/ops', label: 'Ops', icon: Radio },
  { to: '/admin/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/admin/audit', label: 'Audit', icon: History },
  { to: '/admin/integrity', label: 'Integrity', icon: ShieldCheck },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/classes', label: 'Classes', icon: School },
  { to: '/admin/people', label: 'People', icon: Users },
  { to: '/admin/enrollments', label: 'Enrollments', icon: UserPlus },
  { to: '/admin/analysis', label: 'Analysis', icon: ChartColumn },
  { to: '/admin/metrics', label: 'Metrics', icon: Gauge },
]

export function AdminLayout() {
  const { roster } = useAppState()

  return (
    <RoleWorkspace
      title="Admin"
      subtitle={roster.organization.name}
      navLabel="Admin menu"
      items={ITEMS}
    />
  )
}

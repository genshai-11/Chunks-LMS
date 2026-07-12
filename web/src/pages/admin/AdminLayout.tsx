import {
  ChartColumn,
  Gauge,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { RoleWorkspace } from '../../components/RoleWorkspace'
import { useAppState } from '../../state/useAppState'

/** Admin owns accounts + metrics only; courses/classes live under Teacher. */
const ITEMS = [
  { to: '/admin', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/admin/people', label: 'Accounts', icon: Users },
  { to: '/admin/metrics', label: 'Metrics', icon: Gauge },
  { to: '/admin/analysis', label: 'Analysis', icon: ChartColumn },
  { to: '/admin/integrity', label: 'Integrity', icon: ShieldCheck },
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

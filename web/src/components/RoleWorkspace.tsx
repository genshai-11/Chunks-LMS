import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Circle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SectionTab } from './SectionTabs'

type Props = {
  title: string
  subtitle?: string
  /** Optional avatar or badge shown above the sidebar title */
  leading?: ReactNode
  navLabel: string
  items: SectionTab[]
  footer?: string
}

export function RoleWorkspace({ title, subtitle, leading, navLabel, items, footer }: Props) {
  const location = useLocation()

  return (
    <div className="workspace">
      <aside className="sidebar" aria-label={navLabel}>
        {leading ? <div className="sidebar-leading">{leading}</div> : null}
        <div className="sidebar-label">{title}</div>
        {subtitle ? <p className="sidebar-subtitle">{subtitle}</p> : null}
        {items.map((item) => {
          const Icon = item.icon ?? Circle
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
            >
              <Icon className="sidebar-icon" aria-hidden strokeWidth={1.75} />
              {item.label}
            </NavLink>
          )
        })}
        {footer ? <div className="sidebar-foot">{footer}</div> : null}
      </aside>

      <div className="workspace-main">
        <nav className="mobile-nav" aria-label={navLabel}>
          {items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'is-active' : undefined)}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden strokeWidth={1.75} /> : null}
                {item.label}
              </NavLink>
            )
          })}
        </nav>
        <div className="page">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="stack-lg"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

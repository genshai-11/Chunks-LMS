import {
  Cloud,
  CloudOff,
  GraduationCap,
  Loader2,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthChrome } from '../auth/AuthProvider'
import { useAppState } from '../state/useAppState'

const ROLES = [
  { to: '/admin', label: 'Admin', icon: Shield },
  { to: '/teacher', label: 'Teacher', icon: Users },
  { to: '/learner', label: 'Learner', icon: GraduationCap },
]

function BackendBadge() {
  const {
    backendStatus,
    backendError,
    lastSyncedAt,
    syncNow,
    reloadFromSupabase,
    supabaseEnabled,
  } = useAppState()

  if (!supabaseEnabled) {
    return (
      <span className="backend-badge is-offline" title="Supabase env not set">
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        Local only
      </span>
    )
  }

  const label =
    backendStatus === 'booting'
      ? 'Connecting…'
      : backendStatus === 'syncing'
        ? 'Syncing…'
        : backendStatus === 'online'
          ? 'Supabase'
          : backendStatus === 'error'
            ? 'Sync error'
            : 'Offline'

  const title =
    backendError ??
    (lastSyncedAt ? `Last sync ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Supabase')

  return (
    <div className="backend-cluster">
      <span
        className={`backend-badge is-${backendStatus}`}
        title={title}
      >
        {backendStatus === 'syncing' || backendStatus === 'booting' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : backendStatus === 'error' || backendStatus === 'offline' ? (
          <CloudOff className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <Cloud className="h-3.5 w-3.5" aria-hidden />
        )}
        {label}
      </span>
      <button
        type="button"
        className="backend-icon-btn"
        title="Reload from Supabase"
        onClick={() => void reloadFromSupabase()}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      </button>
      <button
        type="button"
        className="backend-icon-btn"
        title="Push now"
        onClick={() => void syncNow()}
      >
        <Cloud className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const focusMode = pathname === '/teacher/observe'

  if (focusMode) {
    return <div className="shell shell-focus">{children}</div>
  }

  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="topbar-brand" end aria-label="Chunks LMS home">
          <img
            src="/logo.png"
            alt=""
            className="topbar-logo"
            width={120}
            height={36}
            decoding="async"
          />
          <span className="topbar-brand-text">Chunks LMS</span>
        </NavLink>

        <nav className="topbar-roles" aria-label="Switch role">
          {ROLES.map((r) => {
            const Icon = r.icon
            return (
              <NavLink
                key={r.to}
                to={r.to}
                className={({ isActive }) => `topbar-role${isActive ? ' is-active' : ''}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden strokeWidth={1.75} />
                {r.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="topbar-actions">
          <BackendBadge />
          <AuthChrome>
            <span className="sr-only">Account</span>
          </AuthChrome>
        </div>
      </header>
      {children}
    </div>
  )
}

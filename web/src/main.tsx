import { ClerkProvider } from '@clerk/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import {
  BypassStaffSessionProvider,
  ClerkStaffSessionProvider,
} from './auth/StaffSessionContext'
import { env } from './env'
import './index.css'

function Root() {
  if (!env.canBoot) {
    const vercelEnv = String(import.meta.env.VITE_VERCEL_ENV ?? '').trim() || 'local'
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white p-4 text-center">
        <div className="max-w-md p-6 bg-slate-900 rounded-2xl border border-white/10 shadow-xl">
          <h2 className="text-xl font-bold mb-2 font-display">Staff auth not configured</h2>
          <p className="text-sm text-slate-400">
            Set <code className="text-slate-200">VITE_CLERK_PUBLISHABLE_KEY</code> for Admin/Teacher
            sign-in, or <code className="text-slate-200">VITE_AUTH_BYPASS=true</code> for local/CI
            demos only.
          </p>
          <p className="text-sm text-slate-500 mt-3">
            Learners use share links at <code className="text-slate-300">/access</code> and do not
            need Clerk.
          </p>
          <p className="text-xs text-slate-600 mt-4 font-mono">
            env={vercelEnv} · clerk={env.clerkPublishableKey ? 'set' : 'missing'} · bypass=
            {env.authBypass ? 'on' : 'off'}
          </p>
          {vercelEnv === 'production' ? (
            <p className="text-xs text-amber-500/90 mt-2">
              Production ignores VITE_AUTH_BYPASS. Add the Clerk publishable key in Vercel →
              Settings → Environment Variables, then Redeploy.
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  if (env.clerkPublishableKey) {
    return (
      <ClerkProvider publishableKey={env.clerkPublishableKey} afterSignOutUrl="/">
        <ClerkStaffSessionProvider>
          <App />
        </ClerkStaffSessionProvider>
      </ClerkProvider>
    )
  }

  // Auth bypass without Clerk key (CI / offline demo)
  return (
    <BypassStaffSessionProvider>
      <App />
    </BypassStaffSessionProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

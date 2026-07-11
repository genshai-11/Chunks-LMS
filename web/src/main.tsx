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

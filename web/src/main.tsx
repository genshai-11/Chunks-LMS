import { ClerkProvider } from '@clerk/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { env } from './env'
import './index.css'

const app = <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {env.clerkPublishableKey ? (
      <ClerkProvider publishableKey={env.clerkPublishableKey} afterSignOutUrl="/">
        {app}
      </ClerkProvider>
    ) : (
      <div className="flex items-center justify-center min-h-screen bg-slate-950 text-white p-4 text-center">
        <div className="max-w-md p-6 bg-slate-900 rounded-2xl border border-white/10 shadow-xl">
          <h2 className="text-xl font-bold mb-2 font-display">Clerk publishable key missing</h2>
          <p className="text-sm text-slate-400">
            Please configure VITE_CLERK_PUBLISHABLE_KEY in your environment to load the application.
          </p>
        </div>
      </div>
    )}
  </StrictMode>,
)

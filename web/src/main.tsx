import { ClerkProvider } from '@clerk/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { env } from './env'
import './index.css'

const app = <App />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {env.clerkPublishableKey && !env.authBypass ? (
      <ClerkProvider publishableKey={env.clerkPublishableKey} afterSignOutUrl="/">
        {app}
      </ClerkProvider>
    ) : (
      app
    )}
  </StrictMode>,
)

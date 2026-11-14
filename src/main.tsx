import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './lib/apiKey' // Purge legacy plaintext BYOK credentials on app startup.
import './styles/globals.css'
import './styles/visual-refresh.css'
import './styles/community.css'
import { router } from './router'
import { registerPwaUpdates } from './lib/pwa'

registerPwaUpdates()

const container = document.getElementById('root')
if (!container) throw new Error('Root element missing from index.html')

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

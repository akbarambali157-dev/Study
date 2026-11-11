import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/globals.css'
import { router } from './router'

// Iterator is an ES2025 global used by pdf.js v6. Browsers that don't ship it
// crash with "ReferenceError: Iterator is not defined" the moment a PDF is
// opened. Shim it before anything else loads.
const _g = globalThis as typeof globalThis & { Iterator?: Function }
if (typeof _g.Iterator === 'undefined') {
  _g.Iterator = function Iterator() {}
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

const container = document.getElementById('root')
if (!container) throw new Error('Root element missing from index.html')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)

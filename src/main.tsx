import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { UPDATE_PARAM } from './buildInfo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Offline support. Only in the production build: during development a service
// worker would serve stale files and make changes look like they didn't apply.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Not fatal: the app just won't work offline.
    })
  })
}

// Drop the cache-busting address "Update" used, so the address bar and bookmarks stay clean.
const here = new URL(window.location.href)
if (here.searchParams.has(UPDATE_PARAM)) {
  here.searchParams.delete(UPDATE_PARAM)
  window.history.replaceState(null, '', here.pathname + here.search + here.hash)
}

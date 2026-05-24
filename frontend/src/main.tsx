import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from "next-themes"
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'

// TanStack Query client — 5 min stale time, 1 retry on failure
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 minutes
      gcTime: 24 * 60 * 60 * 1000, // 24 hours — keep cache alive for persister
      retry: 1,
    },
  },
})

// Persist the query cache to localStorage so page refreshes don't clear it.
// Only queries with gcTime > 0 are persisted (all of them by default above).
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'keil-query-cache',
  // Throttle writes to avoid hammering localStorage on rapid updates
  throttleTime: 1000,
})

// Provider order:
// PersistQueryClientProvider → outermost so TanStack hooks work everywhere
// BrowserRouter              → routing
// AuthProvider               → Supabase session (must wrap AppProvider)
// AppProvider                → org/space context (requires auth session)
// ThemeProvider              → theme
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
          buster: import.meta.env.VITE_CACHE_BUSTER ?? 'v1',
        }}
      >
        <BrowserRouter>
          <AuthProvider>
            <AppProvider>
              <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
                <App />
              </ThemeProvider>
            </AppProvider>
          </AuthProvider>
        </BrowserRouter>
        {/* Only rendered in development builds */}
        <ReactQueryDevtools initialIsOpen={false} />
      </PersistQueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>,
)

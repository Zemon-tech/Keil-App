import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from "next-themes"
import { QueryClient, Query } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del, createStore } from 'idb-keyval'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'
import { RootErrorBoundary } from './components/RootErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'
import { NotificationProvider } from './contexts/NotificationContext'

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

// Custom IndexedDB store mapping
const customStore = createStore('keil-database', 'query-cache');

// Persist the query cache to IndexedDB so page refreshes don't clear it.
// Only queries with gcTime > 0 are persisted (all of them by default above).
const persister = createAsyncStoragePersister({
  serialize: JSON.stringify,
  deserialize: JSON.parse,
  storage: {
    getItem: (key) => get(key, customStore),
    setItem: (key, value) => set(key, value, customStore),
    removeItem: (key) => del(key, customStore),
  },
  // Throttle writes to avoid hammering IndexedDB on rapid updates
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
          dehydrateOptions: {
            shouldDehydrateQuery: (query: Query) => {
              // Exclude chat logs, comments, and activity histories from IndexedDB persistence to keep cache clean & compact
              const queryKey = query.queryKey;
              const skipKeys = ['chat', 'comments', 'activities'];
              const shouldSkip = skipKeys.some(key => queryKey.includes(key));
              return query.state.status === 'success' && !shouldSkip;
            }
          }
        }}
      >
        <BrowserRouter>
          <AuthProvider>
            <AppProvider>
              <NotificationProvider>
                <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
                  <App />
                </ThemeProvider>
              </NotificationProvider>
            </AppProvider>
          </AuthProvider>
        </BrowserRouter>
        {/* Only rendered in development builds */}
        <ReactQueryDevtools initialIsOpen={false}  />
      </PersistQueryClientProvider>
    </RootErrorBoundary>
  </StrictMode>,
)

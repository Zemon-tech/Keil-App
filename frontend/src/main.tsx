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
import { SubscriptionProvider } from './contexts/SubscriptionContext'
import { supabase } from './lib/supabase'

// TanStack Query client — 5 min stale time, 1 retry on failure
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 24 * 60 * 60 * 1000, // 24 hours — keep cache alive for persister
      retry: 1,
    },
  },
})

// ── Per-user IndexedDB cache isolation ───────────────────────────────────────
// The store name includes the authenticated user's ID so that if a different
// user logs in on the same browser, they get a completely separate cache.
// On initial load (before auth resolves) we use a 'pending' store that will
// be swapped once auth is known.
async function getUserScopedCacheKey(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return `keil-cache-${session.user.id}`;
    }
  } catch { /* fall through */ }
  return 'keil-database'; // fallback for unauthenticated state
}

// Build persister with dynamic store switching
async function buildPersister() {
  return createAsyncStoragePersister({
    serialize: JSON.stringify,
    deserialize: JSON.parse,
    storage: {
      getItem: async (key) => {
        const cacheKey = await getUserScopedCacheKey();
        const customStore = createStore(cacheKey, "query-cache");
        return get(key, customStore);
      },
      setItem: async (key, value) => {
        const cacheKey = await getUserScopedCacheKey();
        const customStore = createStore(cacheKey, "query-cache");
        return set(key, value, customStore);
      },
      removeItem: async (key) => {
        const cacheKey = await getUserScopedCacheKey();
        const customStore = createStore(cacheKey, "query-cache");
        return del(key, customStore);
      },
    },
    // Throttle writes to avoid hammering IndexedDB on rapid updates
    throttleTime: 1000,
  });
}

// Provider order:
// PersistQueryClientProvider → outermost so TanStack hooks work everywhere
// BrowserRouter              → routing
// AuthProvider               → Supabase session (must wrap AppProvider)
// AppProvider                → org/space context (requires auth session)
// ThemeProvider              → theme
buildPersister().then((persister) => {
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
                <SubscriptionProvider>
                  <NotificationProvider>
                    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
                      <App />
                    </ThemeProvider>
                  </NotificationProvider>
                </SubscriptionProvider>
              </AppProvider>
            </AuthProvider>
          </BrowserRouter>
          {/* Only rendered in development builds */}
          <ReactQueryDevtools initialIsOpen={false}  />
        </PersistQueryClientProvider>
      </RootErrorBoundary>
    </StrictMode>,
  )
});

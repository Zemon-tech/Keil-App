import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from "next-themes"
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'
import { NotificationProvider } from './contexts/NotificationContext'

// TanStack Query client — 5 min stale time, 1 retry on failure
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

// Provider order:
// QueryClientProvider  → outermost so TanStack hooks work everywhere
// BrowserRouter        → routing
// AuthProvider         → Supabase session (must wrap AppProvider)
// AppProvider          → org/space context (requires auth session)
// NotificationProvider → custom notifications hook context
// ThemeProvider        → theme
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
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
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)

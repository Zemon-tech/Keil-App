import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogoLoader } from "@/components/LogoLoader";
import { PublicTaskView } from "@/components/tasks/PublicTaskView";
import { usePublicTask } from "@/hooks/api/usePublicTask";

/**
 * TaskDetailRoute
 *
 * Route handler for /tasks/:taskId and /events/:eventId deep links.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Auth state        │  Rendering                                 │
 * │───────────────────────────────────────────────────────────────  │
 * │  Loading           │  Minimal spinner (no 8s splash)            │
 * │  Authenticated     │  null — React Router serves the            │
 * │                    │  ProtectedRoute > Layout > TasksPage path   │
 * │                    │  which keeps the global Layout (and         │
 * │                    │  MeetingDialog) alive during navigation.    │
 * │  Not authenticated │  PublicTaskView (read-only, no sidebar)     │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * WHY authenticated users return null here:
 * App.tsx defines /tasks/:taskId BOTH at the top level (this route) and
 * inside ProtectedRoute > Layout. React Router matches routes in order.
 * When the user IS authenticated, ProtectedRoute has already rendered the
 * correct Layout + TasksPage subtree, so this component is never reached.
 * If it ever is, returning null is safe — the URL is correct and the
 * ProtectedRoute subtree will handle it on the next render cycle.
 */
export function TaskDetailRoute() {
  const { user, loading: authLoading } = useAuth();
  const { taskId, eventId } = useParams<{ taskId?: string; eventId?: string }>();
  const taskIdToFetch = taskId ?? eventId;

  // Fetch public data only when user is NOT authenticated.
  // For authenticated users this hook stays disabled.
  const {
    data: publicTask,
    isLoading: isPublicLoading,
    isError: isPublicError,
  } = usePublicTask(taskIdToFetch, !authLoading && !user);

  // ── Still determining auth state ───────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <LogoLoader size={180} label="Loading" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  // ── Authenticated user → the ProtectedRoute > Layout path handles this ─────
  // This component should not be reached for authenticated users because
  // App.tsx places /tasks/:taskId inside ProtectedRoute > Layout as well.
  // Return null as a safe no-op; the correct subtree is already rendered.
  if (user) {
    return null;
  }

  // ── Unauthenticated visitor → render public read-only view ─────────────────
  return (
    <PublicTaskView
      isLoading={isPublicLoading}
      isNotFound={isPublicError}
      task={publicTask}
    />
  );
}

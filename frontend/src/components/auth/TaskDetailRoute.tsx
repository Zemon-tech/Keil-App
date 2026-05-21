import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogoLoader } from "@/components/LogoLoader";
import { Layout } from "@/components/Layout";
import { TasksPage } from "@/components/TasksPage";
import { PublicTaskView } from "@/components/tasks/PublicTaskView";
import { usePublicTask } from "@/hooks/api/usePublicTask";

/**
 * TaskDetailRoute
 *
 * Smart route wrapper for /tasks/:taskId and /events/:eventId.
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │  Auth state       │  Rendering                              │
 * │─────────────────────────────────────────────────────────────│
 * │  Loading          │  Minimal spinner (no 8s splash)         │
 * │  Authenticated    │  Full Layout + TasksPage (no change)    │
 * │  Not authenticated│  PublicTaskView (read-only, no sidebar) │
 * └─────────────────────────────────────────────────────────────┘
 *
 * The existing ProtectedRoute splash (LogoLoader) only fires for the
 * main app shell. Deep-link visitors — whether logged in or not — get a
 * lightweight spinner and then the appropriate view immediately.
 */
export function TaskDetailRoute() {
  const { user, loading: authLoading } = useAuth();
  const { taskId, eventId } = useParams<{ taskId?: string; eventId?: string }>();
  const taskIdToFetch = taskId ?? eventId;

  // Fetch public data only when user is NOT authenticated.
  // For authenticated users this hook stays disabled — they get full TasksPage.
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

  // ── Authenticated user → render full interactive app ───────────────────────
  if (user) {
    return (
      <Layout>
        <TasksPage />
      </Layout>
    );
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

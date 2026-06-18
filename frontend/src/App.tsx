import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import "./App.css";
import { Layout } from "./components/Layout";
import { AuthPage } from "./components/auth/AuthPage";
import { Dashboard } from "./components/Dashboard";
import { TasksPage } from "./components/TasksPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useAuth } from "./contexts/AuthContext";
import { InvitePage } from "./components/workspace/InvitePage";

import { MotionPage } from "./components/motion/MotionPage";
import { MotionHome } from "./components/motion/MotionHome";
import { MotionProfile } from "./components/motion/MotionProfile";
import { MotionPublicPage } from "./components/motion/MotionPublicPage";
import { useMotionStore } from "./store/useMotionStore";
import { BillingPage } from "./components/billing/BillingPage";

import { useAppContext } from "./contexts/AppContext";

/**
 * Redirects /motion to the last opened page if one exists,
 * otherwise falls through to MotionHome.
 */
function MotionIndexRoute() {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const lastOpenedPages = useMotionStore((s) => s.lastOpenedPages);
  const [searchParams] = useSearchParams();
  const isHomeRequested = searchParams.get("home") === "true";

  const key = activeOrgId && activeSpaceId ? `${activeOrgId}:${activeSpaceId}` : "";
  const lastOpenedPageId = lastOpenedPages[key];

  if (lastOpenedPageId && !isHomeRequested) {
    return <Navigate to={`/motion/${lastOpenedPageId}`} replace />;
  }
  return <MotionHome />;
}



/**
 * Main application component.
 * Configures application routes and protected access.
 *
 * ROUTING DESIGN:
 *
 * /tasks/:taskId and /events/:eventId live INSIDE ProtectedRoute > Layout so
 * the global <Layout> (which contains <MeetingDialog />) is never unmounted
 * when the user navigates into a task detail pane. Previously these routes were
 * outside Layout (served by a top-level TaskDetailRoute that mounted its own
 * Layout), which caused the MeetingDialog cleanup to fire and kill the recording.
 *
 * PUBLIC DEEP LINKS (unauthenticated visitors on /tasks/:id or /events/:id):
 * ProtectedRoute detects these paths and renders TaskDetailRoute → PublicTaskView
 * directly instead of redirecting to /login. See ProtectedRoute.tsx for details.
 */
function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* ── Auth ──────────────────────────────────────────────────────────── */}
      <Route
        path="/login"
        element={!user ? <AuthPage /> : <Navigate to="/" replace />}
      />

      {/* ── Public Motion pages (no auth, no layout) ─────────────────────── */}
      <Route path="/notes/public/:token" element={<MotionPublicPage mode="token" />} />
      <Route path="/motion/:slug/:pageId" element={<MotionPublicPage mode="pageId" />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route
            path="/"
            element={<Dashboard />}
          />
          <Route
            path="/c/:threadId"
            element={<Dashboard />}
          />
          {/* /tasks and /events without an ID → task list + calendar */}
          <Route
            path="/tasks"
            element={<TasksPage />}
          />
          <Route
            path="/events"
            element={<TasksPage />}
          />
          {/*
            /tasks/:taskId and /events/:eventId for authenticated users.
            MUST stay inside Layout so the global MeetingDialog is never
            unmounted during task navigation — keeping recording sessions alive.
            TasksPage reads useParams() for the taskId/eventId param.
          */}
          <Route
            path="/tasks/:taskId"
            element={<TasksPage />}
          />
          <Route
            path="/events/:eventId"
            element={<TasksPage />}
          />
          <Route
            path="/motion"
            element={<MotionIndexRoute />}
          />
          <Route
            path="/motion/profile"
            element={<MotionProfile />}
          />
          <Route
            path="/motion/:pageId"
            element={<MotionPage />}
          />
          <Route
            path="/billing"
            element={<BillingPage />}
          />
        </Route>
        <Route
          path="/my-tasks"
          element={<Navigate to="/tasks" replace />}
        />
        {/* New Meetings route - redirect to motion */}
        <Route
          path="/meetings/*"
          element={<Navigate to="/motion" replace />}
        />
        <Route
          path="/schedule"
          element={<Navigate to="/tasks" replace />}
        />
        <Route path="/invite/:token" element={<InvitePage />} />
        {/* Add more protected routes here */}
      </Route>

      {/* ── Catch-all — redirect to home ─────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;

import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import "./App.css";
import { Layout } from "./components/Layout";
import { AuthPage } from "./components/auth/AuthPage";
import { Dashboard } from "./components/Dashboard";
import { TasksPage } from "./components/TasksPage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { TaskDetailRoute } from "./components/auth/TaskDetailRoute";
import { useAuth } from "./contexts/AuthContext";
import { InvitePage } from "./components/workspace/InvitePage";

import { MotionPage } from "./components/motion/MotionPage";
import { MotionHome } from "./components/motion/MotionHome";
import { MotionProfile } from "./components/motion/MotionProfile";
import { MotionPublicPage } from "./components/motion/MotionPublicPage";
import { useMotionStore } from "./store/useMotionStore";

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
  return (
    <Layout>
      <MotionHome />
    </Layout>
  );
}



/**
 * Main application component.
 * Configures application routes and protected access.
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

      {/* ── Public task / event deep links ───────────────────────────────── */}
      {/* These routes are auth-AWARE (not auth-required).                  */}
      {/* Authenticated  → full interactive Layout + TasksPage.             */}
      {/* Unauthenticated → read-only PublicTaskView, no redirect to login. */}
      <Route path="/tasks/:taskId" element={<TaskDetailRoute />} />
      <Route path="/events/:eventId" element={<TaskDetailRoute />} />

      {/* ── Public Motion pages (no auth, no layout) ─────────────────────── */}
      <Route path="/notes/public/:token" element={<MotionPublicPage mode="token" />} />
      <Route path="/motion/:slug/:pageId" element={<MotionPublicPage mode="pageId" />} />

      {/* ── Protected Routes ─────────────────────────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        {/* /tasks and /events without an ID → task list + calendar */}
        <Route
          path="/tasks"
          element={
            <Layout>
              <TasksPage />
            </Layout>
          }
        />

        <Route
          path="/events"
          element={
            <Layout>
              <TasksPage />
            </Layout>
          }
        />
        <Route
          path="/my-tasks"
          element={<Navigate to="/tasks" replace />}
        />
        <Route
          path="/motion"
          element={<MotionIndexRoute />}
        />
        <Route
          path="/motion/profile"
          element={
            <Layout>
              <MotionProfile />
            </Layout>
          }
        />
        <Route
          path="/motion/:pageId"
          element={
            <Layout>
              <MotionPage />
            </Layout>
          }
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

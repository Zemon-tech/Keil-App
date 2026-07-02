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
import { SharedMotionViewer } from "./components/motion/SharedMotionViewer";
import { useMotionStore } from "./store/useMotionStore";

import { useAppContext } from "./contexts/AppContext";
import { MobileBlocker } from "./components/MobileBlocker";

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
 * All standard application routes — wrapped in MobileBlocker so the workspace
 * is desktop-only. Public and shared Motion viewer routes are NOT in here.
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
function InnerApp() {
  const { user } = useAuth();

  return (
    <MobileBlocker>
      <Routes>
        {/* ── Auth ──────────────────────────────────────────────────────────── */}
        <Route
          path="/login"
          element={!user ? <AuthPage /> : <Navigate to="/" replace />}
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/c/:threadId" element={<Dashboard />} />

            {/* /tasks and /events without an ID → task list + calendar */}
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/events" element={<TasksPage />} />

            {/*
              /tasks/:taskId and /events/:eventId for authenticated users.
              MUST stay inside Layout so the global MeetingDialog is never
              unmounted during task navigation — keeping recording sessions alive.
              TasksPage reads useParams() for the taskId/eventId param.
            */}
            <Route path="/tasks/:taskId" element={<TasksPage />} />
            <Route path="/events/:eventId" element={<TasksPage />} />

            <Route path="/motion" element={<MotionIndexRoute />} />
            <Route path="/motion/profile" element={<MotionProfile />} />
            <Route path="/motion/:pageId" element={<MotionPage />} />
            <Route path="/billing" element={<Navigate to="/?success=true" replace />} />
          </Route>

          <Route path="/my-tasks" element={<Navigate to="/tasks" replace />} />
          {/* New Meetings route - redirect to motion */}
          <Route path="/meetings/*" element={<Navigate to="/motion" replace />} />
          <Route path="/schedule" element={<Navigate to="/tasks" replace />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          {/* Add more protected routes here */}
        </Route>

        {/* ── Catch-all — redirect to home ─────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MobileBlocker>
  );
}

/**
 * Root app component.
 *
 * Public Motion pages and the authenticated Shared Motion Viewer are declared
 * BEFORE <InnerApp> so they are matched first and rendered WITHOUT MobileBlocker.
 * This makes them fully accessible on mobile, tablet, and desktop.
 *
 * All other routes fall through to <InnerApp> which enforces the desktop-only
 * MobileBlocker for the main workspace.
 */
function App() {
  return (
    <Routes>
      {/* ── Public Motion viewer (unauthenticated, no MobileBlocker) ─────── */}
      <Route path="/notes/public/:token" element={<MotionPublicPage mode="token" />} />
      <Route path="/motion/:slug/:pageId" element={<MotionPublicPage mode="pageId" />} />

      {/* ── Authenticated Shared Motion Viewer (no MobileBlocker) ──────────── */}
      {/* Recipients access space-shared pages here — mobile/tablet friendly.   */}
      <Route path="/shared/:pageId" element={<SharedMotionViewer />} />

      {/* ── All other routes — desktop-only via MobileBlocker ──────────────── */}
      <Route path="*" element={<InnerApp />} />
    </Routes>
  );
}

export default App;

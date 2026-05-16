import { Routes, Route, Navigate } from "react-router-dom";
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

/**
 * Main application component.
 * Configures application routes and protected access.
 */
function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={!user ? <AuthPage /> : <Navigate to="/" replace />}
      />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route
          path="/"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/tasks/:taskId?"
          element={
            <Layout>
              <TasksPage />
            </Layout>
          }
        />
        <Route
          path="/events/:eventId?"
          element={
            <Layout>
              <TasksPage />
            </Layout>
          }
        />
        <Route
          path="/motion"
          element={
            <Layout>
              <MotionHome />
            </Layout>
          }
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
        <Route
          path="/schedule"
          element={
            <Navigate to="/tasks" replace />
          }
        />
        <Route path="/invite/:token" element={<InvitePage />} />
        {/* Add more protected routes here */}
      </Route>

      {/* Public Motion page — no auth, no layout */}
      <Route path="/notes/public/:token" element={<MotionPublicPage />} />

      {/* Catch-all - Redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;


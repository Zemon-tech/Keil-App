import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { Layout } from "./components/Layout";
import { AuthPage } from "./components/auth/AuthPage";
import { Dashboard } from "./components/Dashboard";
import { ChatPage } from "./components/ChatPage";
import { TasksPage } from "./components/TasksPage";
import { SchedulePage } from "./components/SchedulePage";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { useAuth } from "./contexts/AuthContext";

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
          path="/chat"
          element={
            <Layout>
              <ChatPage />
            </Layout>
          }
        />
        <Route
          path="/tasks"
          element={
            <Layout>
              <TasksPage />
            </Layout>
          }
        />
        <Route
          path="/schedule"
          element={
            <Layout>
              <SchedulePage />
            </Layout>
          }
        />
        {/* Add more protected routes here */}
      </Route>

      {/* Catch-all - Redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;


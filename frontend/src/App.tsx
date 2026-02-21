import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { Layout } from "./components/Layout";
import { AuthPage } from "./components/auth/AuthPage";
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
              <div className="p-8">
                <h1 className="text-3xl font-bold font-heading">
                  Welcome back, {user?.user_metadata?.full_name || user?.email}
                </h1>
                <p className="text-muted-foreground mt-2">
                  You are successfully logged in and synced with MongoDB.
                </p>
              </div>
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


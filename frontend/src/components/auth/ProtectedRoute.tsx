import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogoLoader } from "@/components/LogoLoader";
import { TaskDetailRoute } from "@/components/auth/TaskDetailRoute";

/**
 * A wrapper component for protected routes.
 *
 * For authenticated users: renders the child routes via <Outlet />.
 * For unauthenticated users:
 *   - On task/event deep-link paths (/tasks/:id, /events/:id): renders
 *     TaskDetailRoute which shows PublicTaskView without requiring auth.
 *   - All other paths: redirects to /login.
 *
 * This avoids placing /tasks/:taskId in a separate top-level route that would
 * mount a new <Layout> instance and unmount the global one (killing the
 * MeetingDialog recording session).
 */
const ProtectedRoute: React.FC = () => {
    const { user, loading } = useAuth();
    const location = useLocation();
    const [splashDone, setSplashDone] = useState(false);

    useEffect(() => {
        const key = "keilapp:splashDone";
        const alreadyDone = sessionStorage.getItem(key) === "1";

        if (alreadyDone) {
            setSplashDone(true);
            return;
        }

        const timeoutId = window.setTimeout(() => {
            sessionStorage.setItem(key, "1");
            setSplashDone(true);
        }, 2000);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, []);

    if (!splashDone) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-6">
                <LogoLoader size={280} label="Loading application" />
                <p className="text-muted-foreground">Starting up...</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-6">
                <LogoLoader size={240} label="Loading auth state" />
                <p className="text-muted-foreground">Loading auth state...</p>
            </div>
        );
    }

    if (!user) {
        // For public task/event deep-links, render the public view instead of
        // redirecting to login. This allows unauthenticated users to view shared
        // tasks without being forced to sign in.
        const isTaskDeepLink = /^\/(tasks|events)\/[^/]+$/.test(location.pathname);
        if (isTaskDeepLink) {
            return <TaskDetailRoute />;
        }
        // All other unauthenticated routes → redirect to login
        return <Navigate to="/login" replace />;
    }

    // Render the child routes if authenticated
    return <Outlet />;
};

export default ProtectedRoute;

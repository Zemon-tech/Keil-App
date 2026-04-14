import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogoLoader } from "@/components/LogoLoader";

/**
 * A wrapper component for protected routes.
 * Redirects non-authenticated users to the login page.
 */
const ProtectedRoute: React.FC = () => {
    const { user, loading } = useAuth();
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
        }, 8000);

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
        // Redirect to login if not authenticated
        return <Navigate to="/login" replace />;
    }

    // Render the child routes if authenticated
    return <Outlet />;
};

export default ProtectedRoute;

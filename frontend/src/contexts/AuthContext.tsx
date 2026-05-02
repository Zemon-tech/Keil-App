import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import api from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";

/**
 * Type definition for the Authentication Context.
 */
interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    /** Call with `true` before signUp to suppress auto-login, then `false` after. */
    setSuppressAutoLogin: (value: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider component that wraps the app and manages Supabase authentication state.
 * Monitors session changes and provides the current user and session to the rest of the application.
 * 
 * @param children - React children components
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const suppressAutoLoginRef = useRef(false);

    const setSuppressAutoLogin = (value: boolean) => {
        suppressAutoLoginRef.current = value;
    };

    useEffect(() => {
        // Get initial session
        const getInitialSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                setSession(session);
                setUser(session?.user ?? null);
            } catch (err) {
                console.error("Failed to get session:", err);
            } finally {
                // Always stop loading, even if session fetch fails
                setLoading(false);
            }
        };

        getInitialSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                // If signup is in progress, suppress the auto-login session
                // so the user is forced to sign in explicitly.
                if (suppressAutoLoginRef.current && session) {
                    suppressAutoLoginRef.current = false;
                    await supabase.auth.signOut();
                    return;
                }

                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);

                // Sync with backend in background (non-blocking)
                if (session) {
                    connectSocket(session.access_token); // Start socket on login/page refresh
                    api.get('users/me').catch(err => console.error("Auth sync failed:", err));
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        disconnectSocket();            // MUST be called BEFORE signOut — JWT is still valid here
        await supabase.auth.signOut(); // then clear the Supabase session
    };

    const value = {
        session,
        user,
        loading,
        signOut,
        setSuppressAutoLogin,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to access the Authentication Context.
 * Must be used within an AuthProvider.
 * 
 * @returns The authentication context value
 */
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

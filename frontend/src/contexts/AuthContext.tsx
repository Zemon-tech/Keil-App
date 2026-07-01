import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import api from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { del, createStore } from "idb-keyval";
import { useMotionStore } from "@/store/useMotionStore";

export interface SessionRecord {
  id: string;          // unique session record ID in database
  loginAt: string;     // ISO timestamp of first login on this browser
  lastSeen: string;    // ISO timestamp of last active request
  userAgent: string;   // browser user-agent
  platform: string;    // navigator.platform
  isCurrent: boolean;  // whether this is the current active session
}

/**
 * Type definition for the Authentication Context.
 */
interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    /** True when the initial session check is complete AND a user is present. */
    isAuthenticated: boolean;
    signOut: () => Promise<void>;
    /** Signs out from ALL devices by revoking every refresh token. */
    signOutGlobal: () => Promise<void>;
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
    const queryClient = useQueryClient();

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
                    const socket = connectSocket(session.access_token); // Start socket on login/page refresh
                    
                    // Listen for real-time user profile updates (e.g., name or avatar changes)
                    socket.off("user_updated");
                    socket.on("user_updated", () => {
                        // Invalidate query caches to fetch fresh names/avatars
                        queryClient.invalidateQueries({ queryKey: ["me"] });
                        queryClient.invalidateQueries({ queryKey: ["orgs"] });
                        queryClient.invalidateQueries({ queryKey: ["spaces"] });
                        queryClient.invalidateQueries({ queryKey: ["chat"] });
                        queryClient.invalidateQueries({ queryKey: ["tasks"] });
                        queryClient.invalidateQueries({ queryKey: ["org-tasks"] });
                    });

                    api.get('users/me').catch(err => console.error("Auth sync failed:", err));
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const _clearLocalState = async () => {
        // 1. Clear active TanStack Query memory cache
        queryClient.clear();

        // 2. Clear persistent IndexedDB store cache for this specific user
        try {
            const cacheKey = user?.id ? `keil-cache-${user.id}` : "keil-database";
            const customStore = createStore(cacheKey, "query-cache");
            await del("keil-query-cache", customStore);
        } catch (e) {
            console.error("Failed to delete IndexedDB query cache on logout:", e);
        }

        // 3. Clear Zustand store's optimistic, routing cache and localStorage keys
        try {
            localStorage.removeItem("motion:lastOpenedPages");
            localStorage.removeItem("motion:recentlyOpenedPages");
            localStorage.removeItem("keil_active_org");
            localStorage.removeItem("keil_active_space");
            localStorage.removeItem("keil_browser_id");
        } catch { /* ignore */ }

        useMotionStore.setState({
            dirtyPageIds: new Set<string>(),
            lastOpenedPages: {},
            recentlyOpenedPages: {},
            sidebarOpen: true,
            drawerOpen: false,
            shareOpen: false
        });
    };

    /** Signs out this device only (other devices remain logged in). */
    const signOut = useCallback(async () => {
        disconnectSocket();            // MUST be called BEFORE signOut — JWT is still valid here
        try {
            await api.delete("/users/sessions/current");
        } catch (err) {
            console.error("Failed to revoke session on signout:", err);
        }
        await _clearLocalState();
        await supabase.auth.signOut(); // scope: 'local' by default
    }, [queryClient]);

    /**
     * Signs out from ALL devices by revoking every refresh token in Supabase.
     * Other devices will be kicked out on their next token validation.
     */
    const signOutGlobal = useCallback(async () => {
        disconnectSocket();
        try {
            await api.delete("/users/sessions");
        } catch (err) {
            console.error("Failed to revoke all sessions on global signout:", err);
        }
        await _clearLocalState();
        await supabase.auth.signOut({ scope: 'global' });
    }, [queryClient]);

    // Handle background session revocation events dispatched from the API client
    useEffect(() => {
        const handleSessionRevoked = () => {
            signOut();
        };
        window.addEventListener("keil-session-revoked", handleSessionRevoked);
        return () => window.removeEventListener("keil-session-revoked", handleSessionRevoked);
    }, [signOut]);

    const isAuthenticated = !loading && user !== null;

    const value = {
        session,
        user,
        loading,
        isAuthenticated,
        signOut,
        signOutGlobal,
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

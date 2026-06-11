import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import api from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import { del, createStore } from "idb-keyval";
import { useMotionStore } from "@/store/useMotionStore";

// ── Session Record Helpers ────────────────────────────────────────────────────
const SESSIONS_KEY = "keil_sessions";

export interface SessionRecord {
  id: string;          // unique per browser (generated once, persisted)
  loginAt: string;     // ISO timestamp of first login on this browser
  lastSeen: string;    // ISO timestamp of last auth state change
  userAgent: string;   // browser user-agent
  platform: string;    // navigator.platform
  isCurrent: boolean;  // always true when read from this browser
}

function getBrowserId(): string {
  const existing = localStorage.getItem("keil_browser_id");
  if (existing) return existing;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem("keil_browser_id", id);
  return id;
}

export function upsertSessionRecord() {
  try {
    const browserId = getBrowserId();
    const stored = localStorage.getItem(SESSIONS_KEY);
    const records: SessionRecord[] = stored ? JSON.parse(stored) : [];
    const existing = records.find((r) => r.id === browserId);
    const now = new Date().toISOString();
    if (existing) {
      existing.lastSeen = now;
      existing.isCurrent = true;
    } else {
      records.push({
        id: browserId,
        loginAt: now,
        lastSeen: now,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        isCurrent: true,
      });
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(records));
  } catch { /* ignore */ }
}

export function removeCurrentSessionRecord() {
  try {
    const browserId = localStorage.getItem("keil_browser_id");
    if (!browserId) return;
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (!stored) return;
    const records: SessionRecord[] = JSON.parse(stored);
    const updated = records.filter((r) => r.id !== browserId);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  } catch { /* ignore */ }
}

export function getSessionRecords(): SessionRecord[] {
  try {
    const browserId = localStorage.getItem("keil_browser_id");
    const stored = localStorage.getItem(SESSIONS_KEY);
    if (!stored) return [];
    const records: SessionRecord[] = JSON.parse(stored);
    // Mark current browser
    return records.map((r) => ({ ...r, isCurrent: r.id === browserId }));
  } catch {
    return [];
  }
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
                    connectSocket(session.access_token); // Start socket on login/page refresh
                    api.get('users/me').catch(err => console.error("Auth sync failed:", err));
                    upsertSessionRecord(); // Track this browser as an active session
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

        // 2. Clear persistent IndexedDB store cache
        try {
            const customStore = createStore('keil-database', 'query-cache');
            await del('keil-query-cache', customStore);
        } catch (e) {
            console.error("Failed to delete IndexedDB query cache on logout:", e);
        }

        // 3. Clear Zustand store's optimistic and routing cache
        try {
            localStorage.removeItem("motion:lastOpenedPages");
        } catch { /* ignore */ }
        useMotionStore.setState({
            dirtyPageIds: new Set<string>(),
            lastOpenedPages: {}
        });
    };

    /** Signs out this device only (other devices remain logged in). */
    const signOut = async () => {
        disconnectSocket();            // MUST be called BEFORE signOut — JWT is still valid here
        removeCurrentSessionRecord();  // Remove this browser from the sessions list
        await _clearLocalState();
        await supabase.auth.signOut(); // scope: 'local' by default
    };

    /**
     * Signs out from ALL devices by revoking every refresh token in Supabase.
     * Other devices will be kicked out on their next token validation.
     */
    const signOutGlobal = async () => {
        disconnectSocket();
        // Clear all session records since all devices are being signed out
        try { localStorage.removeItem("keil_sessions"); } catch { /* ignore */ }
        await _clearLocalState();
        await supabase.auth.signOut({ scope: 'global' });
    };

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

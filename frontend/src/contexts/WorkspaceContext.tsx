import React, { createContext, useContext, useEffect, useState } from "react";
import { useWorkspaces, type Workspace } from "@/hooks/api/useWorkspace";

// ─── Context Shape ────────────────────────────────────────────────────────────

interface WorkspaceContextType {
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceRole: "owner" | "admin" | "member" | null;
  workspaces: Workspace[];
  isLoading: boolean;
  setActiveWorkspace: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(
  undefined
);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Fetches the current user + workspace via `useMe()` (TanStack Query).
 * Exposes workspaceId, workspaceName, workspaceRole to all child components.
 *
 * Must be placed INSIDE <AuthProvider> so the session JWT exists when
 * the query fires.
 */
export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { data: workspaces, isLoading } = useWorkspaces();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    return localStorage.getItem("keil_active_workspace");
  });

  // Fallback to the first available workspace if none is strictly set or invalid
  const targetWorkspace = workspaces?.find(w => w.id === activeWorkspaceId) || workspaces?.[0] || null;

  useEffect(() => {
    if (targetWorkspace) {
      setActiveWorkspaceId(targetWorkspace.id);
      localStorage.setItem("keil_active_workspace", targetWorkspace.id);
    }
  }, [targetWorkspace?.id]);

  const value: WorkspaceContextType = {
    workspaceId: targetWorkspace?.id ?? null,
    workspaceName: targetWorkspace?.name ?? null,
    workspaceRole: targetWorkspace?.role ?? null,
    workspaces: workspaces || [],
    isLoading,
    setActiveWorkspace: (id: string) => {
      setActiveWorkspaceId(id);
      localStorage.setItem("keil_active_workspace", id);
    }
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Access workspace data anywhere in the component tree.
 * Throws a clear error if used outside <WorkspaceProvider>.
 */
export const useWorkspace = (): WorkspaceContextType => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};

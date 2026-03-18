import React, { createContext, useContext } from "react";
import { useMe } from "@/hooks/api/useMe";

// ─── Context Shape ────────────────────────────────────────────────────────────

interface WorkspaceContextType {
  workspaceId: string | null;
  workspaceName: string | null;
  workspaceRole: "owner" | "admin" | "member" | null;
  isLoading: boolean;
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
  const { data, isLoading } = useMe();

  const value: WorkspaceContextType = {
    workspaceId: data?.workspace?.id ?? null,
    workspaceName: data?.workspace?.name ?? null,
    workspaceRole: data?.workspace?.role ?? null,
    isLoading,
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

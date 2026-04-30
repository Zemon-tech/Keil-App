import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Space {
  id: string;
  org_id: string;
  name: string;
  visibility: "private";
  created_by: string | null;
  created_at: string;
  /** The current user's role inside this space. */
  role: "owner" | "admin" | "member";
  /** Compatibility: the legacy workspace_id for this space. Used by legacy chat/task hooks during transition. */
  compatibility_workspace_id: string | null;
}

export interface SpaceMember {
  user_id: string;
  role: "owner" | "admin" | "member";
  name: string | null;
  email: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const spaceKeys = {
  all: ["spaces"] as const,
  list: (orgId: string) => [...spaceKeys.all, orgId, "list"] as const,
  members: (orgId: string, spaceId: string) =>
    [...spaceKeys.all, orgId, spaceId, "members"] as const,
};

// ─── useSpaces ────────────────────────────────────────────────────────────────

/**
 * Fetches all spaces the current user can see inside an organisation.
 * Calls: GET /api/v1/orgs/:orgId/spaces
 * Enabled only when orgId is provided.
 */
export function useSpaces(orgId: string | null) {
  return useQuery<Space[]>({
    queryKey: spaceKeys.list(orgId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: { spaces: Space[] } }>(
        `v1/orgs/${orgId}/spaces`
      );
      return res.data.data.spaces ?? [];
    },
    enabled: !!orgId,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ─── useSpaceMembers ──────────────────────────────────────────────────────────

/**
 * Fetches all members of a specific space inside an organisation.
 * Calls: GET /api/v1/orgs/:orgId/spaces/:spaceId/members
 * Enabled only when both orgId and spaceId are provided.
 */
export function useSpaceMembers(orgId: string | null, spaceId: string | null) {
  return useQuery<SpaceMember[]>({
    queryKey: spaceKeys.members(orgId ?? "", spaceId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: SpaceMember[] }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/members`
      );
      return res.data.data ?? [];
    },
    enabled: !!orgId && !!spaceId,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  role: "admin" | "manager" | "member";
  is_private: boolean;
}

export interface DeletedSpace {
  id: string;
  org_id: string | null;
  name: string;
  visibility: string;
  created_by: string | null;
  created_at: string;
  deleted_at: string;
}

export interface SpaceMember {
  user_id: string;
  role: "admin" | "manager" | "member";
  name: string | null;
  email: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const spaceKeys = {
  all: ["spaces"] as const,
  list: (orgId: string) => [...spaceKeys.all, orgId, "list"] as const,
  deleted: (orgId: string) => [...spaceKeys.all, orgId, "deleted"] as const,
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
    staleTime: 0, // Load fresh space lists on navigation/mount
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ─── useDeletedSpaces ─────────────────────────────────────────────────────────

/**
 * Fetches soft-deleted spaces for an org.
 * Calls: GET /api/v1/orgs/:orgId/spaces/deleted
 * Only org owner/admin will receive results (backend enforces 403 for members).
 */
export function useDeletedSpaces(orgId: string | null) {
  return useQuery<DeletedSpace[]>({
    queryKey: spaceKeys.deleted(orgId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: { spaces: DeletedSpace[] } }>(
        `v1/orgs/${orgId}/spaces/deleted`
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
      const res = await api.get<{ data: { members: SpaceMember[] } }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/members`
      );
      return res.data.data.members ?? [];
    },
    enabled: !!orgId && !!spaceId,
    staleTime: 0, // Load fresh space members lists on navigate/open
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ─── useCreateSpace ───────────────────────────────────────────────────────────

/**
 * Creates a new space inside an organisation.
 * Calls: POST /api/v1/orgs/:orgId/spaces
 * Caller must be an org owner or admin.
 */
export function useCreateSpace(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<Space, Error, string>({
    mutationFn: async (name) => {
      const res = await api.post<{ data: { space: Space } }>(
        `v1/orgs/${orgId}/spaces`,
        { name }
      );
      return res.data.data.space;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: spaceKeys.list(orgId) });
      }
    },
  });
}

// ─── useRenameSpace ───────────────────────────────────────────────────────────

/**
 * Renames a space with an optimistic update.
 * The cache is updated immediately; rolled back on error.
 * Calls: PATCH /api/v1/orgs/:orgId/spaces/:spaceId
 */
export function useRenameSpace(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    { space: Space },
    Error,
    { spaceId: string; name: string }
  >({
    mutationFn: async ({ spaceId, name }) => {
      const res = await api.patch<{ data: { space: Space } }>(
        `v1/orgs/${orgId}/spaces/${spaceId}`,
        { name }
      );
      return res.data.data;
    },
    onMutate: async ({ spaceId, name }) => {
      if (!orgId) return;
      // Cancel any in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: spaceKeys.list(orgId) });

      // Snapshot the previous value for rollback
      const previous = queryClient.getQueryData<Space[]>(spaceKeys.list(orgId));

      // Optimistically update the name in the cache
      queryClient.setQueryData<Space[]>(spaceKeys.list(orgId), (old = []) =>
        old.map((s) => (s.id === spaceId ? { ...s, name } : s))
      );

      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      // Roll back to the snapshot on error
      if (orgId && context?.previous) {
        queryClient.setQueryData(spaceKeys.list(orgId), context.previous);
      }
    },
    onSettled: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: spaceKeys.list(orgId) });
      }
    },
  });
}

// ─── useDeleteSpace ───────────────────────────────────────────────────────────

/**
 * Soft-deletes a space.
 * Calls: DELETE /api/v1/orgs/:orgId/spaces/:spaceId
 *
 * The caller is responsible for handling the active-space fallback:
 *   const del = useDeleteSpace(orgId);
 *   del.mutate(spaceId, {
 *     onSuccess: () => {
 *       if (activeSpaceId === spaceId) setActiveOrganisation(orgId);
 *     },
 *   });
 */
export function useDeleteSpace(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (spaceId) => {
      await api.delete(`v1/orgs/${orgId}/spaces/${spaceId}`);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: spaceKeys.list(orgId) });
        queryClient.invalidateQueries({ queryKey: spaceKeys.deleted(orgId) });
      }
    },
  });
}

// ─── useRestoreSpace ──────────────────────────────────────────────────────────

/**
 * Restores a soft-deleted space.
 * Calls: POST /api/v1/orgs/:orgId/spaces/:spaceId/restore
 */
export function useRestoreSpace(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<{ space: Space }, Error, string>({
    mutationFn: async (spaceId) => {
      const res = await api.post<{ data: { space: Space } }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/restore`
      );
      return res.data.data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: spaceKeys.list(orgId) });
        queryClient.invalidateQueries({ queryKey: spaceKeys.deleted(orgId) });
      }
    },
  });
}

// ─── useHardDeleteSpace ───────────────────────────────────────────────────────

/**
 * Permanently deletes a soft-deleted space and all its data.
 * Calls: DELETE /api/v1/orgs/:orgId/spaces/:spaceId/permanent
 * The space must already be soft-deleted.
 */
export function useHardDeleteSpace(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (spaceId) => {
      await api.delete(`v1/orgs/${orgId}/spaces/${spaceId}/permanent`);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: spaceKeys.deleted(orgId) });
      }
    },
  });
}

// ─── useAddSpaceMember ────────────────────────────────────────────────────────

/**
 * Adds an org member to a space (role: member).
 * Calls: POST /api/v1/orgs/:orgId/spaces/:spaceId/members
 * Target user must already be an org member.
 */
export function useAddSpaceMember(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (targetUserId) => {
      await api.post(
        `v1/orgs/${orgId}/spaces/${spaceId}/members`,
        { user_id: targetUserId }
      );
    },
    onSuccess: () => {
      if (orgId && spaceId) {
        queryClient.invalidateQueries({
          queryKey: spaceKeys.members(orgId, spaceId),
        });
      }
    },
  });
}

// ─── useRemoveSpaceMember ─────────────────────────────────────────────────────

/**
 * Removes a member from a space (space only — org membership is unaffected).
 * Calls: DELETE /api/v1/orgs/:orgId/spaces/:spaceId/members/:userId
 * Org owner/admin only. Cannot remove yourself.
 */
export function useRemoveSpaceMember(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (targetUserId) => {
      await api.delete(
        `v1/orgs/${orgId}/spaces/${spaceId}/members/${targetUserId}`
      );
    },
    onSuccess: () => {
      if (orgId && spaceId) {
        queryClient.invalidateQueries({
          queryKey: spaceKeys.members(orgId, spaceId),
        });
      }
    },
  });
}

// ─── useUpdateSpaceMemberRole ──────────────────────────────────────────────────

/**
 * Updates a member's role inside a space.
 * Calls: PATCH /api/v1/orgs/:orgId/spaces/:spaceId/members/:userId
 * Space admin only. Cannot demote/promote yourself.
 */
export function useUpdateSpaceMemberRole(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { userId: string; role: "admin" | "manager" | "member" }
  >({
    mutationFn: async ({ userId, role }) => {
      await api.patch(
        `v1/orgs/${orgId}/spaces/${spaceId}/members/${userId}`,
        { role }
      );
    },
    onSuccess: () => {
      if (orgId && spaceId) {
        queryClient.invalidateQueries({
          queryKey: spaceKeys.members(orgId, spaceId),
        });
        queryClient.invalidateQueries({
          queryKey: spaceKeys.list(orgId),
        });
      }
    },
  });
}

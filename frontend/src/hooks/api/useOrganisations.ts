import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Organisation {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  /** The current user's role inside this organisation. */
  role: "owner" | "admin" | "member";
}

export interface OrgMember {
  user_id: string;
  role: "owner" | "admin" | "member";
  name: string | null;
  email: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const orgKeys = {
  all: ["organisations"] as const,
  list: () => [...orgKeys.all, "list"] as const,
  members: (orgId: string) => [...orgKeys.all, orgId, "members"] as const,
};

// ─── useOrganisations ─────────────────────────────────────────────────────────

/**
 * Fetches all organisations the current user belongs to.
 * Calls: GET /api/v1/orgs
 * Returns an empty array (not an error) when the user has no organisations.
 */
export function useOrganisations() {
  return useQuery<Organisation[]>({
    queryKey: orgKeys.list(),
    queryFn: async () => {
      const res = await api.get<{ data: { organisations: Organisation[] } }>("v1/orgs");
      return res.data.data.organisations ?? [];
    },
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ─── useOrgMembers ────────────────────────────────────────────────────────────

/**
 * Fetches all members of an organisation.
 * Calls: GET /api/v1/orgs/:orgId/members
 * Enabled only when orgId is provided.
 */
export function useOrgMembers(orgId: string | null) {
  return useQuery<OrgMember[]>({
    queryKey: orgKeys.members(orgId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: { members: OrgMember[] } }>(
        `v1/orgs/${orgId}/members`
      );
      return res.data.data.members ?? [];
    },
    enabled: !!orgId,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ─── useCreateOrganisation ────────────────────────────────────────────────────

/**
 * Creates a new organisation with a default "General" space.
 * Calls: POST /api/v1/orgs
 *
 * The caller is responsible for switching context on success:
 *   const create = useCreateOrganisation();
 *   create.mutate("My Org", {
 *     onSuccess: ({ org, space }) => setActiveOrganisation(org.id, space.id),
 *   });
 */
export function useCreateOrganisation() {
  const queryClient = useQueryClient();

  return useMutation<
    { org: Organisation; space: { id: string; name: string; org_id: string; created_at: string } },
    Error,
    string // org name
  >({
    mutationFn: async (name) => {
      const res = await api.post<{
        data: {
          org: Organisation;
          space: { id: string; name: string; org_id: string; created_at: string };
        };
      }>("v1/orgs", { name });
      return res.data.data;
    },
    onSuccess: () => {
      // Invalidate org list so the new org appears everywhere
      queryClient.invalidateQueries({ queryKey: orgKeys.list() });
    },
  });
}

// ─── useCreateOrgInvite ───────────────────────────────────────────────────────

/**
 * Generates an invite link for an organisation.
 * Calls: POST /api/v1/orgs/:orgId/invite
 */
export function useCreateOrgInvite() {
  return useMutation<{ inviteLink: string; token: string }, Error, string>({
    mutationFn: async (orgId) => {
      const res = await api.post<{ data: { inviteLink: string; token: string } }>(
        `v1/orgs/${orgId}/invite`
      );
      return res.data.data;
    },
  });
}

// ─── useRenameOrganisation ───────────────────────────────────────────────────

export function useRenameOrganisation() {
  const queryClient = useQueryClient();

  return useMutation<
    { org: Organisation },
    Error,
    { orgId: string; name: string }
  >({
    mutationFn: async ({ orgId, name }) => {
      const res = await api.patch<{ data: { org: Organisation } }>(
        `v1/orgs/${orgId}`,
        { name }
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.list() });
    },
  });
}

// ─── useDeleteOrganisation ───────────────────────────────────────────────────

export function useDeleteOrganisation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (orgId) => {
      await api.delete(`v1/orgs/${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orgKeys.list() });
    },
  });
}

// ─── useUpdateOrgMemberRole ──────────────────────────────────────────────────

export function useUpdateOrgMemberRole(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { userId: string; role: "admin" | "member" }
  >({
    mutationFn: async ({ userId, role }) => {
      await api.patch(`v1/orgs/${orgId}/members/${userId}`, { role });
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: orgKeys.members(orgId) });
        queryClient.invalidateQueries({ queryKey: orgKeys.list() });
      }
    },
  });
}

// ─── useRemoveOrgMember ──────────────────────────────────────────────────────

export function useRemoveOrgMember(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (userId) => {
      await api.delete(`v1/orgs/${orgId}/members/${userId}`);
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: orgKeys.members(orgId) });
        queryClient.invalidateQueries({ queryKey: orgKeys.list() });
      }
    },
  });
}

// ─── useJoinOrganisation ──────────────────────────────────────────────────────

/**
 * Joins an organisation using an invite token.
 * Calls: POST /api/v1/orgs/join
 *
 * The caller is responsible for switching context on success:
 *   const join = useJoinOrganisation();
 *   join.mutate(token, {
 *     onSuccess: ({ orgId, spaceId }) => setActiveOrganisation(orgId, spaceId),
 *   });
 */
export function useJoinOrganisation() {
  const queryClient = useQueryClient();

  return useMutation<{ orgId: string; spaceId: string }, Error, string>({
    mutationFn: async (token) => {
      const res = await api.post<{ data: { orgId: string; spaceId: string } }>(
        "v1/orgs/join",
        { token }
      );
      return res.data.data;
    },
    onSuccess: () => {
      // Invalidate org list so the joined org appears in the sidebar
      queryClient.invalidateQueries({ queryKey: orgKeys.list() });
    },
  });
}

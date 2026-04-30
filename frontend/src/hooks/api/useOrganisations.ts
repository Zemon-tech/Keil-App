import { useQuery } from "@tanstack/react-query";
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

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const orgKeys = {
  all: ["organisations"] as const,
  list: () => [...orgKeys.all, "list"] as const,
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
    // Don't block the UI — a user with no orgs is valid
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

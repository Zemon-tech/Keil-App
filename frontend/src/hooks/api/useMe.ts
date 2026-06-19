import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  avatar_url?: string | null;
  onboarded: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the current authenticated user's profile from GET /api/users/me.
 *
 * Query key: ["me"]
 * staleTime: inherits from QueryClient default (5 min)
 */
export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get<{ data: MeResponse }>("users/me");
      return res.data.data;
    },
    // Don't retry on 401 — user just isn't logged in
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401) return false;
      return failureCount < 1;
    },
  });
}

/**
 * Marks the current authenticated user as onboarded in the database.
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await api.patch("users/onboard");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

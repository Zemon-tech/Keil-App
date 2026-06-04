import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GitHubStatus {
  connected: boolean;
  connected_at?: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const gitHubKeys = {
  status: ["integrations", "github", "status"] as const,
};

// ─── useGitHubStatus ──────────────────────────────────────────────────────────

/**
 * Fetches the current user's GitHub connection status.
 * Returns { connected: false } when not connected.
 */
export function useGitHubStatus() {
  return useQuery<GitHubStatus>({
    queryKey: gitHubKeys.status,
    queryFn: async () => {
      const res = await api.get<{ data: GitHubStatus }>(
        "v1/integrations/github/status"
      );
      return res.data.data;
    },
    // Don't retry on auth errors
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
    // Stale after 30 seconds
    staleTime: 30_000,
  });
}

// ─── useConnectGitHub ─────────────────────────────────────────────────────────

/**
 * Returns a function that initiates the GitHub OAuth flow.
 * Fetches the consent URL from the backend and redirects the browser to it.
 * The user will be redirected back to /tasks?github=connected (or ?github=error).
 */
export function useConnectGitHub() {
  return async () => {
    try {
      const res = await api.get<{ data: { url: string } }>(
        "v1/integrations/github/connect"
      );
      const url = res.data.data.url;
      // Full page redirect to GitHub OAuth
      window.location.href = url;
    } catch (err) {
      toast.error("Failed to start GitHub connection. Please try again.");
      console.error("[github] connect error:", err);
    }
  };
}

// ─── useDisconnectGitHub ──────────────────────────────────────────────────────

/**
 * Mutation that disconnects GitHub.
 * Invalidates the status query on success so the UI updates immediately.
 */
export function useDisconnectGitHub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.delete("v1/integrations/github");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gitHubKeys.status });
      toast.success("GitHub disconnected");
    },
    onError: () => {
      toast.error("Failed to disconnect GitHub. Please try again.");
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleCalendarStatus {
  connected: boolean;
  calendar_id?: string;
  connected_at?: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const integrationKeys = {
  googleStatus: ["integrations", "google", "status"] as const,
};

// ─── useGoogleCalendarStatus ──────────────────────────────────────────────────

/**
 * Fetches the current user's Google Calendar connection status.
 * Returns { connected: false } when not connected.
 */
export function useGoogleCalendarStatus() {
  return useQuery<GoogleCalendarStatus>({
    queryKey: integrationKeys.googleStatus,
    queryFn: async () => {
      const res = await api.get<{ data: GoogleCalendarStatus }>(
        "v1/integrations/google/status"
      );
      return res.data.data;
    },
    // Don't retry on auth errors
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
    // Stale after 30 seconds — status doesn't change often
    staleTime: 30_000,
  });
}

// ─── useConnectGoogleCalendar ─────────────────────────────────────────────────

/**
 * Returns a function that initiates the Google Calendar OAuth flow.
 * Fetches the consent URL from the backend and redirects the browser to it.
 * The user will be redirected back to /tasks?gcal=connected (or ?gcal=error).
 */
export function useConnectGoogleCalendar() {
  return async () => {
    try {
      const res = await api.get<{ data: { url: string } }>(
        "v1/integrations/google/connect"
      );
      const url = res.data.data.url;
      // Full page redirect — Google OAuth requires this (not a popup)
      window.location.href = url;
    } catch (err) {
      toast.error("Failed to start Google Calendar connection. Please try again.");
      console.error("[gcal] connect error:", err);
    }
  };
}

// ─── useDisconnectGoogleCalendar ──────────────────────────────────────────────

/**
 * Mutation that disconnects Google Calendar.
 * Invalidates the status query on success so the UI updates immediately.
 */
export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.delete("v1/integrations/google");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.googleStatus });
      toast.success("Google Calendar disconnected");
    },
    onError: () => {
      toast.error("Failed to disconnect Google Calendar. Please try again.");
    },
  });
}

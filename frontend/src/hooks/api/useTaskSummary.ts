import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskSummaryDTO {
  task_id: string;
  summary_text: string;
  comment_count: number;
  model_used: string;
  generated_at: string;
}

interface SummaryResponse {
  success: boolean;
  data: TaskSummaryDTO;
}

interface SummarySocketPayload {
  taskId: string;
  summary: string;
  commentCount: number;
  generatedAt: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const taskSummaryKeys = {
  all: ["task-summaries"] as const,
  task: (orgId: string, spaceId: string, taskId: string) =>
    ["task-summaries", orgId, spaceId, taskId] as const,
};

// ─── useTaskSummary ───────────────────────────────────────────────────────────

/**
 * Fetches the cached AI summary for a task and subscribes to real-time
 * updates via Socket.IO. Returns null when no summary exists yet.
 */
export function useTaskSummary(
  orgId: string | null,
  spaceId: string | null,
  taskId: string | undefined
) {
  const queryClient = useQueryClient();
  const enabled = !!orgId && !!spaceId && !!taskId;

  const query = useQuery({
    queryKey: taskSummaryKeys.task(orgId ?? "", spaceId ?? "", taskId ?? ""),
    queryFn: async () => {
      const response = await api.get<SummaryResponse>(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${taskId}/summary`
      );
      // 204 = no summary yet, axios will throw for non-2xx but our backend returns 204 with no body
      return response.data?.data ?? null;
    },
    enabled,
    staleTime: 60_000, // Summary is relatively stable — refetch after 1 min
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      // Don't retry on 204 (no content), auth errors, or not found
      if (status === 204 || status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    },
  });

  // ── Socket.IO real-time listener ────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    if (!socket) return;

    const handleSummaryUpdated = (payload: SummarySocketPayload) => {
      if (payload.taskId !== taskId) return;

      // Optimistically update the cache with the new summary
      queryClient.setQueryData(
        taskSummaryKeys.task(orgId!, spaceId!, taskId!),
        {
          task_id: payload.taskId,
          summary_text: payload.summary,
          comment_count: payload.commentCount,
          generated_at: payload.generatedAt,
          model_used: "", // not provided in socket payload, non-essential for display
        } satisfies TaskSummaryDTO
      );
    };

    socket.on("task_summary_updated", handleSummaryUpdated);

    return () => {
      socket.off("task_summary_updated", handleSummaryUpdated);
    };
  }, [queryClient, orgId, spaceId, taskId, enabled]);

  return query;
}

// ─── useRegenerateTaskSummary ─────────────────────────────────────────────────

/**
 * Mutation to manually trigger a summary regeneration.
 * Shows toasts on success, error, and rate limit.
 */
export function useRegenerateTaskSummary(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      const response = await api.post(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${taskId}/summary/regenerate`
      );
      return response.data;
    },
    onSuccess: (_, taskId) => {
      toast.success("Summary regeneration started");
      // The actual updated data will arrive via socket — no need to invalidate immediately
      // But invalidate after a short delay as fallback
      setTimeout(() => {
        if (orgId && spaceId) {
          queryClient.invalidateQueries({
            queryKey: taskSummaryKeys.task(orgId, spaceId, taskId),
          });
        }
      }, 8000);
    },
    onError: (error: unknown) => {
      const status = (error as { response?: { status?: number; data?: { code?: string; message?: string } } })?.response?.status;
      const data = (error as { response?: { data?: { code?: string; message?: string } } })?.response?.data;

      if (status === 429) {
        toast.error(data?.message || "Daily summary limit reached for this task. Try again tomorrow.");
      } else if (status === 409) {
        toast.info(data?.message || "Summary is already being generated.");
      } else {
        toast.error("Failed to regenerate summary. Please try again.");
      }
    },
  });
}

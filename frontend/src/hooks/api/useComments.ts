import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Comment } from "../../types/task";
import api from "../../lib/api";

type CreateCommentPayload = {
  taskId: string;
  content: string;
  parent_comment_id?: string;
};

// Response match from API shapes
type CommentsResponse = {
  success: boolean;
  data: Comment[];
};

// ─── Org/space-scoped comment query keys ─────────────────────────────────────

export const orgCommentKeys = {
  task: (orgId: string, spaceId: string, taskId: string) =>
    ["org-comments", orgId, spaceId, taskId] as const,
};

// ─── useOrgTaskComments ───────────────────────────────────────────────────────

export function useOrgTaskComments(
  orgId: string | null,
  spaceId: string | null,
  taskId?: string
) {
  return useQuery({
    queryKey: orgCommentKeys.task(orgId ?? "", spaceId ?? "", taskId ?? ""),
    queryFn: async () => {
      const response = await api.get<CommentsResponse>(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${taskId}/comments`
      );
      return response.data.data;
    },
    enabled: !!orgId && !!spaceId && !!taskId,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ─── useCreateOrgComment ──────────────────────────────────────────────────────

export function useCreateOrgComment(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, content, parent_comment_id }: CreateCommentPayload) => {
      const response = await api.post(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${taskId}/comments`,
        { content, parent_comment_id }
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: orgCommentKeys.task(orgId, spaceId, variables.taskId),
      });
    },
  });
}

// ─── useDeleteOrgComment ──────────────────────────────────────────────────────

type DeleteOrgCommentPayload = {
  taskId: string;
  commentId: string;
};

export function useDeleteOrgComment(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, commentId }: DeleteOrgCommentPayload) => {
      const response = await api.delete(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${taskId}/comments/${commentId}`
      );
      return response.data;
    },
    onSuccess: (_, variables) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: orgCommentKeys.task(orgId, spaceId, variables.taskId),
      });
    },
  });
}

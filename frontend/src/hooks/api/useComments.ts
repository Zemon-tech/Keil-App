import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Comment } from "../../types/task";
import api from "../../lib/api";

type CreateCommentPayload = {
  taskId: string;
  content: string;
  parent_comment_id?: string;
};

type DeleteCommentPayload = {
  taskId: string;
  commentId: string;
};

// Response match from API shapes
type CommentsResponse = {
  success: boolean;
  data: Comment[];
};

export function useTaskComments(taskId?: string) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: async () => {
      const response = await api.get<CommentsResponse>(
        `/v1/tasks/${taskId}/comments`,
      );
      return response.data.data;
    },
    enabled: !!taskId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      content,
      parent_comment_id,
    }: CreateCommentPayload) => {
      const response = await api.post(`/v1/tasks/${taskId}/comments`, {
        content,
        parent_comment_id,
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["comments", variables.taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["activity", "task", variables.taskId],
      });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId }: DeleteCommentPayload) => {
      const response = await api.delete(`/v1/comments/${commentId}`);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["comments", variables.taskId],
      });
      queryClient.invalidateQueries({
        queryKey: ["activity", "task", variables.taskId],
      });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PersonalTaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";

export type PersonalTaskPriority = "low" | "medium" | "high" | "urgent";

export interface PersonalTaskDTO {
  id: string;
  owner_user_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  objective: string | null;
  success_criteria: string | null;
  status: PersonalTaskStatus;
  priority: PersonalTaskPriority;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePersonalTaskInput {
  title: string;
  description?: string;
  objective?: string;
  success_criteria?: string;
  status?: PersonalTaskStatus;
  priority?: PersonalTaskPriority;
  start_date?: string;
  due_date?: string;
  parent_task_id?: string;
}

export interface UpdatePersonalTaskInput {
  title?: string;
  description?: string | null;
  objective?: string | null;
  success_criteria?: string | null;
  status?: PersonalTaskStatus;
  priority?: PersonalTaskPriority;
  start_date?: string | null;
  due_date?: string | null;
}

export interface PersonalTaskFilters {
  status?: PersonalTaskStatus;
  priority?: PersonalTaskPriority;
  parent_task_id?: string | null;
  limit?: number;
  offset?: number;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

/**
 * Personal task cache keys are NOT scoped to workspaceId/orgId because
 * personal tasks are platform-owned: they belong only to the user.
 */
export const personalTaskKeys = {
  all: ["personal-tasks"] as const,
  lists: () => [...personalTaskKeys.all, "list"] as const,
  list: (filters: PersonalTaskFilters) => [...personalTaskKeys.lists(), filters] as const,
  detail: (id: string) => [...personalTaskKeys.all, "detail", id] as const,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function toApiParams(filters: PersonalTaskFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.status !== undefined) params.status = filters.status;
  if (filters.priority !== undefined) params.priority = filters.priority;
  if (filters.parent_task_id !== undefined)
    params.parent_task_id = filters.parent_task_id === null ? "null" : filters.parent_task_id;
  if (filters.limit !== undefined) params.limit = String(filters.limit);
  if (filters.offset !== undefined) params.offset = String(filters.offset);
  return params;
}

// ─── usePersonalTasks ─────────────────────────────────────────────────────────

/**
 * Fetches the current user's personal task list.
 * Calls: GET /api/v1/personal/tasks
 *
 * Personal tasks are always available — even with no organisation.
 * The query is always enabled once the hook is mounted (the protect
 * middleware on the server side ensures only the owner's tasks are returned).
 */
export function usePersonalTasks(filters: PersonalTaskFilters = {}) {
  return useQuery<PersonalTaskDTO[]>({
    queryKey: personalTaskKeys.list(filters),
    queryFn: async () => {
      const res = await api.get<{ data: PersonalTaskDTO[] }>("v1/personal/tasks", {
        params: toApiParams(filters),
      });
      return res.data.data;
    },
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ─── usePersonalTask ──────────────────────────────────────────────────────────

export function usePersonalTask(taskId: string | null) {
  return useQuery<PersonalTaskDTO>({
    queryKey: personalTaskKeys.detail(taskId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: PersonalTaskDTO }>(`v1/personal/tasks/${taskId}`);
      return res.data.data;
    },
    enabled: !!taskId,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    },
  });
}

// ─── useCreatePersonalTask ────────────────────────────────────────────────────

export function useCreatePersonalTask() {
  const queryClient = useQueryClient();

  return useMutation<PersonalTaskDTO, Error, CreatePersonalTaskInput>({
    mutationFn: async (input) => {
      const res = await api.post<{ data: PersonalTaskDTO }>("v1/personal/tasks", input);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: personalTaskKeys.lists() });
      if (data.parent_task_id) {
        queryClient.invalidateQueries({
          queryKey: personalTaskKeys.detail(data.parent_task_id),
        });
      }
    },
    onError: () => {
      toast.error("Failed to create personal task. Please try again.");
    },
  });
}

// ─── useUpdatePersonalTask ────────────────────────────────────────────────────

export function useUpdatePersonalTask() {
  const queryClient = useQueryClient();

  return useMutation<
    PersonalTaskDTO,
    Error,
    { id: string; updates: UpdatePersonalTaskInput }
  >({
    mutationFn: async ({ id, updates }) => {
      const res = await api.patch<{ data: PersonalTaskDTO }>(
        `v1/personal/tasks/${id}`,
        updates
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: personalTaskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: personalTaskKeys.detail(data.id) });
    },
    onError: () => {
      toast.error("Failed to update personal task. Please try again.");
    },
  });
}

// ─── useDeletePersonalTask ────────────────────────────────────────────────────

export function useDeletePersonalTask() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (taskId) => {
      await api.delete(`v1/personal/tasks/${taskId}`);
    },
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({ queryKey: personalTaskKeys.lists() });
      queryClient.removeQueries({ queryKey: personalTaskKeys.detail(taskId) });
    },
    onError: () => {
      toast.error("Failed to delete personal task. Please try again.");
    },
  });
}

// ─── useChangePersonalTaskStatus ──────────────────────────────────────────────

export function useChangePersonalTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    PersonalTaskDTO,
    Error,
    { id: string; status: PersonalTaskStatus }
  >({
    mutationFn: async ({ id, status }) => {
      const res = await api.patch<{ data: PersonalTaskDTO }>(
        `v1/personal/tasks/${id}/status`,
        { status }
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: personalTaskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: personalTaskKeys.detail(data.id) });
    },
    onError: () => {
      toast.error("Failed to update task status. Please try again.");
    },
  });
}

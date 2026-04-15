import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import type { Task, TaskStatus, TaskPriority } from "@/types/task";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by the backend for every task */
export interface TaskDTO {
  id: string;
  title: string;
  description?: string;
  objective?: string;
  success_criteria?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  start_date?: string;
  parent_task_id?: string;
  workspace_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  assignees?: Array<{ id: string; name: string | null; email: string }>;
  // frontend-side extras from Task type (optional when fetching list)
  projectId?: string;
  projectTitle?: string;
  owner?: string;
  labels?: string[];
  storyPoints?: number;
  timeEstimateMinutes?: number;
  dueDateISO?: string;
  plannedStartISO?: string;
  plannedEndISO?: string;
  subtasks?: Task["subtasks"];
  dependencies?: Task["dependencies"];
  context?: Task["context"];
  history?: Task["history"];
  comments?: Task["comments"];

}

export type SortBy = "due_date" | "priority" | "created_at";
export type SortOrder = "asc" | "desc";

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  due_date_start?: string;
  due_date_end?: string;
  sort_by?: SortBy;
  sort_order?: SortOrder;
  limit?: number;
  offset?: number;
  parent_task_id?: string | null;
  query?: string; // client-side text search — not sent to backend
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  objective?: string;
  success_criteria?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  start_date?: string;
  due_date?: string;
  parent_task_id?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  objective?: string;
  success_criteria?: string;
  priority?: TaskPriority;
  start_date?: string;
  due_date?: string;
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filters: Omit<TaskFilters, "query">) =>
    [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

// ─── Helper: strip client-only filter fields before sending to backend ────────

function toApiParams(filters: TaskFilters = {}): Record<string, string> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { query, ...rest } = filters;
  const params: Record<string, string> = {};
  (Object.keys(rest) as Array<keyof typeof rest>).forEach((key) => {
    const val = rest[key];
    if (val !== undefined && val !== null) {
      params[key] = String(val);
    }
  });
  return params;
}

// ─── useTasks ─────────────────────────────────────────────────────────────────

/**
 * Fetches the task list for the current workspace.
 * Pass filters to narrow results — the query key includes all filters so
 * changing any filter automatically triggers a refetch.
 */
export function useTasks(filters: TaskFilters = {}) {
  // Exclude client-only `query` field from the query key used for caching
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { query: _q, ...serverFilters } = filters;

  return useQuery<TaskDTO[]>({
    queryKey: taskKeys.list(serverFilters),
    queryFn: async () => {
      const res = await api.get<{ data: TaskDTO[] }>("v1/tasks", {
        params: toApiParams(filters),
      });
      return res.data.data;
    },
    // Don't retry on 401/403 — auth issue
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ─── useTask ──────────────────────────────────────────────────────────────────

/**
 * Fetches a single task by ID including its full assignees array.
 * Enabled only when taskId is non-empty.
 */
export function useTask(taskId: string) {
  return useQuery<TaskDTO>({
    queryKey: taskKeys.detail(taskId),
    queryFn: async () => {
      const res = await api.get<{ data: TaskDTO }>(`v1/tasks/${taskId}`);
      return res.data.data;
    },
    enabled: !!taskId,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response
        ?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    },
  });
}

// ─── useCreateTask ────────────────────────────────────────────────────────────

/**
 * Creates a new task. On success, invalidates the task list cache so the
 * new task appears immediately without a manual refresh.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<TaskDTO, Error, CreateTaskInput>({
    mutationFn: async (input) => {
      const res = await api.post<{ data: TaskDTO }>("v1/tasks", input);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Failed to create task. Please try again.";
      toast.error(message);
    },
  });
}

// ─── useUpdateTask ────────────────────────────────────────────────────────────

/**
 * Updates task fields (title, description, objective, etc.).
 * Invalidates both the list and the specific task detail cache on success.
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<
    TaskDTO,
    Error,
    { id: string; updates: UpdateTaskInput }
  >({
    mutationFn: async ({ id, updates }) => {
      const res = await api.patch<{ data: TaskDTO }>(
        `v1/tasks/${id}`,
        updates
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(data.id) });
    },
    onError: () => {
      toast.error("Failed to update task. Please try again.");
    },
  });
}

// ─── useDeleteTask ────────────────────────────────────────────────────────────

/**
 * Deletes a task. On success, invalidates the task list.
 * The caller is responsible for clearing any selected-task state if the
 * deleted task was selected.
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (taskId) => {
      await api.delete(`v1/tasks/${taskId}`);
    },
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      // Remove from detail cache so stale data isn't shown if re-selected
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
    },
    onError: () => {
      toast.error("Failed to delete task. Please try again.");
    },
  });
}

// ─── useChangeTaskStatus ──────────────────────────────────────────────────────

/**
 * Changes only the status of a task via PATCH /api/v1/tasks/:id/status.
 * Handles the 400 "blocked by dependencies" case with an error toast.
 */
export function useChangeTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    TaskDTO,
    { response?: { status?: number; data?: { message?: string } } },
    { id: string; status: TaskStatus }
  >({
    mutationFn: async ({ id, status }) => {
      const res = await api.patch<{ data: TaskDTO }>(
        `v1/tasks/${id}/status`,
        { status }
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
    onError: (error, { id }) => {
      const httpStatus = error?.response?.status;
      const message = error?.response?.data?.message;

      if (httpStatus === 400) {
        // Blocked by incomplete dependencies
        toast.error(
          message ??
            "Cannot mark as done — this task has incomplete dependencies. Complete them first.",
          { duration: 6000 }
        );
      } else {
        toast.error("Failed to update status. Please try again.");
      }

      // Refetch to ensure UI shows the real (server) status
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
    },
  });
}

// ─── Assignees & Dependencies ──────────────────────────────────────────────────

export function useAssignUser() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { id: string; userId: string }
  >({
    mutationFn: async ({ id, userId }) => {
      await api.post(`v1/tasks/${id}/assignees`, { user_id: userId });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast.success("Assignee added");
    },
    onError: () => {
      toast.error("Failed to assign user");
    },
  });
}

export function useRemoveAssignee() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { id: string; userId: string }
  >({
    mutationFn: async ({ id, userId }) => {
      await api.delete(`v1/tasks/${id}/assignees/${userId}`);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast.success("Assignee removed");
    },
    onError: () => {
      toast.error("Failed to remove assignee");
    },
  });
}

export function useAddDependency() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    { response?: { status?: number; data?: { message?: string } } },
    { id: string; dependsOnTaskId: string }
  >({
    mutationFn: async ({ id, dependsOnTaskId }) => {
      await api.post(`v1/tasks/${id}/dependencies`, { depends_on_task_id: dependsOnTaskId });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast.success("Dependency added");
    },
    onError: (error) => {
      const httpStatus = error?.response?.status;
      const message = error?.response?.data?.message;

      if (httpStatus === 400) {
        toast.error(message ?? "Cannot add circular dependency.");
      } else {
        toast.error("Failed to add dependency.");
      }
    },
  });
}

export function useRemoveDependency() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { id: string; blockedByTaskId: string }
  >({
    mutationFn: async ({ id, blockedByTaskId }) => {
      await api.delete(`v1/tasks/${id}/dependencies/${blockedByTaskId}`);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      toast.success("Dependency removed");
    },
    onError: () => {
      toast.error("Failed to remove dependency");
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import type { Task, AnyStatus, TaskPriority, EventType } from "@/types/task";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Shape returned by the backend for every task */
export interface TaskDTO {
  id: string;
  title: string;
  type: "task" | "event";
  event_type?: EventType | null;
  location?: string | null;
  is_all_day?: boolean;
  description?: string;
  objective?: string;
  success_criteria?: string;
  status: AnyStatus;
  priority: TaskPriority;
  due_date?: string;
  start_date?: string;
  parent_task_id?: string;
  /** @deprecated — will be removed once all routes are org/space-scoped */
  workspace_id?: string;
  org_id?: string;
  space_id?: string;
  created_by: string;
  creator_name?: string | null;
  creator_email?: string | null;
  created_at: string;
  updated_at: string;
  assignees?: Array<{ id: string; name: string | null; email: string }>;
  story_points?: number;
  time_estimate?: number;
  user_space_role?: string;
  org_name?: string;
  space_name?: string;
  // frontend-side extras from Task type (optional when fetching list)
  projectId?: string;
  projectTitle?: string;
  owner?: string;
  labels?: string[];
  dueDateISO?: string;
  plannedStartISO?: string;
  plannedEndISO?: string;
  subtasks?: Task["subtasks"];
  dependencies?: Task["dependencies"];
  context?: Task["context"];
  history?: Task["history"];
  comments?: Task["comments"];
  subtask_count?: number;
  parent_task_title?: string;
}

export type SortBy = "due_date" | "priority" | "created_at";
export type SortOrder = "asc" | "desc";

export interface TaskFilters {
  status?: AnyStatus;
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
  mirror?: boolean;
  org_filter?: string;
  space_filter?: string;
}

export interface CreateTaskInput {
  title: string;
  type?: "task" | "event";
  event_type?: EventType | null;
  location?: string | null;
  is_all_day?: boolean;
  description?: string;
  objective?: string;
  success_criteria?: string;
  status?: AnyStatus;
  priority?: TaskPriority;
  start_date?: string;
  due_date?: string;
  parent_task_id?: string;
  story_points?: number;
  time_estimate?: number;
  assignee_ids?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  type?: "task" | "event";
  event_type?: EventType | null;
  location?: string | null;
  is_all_day?: boolean;
  description?: string;
  objective?: string;
  success_criteria?: string;
  priority?: TaskPriority;
  start_date?: string | null;
  due_date?: string | null;
  story_points?: number;
  time_estimate?: number;
}

const EVENT_STATUSES = new Set<AnyStatus>([
  "confirmed",
  "tentative",
  "cancelled",
  "completed",
]);

export function normalizeTaskDTO(dto: TaskDTO): TaskDTO {
  const raw = dto as unknown as { type?: unknown; status?: AnyStatus; event_type?: EventType | null };
  const type = raw.type;
  if (type === "task" || type === "event") {
    return dto;
  }
  const inferred: "task" | "event" =
    !!raw.event_type || (raw.status ? EVENT_STATUSES.has(raw.status) : false) ? "event" : "task";
  return {
    ...dto,
    type: inferred,
  };
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filters: Omit<TaskFilters, "query">) =>
    [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  subtasks: (parentId: string) => [...taskKeys.all, "subtasks", parentId] as const,
};

// ─── Org-scoped query key factory ─────────────────────────────────────────────
// Keys include orgId + spaceId so switching spaces auto-invalidates caches.

export const orgTaskKeys = {
  all: ["org-tasks"] as const,
  lists: (orgId: string, spaceId: string) =>
    [...orgTaskKeys.all, orgId, spaceId, "list"] as const,
  list: (orgId: string, spaceId: string, filters: object) =>
    [...orgTaskKeys.lists(orgId, spaceId), filters] as const,
  detail: (orgId: string, spaceId: string, id: string) =>
    [...orgTaskKeys.all, orgId, spaceId, "detail", id] as const,
  subtasks: (orgId: string, spaceId: string, parentId: string) =>
    [...orgTaskKeys.all, orgId, spaceId, "subtasks", parentId] as const,
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

// ─────────────────────────────────────────────────────────────────────────────
// ORG/SPACE-SCOPED HOOKS
// All hooks below call the new /orgs/:orgId/spaces/:spaceId/tasks routes.
// They are disabled (not erroring) when orgId or spaceId is null.
// ─────────────────────────────────────────────────────────────────────────────

const noRetryOn401 = (failureCount: number, error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 401 || status === 403 || status === 404) return false;
  return failureCount < 1;
};

// ─── useOrgTasks ──────────────────────────────────────────────────────────────

export function useOrgTasks(
  orgId: string | null,
  spaceId: string | null,
  filters: TaskFilters = {}
) {
  const { query: _q, ...serverFilters } = filters;

  return useQuery<TaskDTO[]>({
    queryKey: orgTaskKeys.list(orgId ?? "", spaceId ?? "", serverFilters),
    queryFn: async () => {
      const res = await api.get<{ data: TaskDTO[] }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks`,
        { params: toApiParams(filters) }
      );
      return res.data.data.map(normalizeTaskDTO);
    },
    enabled: !!orgId && !!spaceId,
    retry: noRetryOn401,
  });
}

// ─── useOrgTask ───────────────────────────────────────────────────────────────

export function useOrgTask(
  orgId: string | null,
  spaceId: string | null,
  taskId: string
) {
  return useQuery<TaskDTO>({
    queryKey: orgTaskKeys.detail(orgId ?? "", spaceId ?? "", taskId),
    queryFn: async () => {
      const res = await api.get<{ data: TaskDTO }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${taskId}`
      );
      return normalizeTaskDTO(res.data.data);
    },
    enabled: !!orgId && !!spaceId && !!taskId,
    retry: noRetryOn401,
  });
}

// ─── useLocateTask ────────────────────────────────────────────────────────────
// Cross-workspace lookup: given a taskId, finds the orgId + spaceId it belongs
// to — but only if the current user is an accepted member of that org.
// Used by TasksPage to auto-switch workspace context when following a shared link.

export function useLocateTask(taskId: string, enabled: boolean) {
  return useQuery<{ orgId: string; spaceId: string }>({
    queryKey: ["task-locate", taskId],
    queryFn: async () => {
      const res = await api.get<{ data: { orgId: string; spaceId: string } }>(
        `v1/tasks/${taskId}/locate`
      );
      return res.data.data;
    },
    enabled: !!taskId && enabled,
    retry: false,
    staleTime: 30_000,
  });
}

// ─── useOrgSubtasks ───────────────────────────────────────────────────────────


export function useOrgSubtasks(
  orgId: string | null,
  spaceId: string | null,
  parentTaskId: string
) {
  return useQuery<TaskDTO[]>({
    queryKey: orgTaskKeys.subtasks(orgId ?? "", spaceId ?? "", parentTaskId),
    queryFn: async () => {
      const res = await api.get<{ data: TaskDTO[] }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${parentTaskId}/subtasks`
      );
      return res.data.data.map(normalizeTaskDTO);
    },
    enabled: !!orgId && !!spaceId && !!parentTaskId,
    retry: noRetryOn401,
  });
}

// ─── useCreateOrgTask ─────────────────────────────────────────────────────────

export function useCreateOrgTask(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<TaskDTO, Error, CreateTaskInput>({
    mutationFn: async (input) => {
      const res = await api.post<{ data: TaskDTO }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks`,
        input
      );
      return normalizeTaskDTO(res.data.data);
    },
    onSuccess: (data) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      if (data.parent_task_id) {
        queryClient.invalidateQueries({
          queryKey: orgTaskKeys.subtasks(orgId, spaceId, data.parent_task_id),
        });
        queryClient.invalidateQueries({
          queryKey: orgTaskKeys.detail(orgId, spaceId, data.parent_task_id),
        });
      }
    },
    onError: () => {
      toast.error("Failed to create task. Please try again.");
    },
  });
}

// ─── useUpdateOrgTask ─────────────────────────────────────────────────────────

export function useUpdateOrgTask(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<TaskDTO, Error, { id: string; updates: UpdateTaskInput }>({
    mutationFn: async ({ id, updates }) => {
      const res = await api.patch<{ data: TaskDTO }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${id}`,
        updates
      );
      return normalizeTaskDTO(res.data.data);
    },
    onSuccess: (data) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      queryClient.invalidateQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, data.id),
      });
    },
    onError: () => {
      toast.error("Failed to update task. Please try again.");
    },
  });
}

// ─── useDeleteOrgTask ─────────────────────────────────────────────────────────

export function useDeleteOrgTask(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; title: string; type: "task" | "event" }, { previousTasksQueries?: [import("@tanstack/react-query").QueryKey, TaskDTO[] | undefined][]; previousDetail?: TaskDTO }>({
    onMutate: async ({ id: taskId }) => {
      if (!orgId || !spaceId) return {};

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      await queryClient.cancelQueries({ queryKey: orgTaskKeys.detail(orgId, spaceId, taskId) });

      // Snapshot the previous value
      const previousTasksQueries = queryClient.getQueriesData<TaskDTO[]>({
        queryKey: orgTaskKeys.lists(orgId, spaceId)
      });
      const previousDetail = queryClient.getQueryData<TaskDTO>(
        orgTaskKeys.detail(orgId, spaceId, taskId)
      );

      // Optimistically remove from list
      queryClient.setQueriesData<TaskDTO[]>(
        { queryKey: orgTaskKeys.lists(orgId, spaceId) },
        (old) => old ? old.filter((t) => t.id !== taskId) : old
      );

      return { previousTasksQueries, previousDetail };
    },
    mutationFn: async ({ id: taskId, title, type }) => {
      return new Promise((resolve, reject) => {
        let isUndone = false;

        const timerId = setTimeout(async () => {
          if (!isUndone) {
            try {
              await api.delete(`v1/orgs/${orgId}/spaces/${spaceId}/tasks/${taskId}`);
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        }, 3000);

        toast(`${title} (${type}) deleted`, {
          action: {
            label: "Undo",
            onClick: () => {
              isUndone = true;
              clearTimeout(timerId);
              reject(new Error("UNDONE"));
            }
          },
          duration: 3000,
        });
      });
    },
    onSuccess: (_data, { id: taskId }) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      queryClient.removeQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, taskId),
      });
    },
    onError: (err, { id: taskId }, context) => {
      if (context?.previousTasksQueries) {
        context.previousTasksQueries.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousDetail && orgId && spaceId) {
        queryClient.setQueryData(
          orgTaskKeys.detail(orgId, spaceId, taskId),
          context.previousDetail
        );
      }
      
      if (err.message !== "UNDONE") {
        toast.error("Failed to delete task. Please try again.");
      }
    },
  });
}

// ─── useChangeOrgTaskStatus ───────────────────────────────────────────────────

export function useChangeOrgTaskStatus(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<
    TaskDTO,
    { response?: { status?: number; data?: { message?: string } } },
    { id: string; status: AnyStatus }
  >({
    mutationFn: async ({ id, status }) => {
      const res = await api.patch<{ data: TaskDTO }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${id}/status`,
        { status }
      );
      return normalizeTaskDTO(res.data.data);
    },
    onSuccess: (data) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, data.id),
      });
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
    },
    onError: (error, { id }) => {
      const httpStatus = error?.response?.status;
      const message = error?.response?.data?.message;
      if (httpStatus === 400) {
        toast.error(
          message ??
            "Cannot mark as done — this task has incomplete dependencies. Complete them first.",
          { duration: 6000 }
        );
      } else {
        toast.error("Failed to update status. Please try again.");
      }
      if (orgId && spaceId) {
        queryClient.invalidateQueries({
          queryKey: orgTaskKeys.detail(orgId, spaceId, id),
        });
        queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      }
    },
  });
}

// ─── useAssignOrgUser ─────────────────────────────────────────────────────────

export function useAssignOrgUser(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; userId: string }>({
    mutationFn: async ({ id, userId }) => {
      await api.post(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${id}/assignees`,
        { user_id: userId }
      );
    },
    onSuccess: (_, { id }) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, id),
      });
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      toast.success("Assignee added");
    },
    onError: () => {
      toast.error("Failed to assign user");
    },
  });
}

// ─── useRemoveOrgAssignee ─────────────────────────────────────────────────────

export function useRemoveOrgAssignee(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; userId: string }>({
    mutationFn: async ({ id, userId }) => {
      await api.delete(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${id}/assignees/${userId}`
      );
    },
    onSuccess: (_, { id }) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, id),
      });
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      toast.success("Assignee removed");
    },
    onError: () => {
      toast.error("Failed to remove assignee");
    },
  });
}

// ─── useAddOrgDependency ──────────────────────────────────────────────────────

export function useAddOrgDependency(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    { response?: { status?: number; data?: { message?: string } } },
    { id: string; dependsOnTaskId: string }
  >({
    mutationFn: async ({ id, dependsOnTaskId }) => {
      await api.post(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${id}/dependencies`,
        { depends_on_task_id: dependsOnTaskId }
      );
    },
    onSuccess: (_, { id }) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, id),
      });
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
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

// ─── useRemoveOrgDependency ───────────────────────────────────────────────────

export function useRemoveOrgDependency(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; blockedByTaskId: string }>({
    mutationFn: async ({ id, blockedByTaskId }) => {
      await api.delete(
        `v1/orgs/${orgId}/spaces/${spaceId}/tasks/${id}/dependencies/${blockedByTaskId}`
      );
    },
    onSuccess: (_, { id }) => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: orgTaskKeys.detail(orgId, spaceId, id),
      });
      queryClient.invalidateQueries({ queryKey: orgTaskKeys.lists(orgId, spaceId) });
      toast.success("Dependency removed");
    },
    onError: () => {
      toast.error("Failed to remove dependency");
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { 
  ScheduleBlockDTO, 
  GanttTaskDTO, 
  UnscheduledTaskDTO 
} from "@/types/task";

export const scheduleKeys = {
  all: ["schedule"] as const,
  calendar: (workspaceId: string, start_range: string, end_range: string, user_id?: string) => 
    [...scheduleKeys.all, "calendar", workspaceId, start_range, end_range, user_id] as const,
  unscheduled: (workspaceId: string, filters: any) => 
    [...scheduleKeys.all, "unscheduled", workspaceId, filters] as const,
  gantt: (workspaceId: string, scope: string, project_id?: string) => 
    [...scheduleKeys.all, "gantt", workspaceId, scope, project_id] as const,
};

export function useCalendarTasks({ start_range, end_range, user_id }: { start_range: string, end_range: string, user_id?: string }) {
  const { workspaceId } = useWorkspace();

  return useQuery<ScheduleBlockDTO[]>({
    queryKey: scheduleKeys.calendar(workspaceId ?? "", start_range, end_range, user_id),
    queryFn: async () => {
      const res = await api.get<{ data: ScheduleBlockDTO[] }>("v1/schedule/calendar", {
        params: { start_range, end_range, user_id },
      });
      return res.data.data;
    },
    enabled: !!start_range && !!end_range && !!workspaceId,
  });
}

export function useUnscheduledTasks({ limit = 50, offset = 0, search }: { limit?: number, offset?: number, search?: string }) {
  const { workspaceId } = useWorkspace();

  return useQuery<{ data: UnscheduledTaskDTO[], pagination: { limit: number, offset: number, total: number } }>({
    queryKey: scheduleKeys.unscheduled(workspaceId ?? "", { limit, offset, search }),
    queryFn: async () => {
      const res = await api.get<{ data: UnscheduledTaskDTO[], pagination: any }>("v1/schedule/unscheduled", {
        params: { limit, offset, search },
      });
      return res.data;
    },
    enabled: !!workspaceId,
  });
}

export function useUpdateTaskTimeblock() {
  const queryClient = useQueryClient();

  return useMutation<ScheduleBlockDTO, any, { taskId: string; scheduled_start: string; scheduled_end: string }>({
    mutationFn: async ({ taskId, scheduled_start, scheduled_end }) => {
      const res = await api.put<{ data: ScheduleBlockDTO }>(`v1/schedule/tasks/${taskId}/timeblock`, {
        scheduled_start,
        scheduled_end,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...scheduleKeys.all, "calendar"] });
      queryClient.invalidateQueries({ queryKey: [...scheduleKeys.all, "unscheduled"] });
    },
    onError: (error) => {
      const message = error?.response?.data?.message || "Failed to update timeblock";
      toast.error(message);
    },
  });
}

export function useDeleteTaskTimeblock() {
  const queryClient = useQueryClient();

  return useMutation<void, any, string>({
    mutationFn: async (taskId) => {
      await api.delete(`v1/schedule/tasks/${taskId}/timeblock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...scheduleKeys.all, "calendar"] });
      queryClient.invalidateQueries({ queryKey: [...scheduleKeys.all, "unscheduled"] });
    },
    onError: (error) => {
      const message = error?.response?.data?.message || "Failed to remove timeblock";
      toast.error(message);
    },
  });
}

export function useGanttTasks({ scope, project_id }: { scope: "workspace" | "user", project_id?: string }) {
  const { workspaceId } = useWorkspace();

  return useQuery<GanttTaskDTO[]>({
    queryKey: scheduleKeys.gantt(workspaceId ?? "", scope, project_id),
    queryFn: async () => {
      const res = await api.get<{ data: GanttTaskDTO[] }>("v1/schedule/gantt", {
        params: { scope, project_id },
      });
      return res.data.data;
    },
    enabled: !!workspaceId && !!scope,
  });
}

export function useUpdateTaskDeadline() {
  const queryClient = useQueryClient();

  return useMutation<{ updated_task: any, cascaded_task_ids: string[] }, any, { id: string; start_date: string; due_date: string }>({
    mutationFn: async ({ id, start_date, due_date }) => {
      const res = await api.patch<{ data: { updated_task: any, cascaded_task_ids: string[] } }>(
        `v1/schedule/tasks/${id}/deadline`,
        { start_date, due_date }
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [...scheduleKeys.all, "gantt"] });
      if (data.cascaded_task_ids.length > 0) {
        toast.info(`${data.cascaded_task_ids.length} dependent task(s) were automatically shifted.`);
      }
    },
    onError: (error) => {
      const message = error?.response?.data?.message || "Failed to update deadline";
      toast.error(message);
    },
  });
}

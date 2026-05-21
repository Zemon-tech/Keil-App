import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { TaskStatus, TaskPriority } from "@/types/task";

export interface MyTaskDTO {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  start_date: string | null;
  created_at: string;
  updated_at: string;
  org_id: string;
  org_name: string;
  space_id: string;
  space_name: string;
}

export interface MyTasksFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  org_id?: string;
}

export function useMyTasks(filters: MyTasksFilters = {}) {
  return useQuery<MyTaskDTO[]>({
    queryKey: ["my-tasks", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status)   params.set("status",   filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.org_id)   params.set("org_id",   filters.org_id);
      
      const res = await api.get<{ data: { tasks: MyTaskDTO[] } }>(
        `v1/my-tasks?${params.toString()}`
      );
      return res.data.data.tasks ?? [];
    },
  });
}

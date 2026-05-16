import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import type { AnyStatus, TaskPriority, EventType } from "@/types/task";

// ─── Public Task DTO ──────────────────────────────────────────────────────────
// Only display-safe fields are returned by the public endpoint.
// No emails, no org/space internals, no system fields.

export interface PublicTaskDTO {
  id: string;
  title: string;
  type?: "task" | "event";
  event_type?: EventType | null;
  location?: string | null;
  is_all_day?: boolean;
  status: AnyStatus;
  priority: TaskPriority;
  due_date?: string | null;
  start_date?: string | null;
  description?: string | null;
  objective?: string | null;
  success_criteria?: string | null;
  parent_task_id?: string | null;
  parent_task_title?: string | null;
  subtask_count?: number;
  subtasks?: Array<{ id: string; title: string; status: string }>;
  assignees?: Array<{ id: string; name: string | null }>;
}

// ─── Bare axios instance ──────────────────────────────────────────────────────
// Does NOT attach any auth token — intentionally unauthenticated.

const publicApi = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace(/\/$/, "") + "/",
  headers: { "Content-Type": "application/json" },
});

// ─── usePublicTask ────────────────────────────────────────────────────────────

export function usePublicTask(taskId: string | undefined, enabled = true) {
  return useQuery<PublicTaskDTO>({
    queryKey: ["public-task", taskId],
    queryFn: async () => {
      const res = await publicApi.get<{ data: PublicTaskDTO }>(
        `v1/public/tasks/${taskId}`
      );
      return res.data.data;
    },
    enabled: !!taskId && enabled,
    retry: false,
    staleTime: 60_000, // 1 minute — public view doesn't need aggressive refetch
  });
}

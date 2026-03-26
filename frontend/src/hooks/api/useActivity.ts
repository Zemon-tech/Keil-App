import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { ActivityLogEntry } from "../../types/task";

// ─── Response shape ───────────────────────────────────────────────────────────

type ActivityResponse = {
    success: boolean;
    data: ActivityLogEntry[];
};

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const activityKeys = {
    all: ["activity"] as const,
    task: (taskId: string) => [...activityKeys.all, "task", taskId] as const,
    workspace: (workspaceId?: string, options?: { limit?: number; offset?: number }) =>
        [...activityKeys.all, "workspace", workspaceId, options] as const,
};

// ─── useTaskActivity ──────────────────────────────────────────────────────────

/**
 * Fetches the full activity log for a specific task.
 * Calls: GET /api/v1/activity?entity_type=task&entity_id=<taskId>
 * Enabled only when taskId is truthy.
 */
export function useTaskActivity(taskId?: string) {
    return useQuery<ActivityLogEntry[]>({
        queryKey: activityKeys.task(taskId ?? ""),
        queryFn: async () => {
            const res = await api.get<ActivityResponse>("v1/activity", {
                params: {
                    entity_type: "task",
                    entity_id: taskId,
                },
            });
            return res.data.data;
        },
        enabled: !!taskId,
    });
}

// ─── useWorkspaceActivity ─────────────────────────────────────────────────────

/**
 * Fetches the workspace-level activity feed (paginated).
 * Calls: GET /api/v1/activity?limit=<n>&offset=<n>
 * Intended for the future dashboard (Module 5) — wired here for completeness.
 * Enabled only when workspaceId is truthy.
 */
export function useWorkspaceActivity(
    workspaceId?: string,
    options?: { limit?: number; offset?: number }
) {
    return useQuery<ActivityLogEntry[]>({
        queryKey: activityKeys.workspace(workspaceId, options),
        queryFn: async () => {
            const res = await api.get<ActivityResponse>("v1/activity", {
                params: {
                    limit: options?.limit ?? 20,
                    offset: options?.offset ?? 0,
                },
            });
            return res.data.data;
        },
        enabled: !!workspaceId,
    });
}

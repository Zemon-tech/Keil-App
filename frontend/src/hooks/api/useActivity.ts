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
    orgTask: (orgId: string, spaceId: string, taskId: string) =>
        [...activityKeys.all, "org", orgId, spaceId, "task", taskId] as const,
};

// ─── useOrgTaskActivity ───────────────────────────────────────────────────────

/**
 * Fetches the activity log for a specific task scoped to an org/space.
 * Calls: GET /api/v1/orgs/:orgId/spaces/:spaceId/activity?entity_type=task&entity_id=<taskId>
 * Enabled only when all three params are truthy.
 */
export function useOrgTaskActivity(
    orgId: string | null,
    spaceId: string | null,
    taskId?: string
) {
    return useQuery<ActivityLogEntry[]>({
        queryKey: activityKeys.orgTask(orgId ?? "", spaceId ?? "", taskId ?? ""),
        queryFn: async () => {
            const res = await api.get<ActivityResponse>(
                `v1/orgs/${orgId}/spaces/${spaceId}/activity`,
                {
                    params: {
                        entity_type: "task",
                        entity_id: taskId,
                    },
                }
            );
            return res.data.data;
        },
        enabled: !!orgId && !!spaceId && !!taskId,
        retry: (failureCount, error: unknown) => {
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status === 401 || status === 403) return false;
            return failureCount < 1;
        },
    });
}

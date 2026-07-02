import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── Response shape ───────────────────────────────────────────────────────────

export interface MetricPoint {
    bucket_date: string; // YYYY-MM-DD
    value: number;
}

type MetricResponse = {
    success: boolean;
    data: MetricPoint[];
};

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const analyticsKeys = {
    all: ["analytics"] as const,
    tasksCompletedDaily: (orgId: string, spaceId: string, days: number) =>
        [...analyticsKeys.all, "tasks-completed-daily", orgId, spaceId, days] as const,
};

// ─── useTasksCompletedDaily ────────────────────────────────────────────────────

/**
 * Fetches pre-computed daily "tasks completed" counts for a space.
 * Calls: GET /api/v1/orgs/:orgId/spaces/:spaceId/analytics/tasks-completed-daily?days=<days>
 *
 * This reads only the materialized analytics_metric_daily table on the
 * backend — cheap, fast, safe to poll with a normal refetchInterval later
 * if/when live updates are added.
 */
export function useTasksCompletedDaily(
    orgId: string | null,
    spaceId: string | null,
    days = 30
) {
    return useQuery<MetricPoint[]>({
        queryKey: analyticsKeys.tasksCompletedDaily(orgId ?? "", spaceId ?? "", days),
        queryFn: async () => {
            const res = await api.get<MetricResponse>(
                `v1/orgs/${orgId}/spaces/${spaceId}/analytics/tasks-completed-daily`,
                { params: { days } }
            );
            return res.data.data;
        },
        enabled: !!orgId && !!spaceId,
        retry: (failureCount, error: unknown) => {
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status === 401 || status === 403) return false;
            return failureCount < 1;
        },
    });
}

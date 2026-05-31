import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { DashboardTaskDTO } from "@/types/task";

export type DashboardResponse = {
    immediate: DashboardTaskDTO[];
    today: DashboardTaskDTO[];
    blocked: DashboardTaskDTO[];
    backlog: DashboardTaskDTO[];
    needsReply: Array<{ id: string; from: string; message: string }>;
};

// ─── Org/space-scoped dashboard ───────────────────────────────────────────────
// Cache key includes orgId and spaceId so switching spaces immediately
// invalidates the previous space's data.

export function useOrgDashboard(orgId: string | null, spaceId: string | null) {
    return useQuery<DashboardResponse>({
        queryKey: ["dashboard", "org", orgId, spaceId],
        queryFn: async () => {
            console.log("[useDashboard] Fetching dashboard", { orgId, spaceId });
            const res = await api.get<{ data: DashboardResponse }>(
                `v1/orgs/${orgId}/spaces/${spaceId}/dashboard`
            );
            const data = res.data.data;
            console.log("[useDashboard] Response received", {
                needsReply: data.needsReply,
                needsReplyCount: data.needsReply?.length ?? 0,
                immediateCount: data.immediate?.length ?? 0,
                todayCount: data.today?.length ?? 0,
            });
            return data;
        },
        enabled: !!orgId && !!spaceId,
        retry: (failureCount, error: unknown) => {
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status === 401 || status === 403) return false;
            return failureCount < 1;
        },
    });
}

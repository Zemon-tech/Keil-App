import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import type { DashboardTaskDTO } from "@/types/task";

export type DashboardResponse = {
    immediate: DashboardTaskDTO[];
    today: DashboardTaskDTO[];
    blocked: DashboardTaskDTO[];
    backlog: DashboardTaskDTO[];
};

// ─── Legacy dashboard (personal mode / workspace-scoped fallback) ─────────────
// Uses the legacy GET /v1/dashboard route which resolves workspace context
// server-side via attachWorkspaceContext. Always enabled — the backend
// returns an empty response gracefully when the user has no workspace.

export function useDashboard() {
    return useQuery<DashboardResponse>({
        queryKey: ["dashboard", "legacy"],
        queryFn: async () => {
            const res = await api.get<{ data: DashboardResponse }>("/v1/dashboard");
            return res.data.data;
        },
        retry: (failureCount, error: unknown) => {
            const status = (error as { response?: { status?: number } })?.response?.status;
            if (status === 401 || status === 403) return false;
            return failureCount < 1;
        },
    });
}

// ─── Org/space-scoped dashboard ───────────────────────────────────────────────
// Cache key includes orgId and spaceId so switching spaces immediately
// invalidates the previous space's data.

export function useOrgDashboard(orgId: string | null, spaceId: string | null) {
    return useQuery<DashboardResponse>({
        queryKey: ["dashboard", "org", orgId, spaceId],
        queryFn: async () => {
            const res = await api.get<{ data: DashboardResponse }>(
                `v1/orgs/${orgId}/spaces/${spaceId}/dashboard`
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

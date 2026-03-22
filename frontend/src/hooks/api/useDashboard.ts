import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import type { DashboardTaskDTO } from "@/types/task";

export type DashboardResponse = {
    immediate: DashboardTaskDTO[];
    today: DashboardTaskDTO[];
    blocked: DashboardTaskDTO[];
    backlog: DashboardTaskDTO[];
};

export function useDashboard() {
    const { workspaceId } = useWorkspace();

    return useQuery<DashboardResponse>({
        queryKey: ["dashboard", workspaceId],
        queryFn: async () => {
            const res = await api.get<{ data: DashboardResponse }>("/v1/dashboard");
            return res.data.data;
        },
        enabled: !!workspaceId,
    });
}

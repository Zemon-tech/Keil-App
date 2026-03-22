import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
  };
}

export const workspaceKeys = {
  all: ["workspaces"] as const,
  members: (workspaceId: string) => [...workspaceKeys.all, workspaceId, "members"] as const,
};

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery<WorkspaceMember[]>({
    queryKey: workspaceKeys.members(workspaceId!),
    queryFn: async () => {
      const res = await api.get<{ data: WorkspaceMember[] }>(`v1/workspaces/${workspaceId}/members`);
      return res.data.data;
    },
    enabled: !!workspaceId,
  });
}

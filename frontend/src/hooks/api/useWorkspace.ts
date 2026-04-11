import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
}

export const workspaceKeys = {
  all: ["workspaces"] as const,
  list: () => [...workspaceKeys.all, "list"] as const,
  members: (workspaceId: string) => [...workspaceKeys.all, workspaceId, "members"] as const,
};

export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: workspaceKeys.list(),
    queryFn: async () => {
      const res = await api.get<{ data: { workspaces: Workspace[] } }>(`v1/workspaces`);
      return res.data.data.workspaces;
    },
  });
}

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

// ─── Phase 2: Invite Tokens ───────────────────────────────────────────────────

export function useCreateInviteLink() {
  return useMutation({
    mutationFn: async (workspaceId: string) => {
      const res = await api.post<{ data: { inviteLink: string, token: string } }>(`v1/workspaces/${workspaceId}/invite`);
      return res.data.data;
    },
  });
}

export function useJoinWorkspace() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await api.post<{ data: { workspaceId: string } }>(`v1/workspaces/join`, { token });
      return res.data;
    },
    onSuccess: () => {
      // Invalidate workspaces list to fetch the newly joined workspace
      queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    }
  });
}

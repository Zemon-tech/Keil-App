import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";

export interface NotionStatus {
  connected: boolean;
  workspace_name?: string;
  connected_at?: string;
}

export const notionKeys = {
  status: ["integrations", "notion", "status"] as const,
};

/**
 * Fetches current user's Notion connection status.
 */
export function useNotionStatus() {
  return useQuery<NotionStatus>({
    queryKey: notionKeys.status,
    queryFn: async () => {
      const res = await api.get<{ data: NotionStatus }>(
        "v1/integrations/notion/status"
      );
      return res.data.data;
    },
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
    staleTime: 30_000,
  });
}

/**
 * Redirects the browser to the Notion OAuth page.
 */
export function useConnectNotion() {
  return async () => {
    try {
      const res = await api.get<{ data: { url: string } }>(
        "v1/integrations/notion/connect"
      );
      window.location.href = res.data.data.url;
    } catch (err) {
      toast.error("Failed to start Notion connection. Please try again.");
      console.error("[notion] connect error:", err);
    }
  };
}

/**
 * Connects Notion manually using a token.
 */
export function useConnectNotionManual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ token, workspaceName }: { token: string; workspaceName?: string }) => {
      await api.post("v1/integrations/notion/manual-connect", { token, workspaceName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notionKeys.status });
      toast.success("Notion connected successfully (Internal Token)");
    },
    onError: () => {
      toast.error("Failed to connect Notion. Please verify your token.");
    },
  });
}

/**
 * Disconnects Notion.
 */
export function useDisconnectNotion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.delete("v1/integrations/notion");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notionKeys.status });
      toast.success("Notion disconnected");
    },
    onError: () => {
      toast.error("Failed to disconnect Notion. Please try again.");
    },
  });
}

/**
 * Imports a Notion page into Motion.
 */
export function useImportNotionPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      notionPageId,
      orgId,
      spaceId,
      parentId,
    }: {
      notionPageId: string;
      orgId: string;
      spaceId: string;
      parentId?: string | null;
    }) => {
      const res = await api.post("v1/integrations/notion/import", {
        notionPageId,
        orgId,
        spaceId,
        parentId,
      });
      return res.data.data;
    },
    onSuccess: () => {
      // Invalidate motion lists to refresh the sidebar
      queryClient.invalidateQueries({ queryKey: ["motionPages"] });
      toast.success("Notion page imported successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to import Notion page.");
    },
  });
}

/**
 * Exports a Motion page to Notion.
 */
export function useExportNotionPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      motionPageId,
      parentNotionPageId,
      targetNotionPageId,
      mode,
    }: {
      motionPageId: string;
      parentNotionPageId?: string | null;
      targetNotionPageId?: string | null;
      mode?: 'create' | 'append';
    }) => {
      const res = await api.post("v1/integrations/notion/export", {
        motionPageId,
        parentNotionPageId,
        targetNotionPageId,
        mode,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["motionPages", data.id] });
      queryClient.invalidateQueries({ queryKey: ["motionPages"] });
      toast.success("Motion page exported to Notion successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to export page to Notion.");
    },
  });
}

/**
 * Syncs a linked Motion page with Notion.
 */
export function useSyncNotionPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ motionPageId }: { motionPageId: string }) => {
      const res = await api.post("v1/integrations/notion/sync", { motionPageId });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["motionPages", data.id] });
      queryClient.invalidateQueries({ queryKey: ["motionPages"] });
      toast.success("Page content synced with Notion!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to sync page with Notion.");
    },
  });
}

/**
 * Unlinks a Motion page from its Notion page.
 */
export function useUnlinkNotionPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ motionPageId }: { motionPageId: string }) => {
      const res = await api.post("v1/integrations/notion/unlink", { motionPageId });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["motionPages", data.id] });
      queryClient.invalidateQueries({ queryKey: ["motionPages"] });
      toast.success("Page unlinked from Notion successfully!");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Failed to unlink page.");
    },
  });
}

export interface NotionSearchPageResult {
  id: string;
  url: string;
  properties?: Record<string, any>;
  icon?: {
    type: 'emoji' | 'external' | 'file';
    emoji?: string;
    external?: { url: string };
    file?: { url: string };
  } | null;
}

export interface NotionSearchResponse {
  results: NotionSearchPageResult[];
  next_cursor?: string | null;
  has_more: boolean;
}

/**
 * Searches user's Notion workspace pages.
 */
export function useSearchNotionPages(query: string) {
  return useQuery<NotionSearchResponse>({
    queryKey: ["integrations", "notion", "search", query],
    queryFn: async () => {
      const res = await api.get<{ data: NotionSearchResponse }>(
        `v1/integrations/notion/search?q=${encodeURIComponent(query)}`
      );
      return res.data.data;
    },
    enabled: query.trim().length > 0,
    staleTime: 5000,
  });
}


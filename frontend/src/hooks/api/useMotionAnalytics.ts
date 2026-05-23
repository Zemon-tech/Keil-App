import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import api from "@/lib/api";

// ─── DTO Interfaces ──────────────────────────────────────────────────────────

export interface MotionPageUpdateDTO {
  id: string;
  page_id: string;
  user_id: string | null;
  action_type: "edit" | "rename" | "icon" | "cover" | "create";
  description: string | null;
  deleted_content: string[] | null;
  added_content: string[] | null;
  created_at: string;
  updated_at: string;
  user_name: string | null;
  user_email: string | null;
}

export interface MotionPageViewDTO {
  id: string;
  page_id: string;
  user_id: string | null;
  created_at: string;
}

export interface PageViewerDTO {
  id: string;
  email: string;
  name: string | null;
  last_viewed_at: string;
}

export interface PageEditorDTO {
  id: string;
  email: string;
  name: string | null;
  last_edited_at: string;
}

export interface PageEditorsResponse {
  creator: {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
  } | null;
  recent: PageEditorDTO[];
}

export interface ViewsSummaryResponse {
  total: number;
  chartData: {
    date: string;
    views: number;
    unique_views: number;
  }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const notesBase = (orgId: string, spaceId: string) =>
  `v1/orgs/${orgId}/spaces/${spaceId}/notes`;

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const motionAnalyticsKeys = {
  all: ["motion-analytics"] as const,
  views: (pageId: string, orgId: string, spaceId: string) => [...motionAnalyticsKeys.all, orgId, spaceId, pageId, "views"] as const,
  summary: (pageId: string, range: number, orgId: string, spaceId: string) => [...motionAnalyticsKeys.all, orgId, spaceId, pageId, "summary", range] as const,
  permission: (pageId: string, orgId: string, spaceId: string) => [...motionAnalyticsKeys.all, orgId, spaceId, pageId, "permission"] as const,
  viewers: (pageId: string, orgId: string, spaceId: string) => [...motionAnalyticsKeys.all, orgId, spaceId, pageId, "viewers"] as const,
  updates: (pageId: string, orgId: string, spaceId: string) => [...motionAnalyticsKeys.all, orgId, spaceId, pageId, "updates"] as const,
  editors: (pageId: string, orgId: string, spaceId: string) => [...motionAnalyticsKeys.all, orgId, spaceId, pageId, "editors"] as const,
};

const noRetryOn4xx = (failureCount: number, error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 1;
};

// ─── Query Hooks ──────────────────────────────────────────────────────────────

/**
 * Hook to record page views
 */
export function useRecordPageView(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<MotionPageViewDTO, Error, void>({
    mutationFn: async () => {
      const res = await api.post<{ data: MotionPageViewDTO }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/views`
      );
      return res.data.data;
    },
    onSuccess: () => {
      if (pageId && orgId && spaceId) {
        queryClient.invalidateQueries({ queryKey: motionAnalyticsKeys.views(pageId, orgId, spaceId) });
        queryClient.invalidateQueries({ queryKey: motionAnalyticsKeys.summary(pageId, 7, orgId, spaceId) });
        queryClient.invalidateQueries({ queryKey: motionAnalyticsKeys.summary(pageId, 28, orgId, spaceId) });
        queryClient.invalidateQueries({ queryKey: motionAnalyticsKeys.summary(pageId, 90, orgId, spaceId) });
      }
    },
  });
}

/**
 * Hook to fetch daily page views summary counts
 */
export function useViewsSummary(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null,
  range = 28
) {
  return useQuery<ViewsSummaryResponse>({
    queryKey: motionAnalyticsKeys.summary(pageId ?? "", range, orgId ?? "", spaceId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: ViewsSummaryResponse }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/views/summary`,
        { params: { range } }
      );
      return res.data.data;
    },
    enabled: !!orgId && !!spaceId && !!pageId,
    retry: noRetryOn4xx,
    staleTime: 10_000,
  });
}

/**
 * Hook to fetch the current user's allow view history preference
 */
export function useViewPermission(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  return useQuery<boolean>({
    queryKey: motionAnalyticsKeys.permission(pageId ?? "", orgId ?? "", spaceId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: { allowed: boolean } }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/view-permission`
      );
      return res.data.data.allowed;
    },
    enabled: !!orgId && !!spaceId && !!pageId,
    retry: noRetryOn4xx,
  });
}

/**
 * Hook to set the user's view permission preference
 */
export function useSetViewPermission(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, boolean>({
    mutationFn: async (allow: boolean) => {
      await api.post(
        `${notesBase(orgId!, spaceId!)}/${pageId}/view-permission`,
        { allow }
      );
    },
    onSuccess: () => {
      if (pageId && orgId && spaceId) {
        queryClient.invalidateQueries({ queryKey: motionAnalyticsKeys.permission(pageId, orgId, spaceId) });
        queryClient.invalidateQueries({ queryKey: motionAnalyticsKeys.viewers(pageId, orgId, spaceId) });
      }
    },
  });
}

/**
 * Hook to fetch the allowed space viewers
 */
export function usePageViewers(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  return useQuery<PageViewerDTO[]>({
    queryKey: motionAnalyticsKeys.viewers(pageId ?? "", orgId ?? "", spaceId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: PageViewerDTO[] }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/viewers`
      );
      return res.data.data;
    },
    enabled: !!orgId && !!spaceId && !!pageId,
    retry: noRetryOn4xx,
    staleTime: 10_000,
  });
}

/**
 * Hook to fetch page updates with infinite scroll (cursor pagination)
 */
export function usePageUpdates(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null,
  limit = 20
) {
  return useInfiniteQuery({
    queryKey: motionAnalyticsKeys.updates(pageId ?? "", orgId ?? "", spaceId ?? ""),
    queryFn: async ({ pageParam = 0 }) => {
      const res = await api.get<{ data: MotionPageUpdateDTO[] }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/updates`,
        { params: { limit, offset: pageParam } }
      );
      return res.data.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === limit ? allPages.length * limit : undefined;
    },
    enabled: !!orgId && !!spaceId && !!pageId,
  });
}

/**
 * Hook to fetch page creator and recent editors
 */
export function usePageEditors(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  return useQuery<PageEditorsResponse>({
    queryKey: motionAnalyticsKeys.editors(pageId ?? "", orgId ?? "", spaceId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: PageEditorsResponse }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/editors`
      );
      return res.data.data;
    },
    enabled: !!orgId && !!spaceId && !!pageId,
    retry: noRetryOn4xx,
    staleTime: 10_000,
  });
}

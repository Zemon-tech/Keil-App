import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect } from "react";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { JSONContent } from "@tiptap/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MotionPageDTO {
  id: string;
  org_id: string;
  space_id: string;
  created_by: string;
  updated_by: string;
  parent_id: string | null;
  title: string;
  content: JSONContent;
  icon: string | null;
  cover_image: string | null;
  cover_position: number;
  position: number;
  small_text: boolean;
  full_width: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type MotionShareType = "public_link" | "space";
export type MotionPermission = "view" | "edit";

export interface MotionPageShareDTO {
  id: string;
  page_id: string;
  share_type: MotionShareType;
  target_org_id: string | null;
  target_space_id: string | null;
  share_token: string | null;
  permission: MotionPermission;
  created_by: string;
  created_at: string;
  expires_at: string | null;
}

export interface CreateMotionPageInput {
  parent_id?: string | null;
  title?: string;
  icon?: string | null;
  cover_image?: string | null;
}

export interface UpdateMotionPageInput {
  title?: string;
  content?: JSONContent;
  icon?: string | null;
  cover_image?: string | null;
  cover_position?: number;
  parent_id?: string | null;
  small_text?: boolean;
  full_width?: boolean;
}

export interface CreateShareInput {
  share_type: MotionShareType;
  permission?: MotionPermission;
  target_org_id?: string | null;
  target_space_id?: string | null;
  expires_at?: string | null;
}

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const motionPageKeys = {
  all: ["motion-pages"] as const,
  lists: (orgId: string, spaceId: string) =>
    [...motionPageKeys.all, orgId, spaceId, "list"] as const,
  trash: (orgId: string, spaceId: string) =>
    [...motionPageKeys.all, orgId, spaceId, "trash"] as const,
  detail: (orgId: string, spaceId: string, id: string) =>
    [...motionPageKeys.all, orgId, spaceId, "detail", id] as const,
  shares: (orgId: string, spaceId: string, pageId: string) =>
    [...motionPageKeys.all, orgId, spaceId, "shares", pageId] as const,
  shared: (orgId: string, spaceId: string) =>
    [...motionPageKeys.all, orgId, spaceId, "shared"] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const noRetryOn4xx = (failureCount: number, error: unknown) => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 1;
};

const notesBase = (orgId: string, spaceId: string) =>
  `v1/orgs/${orgId}/spaces/${spaceId}/notes`;

// ─── Read Hooks ───────────────────────────────────────────────────────────────

/** Fetches all active pages for the current space (sidebar tree data). */
export function useMotionPages(orgId: string | null, spaceId: string | null) {
  return useQuery<MotionPageDTO[]>({
    queryKey: motionPageKeys.lists(orgId ?? "", spaceId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: MotionPageDTO[] }>(
        notesBase(orgId!, spaceId!)
      );
      return res.data.data;
    },
    enabled: !!orgId && !!spaceId,
    retry: noRetryOn4xx,
    staleTime: 30_000, // 30s — pages don't change that often
  });
}

/** Fetches a single page by id. */
export function useMotionPage(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  return useQuery<MotionPageDTO>({
    queryKey: motionPageKeys.detail(orgId ?? "", spaceId ?? "", pageId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: MotionPageDTO }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}`
      );
      return res.data.data;
    },
    enabled: !!orgId && !!spaceId && !!pageId,
    retry: noRetryOn4xx,
    staleTime: 10_000,
    placeholderData: (previousData) => previousData,
  });
}

/** Fetches soft-deleted pages (trash). */
export function useMotionTrash(orgId: string | null, spaceId: string | null) {
  return useQuery<MotionPageDTO[]>({
    queryKey: motionPageKeys.trash(orgId ?? "", spaceId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: MotionPageDTO[] }>(
        `${notesBase(orgId!, spaceId!)}/trash`
      );
      return res.data.data;
    },
    enabled: !!orgId && !!spaceId,
    retry: noRetryOn4xx,
  });
}

/** Fetches pages shared INTO the current space from other spaces. */
export function useSharedToSpace(orgId: string | null, spaceId: string | null) {
  return useQuery<MotionPageDTO[]>({
    queryKey: motionPageKeys.shared(orgId ?? "", spaceId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: MotionPageDTO[] }>(
        `${notesBase(orgId!, spaceId!)}/shared`
      );
      return res.data.data;
    },
    enabled: !!orgId && !!spaceId,
    retry: noRetryOn4xx,
  });
}

/** Fetches all shares for a specific page. */
export function useMotionPageShares(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  return useQuery<MotionPageShareDTO[]>({
    queryKey: motionPageKeys.shares(orgId ?? "", spaceId ?? "", pageId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: MotionPageShareDTO[] }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/shares`
      );
      return res.data.data;
    },
    enabled: !!orgId && !!spaceId && !!pageId,
    retry: noRetryOn4xx,
  });
}

// ─── Mutation Hooks ───────────────────────────────────────────────────────────

/** Creates a new page. Optimistically inserts into the list cache. */
export function useCreateMotionPage(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<MotionPageDTO, Error, CreateMotionPageInput>({
    mutationFn: async (input) => {
      const res = await api.post<{ data: MotionPageDTO }>(
        notesBase(orgId!, spaceId!),
        input
      );
      return res.data.data;
    },
    onSuccess: (newPage) => {
      if (!orgId || !spaceId) return;
      // Optimistically prepend to the list cache
      queryClient.setQueryData<MotionPageDTO[]>(
        motionPageKeys.lists(orgId, spaceId),
        (old) => (old ? [newPage, ...old] : [newPage])
      );
      // Also seed the detail cache so navigating to the page is instant
      queryClient.setQueryData(
        motionPageKeys.detail(orgId, spaceId, newPage.id),
        newPage
      );
    },
    onError: () => {
      toast.error("Failed to create page. Please try again.");
    },
  });
}

/**
 * Updates a page (title, content, icon, cover).
 * Optimistically updates both the list cache and the detail cache.
 * This is the hot path — called on every debounced content save.
 */
export function useUpdateMotionPage(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<
    MotionPageDTO,
    Error,
    { id: string; updates: UpdateMotionPageInput },
    { previousList?: MotionPageDTO[]; previousDetail?: MotionPageDTO }
  >({
    onMutate: async ({ id, updates }) => {
      if (!orgId || !spaceId) return {};

      // Cancel in-flight refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({
        queryKey: motionPageKeys.detail(orgId, spaceId, id),
      });
      await queryClient.cancelQueries({
        queryKey: motionPageKeys.lists(orgId, spaceId),
      });

      const previousDetail = queryClient.getQueryData<MotionPageDTO>(
        motionPageKeys.detail(orgId, spaceId, id)
      );
      const previousList = queryClient.getQueryData<MotionPageDTO[]>(
        motionPageKeys.lists(orgId, spaceId)
      );

      // Apply optimistic update to detail cache
      if (previousDetail) {
        queryClient.setQueryData<MotionPageDTO>(
          motionPageKeys.detail(orgId, spaceId, id),
          { ...previousDetail, ...updates, updated_at: new Date().toISOString() }
        );
      }

      // Apply optimistic update to list cache (title + icon visible in sidebar)
      queryClient.setQueryData<MotionPageDTO[]>(
        motionPageKeys.lists(orgId, spaceId),
        (old) =>
          old?.map((p) =>
            p.id === id
              ? { ...p, ...updates, updated_at: new Date().toISOString() }
              : p
          )
      );

      return { previousDetail, previousList };
    },
    mutationFn: async ({ id, updates }) => {
      const res = await api.patch<{ data: MotionPageDTO }>(
        `${notesBase(orgId!, spaceId!)}/${id}`,
        updates
      );
      return res.data.data;
    },
    onSuccess: (serverPage) => {
      if (!orgId || !spaceId) return;
      // Replace optimistic data with server-confirmed data
      queryClient.setQueryData(
        motionPageKeys.detail(orgId, spaceId, serverPage.id),
        serverPage
      );
      queryClient.setQueryData<MotionPageDTO[]>(
        motionPageKeys.lists(orgId, spaceId),
        (old) => old?.map((p) => (p.id === serverPage.id ? serverPage : p))
      );
    },
    onError: (_err, { id }, context) => {
      // Roll back optimistic updates on failure
      if (context?.previousDetail && orgId && spaceId) {
        queryClient.setQueryData(
          motionPageKeys.detail(orgId, spaceId, id),
          context.previousDetail
        );
      }
      if (context?.previousList && orgId && spaceId) {
        queryClient.setQueryData(
          motionPageKeys.lists(orgId, spaceId),
          context.previousList
        );
      }
      // Don't toast on content save failures — the save indicator in MotionPage handles it
    },
  });
}

/** Soft-deletes a page (moves to trash). Optimistically removes from list. */
export function useSoftDeleteMotionPage(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; title: string }>({
    onMutate: async ({ id }) => {
      if (!orgId || !spaceId) return;
      await queryClient.cancelQueries({
        queryKey: motionPageKeys.lists(orgId, spaceId),
      });
      // Optimistically remove from list (and all descendants)
      queryClient.setQueryData<MotionPageDTO[]>(
        motionPageKeys.lists(orgId, spaceId),
        (old) => old?.filter((p) => p.id !== id && p.parent_id !== id) ?? []
      );
    },
    mutationFn: async ({ id }) => {
      await api.delete(`${notesBase(orgId!, spaceId!)}/${id}`);
    },
    onSuccess: (_, { title }) => {
      if (!orgId || !spaceId) return;
      // Refresh both list and trash
      queryClient.invalidateQueries({
        queryKey: motionPageKeys.lists(orgId, spaceId),
      });
      queryClient.invalidateQueries({
        queryKey: motionPageKeys.trash(orgId, spaceId),
      });
      toast(`"${title}" moved to trash`);
    },
    onError: () => {
      if (orgId && spaceId) {
        queryClient.invalidateQueries({
          queryKey: motionPageKeys.lists(orgId, spaceId),
        });
      }
      toast.error("Failed to delete page. Please try again.");
    },
  });
}

/** Restores a page from trash. */
export function useRestoreMotionPage(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<MotionPageDTO, Error, string>({
    mutationFn: async (pageId) => {
      const res = await api.patch<{ data: MotionPageDTO }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/restore`
      );
      return res.data.data;
    },
    onSuccess: () => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: motionPageKeys.lists(orgId, spaceId),
      });
      queryClient.invalidateQueries({
        queryKey: motionPageKeys.trash(orgId, spaceId),
      });
    },
    onError: () => {
      toast.error("Failed to restore page.");
    },
  });
}

/** Permanently deletes a page (hard delete). Cascades to subpages via DB. */
export function useHardDeleteMotionPage(
  orgId: string | null,
  spaceId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (pageId) => {
      await api.delete(`${notesBase(orgId!, spaceId!)}/${pageId}/permanent`);
    },
    onSuccess: () => {
      if (!orgId || !spaceId) return;
      queryClient.invalidateQueries({
        queryKey: motionPageKeys.trash(orgId, spaceId),
      });
    },
    onError: () => {
      toast.error("Failed to permanently delete page.");
    },
  });
}

// ─── Share Mutation Hooks ─────────────────────────────────────────────────────

/** Creates a share (public link or cross-space). */
export function useCreateMotionPageShare(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<MotionPageShareDTO, Error, CreateShareInput>({
    mutationFn: async (input) => {
      const res = await api.post<{ data: MotionPageShareDTO }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/shares`,
        input
      );
      return res.data.data;
    },
    onSuccess: () => {
      if (!orgId || !spaceId || !pageId) return;
      queryClient.invalidateQueries({
        queryKey: motionPageKeys.shares(orgId, spaceId, pageId),
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message;
      toast.error(message ?? "Failed to create share.");
    },
  });
}

/** Revokes a share by shareId. */
export function useRevokeMotionPageShare(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (shareId) => {
      await api.delete(
        `${notesBase(orgId!, spaceId!)}/${pageId}/shares/${shareId}`
      );
    },
    onSuccess: () => {
      if (!orgId || !spaceId || !pageId) return;
      queryClient.invalidateQueries({
        queryKey: motionPageKeys.shares(orgId, spaceId, pageId),
      });
      toast.success("Share revoked.");
    },
    onError: () => {
      toast.error("Failed to revoke share.");
    },
  });
}

// ─── Socket Listeners ─────────────────────────────────────────────────────────

export function useMotionSocketListeners(
  orgId: string | null,
  spaceId: string | null,
  currentPageId: string | null,
  currentUserId: string | null
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !orgId || !spaceId) return;

    const handleMotionChange = (payload: { type: string; pageId?: string; page?: MotionPageDTO, userId?: string }) => {
      const { type, pageId, page, userId } = payload;

      // Skip if this change was made by the current user (optimistic updates already handled it)
      if (userId === currentUserId) return;

      switch (type) {
        case "create":
          if (page) {
            queryClient.setQueryData<MotionPageDTO[]>(
              motionPageKeys.lists(orgId, spaceId),
              (old) => (old ? [page, ...old] : [page])
            );
          }
          break;

        case "update":
          if (page && pageId) {
            // Update list cache
            queryClient.setQueryData<MotionPageDTO[]>(
              motionPageKeys.lists(orgId, spaceId),
              (old) => old?.map((p) => (p.id === pageId ? page : p))
            );
            
            // Update detail cache ONLY if it's not the page we are currently editing
            // Or if it is, we might want to be careful. For now, let's update it
            // but only if it's not "us". But we don't have a userId here easily.
            // Let's just update detail if it's the current page.
            if (pageId === currentPageId) {
                queryClient.setQueryData(
                    motionPageKeys.detail(orgId, spaceId, pageId),
                    page
                );
            }
          }
          break;

        case "delete":
        case "hard_delete":
          if (pageId) {
            queryClient.setQueryData<MotionPageDTO[]>(
              motionPageKeys.lists(orgId, spaceId),
              (old) => old?.filter((p) => p.id !== pageId && p.parent_id !== pageId) ?? []
            );
            queryClient.invalidateQueries({ queryKey: motionPageKeys.trash(orgId, spaceId) });

            if (pageId === currentPageId) {
              queryClient.setQueryData(motionPageKeys.detail(orgId, spaceId, pageId), undefined);
            }
          }
          break;

        case "restore":
          if (page) {
            queryClient.setQueryData<MotionPageDTO[]>(
              motionPageKeys.lists(orgId, spaceId),
              (old) => (old ? [...old, page] : [page])
            );
            queryClient.invalidateQueries({ queryKey: motionPageKeys.trash(orgId, spaceId) });
          }
          break;
      }
    };

    socket.on("motion_change", handleMotionChange);

    return () => {
      socket.off("motion_change", handleMotionChange);
    };
  }, [orgId, spaceId, currentPageId, currentUserId, queryClient]);
}

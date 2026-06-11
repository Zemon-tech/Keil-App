import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useMemo } from "react";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { JSONContent } from "@tiptap/core";
import { useAppContext } from "@/contexts/AppContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MotionPageDTO {
  id: string;
  org_id: string;
  space_id: string;
  created_by: string;
  updated_by: string;
  parent_id: string | null;
  title: string;
  content?: JSONContent;
  icon: string | null;
  cover_image: string | null;
  cover_position: number;
  position: number;
  small_text: boolean;
  full_width: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  share_permission?: MotionPermission;
}

export type MotionShareType = "public_link" | "space";
export type MotionPermission =
  | "view_all"
  | "view_managers"
  | "view_admins"
  | "edit_all"
  | "edit_managers"
  | "edit_admins"
  | "view"
  | "edit";

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
  target_user_email?: string | null;
  target_user_name?: string | null;
  target_user_avatar?: string | null;
  target_space_name?: string | null;
  target_org_name?: string | null;
  target_org_is_personal?: boolean;
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
  email?: string | null;
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

/** Synchronously/Reactively retrieves a page from the active space's page lists query cache. */
export function useCachedPageById(id: string | null | undefined): MotionPageDTO | undefined {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { data: pages } = useMotionPages(activeOrgId, activeSpaceId);
  return useMemo(() => {
    if (!id || !pages) return undefined;
    return pages.find((p) => p.id === id);
  }, [id, pages]);
}

/** Filters and returns root-level pages from the active space's page lists query cache. */
export function useRootPages(orgId: string | null, spaceId: string | null): MotionPageDTO[] {
  const { data: pages = [] } = useMotionPages(orgId, spaceId);
  return useMemo(() => {
    return pages
      .filter((p) => !p.parent_id && !p.deleted_at)
      .sort((a, b) => a.position - b.position);
  }, [pages]);
}

/** Filters and returns subpages from the active space's page lists query cache. */
export function useSubpages(
  orgId: string | null,
  spaceId: string | null,
  parentId: string | null | undefined
): MotionPageDTO[] {
  const { data: pages = [] } = useMotionPages(orgId, spaceId);
  return useMemo(() => {
    if (!parentId) return [];
    return pages
      .filter((p) => p.parent_id === parentId && !p.deleted_at)
      .sort((a, b) => a.position - b.position);
  }, [pages, parentId]);
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
    staleTime: 5 * 60 * 1000, // 5 min — cache survives refresh via persister
    gcTime: 2 * 60 * 1000, // 2 minutes to free memory for visited pages
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
    onError: (error: any) => {
      const serverMessage = error?.response?.data?.message;
      toast.error(serverMessage || "Failed to create page. Please try again.");
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
    { previousList?: MotionPageDTO[]; previousDetail?: MotionPageDTO; previousShared?: MotionPageDTO[] }
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
      await queryClient.cancelQueries({
        queryKey: motionPageKeys.shared(orgId, spaceId),
      });

      const previousDetail = queryClient.getQueryData<MotionPageDTO>(
        motionPageKeys.detail(orgId, spaceId, id)
      );
      const previousList = queryClient.getQueryData<MotionPageDTO[]>(
        motionPageKeys.lists(orgId, spaceId)
      );
      const previousShared = queryClient.getQueryData<MotionPageDTO[]>(
        motionPageKeys.shared(orgId, spaceId)
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

      // Apply optimistic update to shared list cache
      queryClient.setQueryData<MotionPageDTO[]>(
        motionPageKeys.shared(orgId, spaceId),
        (old) =>
          old?.map((p) =>
            p.id === id
              ? { ...p, ...updates, updated_at: new Date().toISOString() }
              : p
          )
      );

      return { previousDetail, previousList, previousShared };
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
      queryClient.setQueryData<MotionPageDTO[]>(
        motionPageKeys.shared(orgId, spaceId),
        (old) => old?.map((p) => (p.id === serverPage.id ? serverPage : p))
      );
      // Invalidate motion-analytics query keys to trigger fresh updates reload in the drawer
      // Keys are structured as ["motion-analytics", orgId, spaceId, pageId, ...] so we must
      // include orgId + spaceId in the prefix for the match to work correctly.
      queryClient.invalidateQueries({
        queryKey: ["motion-analytics", orgId, spaceId, serverPage.id],
      });
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
      if (context?.previousShared && orgId && spaceId) {
        queryClient.setQueryData(
          motionPageKeys.shared(orgId, spaceId),
          context.previousShared
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
        (old) => {
          if (!old) return [];
          const idsToRemove = new Set<string>([id]);
          let added = true;
          while (added) {
            added = false;
            old.forEach((p) => {
              if (p.parent_id && idsToRemove.has(p.parent_id) && !idsToRemove.has(p.id)) {
                idsToRemove.add(p.id);
                added = true;
              }
            });
          }
          return old.filter((p) => !idsToRemove.has(p.id));
        }
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
    onError: (error: any) => {
      if (orgId && spaceId) {
        queryClient.invalidateQueries({
          queryKey: motionPageKeys.lists(orgId, spaceId),
        });
      }
      const serverMessage = error?.response?.data?.message;
      toast.error(serverMessage || "Failed to delete page. Please try again.");
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
    onError: (error: any) => {
      const serverMessage = error?.response?.data?.message;
      toast.error(serverMessage || "Failed to restore page.");
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
    onError: (error: any) => {
      const serverMessage = error?.response?.data?.message;
      toast.error(serverMessage || "Failed to permanently delete page.");
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
      queryClient.invalidateQueries({
        queryKey: ["motion-analytics", orgId, spaceId, pageId],
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
      queryClient.invalidateQueries({
        queryKey: ["motion-analytics", orgId, spaceId, pageId],
      });
      toast.success("Share revoked.");
    },
    onError: () => {
      toast.error("Failed to revoke share.");
    },
  });
}

/** Updates a share's permission. */
export function useUpdateMotionPageShare(
  orgId: string | null,
  spaceId: string | null,
  pageId: string | null
) {
  const queryClient = useQueryClient();

  return useMutation<
    MotionPageShareDTO,
    Error,
    { shareId: string; permission: MotionPermission }
  >({
    mutationFn: async ({ shareId, permission }) => {
      const res = await api.patch<{ data: MotionPageShareDTO }>(
        `${notesBase(orgId!, spaceId!)}/${pageId}/shares/${shareId}`,
        { permission }
      );
      return res.data.data;
    },
    onSuccess: () => {
      if (!orgId || !spaceId || !pageId) return;
      queryClient.invalidateQueries({
        queryKey: motionPageKeys.shares(orgId, spaceId, pageId),
      });
      queryClient.invalidateQueries({
        queryKey: ["motion-analytics", orgId, spaceId, pageId],
      });
      toast.success("Share permission updated.");
    },
    onError: () => {
      toast.error("Failed to update share permission.");
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
            if (page.share_permission) {
              queryClient.setQueryData<MotionPageDTO[]>(
                motionPageKeys.shared(orgId, spaceId),
                (old) => {
                  if (!old) return [page];
                  if (old.some((p) => p.id === page.id)) return old;
                  return [page, ...old];
                }
              );
            } else {
              queryClient.setQueryData<MotionPageDTO[]>(
                motionPageKeys.lists(orgId, spaceId),
                (old) => {
                  if (!old) return [page];
                  if (old.some((p) => p.id === page.id)) return old;
                  return [page, ...old];
                }
              );
            }
          }
          break;

        case "update":
          if (page && pageId) {
            // Update list cache
            queryClient.setQueryData<MotionPageDTO[]>(
              motionPageKeys.lists(orgId, spaceId),
              (old) => old?.map((p) => (p.id === pageId ? page : p))
            );

            // Update shared cache
            queryClient.setQueryData<MotionPageDTO[]>(
              motionPageKeys.shared(orgId, spaceId),
              (old) => old?.map((p) => (p.id === pageId ? page : p))
            );
            
            // Update detail cache ONLY if it's the page we are currently editing
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
            queryClient.setQueryData<MotionPageDTO[]>(
              motionPageKeys.shared(orgId, spaceId),
              (old) => old?.filter((p) => p.id !== pageId) ?? []
            );
            queryClient.invalidateQueries({ queryKey: motionPageKeys.trash(orgId, spaceId) });

            if (pageId === currentPageId) {
              queryClient.setQueryData(motionPageKeys.detail(orgId, spaceId, pageId), undefined);
            }
          }
          break;

        case "restore":
          if (page) {
            if (page.share_permission) {
              queryClient.setQueryData<MotionPageDTO[]>(
                motionPageKeys.shared(orgId, spaceId),
                (old) => {
                  if (!old) return [page];
                  if (old.some((p) => p.id === page.id)) return old;
                  return [...old, page];
                }
              );
            } else {
              queryClient.setQueryData<MotionPageDTO[]>(
                motionPageKeys.lists(orgId, spaceId),
                (old) => {
                  if (!old) return [page];
                  if (old.some((p) => p.id === page.id)) return old;
                  return [...old, page];
                }
              );
            }
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

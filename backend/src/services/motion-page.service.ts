import crypto from 'crypto';
import { motionPageRepository, motionPageShareRepository } from '../repositories';
import { MotionPage, MotionPageShare } from '../types/entities';
import { MotionShareType, MotionPermission } from '../types/enums';
import { ApiError } from '../utils/ApiError';
import { broadcastMotionChange } from '../socket';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface MotionPageDTO {
  id: string;
  org_id: string;
  space_id: string;
  created_by: string;
  updated_by: string;
  parent_id: string | null;
  title: string;
  content: Record<string, any>;
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

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateMotionPageInput {
  parent_id?: string | null;
  title?: string;
  icon?: string | null;
  cover_image?: string | null;
}

export interface UpdateMotionPageInput {
  title?: string;
  content?: Record<string, any>;
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

// ─── Mappers ──────────────────────────────────────────────────────────────────

const toISO = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
};

const toPageDTO = (page: MotionPage): MotionPageDTO => ({
  id: page.id,
  org_id: page.org_id,
  space_id: page.space_id,
  created_by: page.created_by,
  updated_by: page.updated_by,
  parent_id: page.parent_id,
  title: page.title,
  content: page.content,
  icon: page.icon,
  cover_image: page.cover_image,
  cover_position: page.cover_position ?? 50,
  position: page.position,
  small_text: page.small_text,
  full_width: page.full_width,
  created_at: toISO(page.created_at)!,
  updated_at: toISO(page.updated_at)!,
  deleted_at: toISO(page.deleted_at),
  share_permission: page.share_permission,
});

const toShareDTO = (share: MotionPageShare): MotionPageShareDTO => ({
  id: share.id,
  page_id: share.page_id,
  share_type: share.share_type,
  target_org_id: share.target_org_id,
  target_space_id: share.target_space_id,
  share_token: share.share_token,
  permission: share.permission,
  created_by: share.created_by,
  created_at: toISO(share.created_at)!,
  expires_at: toISO(share.expires_at),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure 64-char hex token for public links.
 * Uses Node's built-in crypto — no external dependency.
 */
const generateShareToken = (): string =>
  crypto.randomBytes(32).toString('hex');

/**
 * Asserts a page exists in the given org+space or is shared to it.
 * Throws 404 if not found. Throws 403 if requireEditPermission is true and the user only has view access.
 * Returns the page for use in the calling function.
 */
const assertPageInSpace = async (
  pageId: string,
  orgId: string,
  spaceId: string,
  requireEditPermission = false,
): Promise<MotionPage> => {
  let page = await motionPageRepository.findByIdInSpace(pageId, orgId, spaceId);
  
  if (!page) {
    page = await motionPageShareRepository.findByIdSharedToSpace(pageId, orgId, spaceId);
    if (page) {
      if (requireEditPermission && page.share_permission !== MotionPermission.EDIT) {
        throw new ApiError(403, 'You only have view access to this shared page');
      }
    } else {
      throw new ApiError(404, 'Page not found');
    }
  }

  return page;
};

// ─── Page CRUD ────────────────────────────────────────────────────────────────

export const getPagesBySpace = async (
  orgId: string,
  spaceId: string,
): Promise<MotionPageDTO[]> => {
  const pages = await motionPageRepository.findBySpace(orgId, spaceId, false);
  return pages.map(toPageDTO);
};

export const getTrashBySpace = async (
  orgId: string,
  spaceId: string,
): Promise<MotionPageDTO[]> => {
  const pages = await motionPageRepository.findTrashBySpace(orgId, spaceId);
  return pages.map(toPageDTO);
};

export const getPageById = async (
  orgId: string,
  spaceId: string,
  pageId: string,
): Promise<MotionPageDTO | null> => {
  let page = await motionPageRepository.findByIdInSpace(pageId, orgId, spaceId);
  if (!page) {
    page = await motionPageShareRepository.findByIdSharedToSpace(pageId, orgId, spaceId);
  }
  return page ? toPageDTO(page) : null;
};

export const createPage = async (
  orgId: string,
  spaceId: string,
  userId: string,
  input: CreateMotionPageInput,
): Promise<MotionPageDTO> => {
  // If a parent_id is provided, verify it belongs to the same org+space
  if (input.parent_id) {
    const parent = await motionPageRepository.findByIdInSpace(
      input.parent_id,
      orgId,
      spaceId,
    );
    if (!parent) {
      throw new ApiError(400, 'Parent page not found or belongs to a different space');
    }
  }

  // Append at the end of the sibling group
  const maxPos = await motionPageRepository.getMaxPosition(
    orgId,
    spaceId,
    input.parent_id ?? null,
  );

  const page = await motionPageRepository.create({
    org_id: orgId,
    space_id: spaceId,
    created_by: userId,
    updated_by: userId,
    parent_id: input.parent_id ?? null,
    title: input.title?.trim() || 'Untitled',
    icon: input.icon ?? null,
    cover_image: input.cover_image ?? null,
    position: maxPos + 1000, // Leave room for fractional inserts between existing pages
    small_text: false,
    full_width: false,
  } as Partial<MotionPage>);

  const dto = toPageDTO(page);
  broadcastMotionChange(spaceId, { type: 'create', page: dto, userId });

  return dto;
};

export const updatePage = async (
  orgId: string,
  spaceId: string,
  pageId: string,
  userId: string,
  input: UpdateMotionPageInput,
  spaceRole: string,
): Promise<MotionPageDTO | null> => {
  const page = await assertPageInSpace(pageId, orgId, spaceId, true);

  if (!page.share_permission) {
    if (spaceRole === 'manager' && page.created_by !== userId) {
      throw new ApiError(403, 'Managers can only edit their own pages');
    }
  }

  // If re-parenting, verify the new parent is in the same org+space
  if (input.parent_id !== undefined && input.parent_id !== null) {
    const newParent = await motionPageRepository.findByIdInSpace(
      input.parent_id,
      orgId,
      spaceId,
    );
    if (!newParent) {
      throw new ApiError(400, 'New parent page not found or belongs to a different space');
    }
    // Prevent a page from becoming its own parent
    if (input.parent_id === pageId) {
      throw new ApiError(400, 'A page cannot be its own parent');
    }
  }

  const updates: Partial<MotionPage> = {};
  if (input.title !== undefined) updates.title = input.title.trim() || 'Untitled';
  if (input.content !== undefined) updates.content = input.content;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.cover_image !== undefined) updates.cover_image = input.cover_image;
  if (input.cover_position !== undefined) updates.cover_position = input.cover_position;
  if (input.parent_id !== undefined) updates.parent_id = input.parent_id;
  if (input.small_text !== undefined) updates.small_text = input.small_text;
  if (input.full_width !== undefined) updates.full_width = input.full_width;
  updates.updated_by = userId;

  const updated = await motionPageRepository.update(pageId, updates);
  if (updated) {
    const dto = toPageDTO(updated);
    broadcastMotionChange(spaceId, { type: 'update', pageId, page: dto, userId });
    return dto;
  }
  return null;
};

export const softDeletePage = async (
  orgId: string,
  spaceId: string,
  pageId: string,
  userId: string,
  spaceRole: string,
): Promise<void> => {
  const page = await assertPageInSpace(pageId, orgId, spaceId);

  if (page.share_permission) {
    throw new ApiError(403, 'Cannot delete a page shared from another space');
  }

  if (spaceRole === 'manager' && page.created_by !== userId) {
    throw new ApiError(403, 'Managers can only delete their own pages');
  }

  // Recursively soft-delete the page and all its descendants in one query.
  // Uses a recursive CTE to walk the full subtree, then bulk-updates deleted_at.
  // This is safe because all pages are scoped to the same org+space (enforced on create).
  await motionPageRepository.softDeleteWithDescendants(pageId);
  broadcastMotionChange(spaceId, { type: 'delete', pageId, userId });
};

export const restorePage = async (
  orgId: string,
  spaceId: string,
  pageId: string,
  userId: string,
  spaceRole: string,
): Promise<MotionPageDTO> => {
  // For restore, we need to find the page even if deleted — use findById from base
  const page = await motionPageRepository.findById(pageId, undefined, true);
  if (!page || page.org_id !== orgId || page.space_id !== spaceId) {
    throw new ApiError(404, 'Page not found in trash');
  }
  if (!page.deleted_at) {
    throw new ApiError(400, 'Page is not in trash');
  }

  if (spaceRole === 'manager' && page.created_by !== userId) {
    throw new ApiError(403, 'Managers can only restore their own pages');
  }

  const restored = await motionPageRepository.restore(pageId);
  if (!restored) throw new ApiError(404, 'Page not found');
  
  const dto = toPageDTO(restored);
  broadcastMotionChange(spaceId, { type: 'restore', page: dto, userId });
  return dto;
};

export const hardDeletePage = async (
  orgId: string,
  spaceId: string,
  pageId: string,
  userId: string,
  spaceRole: string,
): Promise<void> => {
  // Allow hard-deleting from trash (deleted_at IS NOT NULL) — use base findById
  const page = await motionPageRepository.findById(pageId, undefined, true);
  if (!page || page.org_id !== orgId || page.space_id !== spaceId) {
    throw new ApiError(404, 'Page not found');
  }

  if (spaceRole === 'manager' && page.created_by !== userId) {
    throw new ApiError(403, 'Managers can only permanently delete their own pages');
  }

  // DB CASCADE on parent_id handles recursive deletion of all subpages
  await motionPageRepository.hardDelete(pageId);
  broadcastMotionChange(spaceId, { type: 'hard_delete', pageId, userId });
};

// ─── Shares ───────────────────────────────────────────────────────────────────

export const getSharesByPage = async (
  orgId: string,
  spaceId: string,
  pageId: string,
): Promise<MotionPageShareDTO[]> => {
  const page = await assertPageInSpace(pageId, orgId, spaceId);
  if (page.share_permission) {
    throw new ApiError(403, 'Cannot view shares on a page shared from another space');
  }
  const shares = await motionPageShareRepository.findByPage(pageId);
  return shares.map(toShareDTO);
};

export const createShare = async (
  orgId: string,
  spaceId: string,
  pageId: string,
  userId: string,
  input: CreateShareInput,
  spaceRole: string,
): Promise<MotionPageShareDTO> => {
  const page = await assertPageInSpace(pageId, orgId, spaceId);

  if (page.share_permission) {
    throw new ApiError(403, 'Cannot share a page that was shared from another space');
  }

  if (spaceRole === 'manager' && page.created_by !== userId) {
    throw new ApiError(403, 'Managers can only share their own pages');
  }

  if (input.share_type === MotionShareType.PUBLIC_LINK) {
    // Generate a unique token
    const share = await motionPageShareRepository.create({
      page_id: pageId,
      share_type: MotionShareType.PUBLIC_LINK,
      share_token: generateShareToken(),
      permission: input.permission ?? MotionPermission.VIEW,
      created_by: userId,
      expires_at: input.expires_at ? new Date(input.expires_at) : null,
      target_org_id: null,
      target_space_id: null,
    } as Partial<MotionPageShare>);
    return toShareDTO(share);
  }

  if (input.share_type === MotionShareType.SPACE) {
    if (!input.target_org_id || !input.target_space_id) {
      throw new ApiError(400, 'target_org_id and target_space_id are required for space shares');
    }
    // Prevent sharing a page with its own space
    if (input.target_org_id === orgId && input.target_space_id === spaceId) {
      throw new ApiError(400, 'Cannot share a page with its own space');
    }
    // Check for duplicate
    const existing = await motionPageShareRepository.findSpaceShare(
      pageId,
      input.target_org_id,
      input.target_space_id,
    );
    if (existing) {
      throw new ApiError(409, 'This page is already shared with that space');
    }

    const share = await motionPageShareRepository.executeInTransaction(async (client) => {
      const createdShare = await motionPageShareRepository.create({
        page_id: pageId,
        share_type: MotionShareType.SPACE,
        target_org_id: input.target_org_id,
        target_space_id: input.target_space_id,
        share_token: null,
        permission: input.permission ?? MotionPermission.VIEW,
        created_by: userId,
        expires_at: input.expires_at ? new Date(input.expires_at) : null,
      } as Partial<MotionPageShare>, client);

      const membersRes = await client.query(
        'SELECT user_id FROM public.space_members WHERE org_id = $1 AND space_id = $2',
        [input.target_org_id, input.target_space_id]
      );
      const recipientIds = membersRes.rows.map((row: any) => row.user_id as string);

      if (recipientIds.length > 0) {
        const senderRes = await client.query('SELECT name, email FROM public.users WHERE id = $1', [userId]);
        const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || 'Someone';

        await client.query(
          `INSERT INTO public.notification_outbox (workspace_id, org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            null,
            input.target_org_id,
            input.target_space_id,
            userId,
            'motion_shared',
            'motion_page',
            pageId,
            JSON.stringify({
              recipient_ids: recipientIds,
              page_title: page.title,
              sender_name: senderName
            })
          ]
        );
      }
      return createdShare;
    });
    return toShareDTO(share);
  }

  throw new ApiError(400, 'Invalid share_type');
};

export const revokeShare = async (
  orgId: string,
  spaceId: string,
  pageId: string,
  shareId: string,
  userId: string,
  spaceRole: string,
): Promise<void> => {
  const page = await assertPageInSpace(pageId, orgId, spaceId);

  if (page.share_permission) {
    throw new ApiError(403, 'Cannot revoke shares on a page shared from another space');
  }

  if (spaceRole === 'manager' && page.created_by !== userId) {
    throw new ApiError(403, 'Managers can only revoke shares for their own pages');
  }

  const share = await motionPageShareRepository.findById(shareId);
  if (!share || share.page_id !== pageId) {
    throw new ApiError(404, 'Share not found');
  }

  await motionPageShareRepository.delete(shareId);
};

// ─── Public token resolution ──────────────────────────────────────────────────

export const getPageByPublicToken = async (
  token: string,
): Promise<MotionPageDTO | null> => {
  const share = await motionPageShareRepository.findByToken(token);
  if (!share) return null;

  // Fetch the page — must be active (not deleted)
  const page = await motionPageRepository.findById(share.page_id);
  if (!page) return null;

  return toPageDTO(page);
};

/**
 * Returns a page by its ID only if public sharing is enabled for it.
 * Used by the new /motion/:slug/:pageId public URL.
 */
export const getPageByIdIfPublic = async (
  pageId: string,
): Promise<MotionPageDTO | null> => {
  // Check if there is an active public_link share for this page
  const shares = await motionPageShareRepository.findByPage(pageId);
  const hasPublicShare = shares.some(
    (s) =>
      s.share_type === MotionShareType.PUBLIC_LINK &&
      (s.expires_at === null || new Date(s.expires_at) > new Date()),
  );
  if (!hasPublicShare) return null;

  // Fetch the page — must be active (not deleted)
  const page = await motionPageRepository.findById(pageId);
  if (!page || page.deleted_at) return null;

  return toPageDTO(page);
};

// ─── Cross-space shared pages ─────────────────────────────────────────────────

export const getSharedToSpace = async (
  orgId: string,
  spaceId: string,
): Promise<MotionPageDTO[]> => {
  const pages = await motionPageShareRepository.findPagesSharedToSpace(orgId, spaceId);
  return pages.map(toPageDTO);
};

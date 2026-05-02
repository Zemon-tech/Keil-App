import pool from "../config/pg";
import { spaceRepository, organisationRepository } from "../repositories";
import { ApiError } from "../utils/ApiError";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface SpaceDTO {
  id: string;
  org_id: string | null;
  name: string;
  visibility: string;
  created_by: string | null;
  created_at: string;
  role: string;
  compatibility_workspace_id: string | null;
}

export interface SpaceMemberDTO {
  user_id: string;
  role: string;
  name: string | null;
  email: string;
}

export interface DeletedSpaceDTO {
  id: string;
  org_id: string | null;
  name: string;
  visibility: string;
  created_by: string | null;
  created_at: string;
  deleted_at: string;
}

const toDTO = (row: any): SpaceDTO => ({
  id: row.id,
  org_id: row.org_id,
  name: row.name,
  visibility: row.visibility,
  created_by: row.created_by,
  created_at: new Date(row.created_at).toISOString(),
  role: row.membership_role,
  compatibility_workspace_id: row.compatibility_workspace_id,
});

const toDeletedDTO = (row: any): DeletedSpaceDTO => ({
  id: row.id,
  org_id: row.org_id,
  name: row.name,
  visibility: row.visibility,
  created_by: row.created_by,
  created_at: new Date(row.created_at).toISOString(),
  deleted_at: new Date(row.deleted_at).toISOString(),
});

// ── Helper: assert caller is org owner or admin ───────────────────────────────

const assertOwnerOrAdmin = async (orgId: string, userId: string): Promise<void> => {
  const role = await organisationRepository.getMemberRole(orgId, userId);
  if (!role) throw new ApiError(403, "Not a member of this organisation");
  if (role !== "owner" && role !== "admin") {
    throw new ApiError(403, "Only organisation owners and admins can manage spaces");
  }
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export const getVisibleSpaces = async (orgId: string, userId: string): Promise<SpaceDTO[]> => {
  const spaces = await spaceRepository.findVisibleByOrgAndUser(orgId, userId);
  return spaces.map(toDTO);
};

export const getSpaceMembers = async (orgId: string, spaceId: string): Promise<SpaceMemberDTO[]> => {
  return spaceRepository.findMembers(orgId, spaceId);
};

export const getDeletedSpaces = async (
  orgId: string,
  userId: string,
): Promise<DeletedSpaceDTO[]> => {
  await assertOwnerOrAdmin(orgId, userId);
  const spaces = await spaceRepository.findDeletedByOrg(orgId);
  return spaces.map(toDeletedDTO);
};

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * Creates a new space inside an org.
 * Caller must be an org owner or admin.
 * Returns the new space DTO with role="owner".
 */
export const createSpace = async (
  orgId: string,
  userId: string,
  name: string,
): Promise<SpaceDTO> => {
  await assertOwnerOrAdmin(orgId, userId);

  const space = await spaceRepository.executeInTransaction(async (client) => {
    return spaceRepository.createWithOwner(orgId, name.trim(), userId, client);
  });

  return {
    id: space.id,
    org_id: space.org_id,
    name: space.name,
    visibility: space.visibility,
    created_by: space.created_by,
    created_at: new Date(space.created_at).toISOString(),
    role: "owner",
    compatibility_workspace_id: null,
  };
};

// ─── Update ───────────────────────────────────────────────────────────────────

export const renameSpace = async (
  orgId: string,
  spaceId: string,
  userId: string,
  name: string,
): Promise<SpaceDTO> => {
  await assertOwnerOrAdmin(orgId, userId);

  const trimmed = name.trim();
  if (!trimmed) throw new ApiError(400, "Space name is required");

  const updated = await spaceRepository.rename(spaceId, trimmed);
  if (!updated) throw new ApiError(404, "Space not found");

  return {
    id: updated.id,
    org_id: updated.org_id,
    name: updated.name,
    visibility: updated.visibility,
    created_by: updated.created_by,
    created_at: new Date(updated.created_at).toISOString(),
    role: "owner",
    compatibility_workspace_id: null,
  };
};

// ─── Delete / Restore ─────────────────────────────────────────────────────────

/**
 * Soft-deletes a space and cascades to tasks.
 * channels and activity_logs do not have deleted_at — they are excluded from
 * the cascade and will be hard-deleted if the space is permanently deleted later.
 * space_members rows are preserved so restore is possible.
 * The last active space in an org cannot be deleted.
 */
export const deleteSpace = async (
  orgId: string,
  spaceId: string,
  userId: string,
): Promise<void> => {
  await assertOwnerOrAdmin(orgId, userId);

  const activeCount = await spaceRepository.countActiveByOrg(orgId);
  if (activeCount <= 1) {
    throw new ApiError(400, "Cannot delete the last space in an organisation");
  }

  await spaceRepository.executeInTransaction(async (client) => {
    await spaceRepository.softDeleteSpace(spaceId, client);
    await client.query(
      `UPDATE public.tasks SET deleted_at = NOW()
       WHERE space_id = $1 AND deleted_at IS NULL`,
      [spaceId],
    );
  });
};

/**
 * Restores a soft-deleted space.
 * Tasks that were cascade-deleted remain soft-deleted — restore them separately.
 */
export const restoreSpace = async (
  orgId: string,
  spaceId: string,
  userId: string,
): Promise<SpaceDTO> => {
  await assertOwnerOrAdmin(orgId, userId);

  const restored = await spaceRepository.executeInTransaction(async (client) => {
    return spaceRepository.restore(spaceId, client);
  });

  if (!restored) throw new ApiError(404, "Space not found or is not deleted");

  return {
    id: restored.id,
    org_id: restored.org_id,
    name: restored.name,
    visibility: restored.visibility,
    created_by: restored.created_by,
    created_at: new Date(restored.created_at).toISOString(),
    role: "owner",
    compatibility_workspace_id: null,
  };
};

/**
 * Permanently deletes a space and ALL its data.
 * The space must already be soft-deleted before calling this.
 * Deleting channels cascades to channel_members and messages automatically (ON DELETE CASCADE).
 */
export const hardDeleteSpace = async (
  orgId: string,
  spaceId: string,
  userId: string,
): Promise<void> => {
  await assertOwnerOrAdmin(orgId, userId);

  const deleted = await spaceRepository.findDeletedByOrg(orgId);
  const target = deleted.find((s) => s.id === spaceId);
  if (!target) {
    throw new ApiError(400, "Space must be soft-deleted before permanent deletion");
  }

  await spaceRepository.executeInTransaction(async (client) => {
    await client.query(
      `DELETE FROM public.task_dependencies
       WHERE task_id IN (SELECT id FROM public.tasks WHERE space_id = $1)
          OR depends_on_task_id IN (SELECT id FROM public.tasks WHERE space_id = $1)`,
      [spaceId],
    );
    await client.query(
      `DELETE FROM public.task_assignees
       WHERE task_id IN (SELECT id FROM public.tasks WHERE space_id = $1)`,
      [spaceId],
    );
    await client.query(
      `DELETE FROM public.comments
       WHERE task_id IN (SELECT id FROM public.tasks WHERE space_id = $1)`,
      [spaceId],
    );
    await client.query(`DELETE FROM public.tasks WHERE space_id = $1`, [spaceId]);
    // channel_members and messages cascade automatically from channels
    await client.query(`DELETE FROM public.channels WHERE space_id = $1`, [spaceId]);
    await client.query(`DELETE FROM public.activity_logs WHERE space_id = $1`, [spaceId]);
    await client.query(`DELETE FROM public.space_members WHERE space_id = $1`, [spaceId]);
    await spaceRepository.hardDelete(spaceId, client);
  });
};

// ─── Member management ────────────────────────────────────────────────────────

export const addSpaceMember = async (
  orgId: string,
  spaceId: string,
  userId: string,
  targetUserId: string,
): Promise<void> => {
  await assertOwnerOrAdmin(orgId, userId);

  const targetRole = await organisationRepository.getMemberRole(orgId, targetUserId);
  if (!targetRole) {
    throw new ApiError(400, "User is not a member of this organisation");
  }

  await spaceRepository.executeInTransaction(async (client) => {
    await spaceRepository.addMember(orgId, spaceId, targetUserId, "member", client);
  });
};

export const removeSpaceMember = async (
  orgId: string,
  spaceId: string,
  userId: string,
  targetUserId: string,
): Promise<void> => {
  await assertOwnerOrAdmin(orgId, userId);

  if (userId === targetUserId) {
    throw new ApiError(400, "Cannot remove yourself from a space");
  }

  await spaceRepository.executeInTransaction(async (client) => {
    await spaceRepository.removeMember(spaceId, targetUserId, client);
  });
};

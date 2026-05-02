import { spaceRepository, organisationRepository } from "../repositories";
import { ApiError } from "../utils/ApiError";

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

export const getVisibleSpaces = async (orgId: string, userId: string): Promise<SpaceDTO[]> => {
  const spaces = await spaceRepository.findVisibleByOrgAndUser(orgId, userId);
  return spaces.map(toDTO);
};

export const getSpaceMembers = async (orgId: string, spaceId: string): Promise<SpaceMemberDTO[]> => {
  return spaceRepository.findMembers(orgId, spaceId);
};

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
  const role = await organisationRepository.getMemberRole(orgId, userId);
  if (!role) {
    throw new ApiError(403, "Not a member of this organisation");
  }
  if (role !== "owner" && role !== "admin") {
    throw new ApiError(403, "Only organisation owners and admins can create spaces");
  }

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


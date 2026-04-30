import { spaceRepository } from "../repositories";

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

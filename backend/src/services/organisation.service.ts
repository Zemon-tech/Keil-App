import jwt from "jsonwebtoken";
import { organisationRepository, spaceRepository } from "../repositories";
import { ApiError } from "../utils/ApiError";

export interface OrganisationDTO {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  role: string;
}

export interface OrgMemberDTO {
  user_id: string;
  role: string;
  name: string | null;
  email: string;
}

const toDTO = (row: any): OrganisationDTO => ({
  id: row.id,
  name: row.name,
  owner_user_id: row.owner_user_id,
  created_at: new Date(row.created_at).toISOString(),
  updated_at: new Date(row.updated_at).toISOString(),
  role: row.membership_role,
});

export const getUserOrganisations = async (userId: string): Promise<OrganisationDTO[]> => {
  const organisations = await organisationRepository.findByUserId(userId);
  return organisations.map(toDTO);
};

/**
 * Creates a new organisation with a default "General" space.
 * The caller is added as owner of both.
 * Returns the new org (with role="owner") and the default space.
 */
export const createOrganisation = async (
  userId: string,
  name: string,
): Promise<{ org: OrganisationDTO; space: { id: string; name: string; org_id: string; created_at: string } }> => {
  return organisationRepository.executeInTransaction(async (client) => {
    const org = await organisationRepository.createWithOwner(name.trim(), userId, client);
    const space = await spaceRepository.createWithOwner(org.id, "General", userId, client);

    return {
      org: {
        id: org.id,
        name: org.name,
        owner_user_id: org.owner_user_id,
        created_at: new Date(org.created_at).toISOString(),
        updated_at: new Date(org.updated_at).toISOString(),
        role: "owner",
      },
      space: {
        id: space.id,
        name: space.name,
        org_id: space.org_id!,
        created_at: new Date(space.created_at).toISOString(),
      },
    };
  });
};

/**
 * Generates a signed JWT invite token for an org.
 * Caller must already be a member of the org.
 */
export const generateInviteToken = async (
  orgId: string,
  userId: string,
): Promise<{ inviteLink: string; token: string }> => {
  const role = await organisationRepository.getMemberRole(orgId, userId);
  if (!role) {
    throw new ApiError(403, "Not a member of this organisation");
  }

  const secret = process.env.JWT_SECRET || "fallback_secret";
  const token = jwt.sign({ orgId, type: "org_invite" }, secret, { expiresIn: "7d" });
  const frontendUrl = process.env.FRONTEND_URL || "";
  const inviteLink = `${frontendUrl}/invite/${token}`;

  return { inviteLink, token };
};

/**
 * Joins an organisation using an invite token.
 * Adds the user to the org and its default space as a member.
 * Idempotent — safe to call multiple times.
 */
export const joinOrganisation = async (
  token: string,
  userId: string,
): Promise<{ orgId: string; spaceId: string }> => {
  const secret = process.env.JWT_SECRET || "fallback_secret";

  let payload: { orgId: string; type: string };
  try {
    payload = jwt.verify(token, secret) as { orgId: string; type: string };
  } catch {
    throw new ApiError(400, "Invalid or expired invite token");
  }

  if (payload.type !== "org_invite" || !payload.orgId) {
    throw new ApiError(400, "Invalid invite token");
  }

  const { orgId } = payload;

  const org = await organisationRepository.findById(orgId);
  if (!org) {
    throw new ApiError(404, "Organisation not found");
  }

  const defaultSpace = await spaceRepository.findDefaultSpace(orgId);
  if (!defaultSpace) {
    throw new ApiError(500, "Organisation has no spaces");
  }

  await organisationRepository.executeInTransaction(async (client) => {
    await organisationRepository.addMember(orgId, userId, "member", client);
    await spaceRepository.addMember(orgId, defaultSpace.id, userId, "member", client);
  });

  return { orgId, spaceId: defaultSpace.id };
};

/**
 * Returns all members of an organisation.
 */
export const getOrgMembers = async (orgId: string): Promise<OrgMemberDTO[]> => {
  return organisationRepository.findMembers(orgId);
};


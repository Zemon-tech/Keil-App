import jwt from "jsonwebtoken";
import { organisationRepository, spaceRepository, orgSubscriptionRepository } from "../repositories";
import { ApiError } from "../utils/ApiError";
import { io } from "../socket";

export interface OrganisationDTO {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
  role: string;
  is_personal: boolean;
}

export interface OrgMemberDTO {
  user_id: string;
  role: string;
  name: string | null;
  email: string;
  avatar_url?: string | null;
  workspaces?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

const toDTO = (row: any): OrganisationDTO => ({
  id: row.id,
  name: row.name,
  owner_user_id: row.owner_user_id,
  created_at: new Date(row.created_at).toISOString(),
  updated_at: new Date(row.updated_at).toISOString(),
  role: row.membership_role,
  is_personal: !!row.is_personal,
});

export const getUserOrganisations = async (userId: string): Promise<OrganisationDTO[]> => {
  const organisations = await organisationRepository.findByUserId(userId);
  return organisations.map(toDTO);
};

/**
 * Creates a new organisation with a default "General" space.
 * The caller is added as owner of the org and admin of the space.
 * Returns the new org (with role="owner") and the default space.
 */
export const createOrganisation = async (
  userId: string,
  name: string,
): Promise<{ org: OrganisationDTO; space: { id: string; name: string; org_id: string; created_at: string } }> => {
  return organisationRepository.executeInTransaction(async (client) => {
    const org = await organisationRepository.createWithOwner(name.trim(), userId, client);
    const space = await spaceRepository.createWithOwner(org.id, "General", userId, client, true);

    return {
      org: {
        id: org.id,
        name: org.name,
        owner_user_id: org.owner_user_id,
        created_at: new Date(org.created_at).toISOString(),
        updated_at: new Date(org.updated_at).toISOString(),
        role: "owner",
        is_personal: false,
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
  if (role !== "owner" && role !== "admin") {
    throw new ApiError(403, "Only organisation admins and owners can generate invite links");
  }

  const secret = process.env.JWT_SECRET || "fallback_secret";
  const token = jwt.sign({ orgId, inviterId: userId, type: "org_invite" }, secret, { expiresIn: "7d" });
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
): Promise<{
  org: OrganisationDTO;
  space: { id: string; name: string; org_id: string; created_at: string };
}> => {
  const secret = process.env.JWT_SECRET || "fallback_secret";

  let payload: { orgId: string; inviterId?: string; type: string };
  try {
    payload = jwt.verify(token, secret) as { orgId: string; inviterId?: string; type: string };
  } catch {
    throw new ApiError(400, "Invalid or expired invite token");
  }

  if (payload.type !== "org_invite" || !payload.orgId) {
    throw new ApiError(400, "Invalid invite token");
  }

  const { orgId, inviterId } = payload;

  const org = await organisationRepository.findById(orgId);
  if (!org) {
    throw new ApiError(404, "Organisation not found");
  }

  // ── Seat availability check (Teams subscription) ────────────────────────────
  const orgSub = await orgSubscriptionRepository.findByOrgId(orgId);
  if (orgSub && orgSub.seats_used >= orgSub.seats_purchased) {
    throw new ApiError(403, `This organisation has used all ${orgSub.seats_purchased} purchased seats. The org owner must purchase more seats before new members can join.`);
  }

  let defaultSpace = await spaceRepository.findDefaultSpace(orgId);
  if (!defaultSpace) {
    throw new ApiError(500, "Organisation has no spaces");
  }

  if (defaultSpace.is_private) {
    const fallbackSpace = await spaceRepository.findOldestNonPrivateSpace(orgId);
    if (!fallbackSpace) {
      throw new ApiError(400, "This organisation has no joinable spaces");
    }
    defaultSpace = fallbackSpace;
  }

  await organisationRepository.executeInTransaction(async (client) => {
    // 1. Join user to organisation and default space
    await organisationRepository.addMember(orgId, userId, "member", client);
    await spaceRepository.addMember(orgId, defaultSpace!.id, userId, "member", client);

    // 1b. Increment seats_used if org has a Teams subscription
    await orgSubscriptionRepository.incrementSeatsUsed(orgId, client);

    // 2. Fetch joining user's name/email
    const userResult = await client.query(
      `SELECT name, email FROM public.users WHERE id = $1`,
      [userId]
    );
    const joinedUserName = userResult.rows[0]?.name || userResult.rows[0]?.email?.split("@")[0] || 'Someone';
    const joinedUserEmail = userResult.rows[0]?.email || '';

    // 3. Fetch admins/owner to notify
    const adminsResult = await client.query(
      `SELECT user_id FROM public.organisation_members WHERE org_id = $1 AND role IN ('owner', 'admin')`,
      [orgId]
    );
    const adminsAndOwnersIds = adminsResult.rows.map(row => row.user_id).filter(id => id !== userId);

    // 4. Queue system notification in notification_outbox
    await client.query(
      `INSERT INTO public.notification_outbox (org_id, space_id, sender_id, event_type, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        orgId,
        defaultSpace!.id,
        userId,
        'membership_updates',
        'organisation_member',
        userId,
        JSON.stringify({
          recipient_ids: adminsAndOwnersIds,
          org_name: org.name,
          member_name: joinedUserName,
          action: 'member_joined'
        })
      ]
    );

    // 5. Emit real-time WebSockets update
    const notifyTargets = Array.from(new Set([...adminsAndOwnersIds, inviterId])).filter(
      (id): id is string => Boolean(id) && id !== userId
    );

    if (io) {
      notifyTargets.forEach(targetId => {
        io.to(`user:${targetId}`).emit("member_joined", {
          orgId,
          orgName: org.name,
          inviterId,
          joinedUser: {
            id: userId,
            name: joinedUserName,
            email: joinedUserEmail
          }
        });
      });
    }
  });

  return {
    org: toDTO({ ...org, membership_role: "member" }),
    space: {
      id: defaultSpace.id,
      name: defaultSpace.name,
      org_id: defaultSpace.org_id!,
      created_at: new Date(defaultSpace.created_at).toISOString(),
    }
  };
};

/**
 * Returns all members of an organisation.
 */
export const getOrgMembers = async (orgId: string, showWorkspaces: boolean = true): Promise<OrgMemberDTO[]> => {
  const members = await organisationRepository.findMembers(orgId);
  if (members.length === 0) return [];

  if (!showWorkspaces) {
    return members.map((m) => ({
      ...m,
      workspaces: undefined,
    }));
  }

  const userIds = members.map((m) => m.user_id);
  const memberships = await organisationRepository.findSpaceMembershipsByOrgAndUsers(orgId, userIds);

  // Group memberships by user_id
  const membershipsByUserId: Record<string, Array<{ user_id: string; space_id: string; space_name: string; role: string }>> = {};
  for (const ms of memberships) {
    if (!membershipsByUserId[ms.user_id]) {
      membershipsByUserId[ms.user_id] = [];
    }
    membershipsByUserId[ms.user_id].push(ms);
  }

  return members.map((m) => ({
    ...m,
    workspaces: (membershipsByUserId[m.user_id] || []).map((ms) => ({
      id: ms.space_id,
      name: ms.space_name,
      role: ms.role,
    })),
  }));
};

export const renameOrganisation = async (
  orgId: string,
  userId: string,
  name: string,
): Promise<OrganisationDTO> => {
  const org = await organisationRepository.update(orgId, { name: name.trim() } as any);
  if (!org) {
    throw new ApiError(404, "Organisation not found");
  }

  const role = await organisationRepository.getMemberRole(orgId, userId);
  return toDTO({ ...org, membership_role: role ?? "member" });
};

export const deleteOrganisation = async (
  orgId: string,
  userId: string,
): Promise<void> => {
  const org = await organisationRepository.findById(orgId);
  if (!org) {
    throw new ApiError(404, "Organisation not found");
  }
  if (org.is_personal) {
    throw new ApiError(400, "Personal organisation cannot be deleted");
  }

  const role = await organisationRepository.getMemberRole(orgId, userId);
  if (role !== "owner") {
    throw new ApiError(403, "Only the organisation owner can delete this organisation");
  }

  await organisationRepository.softDelete(orgId);
};

export const updateOrgMemberRole = async (
  orgId: string,
  actorUserId: string,
  targetUserId: string,
  role: "admin" | "member",
): Promise<void> => {
  const actorRole = await organisationRepository.getMemberRole(orgId, actorUserId);
  const targetRole = await organisationRepository.getMemberRole(orgId, targetUserId);

  if (!targetRole) {
    throw new ApiError(404, "Member not found");
  }
  if (targetRole === "owner") {
    throw new ApiError(400, "The organisation owner role cannot be changed here");
  }
  if (actorUserId === targetUserId) {
    throw new ApiError(400, "Cannot change your own role");
  }

  if (actorRole === "admin") {
    if (targetRole === "admin") {
      throw new ApiError(403, "Organisation admins cannot modify other admins");
    }
    if (role === "admin") {
      throw new ApiError(403, "Organisation admins cannot promote members to admin");
    }
  }

  await organisationRepository.updateMemberRole(orgId, targetUserId, role);
};

export const removeOrgMember = async (
  orgId: string,
  actorUserId: string,
  targetUserId: string,
): Promise<void> => {
  const actorRole = await organisationRepository.getMemberRole(orgId, actorUserId);
  if (actorUserId === targetUserId) {
    throw new ApiError(400, "You cannot remove yourself from the organisation");
  }

  const targetRole = await organisationRepository.getMemberRole(orgId, targetUserId);
  if (!targetRole) {
    throw new ApiError(404, "Member not found");
  }
  if (targetRole === "owner") {
    throw new ApiError(400, "The organisation owner cannot be removed");
  }

  if (actorRole === "admin" && targetRole === "admin") {
    throw new ApiError(403, "Organisation admins cannot remove other admins");
  }

  await organisationRepository.removeMember(orgId, targetUserId);

  // Decrement seats_used if org has a Teams subscription
  await orgSubscriptionRepository.decrementSeatsUsed(orgId);
};

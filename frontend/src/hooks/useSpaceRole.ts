import { useAppContext } from "@/contexts/AppContext";

export type SpaceRole = "admin" | "manager" | "member";
export type OrgRole = "owner" | "admin" | "member";

const SPACE_RANK: Record<SpaceRole, number> = { admin: 3, manager: 2, member: 1 };

export function useSpaceRole() {
  const { activeSpace, activeOrg } = useAppContext();
  const spaceRole = (activeSpace?.role ?? "member") as SpaceRole;
  const orgRole = (activeOrg?.role ?? "member") as OrgRole;

  const spaceRank = SPACE_RANK[spaceRole] ?? 1;

  return {
    spaceRole,
    orgRole,
    // Task permissions
    canCreateTask:           spaceRank >= SPACE_RANK.manager,
    canEditTask:             spaceRank >= SPACE_RANK.manager,
    canDeleteTask:           spaceRank >= SPACE_RANK.manager,
    canAssignTask:           spaceRank >= SPACE_RANK.manager,
    canChangeAnyStatus:      spaceRank >= SPACE_RANK.manager,
    canChangeAssignedStatus: spaceRank >= SPACE_RANK.member,
    // Comment permissions
    canComment:              spaceRank >= SPACE_RANK.member,
    canDeleteOwnComment:     spaceRank >= SPACE_RANK.member,
    canDeleteAnyComment:     spaceRank >= SPACE_RANK.admin,
    // Motion page permissions
    canCreatePage:           spaceRank >= SPACE_RANK.manager,
    canEditAnyPage:          spaceRank >= SPACE_RANK.admin,
    // Org/space management (org-level check)
    canManageSpace:          orgRole === "owner" || orgRole === "admin",
    canInviteToOrg:          orgRole === "owner" || orgRole === "admin",
    canManageOrgMembers:     orgRole === "owner" || orgRole === "admin",
    canManageSpaceMembers:   spaceRank >= SPACE_RANK.admin,
  };
}

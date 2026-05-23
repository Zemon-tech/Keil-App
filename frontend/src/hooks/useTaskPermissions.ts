import { useAppContext } from "@/contexts/AppContext";
import { type SpaceRole } from "./useSpaceRole";

const SPACE_RANK: Record<SpaceRole, number> = { admin: 3, manager: 2, member: 1 };

export function useTaskPermissions(task?: { org_id?: string; space_id?: string; user_space_role?: string } | null) {
  const { activeOrgId, activeSpace } = useAppContext();

  // If no task is provided, default to member level permissions
  if (!task) {
    return {
      spaceRole: "member" as SpaceRole,
      canEditTask: false,
      canDeleteTask: false,
      canAssignTask: false,
      canChangeAnyStatus: false,
      canChangeAssignedStatus: false,
      canComment: false,
      canDeleteOwnComment: false,
      canDeleteAnyComment: false,
    };
  }

  // Resolve space role dynamically:
  // If the task's org and space match the active org/space, use the activeSpace role (realtime).
  // Otherwise, use the user_space_role returned from the aggregate query (fallback to member).
  const spaceRole = (
    task.org_id === activeOrgId && task.space_id === activeSpace?.id
      ? (activeSpace?.role ?? "member")
      : (task.user_space_role ?? "member")
  ) as SpaceRole;

  const spaceRank = SPACE_RANK[spaceRole] ?? 1;

  return {
    spaceRole,
    canEditTask:             spaceRank >= SPACE_RANK.manager,
    canDeleteTask:           spaceRank >= SPACE_RANK.manager,
    canAssignTask:           spaceRank >= SPACE_RANK.manager,
    canChangeAnyStatus:      spaceRank >= SPACE_RANK.manager,
    canChangeAssignedStatus: spaceRank >= SPACE_RANK.member,
    canComment:              spaceRank >= SPACE_RANK.member,
    canDeleteOwnComment:     spaceRank >= SPACE_RANK.member,
    canDeleteAnyComment:     spaceRank >= SPACE_RANK.admin,
  };
}

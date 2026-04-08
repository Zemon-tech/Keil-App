import {
  workspaceRepository,
  activityRepository
} from '../repositories';
import { Workspace, WorkspaceMember, User } from '../types/entities';
import { MemberRole, LogEntityType, LogActionType } from '../types/enums';
import { PaginationOptions } from '../types/repository';
import { ApiError } from '../utils/ApiError';

/**
 * Workspace Service - Business logic layer using repositories
 * Repositories return Entities, Services convert Entity → DTO
 */

// DTOs (Data Transfer Objects) for API responses
export interface WorkspaceDTO {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceMemberDTO {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
  };
}

export interface CreateWorkspaceData {
  name: string;
  owner_id: string;
}

export interface UpdateWorkspaceData {
  name?: string;
}

/**
 * Convert Workspace entity to DTO
 */
const workspaceToDTO = (workspace: Workspace): WorkspaceDTO => {
  return {
    id: workspace.id,
    name: workspace.name,
    owner_id: workspace.owner_id,
    created_at: workspace.created_at.toISOString()
  };
};

/**
 * Convert WorkspaceMember entity to DTO
 */
const memberToDTO = (member: WorkspaceMember & { user: User }): WorkspaceMemberDTO => {
  return {
    id: member.id,
    workspace_id: member.workspace_id,
    user_id: member.user_id,
    role: member.role,
    created_at: member.created_at.toISOString(),
    user: {
      id: member.user.id,
      email: member.user.email,
      name: member.user.name,
      created_at: new Date(member.user.created_at).toISOString()
    }
  };
};

/**
 * Create a new workspace
 * Note: The database trigger automatically adds the owner as a member
 */
export const createWorkspace = async (data: CreateWorkspaceData): Promise<WorkspaceDTO> => {

  const workspace = await workspaceRepository.executeInTransaction(async (client) => {
    // Create workspace (trigger will auto-add owner as member)
    const newWorkspace = await workspaceRepository.create(data, client);

    // Log workspace creation
    await activityRepository.log({
      workspace_id: newWorkspace.id,
      user_id: data.owner_id,
      entity_type: LogEntityType.WORKSPACE,
      entity_id: newWorkspace.id,
      action_type: LogActionType.TASK_CREATED, // Using TASK_CREATED as placeholder
      old_value: null,
      new_value: { name: newWorkspace.name }
    }, client);

    return newWorkspace;
  });

  return workspaceToDTO(workspace);
};

/**
 * Get workspace by ID
 */
export const getWorkspaceById = async (workspaceId: string): Promise<WorkspaceDTO | null> => {
  const workspace = await workspaceRepository.findById(workspaceId);
  return workspace ? workspaceToDTO(workspace) : null;
};

/**
 * Get user's workspace (First one fallback)
 */
export const getUserWorkspace = async (userId: string): Promise<WorkspaceDTO | null> => {
  const workspace = await workspaceRepository.findByUserId(userId);
  return workspace ? workspaceToDTO(workspace) : null;
};

/**
 * Get ALL user workspaces
 */
export const getUserWorkspaces = async (userId: string): Promise<WorkspaceDTO[]> => {
  const workspaces = await workspaceRepository.findAllByUserId(userId);
  return workspaces.map(workspaceToDTO);
};

/**
 * Update workspace
 */
export const updateWorkspace = async (
  workspaceId: string,
  data: UpdateWorkspaceData,
  userId: string
): Promise<WorkspaceDTO | null> => {
  const result = await workspaceRepository.executeInTransaction(async (client) => {
    const oldWorkspace = await workspaceRepository.findById(workspaceId, client);
    if (!oldWorkspace) {
      return null;
    }

    const updatedWorkspace = await workspaceRepository.update(workspaceId, data, client);
    if (!updatedWorkspace) {
      return null;
    }

    // Log name change if applicable
    if (data.name && data.name !== oldWorkspace.name) {
      await activityRepository.log({
        workspace_id: workspaceId,
        user_id: userId,
        entity_type: LogEntityType.WORKSPACE,
        entity_id: workspaceId,
        action_type: LogActionType.TITLE_UPDATED, // Using TITLE_UPDATED as placeholder
        old_value: { name: oldWorkspace.name },
        new_value: { name: data.name }
      }, client);
    }

    return updatedWorkspace;
  });

  return result ? workspaceToDTO(result) : null;
};

/**
 * Delete workspace (soft delete)
 */
export const deleteWorkspace = async (
  workspaceId: string,
  userId: string
): Promise<void> => {
  await workspaceRepository.executeInTransaction(async (client) => {
    const workspace = await workspaceRepository.findById(workspaceId, client);
    if (!workspace) {
      throw new ApiError(404, 'Workspace not found');
    }

    // Soft delete workspace
    await workspaceRepository.softDelete(workspaceId, client);

    // Log deletion
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: LogEntityType.WORKSPACE,
      entity_id: workspaceId,
      action_type: LogActionType.TASK_DELETED, // Using TASK_DELETED as placeholder
      old_value: { name: workspace.name },
      new_value: null
    }, client);
  });
};

/**
 * Get workspace members
 */
export const getWorkspaceMembers = async (
  workspaceId: string,
  pagination?: PaginationOptions
): Promise<WorkspaceMemberDTO[]> => {
  const members = await workspaceRepository.getMembers(workspaceId, pagination);
  return members.map(memberToDTO);
};

/**
 * Add member to workspace
 */
export const addWorkspaceMember = async (
  workspaceId: string,
  userId: string,
  role: MemberRole,
  addedByUserId: string
): Promise<WorkspaceMemberDTO> => {

  const member = await workspaceRepository.executeInTransaction(async (client) => {
    const newMember = await workspaceRepository.addMember(workspaceId, userId, role, client);

    // Log member addition
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: addedByUserId,
      entity_type: LogEntityType.WORKSPACE,
      entity_id: workspaceId,
      action_type: LogActionType.ASSIGNMENT_ADDED, // Using ASSIGNMENT_ADDED as placeholder
      old_value: null,
      new_value: { user_id: userId, role }
    }, client);

    // Fetch member with user details
    const members = await workspaceRepository.getMembers(workspaceId, undefined, client);
    const memberWithUser = members.find(m => m.id === newMember.id);
    
    return memberWithUser!;
  });

  return memberToDTO(member);
};

/**
 * Update member role
 */
export const updateMemberRole = async (
  workspaceId: string,
  userId: string,
  newRole: MemberRole,
  updatedByUserId: string
): Promise<WorkspaceMemberDTO | null> => {
  const result = await workspaceRepository.executeInTransaction(async (client) => {
    // Get current member info
    const members = await workspaceRepository.getMembers(workspaceId, undefined, client);
    const currentMember = members.find(m => m.user_id === userId);
    
    if (!currentMember) {
      return null;
    }

    // Prevent changing owner role
    if (currentMember.role === MemberRole.OWNER) {
      throw new ApiError(400, 'Cannot change the role of the workspace owner');
    }

    const updatedMember = await workspaceRepository.updateMemberRole(workspaceId, userId, newRole, client);
    if (!updatedMember) {
      return null;
    }

    // Log role change
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: updatedByUserId,
      entity_type: LogEntityType.WORKSPACE,
      entity_id: workspaceId,
      action_type: LogActionType.PRIORITY_CHANGED, // Using PRIORITY_CHANGED as placeholder
      old_value: { user_id: userId, role: currentMember.role },
      new_value: { user_id: userId, role: newRole }
    }, client);

    // Fetch updated member with user details
    const updatedMembers = await workspaceRepository.getMembers(workspaceId, undefined, client);
    const memberWithUser = updatedMembers.find(m => m.user_id === userId);
    
    return memberWithUser!;
  });

  return result ? memberToDTO(result) : null;
};

/**
 * Remove member from workspace
 */
export const removeMember = async (
  workspaceId: string,
  userId: string,
  removedByUserId: string
): Promise<void> => {
  await workspaceRepository.executeInTransaction(async (client) => {
    // Get member info before removal
    const members = await workspaceRepository.getMembers(workspaceId, undefined, client);
    const member = members.find(m => m.user_id === userId);
    
    if (!member) {
      throw new ApiError(404, 'Member not found in workspace');
    }

    // Prevent removing the owner
    if (member.role === MemberRole.OWNER) {
      throw new ApiError(400, 'Cannot remove the workspace owner');
    }

    await workspaceRepository.removeMember(workspaceId, userId, client);

    // Log member removal
    await activityRepository.log({
      workspace_id: workspaceId,
      user_id: removedByUserId,
      entity_type: LogEntityType.WORKSPACE,
      entity_id: workspaceId,
      action_type: LogActionType.ASSIGNMENT_REMOVED, // Using ASSIGNMENT_REMOVED as placeholder
      old_value: { user_id: userId, role: member.role },
      new_value: null
    }, client);
  });
};

/**
 * Check if user is a member of workspace
 */
export const isWorkspaceMember = async (
  workspaceId: string,
  userId: string
): Promise<boolean> => {
  return await workspaceRepository.isMember(workspaceId, userId);
};

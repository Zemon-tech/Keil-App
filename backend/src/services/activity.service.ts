import { activityRepository } from "../repositories";
import { ActivityLog, User } from "../types/entities";
import { LogEntityType } from "../types/enums";
import { ActivityQueryOptions } from "../types/repository";

/**
 * Activity Service - Business logic layer using repositories
 * Repositories return Entities, Services convert Entity → DTO
 */

// DTOs (Data Transfer Objects) for API responses
export interface ActivityLogDTO {
  id: string;
  workspace_id: string;
  user_id: string | null;
  entity_type: LogEntityType;
  entity_id: string;
  action_type: string;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  created_at: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    created_at: string;
  } | null;
}

/**
 * Convert ActivityLog entity to DTO
 */
const toISOStringSafe = (
  value: Date | string | null | undefined,
  fieldName: string,
): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  throw new Error(`Invalid ${fieldName} value in activity log`);
};

const activityLogToDTO = (
  log: ActivityLog & { user: User | null },
): ActivityLogDTO => {
  return {
    id: log.id,
    workspace_id: log.workspace_id,
    user_id: log.user_id,
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    action_type: log.action_type,
    old_value: log.old_value,
    new_value: log.new_value,
    created_at: toISOStringSafe(log.created_at, "created_at"),
    user: log.user
      ? {
          id: log.user.id,
          email: log.user.email,
          name: log.user.name,
          created_at: toISOStringSafe(log.user.created_at, "user.created_at"),
        }
      : null,
  };
};

/**
 * Get activity logs by workspace with pagination and filters
 */
export const getWorkspaceActivity = async (
  workspaceId: string,
  options: ActivityQueryOptions = {},
): Promise<ActivityLogDTO[]> => {
  const logs = await activityRepository.findByWorkspace(workspaceId, options);
  return logs.map(activityLogToDTO);
};

/**
 * Get activity logs for a specific entity
 */
export const getEntityActivity = async (
  workspaceId: string,
  entityType: LogEntityType,
  entityId: string,
): Promise<ActivityLogDTO[]> => {
  const logs = await activityRepository.findByEntity(
    workspaceId,
    entityType,
    entityId,
  );
  return logs.map(activityLogToDTO);
};

/**
 * Get the full task timeline, including related comment activity.
 */
export const getTaskActivity = async (
  workspaceId: string,
  taskId: string,
): Promise<ActivityLogDTO[]> => {
  const logs = await activityRepository.findTaskHistory(workspaceId, taskId);
  return logs.map(activityLogToDTO);
};

/**
 * Get activity logs by user in a workspace
 */
export const getUserActivity = async (
  userId: string,
  workspaceId: string,
): Promise<ActivityLogDTO[]> => {
  const logs = await activityRepository.findByUser(userId, workspaceId);
  return logs.map(activityLogToDTO);
};

/**
 * Get recent activity logs (limited)
 */
export const getRecentActivity = async (
  workspaceId: string,
  limit: number = 50,
): Promise<ActivityLogDTO[]> => {
  const logs = await activityRepository.findRecent(workspaceId, limit);
  return logs.map(activityLogToDTO);
};

/**
 * Get activity feed for dashboard
 * Returns recent activity with pagination
 */
export const getActivityFeed = async (
  workspaceId: string,
  limit: number = 20,
  offset: number = 0,
): Promise<ActivityLogDTO[]> => {
  const logs = await activityRepository.findByWorkspace(workspaceId, {
    pagination: { limit, offset },
  });
  return logs.map(activityLogToDTO);
};

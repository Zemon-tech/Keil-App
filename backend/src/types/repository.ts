// Repository-specific types for queries and operations
import { TaskStatus, TaskPriority } from './enums';

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface SortOptions {
  field: string;
  order: 'ASC' | 'DESC';
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assigneeId?: string;
  dueDateStart?: Date;
  dueDateEnd?: Date;
  parentTaskId?: string | null;
  createdBy?: string;
}

export interface TaskQueryOptions {
  filters?: TaskFilters;
  sort?: SortOptions;
  pagination?: PaginationOptions;
  includeDeleted?: boolean;
}

export interface CommentQueryOptions {
  pagination?: PaginationOptions;
  includeDeleted?: boolean;
}

export interface ActivityQueryOptions {
  pagination?: PaginationOptions;
  entityType?: string;
  entityId?: string;
  userId?: string;
}

export interface WorkspaceMemberQueryOptions {
  pagination?: PaginationOptions;
  role?: string;
}

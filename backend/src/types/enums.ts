// Database enum types matching PostgreSQL schema

export enum TaskStatus {
  BACKLOG = 'backlog',
  TODO = 'todo',
  IN_PROGRESS = 'in-progress',
  DONE = 'done',
  CONFIRMED = 'confirmed',
  TENTATIVE = 'tentative',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum MemberRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

export enum EventType {
  MEETING = 'meeting',
  CALL = 'call',
  PERSONAL = 'personal',
  REMINDER = 'reminder',
  OTHER = 'other'
}

export enum LogEntityType {
  TASK = 'task',
  COMMENT = 'comment',
  WORKSPACE = 'workspace'
}

export enum LogActionType {
  TASK_CREATED = 'task_created',
  TASK_DELETED = 'task_deleted',
  STATUS_CHANGED = 'status_changed',
  PRIORITY_CHANGED = 'priority_changed',
  ASSIGNMENT_ADDED = 'assignment_added',
  ASSIGNMENT_REMOVED = 'assignment_removed',
  DUE_DATE_CHANGED = 'due_date_changed',
  START_DATE_CHANGED = 'start_date_changed',
  DEPENDENCY_ADDED = 'dependency_added',
  DEPENDENCY_REMOVED = 'dependency_removed',
  COMMENT_CREATED = 'comment_created',
  COMMENT_DELETED = 'comment_deleted',
  OBJECTIVE_UPDATED = 'objective_updated',
  SUCCESS_CRITERIA_UPDATED = 'success_criteria_updated',
  TITLE_UPDATED = 'title_updated',
  DESCRIPTION_UPDATED = 'description_updated'
}

// Database entity interfaces matching PostgreSQL schema
import { TaskStatus, TaskPriority, MemberRole, LogEntityType, LogActionType } from './enums';

export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: Date;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: Date;
  deleted_at: Date | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  created_at: Date;
}

export interface Task {
  id: string;
  workspace_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  objective: string | null;
  success_criteria: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: Date | null;
  due_date: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface TaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  assigned_at: Date;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_at: Date;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  parent_comment_id: string | null;
  created_at: Date;
  deleted_at: Date | null;
}

export interface ActivityLog {
  id: string;
  workspace_id: string;
  user_id: string | null;
  entity_type: LogEntityType;
  entity_id: string;
  action_type: LogActionType;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  created_at: Date;
}

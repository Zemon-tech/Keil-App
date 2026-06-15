// Database entity interfaces matching PostgreSQL schema
import { TaskStatus, TaskPriority, MemberRole, LogEntityType, LogActionType, MotionShareType, MotionPermission } from './enums';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: Date;
}

export interface Organisation {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  is_personal?: boolean;
}

export interface OrganisationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: MemberRole;
  created_at: Date;
}

export interface Space {
  id: string;
  org_id: string | null;
  name: string;
  visibility: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  is_private?: boolean;
}

export interface SpaceMember {
  id: string;
  org_id: string | null;
  space_id: string;
  user_id: string;
  role: MemberRole;
  created_at: Date | null;
}

export interface Task {
  id: string;
  org_id?: string | null;
  space_id?: string | null;
  parent_task_id: string | null;
  type: 'task' | 'event';
  event_type: string | null;
  location: string | null;
  is_all_day: boolean;
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
  subtask_count?: number | string;
  google_event_id?: string | null;
  ical_uid?: string | null; // Added in migration 011 — stable Google iCalUID
  meet_link?: string | null;
  guests?: string[] | null;
  context?: any[] | null;
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
  org_id?: string | null;
  space_id?: string | null;
  user_id: string | null;
  entity_type: LogEntityType;
  entity_id: string;
  action_type: LogActionType;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  created_at: Date;
}

export interface PersonalTask {
  id: string;
  owner_user_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  objective: string | null;
  success_criteria: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: Date | null;
  due_date: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  google_event_id?: string | null;
  ical_uid?: string | null; // Added in migration 011 — stable Google iCalUID
  location?: string | null;
  meet_link?: string | null;
  guests?: string[] | null;
  context?: any[] | null;
}

export interface UserIntegration {
  id: string;
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string;
  token_expiry: Date | null;
  calendar_id: string;
  created_at: Date;
  updated_at: Date;
  // 2-way sync fields (added in migration 011_gcal_two_way_sync.sql)
  watch_status?: 'pending' | 'active' | 'degraded' | 'revoked';
  watch_channel_id?: string | null;
  watch_resource_id?: string | null;
  watch_expires_at?: Date | null;
  gcal_sync_token?: string | null;
  last_sync_at?: Date | null;
  sync_in_progress?: boolean;
  last_sync_error?: string | null;
  last_successful_sync_at?: Date | null;
}

export interface MotionPage {
  id: string;
  org_id: string;
  space_id: string;
  created_by: string;
  updated_by: string;
  parent_id: string | null;
  title: string;
  content: Record<string, any>; // Tiptap JSONContent
  icon: string | null;
  cover_image: string | null;
  cover_position: number; // 0–100, vertical %, default 50
  position: number;
  small_text: boolean;
  full_width: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  share_permission?: MotionPermission;
  notion_page_id?: string | null;
  notion_last_synced_at?: Date | null;
}

export interface MotionPageShare {
  id: string;
  page_id: string;
  share_type: MotionShareType;
  target_org_id: string | null;
  target_space_id: string | null;
  share_token: string | null;
  permission: MotionPermission;
  created_by: string;
  created_at: Date;
  expires_at: Date | null;
}

export interface UserNotificationPreference {
  user_id: string;
  notify_task_assigned: boolean;
  notify_message: boolean;
  notify_motion_shared: boolean;
  notify_status_changed: boolean;
  notify_membership_updated: boolean;
  notify_comment_mention: boolean;
  updated_at: Date;
}

export interface Notification {
  id: string;
  org_id: string | null;
  space_id: string | null;
  recipient_id: string;
  sender_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, any>;
  read_at: Date | null;
  created_at: Date;
}

export interface NotificationOutbox {
  id: string;
  org_id: string | null;
  space_id: string | null;
  sender_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, any>;
  status: 'pending' | 'processing' | 'failed';
  attempts: number;
  created_at: Date;
}

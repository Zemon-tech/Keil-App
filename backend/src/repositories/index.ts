// Repository singleton instances
import pool from '../config/pg';
import { UserRepository } from './user.repository';
import { WorkspaceRepository } from './workspace.repository';
import { TaskRepository } from './task.repository';
import { TaskAssigneeRepository } from './task-assignee.repository';
import { TaskDependencyRepository } from './task-dependency.repository';
import { CommentRepository } from './comment.repository';
import { ActivityRepository } from './activity.repository';
import { OrganisationRepository } from './organisation.repository';
import { SpaceRepository } from './space.repository';
import { PersonalTaskRepository } from './personal-task.repository';
import { OrgTaskRepository } from './org-task.repository';

// Instantiate repositories with the shared pool
export const userRepository = new UserRepository();
export const workspaceRepository = new WorkspaceRepository();
export const taskRepository = new TaskRepository();
export const taskAssigneeRepository = new TaskAssigneeRepository();
export const taskDependencyRepository = new TaskDependencyRepository();
export const commentRepository = new CommentRepository();
export const activityRepository = new ActivityRepository();
export const organisationRepository = new OrganisationRepository();
export const spaceRepository = new SpaceRepository();
export const personalTaskRepository = new PersonalTaskRepository();
export const orgTaskRepository = new OrgTaskRepository();

// Export repository classes for testing/mocking
export {
  UserRepository,
  WorkspaceRepository,
  TaskRepository,
  TaskAssigneeRepository,
  TaskDependencyRepository,
  CommentRepository,
  ActivityRepository,
  OrganisationRepository,
  SpaceRepository,
  PersonalTaskRepository,
  OrgTaskRepository
};

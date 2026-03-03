// Repository singleton instances
import pool from '../config/pg';
import { UserRepository } from './user.repository';
import { WorkspaceRepository } from './workspace.repository';
import { TaskRepository } from './task.repository';
import { TaskAssigneeRepository } from './task-assignee.repository';
import { TaskDependencyRepository } from './task-dependency.repository';
import { CommentRepository } from './comment.repository';
import { ActivityRepository } from './activity.repository';

// Instantiate repositories with the shared pool
export const userRepository = new UserRepository();
export const workspaceRepository = new WorkspaceRepository();
export const taskRepository = new TaskRepository();
export const taskAssigneeRepository = new TaskAssigneeRepository();
export const taskDependencyRepository = new TaskDependencyRepository();
export const commentRepository = new CommentRepository();
export const activityRepository = new ActivityRepository();

// Export repository classes for testing/mocking
export {
  UserRepository,
  WorkspaceRepository,
  TaskRepository,
  TaskAssigneeRepository,
  TaskDependencyRepository,
  CommentRepository,
  ActivityRepository
};

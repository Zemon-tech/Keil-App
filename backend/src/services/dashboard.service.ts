import { taskRepository } from '../repositories';
import { Task } from '../types/entities';
import { TaskStatus, TaskPriority } from '../types/enums';

/**
 * Dashboard Service - Business logic for dashboard views
 * Implements the ranking logic from MVP v0.5 requirements
 */

// DTOs for dashboard responses
export interface TaskDTO {
  id: string;
  workspace_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  objective: string | null;
  success_criteria: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  start_date: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardBucketsDTO {
  immediate: TaskDTO[];
  today: TaskDTO[];
  blocked: TaskDTO[];
  backlog: TaskDTO[];
}

/**
 * Convert Task entity to DTO
 */
const taskToDTO = (task: Task): TaskDTO => {
  return {
    id: task.id,
    workspace_id: task.workspace_id,
    parent_task_id: task.parent_task_id,
    title: task.title,
    description: task.description,
    objective: task.objective,
    success_criteria: task.success_criteria,
    status: task.status,
    priority: task.priority,
    start_date: task.start_date ? task.start_date.toISOString() : null,
    due_date: task.due_date ? task.due_date.toISOString() : null,
    created_by: task.created_by,
    created_at: task.created_at.toISOString(),
    updated_at: task.updated_at.toISOString()
  };
};

/**
 * Calculate priority weight for ranking
 * urgent=3, high=2, medium=1, low=0
 */
const getPriorityWeight = (priority: TaskPriority): number => {
  switch (priority) {
    case TaskPriority.URGENT:
      return 3;
    case TaskPriority.HIGH:
      return 2;
    case TaskPriority.MEDIUM:
      return 1;
    case TaskPriority.LOW:
      return 0;
    default:
      return 0;
  }
};

/**
 * Sort tasks by priority weight and due date
 */
const sortTasksByRanking = (tasks: Task[]): Task[] => {
  return tasks.sort((a, b) => {
    // First sort by priority weight (higher first)
    const priorityDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    // Then sort by due date (earlier first)
    if (a.due_date && b.due_date) {
      return a.due_date.getTime() - b.due_date.getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;

    // Finally sort by created date (newer first)
    return b.created_at.getTime() - a.created_at.getTime();
  });
};

/**
 * Get dashboard buckets with ranked tasks
 * Implements the MVP v0.5 dashboard ranking logic
 */
export const getDashboardBuckets = async (workspaceId: string): Promise<DashboardBucketsDTO> => {
  // Fetch all bucket data in parallel
  const [immediate, today, blocked, backlog] = await Promise.all([
    taskRepository.findUrgentAndNearDue(workspaceId, 48), // 48 hours threshold
    taskRepository.findDueToday(workspaceId),
    taskRepository.findBlocked(workspaceId),
    taskRepository.findBacklog(workspaceId)
  ]);

  // Sort each bucket by ranking
  const sortedImmediate = sortTasksByRanking(immediate);
  const sortedToday = sortTasksByRanking(today);
  const sortedBlocked = sortTasksByRanking(blocked);
  const sortedBacklog = sortTasksByRanking(backlog);

  return {
    immediate: sortedImmediate.map(taskToDTO),
    today: sortedToday.map(taskToDTO),
    blocked: sortedBlocked.map(taskToDTO),
    backlog: sortedBacklog.map(taskToDTO)
  };
};

/**
 * Get immediate tasks (urgent + near due)
 */
export const getImmediateTasks = async (
  workspaceId: string,
  hoursThreshold: number = 48
): Promise<TaskDTO[]> => {
  const tasks = await taskRepository.findUrgentAndNearDue(workspaceId, hoursThreshold);
  const sorted = sortTasksByRanking(tasks);
  return sorted.map(taskToDTO);
};

/**
 * Get today's tasks
 */
export const getTodayTasks = async (workspaceId: string): Promise<TaskDTO[]> => {
  const tasks = await taskRepository.findDueToday(workspaceId);
  const sorted = sortTasksByRanking(tasks);
  return sorted.map(taskToDTO);
};

/**
 * Get blocked tasks
 */
export const getBlockedTasks = async (workspaceId: string): Promise<TaskDTO[]> => {
  const tasks = await taskRepository.findBlocked(workspaceId);
  const sorted = sortTasksByRanking(tasks);
  return sorted.map(taskToDTO);
};

/**
 * Get backlog tasks
 */
export const getBacklogTasks = async (workspaceId: string): Promise<TaskDTO[]> => {
  const tasks = await taskRepository.findBacklog(workspaceId);
  const sorted = sortTasksByRanking(tasks);
  return sorted.map(taskToDTO);
};

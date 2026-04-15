import { 
  taskRepository, 
  workspaceRepository, 
  taskAssigneeRepository 
} from '../repositories';
import { ScheduleRepository } from '../repositories/schedule.repository';
import { validateTaskHasDates, validateTimeblockRange } from '../utils/validateTaskDates';
import { ApiError } from '../utils/ApiError';
import { TaskStatus, MemberRole } from '../types/enums';

const scheduleRepository = new ScheduleRepository();

export const getCalendarTasks = async (
  userId: string, 
  workspaceId: string, 
  startRange: string, 
  endRange: string, 
  targetUserId?: string
) => {
  if (targetUserId && targetUserId !== userId) {
    const isMember = await workspaceRepository.isMember(workspaceId, targetUserId);
    if (!isMember) {
      throw new ApiError(403, 'Target user is not a member of this workspace');
    }
    return scheduleRepository.getCalendarBlocks(targetUserId, workspaceId, startRange, endRange);
  }
  return scheduleRepository.getCalendarBlocks(userId, workspaceId, startRange, endRange);
};

export const getUnscheduledTasks = async (
  userId: string, 
  workspaceId: string, 
  limit: number, 
  offset: number, 
  search?: string
) => {
  return scheduleRepository.getUnscheduledTasks(userId, workspaceId, limit, offset, search);
};

export const updateTaskTimeblock = async (
  taskId: string, 
  userId: string, 
  workspaceId: string, 
  scheduledStart: string, 
  scheduledEnd: string
) => {
  return taskRepository.executeInTransaction(async (client) => {
    const task = await taskRepository.findById(taskId, client);
    if (!task || task.workspace_id !== workspaceId || task.deleted_at) {
      throw new ApiError(404, 'Task not found');
    }

    // Auto-set start_date if missing
    if (!task.start_date) {
      task.start_date = new Date();
      await taskRepository.update(task.id, { start_date: task.start_date }, client);
    }

    // Auto-set due_date if missing — default to end of the scheduled day
    if (!task.due_date) {
      const scheduledEndDate = new Date(scheduledEnd);
      // Set due_date to end of that day (23:59:59)
      const endOfDay = new Date(scheduledEndDate);
      endOfDay.setHours(23, 59, 59, 999);
      task.due_date = endOfDay;
      await taskRepository.update(task.id, { due_date: task.due_date }, client);
    }

    validateTaskHasDates(task.start_date, task.due_date);

    // Auto-assign user to task if not already assigned
    const assignees = await taskAssigneeRepository.findByTask(taskId, client);
    const isAssigned = assignees.some((a: any) => a.user_id === userId);
    if (!isAssigned) {
      await taskAssigneeRepository.assign(taskId, userId, client);
    }

    validateTimeblockRange(scheduledStart, scheduledEnd);

    const blockStart = new Date(scheduledStart).getTime();
    const blockEnd = new Date(scheduledEnd).getTime();
    const taskStart = new Date(task.start_date!).getTime();
    const taskDue = new Date(task.due_date!).getTime();

    // Expand task bounds if the timeblock falls outside them
    if (blockStart < taskStart) {
      await taskRepository.update(task.id, { start_date: new Date(scheduledStart) }, client);
    }
    if (blockEnd > taskDue) {
      const newDue = new Date(scheduledEnd);
      newDue.setHours(23, 59, 59, 999);
      await taskRepository.update(task.id, { due_date: newDue }, client);
    }

    if (task.parent_task_id) {
      const parent = await taskRepository.findById(task.parent_task_id, client);
      if (parent && parent.start_date && parent.due_date) {
        const parentStart = new Date(parent.start_date).getTime();
        const parentDue = new Date(parent.due_date).getTime();
        if (blockStart < parentStart || blockEnd > parentDue) {
          throw new ApiError(400, 'Subtask schedule exceeds parent task boundaries');
        }
      }
    }

    if (task.status === TaskStatus.BACKLOG) {
      await taskRepository.updateStatus(task.id, TaskStatus.TODO, client);
      task.status = TaskStatus.TODO;
    }

    const scheduled_start = new Date(scheduledStart);
    const scheduled_end = new Date(scheduledEnd);

    return scheduleRepository.upsertTimeblock(
      taskId, 
      userId, 
      workspaceId, 
      scheduled_start, 
      scheduled_end, 
      client
    );
  });
};

export const deleteTaskTimeblock = async (
  taskId: string, 
  userId: string, 
  workspaceId: string
) => {
  return taskRepository.executeInTransaction(async (client) => {
    await scheduleRepository.deleteTimeblock(taskId, userId, workspaceId, client);
  });
};

export const getGanttTasks = async (
  workspaceId: string, 
  scope: 'workspace' | 'user', 
  userId?: string, 
  projectId?: string
) => {
  return scheduleRepository.getGanttTasks(workspaceId, scope, userId, projectId);
};

export const updateTaskDeadline = async (
  taskId: string, 
  userId: string, 
  workspaceId: string, 
  newStartDateStr: string, 
  newDueDateStr: string
) => {
  return taskRepository.executeInTransaction(async (client) => {
    // Check Permissions
    const members = await workspaceRepository.getMembers(workspaceId, undefined, client);
    const userMember = members.find(m => m.user_id === userId);
    
    if (!userMember || (userMember.role !== MemberRole.ADMIN && userMember.role !== MemberRole.OWNER)) {
      throw new ApiError(403, 'Only admins and owners can perform timeline synchronization via Gantt chart');
    }

    const task = await taskRepository.findById(taskId, client);
    if (!task || task.workspace_id !== workspaceId || task.deleted_at) {
      throw new ApiError(404, 'Task not found');
    }

    if (task.status === TaskStatus.DONE) {
      return { updated_task: task, cascaded_task_ids: [] };
    }

    if (!task.due_date) {
      throw new ApiError(400, 'Cannot modify timeline for a task without an origin due date');
    }

    const newStartDate = new Date(newStartDateStr);
    const newDueDate = new Date(newDueDateStr);
    const oldStartDate = task.start_date ? new Date(task.start_date) : new Date();
    const oldDueDate = new Date(task.due_date);

    const startDeltaMs = newStartDate.getTime() - oldStartDate.getTime();
    const endDeltaMs = newDueDate.getTime() - oldDueDate.getTime();

    await taskRepository.update(taskId, { start_date: newStartDate, due_date: newDueDate }, client);
    const updated_task = await taskRepository.findById(taskId, client);

    // If completely moving, shift timeblocks (preserve duration)
    if (startDeltaMs === endDeltaMs && startDeltaMs !== 0) {
      await scheduleRepository.shiftTimeblocks(taskId, startDeltaMs, client);
    }

    // Always purge blocks that fall out of bounds
    await scheduleRepository.purgeOutOfBoundsTimeblocks(taskId, newStartDate, newDueDate, client);

    const cascaded_task_ids: string[] = [];

    // Cascade engine
    if (endDeltaMs !== 0) {
      const queue: { id: string, updatedDueDate: number, delta: number, depth: number }[] = [];
      queue.push({ id: taskId, updatedDueDate: newDueDate.getTime(), delta: endDeltaMs, depth: 0 });
      const visited = new Set<string>();
      visited.add(taskId);

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.depth >= 15) continue;

        const taskWithDeps = await taskRepository.findWithDependencies(current.id, client);
        if (taskWithDeps && (taskWithDeps as any).blocked_tasks) {
          for (const dependent of (taskWithDeps as any).blocked_tasks) {
            if (visited.has(dependent.id) || dependent.status === TaskStatus.DONE) continue;
            
            const depStart = dependent.start_date ? new Date(dependent.start_date).getTime() : null;
            if (depStart && current.updatedDueDate >= depStart) {
              const depStartNewDate = new Date(depStart + current.delta);
              const depDue = new Date(dependent.due_date!).getTime();
              const depDueNewDate = new Date(depDue + current.delta);
              
              await taskRepository.update(dependent.id, {
                start_date: depStartNewDate,
                due_date: depDueNewDate
              }, client);

              await scheduleRepository.shiftTimeblocks(dependent.id, current.delta, client);
              await scheduleRepository.purgeOutOfBoundsTimeblocks(dependent.id, depStartNewDate, depDueNewDate, client);

              cascaded_task_ids.push(dependent.id);
              visited.add(dependent.id);

              queue.push({ 
                id: dependent.id, 
                updatedDueDate: depDueNewDate.getTime(), 
                delta: current.delta, 
                depth: current.depth + 1 
              });
            }
          }
        }
      }
    }

    return { updated_task, cascaded_task_ids };
  });
};

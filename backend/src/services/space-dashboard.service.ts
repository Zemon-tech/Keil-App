import { orgTaskRepository } from "../repositories";
import { TaskPriority } from "../types/enums";
import { OrgTaskDTO } from "./org-task.service";

const toDTO = (task: any): OrgTaskDTO => ({
  id: task.id,
  workspace_id: task.workspace_id,
  org_id: task.org_id ?? null,
  space_id: task.space_id ?? null,
  parent_task_id: task.parent_task_id,
  title: task.title,
  description: task.description,
  objective: task.objective,
  success_criteria: task.success_criteria,
  status: task.status,
  priority: task.priority,
  start_date: task.start_date ? new Date(task.start_date).toISOString() : null,
  due_date: task.due_date ? new Date(task.due_date).toISOString() : null,
  created_by: task.created_by,
  created_at: new Date(task.created_at).toISOString(),
  updated_at: new Date(task.updated_at).toISOString(),
});

const getPriorityWeight = (priority: TaskPriority): number => {
  switch (priority) {
    case TaskPriority.URGENT:
      return 3;
    case TaskPriority.HIGH:
      return 2;
    case TaskPriority.MEDIUM:
      return 1;
    case TaskPriority.LOW:
    default:
      return 0;
  }
};

const sortTasksByRanking = (tasks: any[]): any[] =>
  tasks.sort((a, b) => {
    const priorityDiff = getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

export const getSpaceDashboardBuckets = async (orgId: string, spaceId: string) => {
  const [immediate, today, blocked, backlog] = await Promise.all([
    orgTaskRepository.findUrgentAndNearDue(orgId, spaceId, 48),
    orgTaskRepository.findDueToday(orgId, spaceId),
    orgTaskRepository.findBlocked(orgId, spaceId),
    orgTaskRepository.findBacklog(orgId, spaceId),
  ]);

  return {
    immediate: sortTasksByRanking(immediate).map(toDTO),
    today: sortTasksByRanking(today).map(toDTO),
    blocked: sortTasksByRanking(blocked).map(toDTO),
    backlog: sortTasksByRanking(backlog).map(toDTO),
  };
};

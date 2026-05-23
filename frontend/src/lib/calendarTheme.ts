/**
 * KeiHQ Calendar Theme System
 * Centralized semantic color mapping for calendar events and tasks.
 * All colors derive from CSS variables defined in index.css.
 */

export interface ThemeColors {
  background: string;
  text: string;
  border: string;
  hover?: string;
  selected?: string;
}

export type CalendarBlockType = 'meeting' | 'focus_block' | 'task_slot' | 'deadline_marker' | 'reminder';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done' | 'completed' | 'cancelled';

/**
 * Mapping for Calendar Block Types (Meeting, Focus, etc.)
 */
export const blockTypeThemeMap: Record<CalendarBlockType, ThemeColors> = {
  meeting: {
    background: 'var(--event-meeting-bg)',
    text: 'var(--event-meeting-text)',
    border: 'var(--event-meeting-border)',
  },
  focus_block: {
    background: 'var(--event-focus-bg)',
    text: 'var(--event-focus-text)',
    border: 'var(--event-focus-border)',
  },
  task_slot: {
    background: 'var(--event-task-bg)',
    text: 'var(--event-task-text)',
    border: 'var(--event-task-border)',
  },
  deadline_marker: {
    background: 'var(--event-deadline-bg)',
    text: 'var(--event-deadline-text)',
    border: 'var(--event-deadline-border)',
  },
  reminder: {
    background: 'var(--event-reminder-bg)',
    text: 'var(--event-reminder-text)',
    border: 'var(--event-reminder-border)',
  },
};

/**
 * Mapping for Task Priorities
 */
export const priorityThemeMap: Record<TaskPriority, ThemeColors> = {
  urgent: {
    background: 'var(--priority-urgent-bg)',
    text: 'var(--priority-urgent-text)',
    border: 'var(--priority-urgent-border)',
  },
  high: {
    background: 'var(--priority-high-bg)',
    text: 'var(--priority-high-text)',
    border: 'var(--priority-high-border)',
  },
  medium: {
    background: 'var(--priority-medium-bg)',
    text: 'var(--priority-medium-text)',
    border: 'var(--priority-medium-border)',
  },
  low: {
    background: 'var(--priority-low-bg)',
    text: 'var(--priority-low-text)',
    border: 'var(--priority-low-border)',
  },
};

/**
 * Specialized Styles for States and Generic Events
 */
export const stateThemeMap = {
  done: {
    background: 'var(--priority-done-bg)',
    text: 'var(--priority-done-text)',
    border: 'var(--priority-done-border)',
  },
  generic: {
    background: 'var(--event-generic-bg)',
    text: 'var(--event-generic-text)',
    border: 'var(--event-generic-border)',
  },
};

/**
 * Helper to get theme colors for a task or block
 */
export function getThemeForTask(type?: string, priority?: string, status?: string): ThemeColors {
  const isDone = status === 'done' || status === 'completed';

  if (isDone) return stateThemeMap.done;
  if (type === 'event') return stateThemeMap.generic;

  const p = (priority?.toLowerCase() as TaskPriority) || 'low';
  return priorityThemeMap[p] || priorityThemeMap.low;
}

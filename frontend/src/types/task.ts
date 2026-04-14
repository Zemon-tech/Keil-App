export type TaskStatus = "backlog" | "todo" | "in-progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type CalendarBlockType =
    | "meeting"
    | "focus_block"
    | "task_slot"
    | "deadline_marker"
    | "reminder";

export type CalendarBlock = {
    id: string;
    type: CalendarBlockType;
    title: string;
    startISO: string;
    endISO?: string;
    taskId?: string;
    notes?: string;
};

export type Subtask = {
    id: string;
    title: string;
    done: boolean;
    assignee?: string;
};

export type Dependency = {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
};

export type ContextItem = {
    id: string;
    title: string;
    url: string;
    type: "doc" | "link" | "figma" | "github" | "notion";
};

export type Comment = {
    id: string;
    task_id: string;
    user_id: string;
    content: string;
    parent_comment_id: string | null;
    created_at: string;
    user: { id: string; email: string; name: string | null };
    replies: Comment[];
};

// ─── Real backend shape — used by Module 4 Activity Feed ─────────────────────
export type ActivityLogEntry = {
    id: string;
    entity_type: "task" | "comment" | "workspace";
    entity_id: string;
    action_type: string;
    old_value: Record<string, any> | null;
    new_value: Record<string, any> | null;
    created_at: string;
    user: { id: string; email: string; name: string | null } | null;
};



export type AssigneeUser = {
    id: string;
    email: string;
    name: string | null;
};

export type Task = {
    id: string;
    projectId: string;
    projectTitle: string;
    title: string;
    description?: string;
    objective: string;
    success_criteria: string;
    status: TaskStatus;
    priority: TaskPriority;
    owner: string;
    assignees: AssigneeUser[];
    labels: string[];
    dueDateISO: string;
    plannedStartISO?: string;
    plannedEndISO?: string;
    storyPoints?: number;
    timeEstimateMinutes?: number;
    dependencies: Dependency[];
    context: ContextItem[];
    subtasks: Subtask[];
    comments: Comment[];
    parentTaskId?: string;
};

export type DashboardTaskDTO = {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    due_date: string | null;
    objective: string | null;
};

// Returned by GET /api/v1/schedule/calendar
export type ScheduleBlockDTO = {
  id: string;
  task_id: string;
  task_title: string;
  task_status: TaskStatus;
  scheduled_start: string; // ISO
  scheduled_end: string;   // ISO
};

// Returned by GET /api/v1/schedule/gantt
export type GanttTaskDTO = {
  id: string;
  title: string;
  status: TaskStatus;
  start_date: string; // ISO — never null (backend defaults null start_date to today in response)
  due_date: string;   // ISO — never null (backend excludes tasks with null due_date)
  parent_task_id: string | null;
  dependencies: string[]; // array of task UUIDs this task depends on
};

// Returned by GET /api/v1/schedule/unscheduled
export type UnscheduledTaskDTO = {
  id: string;
  title: string;
  start_date: string | null;
  due_date: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  parent_task_id?: string | null;
};


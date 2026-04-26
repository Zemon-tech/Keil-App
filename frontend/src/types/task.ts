export type TaskStatus = "backlog" | "todo" | "in-progress" | "done";
export type EventStatus = "confirmed" | "tentative" | "cancelled" | "completed";
export type AnyStatus = TaskStatus | EventStatus;
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type EventType = "meeting" | "call" | "birthday" | "other" | string;

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
    type: "task" | "event";
    event_type?: EventType | null;
    location?: string | null;
    is_all_day?: boolean;
    description?: string;
    objective: string;
    success_criteria: string;
    status: AnyStatus;
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
    history?: ActivityLogEntry[];
    parentTaskId?: string;
};

export type DashboardTaskDTO = {
    id: string;
    title: string;
    status: AnyStatus;
    priority: TaskPriority;
    due_date: string | null;
    objective: string | null;
};

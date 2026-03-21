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
    author: string;
    body: string;
    timestamp: string;
};

export interface HistoryEntry {
    id: string;
    field: string;         // "Status", "Priority", "Assignee", "Subtask", "Due Date"
    from?: string;
    to: string;
    user: string;
    timestamp: string;     // ISO string
    note?: string;         // e.g. "Changed text from..." for description changes
}

export type ActivityLog = {
    id: string;
    label: string;
    timestamp: string;
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
    history: HistoryEntry[];
    comments: Comment[];
    parentTaskId?: string;
};

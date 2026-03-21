import type { Task } from "../types/task";

export const mockTasks: Task[] = [
    {
        id: "tsk_01",
        projectId: "prj_01",
        projectTitle: "ClarityOS Launch",
        title: "Define Task Module UI",
        description: "Ship a task detail experience that keeps the project context visible while staying fast to scan.",
        objective: "Make task work feel structured: objective, criteria, owner, due date, dependencies, and context in one place.",
        success_criteria: "Users can find the next step in < 10 seconds and update status/subtasks without leaving the page.",
        status: "in-progress",
        priority: "high",
        owner: "Shivang",
        assignees: ["Shivang", "Aisha"],
        labels: ["design", "frontend"],
        storyPoints: 5,
        timeEstimateMinutes: 240,
        dueDateISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        plannedStartISO: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
        plannedEndISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        dependencies: [
            { id: "dep_01", taskId: "tsk_03", title: "Finalize sidebar nav", status: "done" },
            { id: "dep_02", taskId: "tsk_04", title: "Decide task statuses", status: "in-progress" },
        ],
        context: [
            { id: "ctx_01", title: "Module spec (Tasks)", type: "doc", url: "#" },
            { id: "ctx_02", title: "Figma export", type: "figma", url: "#" },
            { id: "ctx_03", title: "API contract", type: "github", url: "#" },
        ],
        subtasks: [
            { id: "sub_01", title: "Two-pane layout (list + details)", done: true, assignee: "Aisha" },
            { id: "sub_02", title: "Objective / Success criteria blocks", done: true, assignee: "Shivang" },
            { id: "sub_03", title: "Dependencies + context panel", done: false, assignee: "Aisha" },
            { id: "sub_04", title: "Comments & history tabs", done: false, assignee: "Shivang" },
        ],
        history: [
            {
                id: "h1",
                field: "Status",
                from: "Backlog",
                to: "In Progress",
                user: "Shivang",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString()
            },
            {
                id: "h2",
                field: "Priority",
                from: "Medium",
                to: "High",
                user: "Aisha",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
            },
            {
                id: "h3",
                field: "Subtask",
                to: "Completed: Two-pane layout",
                user: "Shivang",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString()
            },
            {
                id: "h4",
                field: "Due Date",
                from: "12 Mar",
                to: "9 Mar",
                user: "Aisha",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString()
            },
            {
                id: "h5",
                field: "Created",
                to: "Task created by Shivang",
                user: "Shivang",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString()
            }
        ],
        comments: [
            {
                id: "c_01",
                task_id: "tsk_01",
                user_id: "u_design",
                content: "Make the hierarchy visible even when you’re deep inside a subtask.",
                parent_comment_id: null,
                created_at: new Date().toISOString(),
                user: { id: "u_design", email: "design@keil.com", name: "Design" },
                replies: [],
            },
            {
                id: "c_02",
                task_id: "tsk_01",
                user_id: "u_you",
                content: "Agree — I’ll keep a breadcrumb + project chip in the header.",
                parent_comment_id: null,
                created_at: new Date().toISOString(),
                user: { id: "u_you", email: "you@keil.com", name: "You" },
                replies: [],
            },
        ],
    },
    {
        id: "tsk_02",
        projectId: "prj_01",
        projectTitle: "ClarityOS Launch",
        title: "Dependency graph (v1)",
        description: "Represent prerequisite relationships without overwhelming the page.",
        objective: "Represent prerequisite relationships without overwhelming the page.",
        success_criteria: "Users can see what is blocking a task and what it unblocks.",
        status: "backlog",
        priority: "medium",
        owner: "Aisha",
        assignees: ["Aisha"],
        labels: ["frontend"],
        storyPoints: 8,
        timeEstimateMinutes: 480,
        dueDateISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 8).toISOString(),
        plannedStartISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString(),
        plannedEndISO: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10).toISOString(),
        dependencies: [{ id: "dep_11", taskId: "tsk_01", title: "Define Task Module UI", status: "in-progress" }],
        context: [{ id: "ctx_11", title: "Notes: graph UI", type: "doc", url: "#" }],
        subtasks: [
            { id: "sub_11", title: "Decide edge rules", done: false, assignee: "Aisha" },
            { id: "sub_12", title: "Draft minimal visualization", done: false, assignee: "Aisha" },
        ],
        history: [
            {
                id: "h11",
                field: "Created",
                to: "Task created by Aisha",
                user: "Aisha",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
            }
        ],
        comments: [],
    },
    {
        id: "tsk_03",
        projectId: "prj_02",
        projectTitle: "KeilHQ Core",
        title: "Stabilize auth refresh flow",
        description: "Reduce surprise logouts and prevent token-expired cascades.",
        objective: "Reduce surprise logouts and prevent token-expired cascades.",
        success_criteria: "No forced relogin during a 24h session; errors surface with actionable messaging.",
        status: "in-progress",
        priority: "urgent",
        owner: "Rohan",
        assignees: ["Rohan", "Shivang"],
        labels: ["backend", "bug"],
        storyPoints: 3,
        timeEstimateMinutes: 180,
        dueDateISO: new Date(Date.now() + 1000 * 60 * 60 * 10).toISOString(),
        plannedStartISO: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
        plannedEndISO: new Date(Date.now() + 1000 * 60 * 60 * 14).toISOString(),
        dependencies: [{ id: "dep_21", taskId: "tsk_05", title: "Supabase session audit", status: "in-progress" }],
        context: [
            { id: "ctx_21", title: "Supabase docs", type: "link", url: "#" },
            { id: "ctx_22", title: "AuthContext.tsx", type: "doc", url: "#" },
        ],
        subtasks: [
            { id: "sub_21", title: "Reproduce on slow network", done: true, assignee: "Rohan" },
            { id: "sub_22", title: "Add retry/backoff", done: false, assignee: "Rohan" },
            { id: "sub_23", title: "Surface toast + CTA", done: false, assignee: "Shivang" },
        ],
        history: [
            {
                id: "h21",
                field: "Status",
                from: "in-progress",
                to: "in-progress",
                user: "Rohan",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
            },
            {
                id: "h22",
                field: "Created",
                to: "Task created by Aisha",
                user: "Aisha",
                timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
            }
        ],
        comments: [
            {
                id: "c_21",
                task_id: "tsk_03",
                user_id: "u_you",
                content: "Blocked on deciding whether we force refresh on tab-focus.",
                parent_comment_id: null,
                created_at: new Date().toISOString(),
                user: { id: "u_you", email: "you@keil.com", name: "You" },
                replies: [],
            },
        ],
    },
];

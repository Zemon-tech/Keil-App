/**
 * Task Controller
 * 
 * Workspace Resolution Approach:
 * Each user belongs to exactly one workspace. The 'protect' middleware in 'auth.middleware.ts'
 * automatically fetches the user's workspace ID and attaches it to 'req.workspaceId'.
 * This centralizes workspace identification and ensures all task operations are properly scoped
 * without requiring redundant lookups in every controller.
 */

import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as taskService from "../services/task.service";
import { TaskStatus, TaskPriority } from "../types/enums";
import { TaskQueryOptions } from "../types/repository";

// Helper function to validate enums
const validateStatus = (status: any) => Object.values(TaskStatus).includes(status);
const validatePriority = (priority: any) => Object.values(TaskPriority).includes(priority);

export const createTask = catchAsync(async (req: Request, res: Response) => {
    const workspaceId = (req as any).workspaceId;
    const userId = (req as any).user?.id;

    if (!workspaceId) throw new ApiError(403, "Workspace not found for user");

    const {
        title,
        description,
        objective,
        success_criteria,
        status,
        priority,
        start_date,
        due_date,
        parent_task_id
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
        throw new ApiError(400, "Title is required");
    }

    if (status && !validateStatus(status)) throw new ApiError(400, "Invalid status enum value");
    if (priority && !validatePriority(priority)) throw new ApiError(400, "Invalid priority enum value");

    // Parent task validation: must exist in same workspace
    if (parent_task_id) {
        const parentTask = await taskService.getTaskById(parent_task_id);
        if (!parentTask || parentTask.workspace_id !== workspaceId) {
            throw new ApiError(400, "Parent task not found or belongs to a different workspace");
        }
    }

    let startDate: Date | undefined;
    let dueDate: Date | undefined;

    if (start_date) {
        startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) throw new ApiError(400, "Invalid start_date format");
    }
    if (due_date) {
        dueDate = new Date(due_date);
        if (isNaN(dueDate.getTime())) throw new ApiError(400, "Invalid due_date format");
    }

    if (startDate && dueDate && dueDate < startDate) {
        throw new ApiError(400, "due_date must be on or after start_date");
    }

    const task = await taskService.createTask({
        workspace_id: workspaceId,
        created_by: userId,
        title: title.trim(),
        description,
        objective,
        success_criteria,
        status,
        priority,
        start_date: startDate,
        due_date: dueDate,
        parent_task_id
    });

    res.status(201).json(new ApiResponse(201, task, "Task created successfully"));
});

export const getTasks = catchAsync(async (req: Request, res: Response) => {
    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) throw new ApiError(403, "Workspace not found for user");

    const { 
        status, 
        priority, 
        assignee_id, 
        due_date_start, 
        due_date_end, 
        sort_by, 
        sort_order, 
        limit, 
        offset, 
        parent_task_id 
    } = req.query;

    const limitVal = limit ? parseInt(limit as string, 10) : 20;
    const offsetVal = offset ? parseInt(offset as string, 10) : 0;

    const options: TaskQueryOptions = {
        pagination: {
            limit: isNaN(limitVal) ? 20 : limitVal,
            offset: isNaN(offsetVal) ? 0 : offsetVal
        },
        filters: {}
    };

    if (status) options.filters!.status = status as TaskStatus;
    if (priority) options.filters!.priority = priority as TaskPriority;
    if (assignee_id) options.filters!.assigneeId = assignee_id as string;
    
    if (due_date_start) {
        const d = new Date(due_date_start as string);
        if (isNaN(d.getTime())) throw new ApiError(400, "Invalid due_date_start format");
        options.filters!.dueDateStart = d;
    }
    if (due_date_end) {
        const d = new Date(due_date_end as string);
        if (isNaN(d.getTime())) throw new ApiError(400, "Invalid due_date_end format");
        options.filters!.dueDateEnd = d;
    }

    if (parent_task_id !== undefined) {
        options.filters!.parentTaskId = parent_task_id === 'null' ? null : (parent_task_id as string);
    }

    if (sort_by) {
        const field = sort_by === 'due_date' ? 'due_date' : sort_by === 'priority' ? 'priority' : 'created_at';
        const order = (sort_order === 'asc' || sort_order === 'ASC') ? 'ASC' : 'DESC';
        options.sort = { field, order };
    }

    const tasks = await taskService.getTasksByWorkspace(workspaceId, options);
    res.status(200).json(new ApiResponse(200, tasks, "Tasks retrieved successfully"));
});

export const getTaskById = catchAsync(async (req: Request, res: Response) => {
    const workspaceId = (req as any).workspaceId as string;
    const id = req.params.id as string;

    const task = await taskService.getTaskById(id);
    
    // Return 404 for workspace mismatch to prevent data leaking as per security instructions
    if (!task || task.workspace_id !== workspaceId) {
        throw new ApiError(404, "Task not found");
    }

    res.status(200).json(new ApiResponse(200, task, "Task retrieved successfully"));
});

export const updateTask = catchAsync(async (req: Request, res: Response) => {
    const workspaceId = (req as any).workspaceId as string;
    const userId = (req as any).user?.id as string;
    const id = req.params.id as string;

    const existingTask = await taskService.getTaskById(id);
    // Consistent 404 for security
    if (!existingTask || existingTask.workspace_id !== workspaceId) {
        throw new ApiError(404, "Task not found");
    }

    const {
        title,
        description,
        objective,
        success_criteria,
        status,
        priority,
        start_date,
        due_date
    } = req.body;

    if (status && !validateStatus(status)) throw new ApiError(400, "Invalid status enum value");
    if (priority && !validatePriority(priority)) throw new ApiError(400, "Invalid priority enum value");

    let startDate: Date | undefined;
    let dueDate: Date | undefined;

    if (start_date) {
        startDate = new Date(start_date);
        if (isNaN(startDate.getTime())) throw new ApiError(400, "Invalid start_date format");
    }
    
    if (due_date) {
        dueDate = new Date(due_date);
        if (isNaN(dueDate.getTime())) throw new ApiError(400, "Invalid due_date format");
    }

    // Comprehensive date validation against existing data
    const effectiveStartDate = startDate || (existingTask.start_date ? new Date(existingTask.start_date) : undefined);
    const effectiveDueDate = dueDate || (existingTask.due_date ? new Date(existingTask.due_date) : undefined);

    if (effectiveStartDate && effectiveDueDate && effectiveDueDate < effectiveStartDate) {
         throw new ApiError(400, "due_date must be on or after start_date");
    }

    const updatedTask = await taskService.updateTask(id, {
        title: title?.trim(),
        description,
        objective,
        success_criteria,
        status,
        priority,
        start_date: startDate,
        due_date: dueDate
    }, userId, workspaceId);

    // If result is null, it means update failed within transaction somehow
    if (!updatedTask) throw new ApiError(404, "Task not found or update failed");

    res.status(200).json(new ApiResponse(200, updatedTask, "Task updated successfully"));
});

export const changeTaskStatus = catchAsync(async (req: Request, res: Response) => {
    const workspaceId = (req as any).workspaceId as string;
    const userId = (req as any).user?.id as string;
    const id = req.params.id as string;
    const { status } = req.body;

    if (!status || !validateStatus(status)) throw new ApiError(400, "Invalid or missing status value");

    const existingTask = await taskService.getTaskById(id);
    // Consistent 404 for security
    if (!existingTask || existingTask.workspace_id !== workspaceId) {
        throw new ApiError(404, "Task not found");
    }

    const updatedTask = await taskService.changeTaskStatus(id, status, userId, workspaceId);
    
    if (!updatedTask) throw new ApiError(404, "Task not found or update failed");

    res.status(200).json(new ApiResponse(200, updatedTask, "Task status updated successfully"));
});

export const deleteTask = catchAsync(async (req: Request, res: Response) => {
    const workspaceId = (req as any).workspaceId as string;
    const userId = (req as any).user?.id as string;
    const id = req.params.id as string;

    const existingTask = await taskService.getTaskById(id);
    // Consistent 404 for security
    if (!existingTask || existingTask.workspace_id !== workspaceId) {
        throw new ApiError(404, "Task not found");
    }

    await taskService.deleteTask(id, userId, workspaceId);
    
    res.status(200).json(new ApiResponse(200, {}, "Task deleted successfully"));
});

// Assignees
export const assignUserToTask = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, {}, "User assigned to task"));
});

export const removeUserFromTask = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, {}, "User removed from task"));
});

// Dependencies
export const addDependency = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(201).json(new ApiResponse(201, {}, "Dependency added to task"));
});

export const removeDependency = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, {}, "Dependency removed from task"));
});


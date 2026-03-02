import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";

export const createTask = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement (accepts parentTaskId in body if subtask)
    res.status(201).json(new ApiResponse(201, {}, "Task created successfully"));
});

export const getTasks = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement (filtering, pagination)
    res.status(200).json(new ApiResponse(200, [], "Tasks retrieved successfully"));
});

export const getTaskById = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement (with subtasks)
    res.status(200).json(new ApiResponse(200, {}, "Task retrieved successfully"));
});

export const updateTask = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, {}, "Task updated successfully"));
});

export const deleteTask = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement
    res.status(200).json(new ApiResponse(200, {}, "Task deleted successfully"));
});

export const changeTaskStatus = catchAsync(async (req: Request, res: Response) => {
    // TODO: Implement (with dependency check)
    res.status(200).json(new ApiResponse(200, {}, "Task status updated successfully"));
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

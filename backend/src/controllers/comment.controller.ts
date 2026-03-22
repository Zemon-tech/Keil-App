import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { createComment, getThreadedComments, hardDeleteComment } from "../services/comment.service";
import * as taskService from "../services/task.service";

export const getTaskComments = catchAsync(async (req: Request, res: Response) => {
    // Extract task ID from URL params
    const taskId = req.params.id as string;

    // Parse pagination query params with defaults
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    // Extract workspaceId for security context
    const workspaceId = (req as any).workspaceId as string;
    if (!workspaceId) throw new ApiError(403, "Workspace not found for user");

    // Verify task exists and belongs to workspace
    const task = await taskService.getTaskById(taskId);
    if (!task || task.workspace_id !== workspaceId) {
        throw new ApiError(404, "Task not found");
    }

    // Call service to get threaded comments
    const comments = await getThreadedComments(taskId);

    // Return 200 with threaded comments array
    res.status(200).json(new ApiResponse(200, comments, "Comments retrieved successfully"));
});

export const addComment = catchAsync(async (req: Request, res: Response) => {
    // Extract workspaceId and userId from request
    const workspaceId = (req as any).workspaceId as string;
    const reqUserId = (req as any).user?.id as string;

    // Guard: workspaceId must exist
    if (!workspaceId) throw new ApiError(403, "Workspace not found for user");

    // Extract taskId from URL params
    const taskId = req.params.id as string;

    // Extract content and optional parent_comment_id from body
    const { content, parent_comment_id } = req.body;

    // Validate content is present and non-empty
    if (!content || typeof content !== "string" || content.trim() === "") {
        throw new ApiError(400, "Content is required and cannot be empty");
    }

    // Verify task exists and belongs to workspace
    const task = await taskService.getTaskById(taskId);
    if (!task || task.workspace_id !== workspaceId) {
        throw new ApiError(404, "Task not found");
    }

    // Call service to create comment
    const comment = await createComment(
        {
            task_id: taskId,
            user_id: reqUserId,
            content: content.trim(),
            parent_comment_id: parent_comment_id || undefined
        },
        workspaceId
    );

    // Return 201 with created comment DTO
    res.status(201).json(new ApiResponse(201, comment, "Comment added successfully"));
});

export const deleteComment = catchAsync(async (req: Request, res: Response) => {
    // Extract workspaceId and userId from request
    const workspaceId = (req as any).workspaceId as string;
    const reqUserId = (req as any).user?.id as string;

    // Guard: workspaceId must exist
    if (!workspaceId) throw new ApiError(403, "Workspace not found for user");

    // Extract commentId from URL params
    const commentId = req.params.id as string;

    // Call service to HARD delete (NOT soft delete)
    // Service handles: find comment (404), ownership check (403), cascade delete replies, activity logging
    await hardDeleteComment(commentId, reqUserId, workspaceId);

    // Return 200 with null data
    res.status(200).json(new ApiResponse(200, null, "Comment deleted successfully"));
});

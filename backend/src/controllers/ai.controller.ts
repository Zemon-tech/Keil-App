import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { mastra } from "../mastra";

/**
 * GET /api/v1/ai/threads
 *
 * List conversation threads for the authenticated user.
 * Query params:
 *   page     {number}  — page number (0-indexed, default 0)
 *   perPage  {number}  — threads per page (default 20)
 */
export const listThreads = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, "Not authenticated");

  const page = parseInt(req.query.page as string) || 0;
  const perPage = parseInt(req.query.perPage as string) || 20;

  const agent = mastra.getAgent("keilhq-ai");
  const memory = await agent.getMemory();
  if (!memory) throw new ApiError(500, "Memory not configured");

  const result = await memory.listThreads({
    filter: { resourceId: userId },
    page,
    perPage,
    orderBy: { field: "createdAt", direction: "DESC" },
  });

  return res.status(200).json(
    new ApiResponse(200, {
      threads: result.threads,
      hasMore: result.hasMore,
      page,
      perPage,
    }, "Threads retrieved successfully")
  );
});

/**
 * DELETE /api/v1/ai/threads/:threadId
 *
 * Delete a conversation thread and all its messages.
 * Only the thread owner (resource) can delete it.
 */
export const deleteThread = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, "Not authenticated");

  const threadId = req.params.threadId as string;
  if (!threadId) throw new ApiError(400, "threadId is required");

  const agent = mastra.getAgent("keilhq-ai");
  const memory = await agent.getMemory();
  if (!memory) throw new ApiError(500, "Memory not configured");

  // Verify ownership
  const thread = await memory.getThreadById({ threadId });
  if (!thread) throw new ApiError(404, "Thread not found");
  if (thread.resourceId !== userId) throw new ApiError(403, "You do not own this thread");

  // Delete thread (messages are cascade-deleted by storage)
  await memory.deleteThread(threadId);

  return res.status(200).json(
    new ApiResponse(200, null, "Thread deleted successfully")
  );
});

/**
 * GET /api/v1/ai/threads/:threadId/messages
 *
 * Retrieve messages for a specific conversation thread.
 * Verify that the user owns the thread.
 */
export const getThreadMessages = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, "Not authenticated");

  const threadId = req.params.threadId as string;
  if (!threadId) throw new ApiError(400, "threadId is required");

  const agent = mastra.getAgent("keilhq-ai");
  const memory = await agent.getMemory();
  if (!memory) throw new ApiError(500, "Memory not configured");

  // Verify ownership
  const thread = await memory.getThreadById({ threadId });
  if (!thread) throw new ApiError(404, "Thread not found");
  if (thread.resourceId !== userId) throw new ApiError(403, "You do not own this thread");

  // Retrieve all messages for the thread
  const result = await memory.recall({
    threadId,
    perPage: false,
  });

  return res.status(200).json(
    new ApiResponse(200, {
      messages: result.messages,
    }, "Messages retrieved successfully")
  );
});

/**
 * PUT /api/v1/ai/threads/:threadId
 *
 * Rename a conversation thread title.
 * Verify that the user owns the thread.
 */
export const renameThread = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;
  if (!userId) throw new ApiError(401, "Not authenticated");

  const threadId = req.params.threadId as string;
  if (!threadId) throw new ApiError(400, "threadId is required");

  const { title } = req.body;
  if (!title || typeof title !== "string") throw new ApiError(400, "Valid title is required");

  const agent = mastra.getAgent("keilhq-ai");
  const memory = await agent.getMemory();
  if (!memory) throw new ApiError(500, "Memory not configured");

  // Verify ownership
  const thread = await memory.getThreadById({ threadId });
  if (!thread) throw new ApiError(404, "Thread not found");
  if (thread.resourceId !== userId) throw new ApiError(403, "You do not own this thread");

  const updated = await (memory as any).updateThread({
    id: threadId,
    title,
    metadata: thread.metadata || {},
  });

  return res.status(200).json(
    new ApiResponse(200, updated, "Thread renamed successfully")
  );
});


import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { runAdkAgent } from "../services/adk.service";

/**
 * POST /api/v1/adk/chat
 *
 * Body:
 *   message    {string}  — the user's latest message (required)
 *   sessionId  {string}  — pass back the sessionId from the previous response
 *                          to continue a multi-turn conversation (optional)
 *
 * Response:
 *   data.content    {string}  — the agent's reply
 *   data.sessionId  {string}  — persist this on the client and send it back next turn
 */
export const chat = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;

  const { message, sessionId } = req.body as {
    message?: string;
    sessionId?: string;
  };

  if (!message || typeof message !== "string" || !message.trim()) {
    throw new ApiError(400, "message is required and must be a non-empty string");
  }

  if (sessionId !== undefined && typeof sessionId !== "string") {
    throw new ApiError(400, "sessionId must be a string");
  }

  const reply = await runAdkAgent(userId, message.trim(), sessionId);

  return res
    .status(200)
    .json(new ApiResponse(200, reply, "ADK agent response generated successfully"));
});

import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { supervisor, buildRequestContext } from "../agents";
import { config } from "../config";

/**
 * POST /api/v1/ai/chat
 *
 * Body:
 *   messages   {Array<{role, content}>}  — conversation history (required)
 *   orgId      {string}                  — active org UUID (optional)
 *   spaceId    {string}                  — active space UUID (optional)
 *   stream     {boolean}                 — stream tokens via SSE (default: false)
 */
export const chat = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;

  const { messages, orgId, spaceId, stream = false } = req.body as {
    messages?: Array<{ role: string; content: string }>;
    orgId?: string;
    spaceId?: string;
    stream?: boolean;
  };

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ApiError(400, "messages must be a non-empty array");
  }

  const normalizedMessages = messages.map((m) => ({
    role: m?.role as "user" | "assistant" | "system",
    content: typeof m?.content === "string" ? m.content.trim() : "",
  }));

  const invalid = normalizedMessages.find(
    (m) => !["user", "assistant", "system"].includes(m.role) || !m.content
  );
  if (invalid) {
    throw new ApiError(
      400,
      "Each message must have role (user/assistant/system) and non-empty content"
    );
  }

  // ── RequestContext carries userId/orgId/spaceId into every tool ────────────
  const requestContext = buildRequestContext({ userId, orgId, spaceId });

  // ── Streaming (SSE) ────────────────────────────────────────────────────────
  if (stream) {
    const result = await supervisor.stream(normalizedMessages, {
      requestContext,
    });

    // MastraModelOutput.textStream is a Web ReadableStream<string>.
    // We pipe it manually to the Express response as SSE so useChat() can consume it.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const reader = result.textStream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        // Vercel AI SDK useChat() expects the data stream protocol format
        res.write(`0:${JSON.stringify(value)}\n`);
      }
    } finally {
      reader.releaseLock();
    }

    // Signal stream end
    res.write("d:{\"finishReason\":\"stop\"}\n");
    res.end();
    return;
  }

  // ── Non-streaming ──────────────────────────────────────────────────────────
  const result = await supervisor.generate(normalizedMessages, {
    requestContext,
  });

  const text = await result.text;

  return res.status(200).json(
    new ApiResponse(
      200,
      { content: text, model: config.openRouterModel },
      "AI response generated successfully"
    )
  );
});
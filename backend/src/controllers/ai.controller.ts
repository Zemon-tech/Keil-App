import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { supervisor, buildRequestContext } from "../agents";
import { config } from "../config";

/**
 * POST /api/v1/ai/chat
 *
 * Body:
 *   messages   {Array<{role, content?, parts?}>}  — conversation history (required)
 *   orgId      {string}                           — active org UUID (optional)
 *   spaceId    {string}                           — active space UUID (optional)
 *   stream     {boolean}                          — stream tokens via SSE (default: false)
 */
export const chat = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;

  const { messages, orgId, spaceId, stream = false } = req.body as {
    messages?: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>;
    orgId?: string;
    spaceId?: string;
    stream?: boolean;
  };

  // ── Validate ───────────────────────────────────────────────────────────────
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ApiError(400, "messages must be a non-empty array");
  }

  // Normalize messages: handle both plain `content` string and `parts` array
  // (useChat from @ai-sdk/react sends messages with `parts` format)
  const normalizedMessages = messages.map((message) => {
    let content = "";
    if (typeof message?.content === "string") {
      content = message.content.trim();
    } else if (Array.isArray(message?.parts)) {
      content = message.parts
        .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
        .map((part: any) => part.text.trim())
        .join("\n")
        .trim();
    }
    return {
      role: message?.role as "user" | "assistant" | "system",
      content,
    };
  });

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

    // Pipe Mastra's textStream as Vercel AI SDK data stream protocol
    // so the frontend's useChat() hook can consume it.
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
    } catch (err) {
      if (!res.writableEnded) {
        res.write(`3:${JSON.stringify("Stream error")}\n`);
      }
    } finally {
      reader.releaseLock();
    }

    // Signal stream end
    if (!res.writableEnded) {
      res.write("d:{\"finishReason\":\"stop\"}\n");
      res.end();
    }
    return;
  }

  // ── Non-streaming ──────────────────────────────────────────────────────────
  const result = await supervisor.generate(normalizedMessages, {
    requestContext,
  });

  const text = await result.text;

  return res.status(200).json({
    statusCode: 200,
    data: { content: text, model: config.openRouterModel },
    message: "AI response generated successfully",
    success: true,
  });
});

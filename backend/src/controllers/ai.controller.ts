import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { supervisor, buildRequestContext } from "../agents";
import { config } from "../config";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { toAISdkV5Stream } from "@mastra/ai-sdk";

/**
 * POST /api/v1/ai/chat
 *
 * Body:
 *   messages   {Array<{role, content?, parts?}>}  — conversation history (required)
 *   orgId      {string}                           — active org UUID (optional)
 *   spaceId    {string}                           — active space UUID (optional)
 *   stream     {boolean}                          — stream tokens via SSE (default: false)
 *   modelSelection  {"openrouter" | "local"}      - select between openrouter or local LLM (optional)
 *   localAiBaseUrl  {string}                      - custom URL for local LLM (optional)
 *   localAiModel    {string}                      - custom model name for local LLM (optional)
 */
export const chat = catchAsync(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string;

  const {
    messages,
    orgId,
    spaceId,
    stream = false,
    modelSelection,
    localAiBaseUrl,
    localAiModel,
  } = req.body as {
    messages?: Array<{ role: string; content?: string; parts?: Array<{ type: string; text?: string }> }>;
    orgId?: string;
    spaceId?: string;
    stream?: boolean;
    modelSelection?: "openrouter" | "local";
    localAiBaseUrl?: string;
    localAiModel?: string;
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

  // ── Build Dynamic Model if Custom Local LLM is Selected ───────────────────
  const useLocal = modelSelection === "local";
  let customModel: any = undefined;

  if (useLocal) {
    const baseURL = localAiBaseUrl || "http://localhost:8080/v1";
    const modelName = localAiModel || "local-model";
    const isLocalOrCustom = baseURL && !baseURL.includes("openrouter.ai");
    const apiKey = useLocal ? "local-key" : (config.openRouterApiKey || (isLocalOrCustom ? "local-key" : ""));

    const provider = createOpenAICompatible({
      name: isLocalOrCustom ? "local-llm" : "openrouter",
      apiKey: apiKey,
      baseURL: baseURL,
      includeUsage: true,
      headers: {
        "HTTP-Referer": config.frontendUrl || "http://localhost:5173",
        "X-Title": "KeilHQ",
      },
    });
    customModel = provider(modelName);
  }

  // ── RequestContext carries userId/orgId/spaceId into every tool ────────────
  const requestContext = buildRequestContext({ userId, orgId, spaceId });

  // ── Streaming (SSE) ────────────────────────────────────────────────────────
  if (stream) {
    try {
      const result = await supervisor.stream(normalizedMessages, {
        requestContext,
        model: customModel,
      });

      // toAISdkV5Stream returns a ReadableStream of UI message chunk objects.
      // The frontend's useChat (via DefaultChatTransport) expects the AI SDK
      // UI Message Stream Protocol: SSE lines of `data: <JSON>\n\n` with a
      // final `data: [DONE]\n\n`, plus the `x-vercel-ai-ui-message-stream: v1`
      // header so the client knows how to parse the stream.
      const aiSDKStream = toAISdkV5Stream(result, {
        from: "agent",
        sendStart: true,
        sendFinish: true,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("x-vercel-ai-ui-message-stream", "v1");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const reader = aiSDKStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Serialize each chunk as an SSE data line (AI SDK protocol)
          res.write(`data: ${JSON.stringify(value)}\n\n`);
        }
      } catch (err) {
        console.error("Mastra stream error:", err);
        // Send error as an SSE event so the client can surface it
        res.write(`data: ${JSON.stringify({ type: "error", errorText: String(err) })}\n\n`);
      } finally {
        reader.releaseLock();
      }

      // Signal end of stream
      res.write("data: [DONE]\n\n");
    } catch (err) {
      console.error("Mastra stream initialization failed:", err);
      // If headers haven't been sent yet, return a proper error response
      if (!res.headersSent) {
        return res.status(500).json({
          statusCode: 500,
          data: null,
          message: "Failed to initialize AI stream",
          success: false,
        });
      }
      // Headers already sent — write error as SSE and close
      res.write(`data: ${JSON.stringify({ type: "error", errorText: "Stream initialization failed" })}\n\n`);
      res.write("data: [DONE]\n\n");
    }

    if (!res.writableEnded) {
      res.end();
    }
    return;
  }

  // ── Non-streaming ──────────────────────────────────────────────────────────
  const result = await supervisor.generate(normalizedMessages, {
    requestContext,
    model: customModel,
  });

  const text = result.text;

  return res.status(200).json({
    statusCode: 200,
    data: { content: text, model: useLocal ? (localAiModel || "local-model") : config.openRouterModel },
    message: "AI response generated successfully",
    success: true,
  });
});

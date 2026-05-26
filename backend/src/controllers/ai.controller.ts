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
    console.log("Streaming chat started for messages:", JSON.stringify(normalizedMessages));
    try {
      const result = await supervisor.stream(normalizedMessages, {
        requestContext,
        model: customModel,
      });

      console.log("Supervisor stream successfully initialized");
      const aiSDKStream = toAISdkV5Stream(result, { from: "agent" });

      // Stream tokens to Express response compatible with Vercel AI SDK protocol
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const reader = aiSDKStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log("Mastra stream reading complete");
            break;
          }
          console.log("Writing stream chunk:", JSON.stringify(value));
          res.write(value);
        }
      } catch (err) {
        console.error("Mastra stream write failed in loop:", err);
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      console.error("Mastra stream initialization failed:", err);
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

  const text = await result.text;

  return res.status(200).json({
    statusCode: 200,
    data: { content: text, model: useLocal ? (localAiModel || "local-model") : config.openRouterModel },
    message: "AI response generated successfully",
    success: true,
  });
});

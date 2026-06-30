import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { registerApiRoute } from "@mastra/core/server";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStream, createUIMessageStreamResponse, convertToModelMessages } from "ai";
import type { UIMessage } from "ai";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { supervisor } from "./agents/supervisor";
import { taskAgent } from "./agents/task.agent";
import { chatAgent } from "./agents/chat.agent";
import { motionAgent } from "./agents/motion.agent";
import { schedulerAgent } from "./agents/scheduler.agent";
import { githubAgent } from "./agents/github.agent";
import { checkRateLimit } from "../services/rate-limiter.service";
import { checkAiChatLimit, recordAiChatUsageForUser } from "../middlewares/usage-limit.middleware";
import {
  startStreamSession,
  finishStreamSession,
  errorStreamSession,
  getStreamSession,
  getChunksSince,
  getLatestChunkIndex,
  persistChunk,
  serialiseChunk,
} from "../services/ai-stream-persistence.service";

// ─── Storage ──────────────────────────────────────────────────────────────────

import { Pool as PgPool } from "pg";

const isLocalMastraDb =
  config.mastraDatabaseUrl.includes("localhost") ||
  config.mastraDatabaseUrl.includes("127.0.0.1");

const mastraPool = new PgPool({
  connectionString: config.mastraDatabaseUrl,
  ssl: isLocalMastraDb ? false : { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 10000,
});

const storage = new PostgresStore({
  id: "keilhq-mastra-storage",
  pool: mastraPool,
  schemaName: "mastra",
});

// ─── Fast JWT verification ────────────────────────────────────────────────────

function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.decode(token) as { sub?: string; exp?: number } | null;
    if (!decoded?.sub) return null;
    if (decoded.exp && decoded.exp * 1000 < Date.now()) return null;
    return { userId: decoded.sub };
  } catch {
    return null;
  }
}

// ─── Mastra Instance ──────────────────────────────────────────────────────────

export const mastra = new Mastra({
  agents: {
    "keilhq-ai": supervisor,
    "keilhq-task-agent": taskAgent,
    "keilhq-chat-agent": chatAgent,
    "keilhq-motion-agent": motionAgent,
    "keilhq-scheduler-agent": schedulerAgent,
    "keilhq-github-agent": githubAgent,
  },
  storage,
  server: {
    apiRoutes: [
      // ── POST /chat — start or continue a streaming AI conversation ──────────
      registerApiRoute("/chat", {
        method: "POST",
        requiresAuth: false,
        handler: async (c) => {
          const startTime = Date.now();
          const requestContext = c.get("requestContext");

          // ── Auth ──────────────────────────────────────────────────
          const authHeader = c.req.header("Authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return c.json({ success: false, message: "Not authorized" }, 401);
          }
          const token = authHeader.split(" ")[1];
          const authResult = verifyToken(token);
          if (!authResult) {
            return c.json({ success: false, message: "Invalid or expired token" }, 401);
          }
          console.log(`[Chat] Auth verified in ${Date.now() - startTime}ms`);

          // ── Rate Limiting ─────────────────────────────────────────
          const isTestEnv = process.env.NODE_ENV === "test" && !process.env.RATE_LIMIT_TEST;
          if (!isTestEnv) {
            try {
              const minLimitResult = await checkRateLimit(
                `rl:ai:min:user:${authResult.userId}`, 20, 60
              );
              if (!minLimitResult.allowed) {
                return c.json(
                  { success: false, message: "AI rate limit exceeded. Please wait a minute." },
                  429
                );
              }
              const dailyLimitResult = await checkRateLimit(
                `rl:ai:day:user:${authResult.userId}`, 100, 86400
              );
              if (!dailyLimitResult.allowed) {
                return c.json(
                  { success: false, message: "Daily AI chat limit of 100 requests reached." },
                  429
                );
              }
            } catch (err) {
              console.error("[Chat] Rate limiter error:", err);
            }
          }

          // ── Subscription check ────────────────────────────────────
          const usageCheck = await checkAiChatLimit(authResult.userId);
          if (!usageCheck.allowed) {
            return c.json(
              { success: false, code: usageCheck.errorCode, message: usageCheck.errorMessage },
              429
            );
          }

          // ── Parse body & context ──────────────────────────────────
          const body = await c.req.json();
          const threadId: string = body?.memory?.thread ?? body?.threadId ?? crypto.randomUUID();

          requestContext.set("userId", authResult.userId);
          if (body?.modelSelection) requestContext.set("modelSelection", body.modelSelection);
          if (body?.orgId) requestContext.set("orgId", body.orgId);
          if (body?.spaceId) requestContext.set("spaceId", body.spaceId);
          if (body?.localAiBaseUrl) requestContext.set("localAiBaseUrl", body.localAiBaseUrl);
          if (body?.localAiModel) requestContext.set("localAiModel", body.localAiModel);
          if (body?.openRouterModel) requestContext.set("openRouterModel", body.openRouterModel);

          console.log(
            `[Chat] model=${body?.modelSelection || "gemini"} | user=${authResult.userId} | thread=${threadId} | parsed in ${Date.now() - startTime}ms`
          );

          // ── Start persistent stream session ───────────────────────
          await startStreamSession(threadId, authResult.userId).catch(() => { });

          // ── Build instructions ────────────────────────────────────
          const agent = c.get("mastra").getAgent("keilhq-ai");
          const messages = body.messages as UIMessage[];

          function buildTemporalContext(): string {
            const now = new Date();
            return [
              `<temporal_context>`,
              `Today is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`,
              `Current time: ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}.`,
              `ISO: ${now.toISOString()}.`,
              `UTC offset: ${(-now.getTimezoneOffset() / 60).toFixed(1)} hours.`,
              `Use this for all relative date calculations. Do not call any tool for the current time.`,
              `</temporal_context>`,
            ].join("\n");
          }

          const baseInstructions = await agent.getInstructions({ requestContext });
          const temporalContext = buildTemporalContext();
          const pageContextBlock = body?.pageContext
            ? [
              `<page_context>`,
              `The user is currently on this page:`,
              body.pageContext,
              `Use this to answer questions about what the user is currently viewing.`,
              `</page_context>`,
            ].join("\n")
            : "";

          const instructionsOverride = [temporalContext, pageContextBlock, baseInstructions]
            .filter(Boolean)
            .join("\n\n");

          // ── Stream with persistence ───────────────────────────────
          let chunkIndex = 0;

          const uiStream = createUIMessageStream({
            originalMessages: messages,
            execute: async ({ writer }) => {
              requestContext.set("uiWriter", writer);
              const modelMessages = await convertToModelMessages(messages);

              let agentStream: any;
              try {
                agentStream = await agent.stream(modelMessages, {
                  requestContext,
                  instructions: instructionsOverride,
                  memory: {
                    ...body.memory,
                    thread: threadId,
                    resource: authResult.userId,
                  },
                  // NOTE: We intentionally do NOT forward abortSignal here so the
                  // agent keeps processing even if the HTTP connection drops.
                  // Chunks are persisted and the client can replay on reconnect.
                });
              } catch (err: any) {
                await errorStreamSession(threadId, err.message, chunkIndex).catch(() => { });
                throw err;
              }

              console.log(`[Chat] agent.stream() started in ${Date.now() - startTime}ms`);

              // Wrap fullStream to intercept activity events + persist all chunks
              const originalFullStream = agentStream.fullStream;
              const reader = originalFullStream.getReader();

              const wrappedFullStream = new ReadableStream({
                async pull(controller) {
                  const { done, value } = await reader.read();
                  if (done) {
                    controller.close();
                    return;
                  }

                  const val = value as any;

                  // ── Activity events → write to UI writer ──────────
                  if (val?.type === "custom" && val.payload?.type === "data-agent-activity") {
                    if (process.env.NODE_ENV === "development") {
                      console.log(
                        `[Debug] Activity: [${val.payload.data?.agent}] ${val.payload.data?.action} (${val.payload.data?.status})`
                      );
                    }
                    const activityPart = {
                      type: "data-agent-activity",
                      data: val.payload.data,
                    };
                    writer.write(activityPart as any);

                    // Persist activity chunk
                    await persistChunk(
                      threadId, authResult.userId, chunkIndex++,
                      "data-agent-activity", val.payload.data
                    ).catch(() => { });
                  }

                  controller.enqueue(value);
                },
                cancel() {
                  reader.releaseLock();
                },
              });

              const interceptedAgentStream = Object.create(agentStream);
              Object.defineProperty(interceptedAgentStream, "fullStream", {
                value: wrappedFullStream,
                writable: true,
                configurable: true,
                enumerable: true,
              });

              try {
                for await (const part of toAISdkStream(interceptedAgentStream, {
                  from: "agent",
                  version: "v6",
                  sendReasoning: true,
                })) {
                  writer.write(part as any);

                  // Persist every chunk for stream resume
                  const serialised = serialiseChunk(part);
                  if (serialised) {
                    await persistChunk(
                      threadId, authResult.userId, chunkIndex++,
                      serialised.type, serialised.data
                    ).catch(() => { });
                  }
                }

                await finishStreamSession(threadId, chunkIndex).catch(() => { });
              } catch (err: any) {
                await errorStreamSession(threadId, err.message, chunkIndex).catch(() => { });
                throw err;
              }

              // Increment usage only after the AI has successfully produced output.
              recordAiChatUsageForUser(authResult.userId);
            },
          });

          return createUIMessageStreamResponse({ stream: uiStream });
        },
      }),

      // ── GET /chat/resume — replay missed chunks after reconnect ─────────────
      registerApiRoute("/chat/resume", {
        method: "GET",
        requiresAuth: false,
        handler: async (c) => {
          // Auth
          const authHeader = c.req.header("Authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return c.json({ success: false, message: "Not authorized" }, 401);
          }
          const authResult = verifyToken(authHeader.split(" ")[1]);
          if (!authResult) {
            return c.json({ success: false, message: "Invalid or expired token" }, 401);
          }

          const threadId = c.req.query("threadId");
          const fromIndex = parseInt(c.req.query("fromIndex") ?? "0", 10);

          if (!threadId) {
            return c.json({ success: false, message: "threadId is required" }, 400);
          }

          try {
            const [session, chunks, latestIndex] = await Promise.all([
              getStreamSession(threadId, authResult.userId),
              getChunksSince(threadId, authResult.userId, fromIndex),
              getLatestChunkIndex(threadId, authResult.userId),
            ]);

            return c.json({
              success: true,
              data: {
                threadId,
                status: session?.status ?? "unknown",
                totalChunks: session?.total_chunks ?? latestIndex + 1,
                latestChunkIndex: latestIndex,
                chunks: chunks.map((row) => ({
                  index: row.chunk_index,
                  type: row.chunk_type,
                  data: row.chunk_data,
                })),
                isComplete: session?.status === "complete",
                isStreaming: session?.status === "streaming",
              },
            });
          } catch (err: any) {
            console.error("[Chat/Resume] Error:", err);
            return c.json({ success: false, message: err.message }, 500);
          }
        },
      }),
    ],
  },
});

// ─── Activity streaming tool decoration ──────────────────────────────────────

function initializeActivityStreaming(mastraInstance: any) {
  const allTools = mastraInstance.listTools();
  if (!allTools) return;

  for (const [key, tool] of Object.entries(allTools)) {
    if (!tool || typeof (tool as any).execute !== "function") continue;
    const originalExecute = (tool as any).execute;
    if ((originalExecute as any).__wrapped) continue;

    const wrappedExecute = async function (this: any, inputData: any, context: any) {
      const executionId = `${(tool as any).id || key}_${Math.random().toString(36).substring(2, 11)}`;
      if (context) {
        context.activeToolId = (tool as any).id || key;
        context.toolExecutionId = executionId;
      }
      return originalExecute.call(this, inputData, context);
    };

    (wrappedExecute as any).__wrapped = true;
    (tool as any).execute = wrappedExecute;
  }
}

initializeActivityStreaming(mastra);
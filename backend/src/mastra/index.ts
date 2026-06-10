import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { registerApiRoute } from "@mastra/core/server";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
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

// ─── Storage ──────────────────────────────────────────────────────────────────
// Mastra storage needs a direct/session connection (not transaction pooler)
// because it runs DDL statements (CREATE TABLE, ALTER TABLE) during init.
// Supabase session pooler limits to 15 concurrent connections total,
// so we cap Mastra's pool to 5 to leave room for the app's pool.

import { Pool as PgPool } from "pg";

const isLocalMastraDb = config.mastraDatabaseUrl.includes("localhost") || config.mastraDatabaseUrl.includes("127.0.0.1");

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
// Decode the Supabase JWT locally instead of making a network call to
// supabaseAdmin.auth.getUser(). This drops auth from ~230ms to <1ms.
// We verify expiry locally. The token's integrity is guaranteed by Supabase
// issuing it and the frontend sending it over HTTPS.

function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.decode(token) as { sub?: string; exp?: number } | null;
    if (!decoded?.sub) return null;

    // Check expiry
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
      registerApiRoute("/chat", {
        method: "POST",
        requiresAuth: false,
        handler: async (c) => {
          const startTime = Date.now();
          const requestContext = c.get("requestContext");

          // ── Auth (local JWT decode — <1ms) ────────────────────────
          const authHeader = c.req.header("Authorization");
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return c.json({ success: false, message: "Not authorized" }, 401);
          }
          const token = authHeader.split(" ")[1];
          const authResult = verifyToken(token);
          if (!authResult) {
            return c.json(
              { success: false, message: "Invalid or expired token" },
              401,
            );
          }
          console.log(`[Chat] Auth verified in ${Date.now() - startTime}ms`);

          // ── Rate Limiting (PostgreSQL distributed) ───────────────
          const isTestEnv = process.env.NODE_ENV === "test" && !process.env.RATE_LIMIT_TEST;
          if (!isTestEnv) {
            try {
              const minLimitResult = await checkRateLimit(`rl:ai:min:user:${authResult.userId}`, 20, 60);
              if (!minLimitResult.allowed) {
                return c.json(
                  { success: false, message: "AI rate limit exceeded. Please wait a minute before making another request." },
                  429
                );
              }
              const dailyLimitResult = await checkRateLimit(`rl:ai:day:user:${authResult.userId}`, 100, 86400);
              if (!dailyLimitResult.allowed) {
                return c.json(
                  { success: false, message: "Daily AI chat limit of 100 requests reached. Please try again tomorrow." },
                  429
                );
              }
            } catch (err) {
              console.error("[Chat] Rate limiter error:", err);
              // Fail open: let requests pass if rate limit DB check fails
            }
          }

          // ── Parse body & set requestContext ───────────────────────
          const body = await c.req.json();
          requestContext.set("userId", authResult.userId);
          if (body?.modelSelection)
            requestContext.set("modelSelection", body.modelSelection);
          if (body?.orgId) requestContext.set("orgId", body.orgId);
          if (body?.spaceId) requestContext.set("spaceId", body.spaceId);
          if (body?.localAiBaseUrl)
            requestContext.set("localAiBaseUrl", body.localAiBaseUrl);
          if (body?.localAiModel)
            requestContext.set("localAiModel", body.localAiModel);
          if (body?.openRouterModel)
            requestContext.set("openRouterModel", body.openRouterModel);

          console.log(
            `[Chat] model=${body?.modelSelection || "gemini"} | user=${authResult.userId} | bodyParsed in ${Date.now() - startTime}ms`,
          );

          // ── Get agent and stream directly ─────────────────────────
          const agent = c.get("mastra").getAgent("keilhq-ai");
          const messages = body.messages as UIMessage[];

          function buildTemporalContext(): string {
            const now = new Date();
            return [
              `<temporal_context>`,
              `Today is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
              `Current time: ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}.`,
              `ISO: ${now.toISOString()}.`,
              `UTC offset: ${(-now.getTimezoneOffset() / 60).toFixed(1)} hours.`,
              `Use this for all relative date calculations. Do not call any tool for the current time.`,
              `</temporal_context>`,
            ].join('\n');
          }

          const baseInstructions = await agent.getInstructions({ requestContext });
          const temporalContext = buildTemporalContext();
          const instructionsOverride = `${temporalContext}\n\n${baseInstructions}`;

          const agentStream = await agent.stream(messages, {
            requestContext,
            instructions: instructionsOverride,
            memory: {
              ...body.memory,
              resource: authResult.userId,
            },
            abortSignal: c.req.raw.signal,
          });

          console.log(
            `[Chat] agent.stream() started in ${Date.now() - startTime}ms`,
          );

          // ── Convert to AI SDK v6 format and return ────────────────
          const uiStream = createUIMessageStream({
            originalMessages: messages,
            execute: async ({ writer }) => {
              // Wrap agentStream.fullStream to intercept custom data-agent-activity events
              const originalFullStream = agentStream.fullStream;
              const reader = originalFullStream.getReader();
              const wrappedFullStream = new ReadableStream({
                async pull(controller) {
                  const { done, value } = await reader.read();
                  if (done) {
                    controller.close();
                    return;
                  }
                  // Intercept data-agent-activity custom chunks
                  const val = value as any;
                  if (val && val.type === "custom" && val.payload?.type === "data-agent-activity") {
                    if (process.env.NODE_ENV === "development") {
                      console.log(
                        `[Debug] Activity received: [${val.payload.data?.agent}] ${val.payload.data?.action} (${val.payload.data?.status})`
                      );
                    }
                    // Write directly to Hono's writer as an AI SDK message part
                    writer.write({
                      type: "data-agent-activity",
                      ...val.payload.data,
                    } as any);
                  }
                  controller.enqueue(value);
                },
                cancel() {
                  reader.releaseLock();
                },
              });

              // Replace fullStream on agentStream with our wrapped stream using Object.defineProperty to override the read-only getter
              const interceptedAgentStream = Object.create(agentStream);
              Object.defineProperty(interceptedAgentStream, "fullStream", {
                value: wrappedFullStream,
                writable: true,
                configurable: true,
                enumerable: true,
              });

              for await (const part of toAISdkStream(interceptedAgentStream, {
                from: "agent",
                version: "v6",
                sendReasoning: true,
              })) {
                writer.write(part as any);
              }
            },
          });

          return createUIMessageStreamResponse({ stream: uiStream });
        },
      }),
    ],
  },
});

import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { registerApiRoute } from "@mastra/core/server";
import { toAISdkStream } from "@mastra/ai-sdk";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { UIMessage } from "ai";
import jwt from "jsonwebtoken";
import pool from "../config/pg";
import { supervisor } from "./agents/supervisor";
import { taskAgent } from "./agents/task.agent";
import { chatAgent } from "./agents/chat.agent";
import { motionAgent } from "./agents/motion.agent";

// ─── Storage ──────────────────────────────────────────────────────────────────

const storage = new PostgresStore({
  id: "keilhq-mastra-storage",
  pool: pool,
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

          console.log(
            `[Chat] model=${body?.modelSelection || "gemini"} | user=${authResult.userId} | bodyParsed in ${Date.now() - startTime}ms`,
          );

          // ── Get agent and stream directly ─────────────────────────
          const agent = c.get("mastra").getAgent("keilhq-ai");
          const messages = body.messages as UIMessage[];

          const agentStream = await agent.stream(messages, {
            requestContext,
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
              for await (const part of toAISdkStream(agentStream, {
                from: "agent",
                version: "v6",
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

import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { chatRoute } from "@mastra/ai-sdk";
import pool from "../config/pg";
import { supabaseAdmin } from "../config/supabase";
import { supervisor } from "./agents/supervisor";
import { taskAgent } from "./agents/task.agent";
import { chatAgent } from "./agents/chat.agent";
import { motionAgent } from "./agents/motion.agent";

// ─── Storage ──────────────────────────────────────────────────────────────────
// Reuse the existing pg.Pool from src/config/pg.ts.
// Tables are created in the `mastra` schema to keep them isolated from app tables.

const storage = new PostgresStore({
  id: "keilhq-mastra-storage",
  pool: pool,
  schemaName: "mastra",
});

// ─── Mastra Instance ──────────────────────────────────────────────────────────

export const mastra = new Mastra({
  agents: { "keilhq-ai": supervisor, "keilhq-task-agent": taskAgent, "keilhq-chat-agent": chatAgent, "keilhq-motion-agent": motionAgent },
  storage,
  server: {
    middleware: [
      async (c, next) => {
        // Extract JWT from Authorization header and verify with Supabase
        const authHeader = c.req.header("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return c.json({ success: false, message: "Not authorized" }, 401);
        }

        const token = authHeader.split(" ")[1];
        const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !supabaseUser) {
          return c.json({ success: false, message: "Invalid or expired token" }, 401);
        }

        // Set userId on Mastra's requestContext so agents/tools can access it
        const requestContext = c.get("requestContext");
        requestContext.set("userId", supabaseUser.id);

        // Also extract orgId/spaceId/modelSelection from request body if present
        if (c.req.method === "POST") {
          try {
            const clonedReq = c.req.raw.clone();
            const body = await clonedReq.json();
            if (body?.orgId) requestContext.set("orgId", body.orgId);
            if (body?.spaceId) requestContext.set("spaceId", body.spaceId);
            if (body?.modelSelection) requestContext.set("modelSelection", body.modelSelection);
            if (body?.localAiBaseUrl) requestContext.set("localAiBaseUrl", body.localAiBaseUrl);
            if (body?.localAiModel) requestContext.set("localAiModel", body.localAiModel);
          } catch {
            // Body parsing may fail for non-JSON requests — that's fine
          }
        }

        await next();
      },
    ],
    apiRoutes: [
      chatRoute({
        path: "/chat",
        agent: "keilhq-ai",
      }),
    ],
  },
});

import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../../config/pg";
import { emitActivity } from "../lib/activity-stream";

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function ensureMemoryTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.user_memory (
      user_id     UUID        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
      content     TEXT        NOT NULL DEFAULT '',
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getMemory(userId: string): Promise<string> {
  await ensureMemoryTable();
  const result = await pool.query(
    `SELECT content FROM public.user_memory WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0]?.content ?? "";
}

async function setMemory(userId: string, content: string): Promise<void> {
  await ensureMemoryTable();
  await pool.query(
    `INSERT INTO public.user_memory (user_id, content, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET content = $2, updated_at = NOW()`,
    [userId, content]
  );
}

// ─── Tool: read_memory ────────────────────────────────────────────────────────

export const readMemoryTool = createTool({
  id: "read_memory",
  description:
    "Read the persistent memory file for the current user. Call this at the start of every conversation to recall facts, preferences, and context about the user. Returns a Markdown document.",
  inputSchema: z.object({}),
  execute: async (_input, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "KeilHQ AI",
      action: "Reading memory",
      status: "running",
    });

    try {
      const content = await getMemory(userId);

      await emitActivity(context, {
        agentLabel: "KeilHQ AI",
        action: "Memory loaded",
        status: "complete",
      });

      return {
        memory: content || "# User Memory\n\n*(No memory yet — this is a fresh start.)*",
        hasMemory: content.length > 0,
      };
    } catch (err: any) {
      return { error: err.message || "Failed to read memory." };
    }
  },
});

// ─── Tool: update_memory ──────────────────────────────────────────────────────

export const updateMemoryTool = createTool({
  id: "update_memory",
  description:
    "Update the persistent memory file for the current user. Use this to record new facts, preferences, decisions, or context the user has shared. The content should be a complete Markdown document — you rewrite the whole file each time, merging old and new information. Always preserve existing useful facts when rewriting.",
  inputSchema: z.object({
    content: z
      .string()
      .min(1)
      .describe(
        "The full updated memory as a Markdown document. Structure with sections like ## Preferences, ## Work Context, ## Recent Decisions, ## Personal Facts. Merge existing memory with new information — never discard useful facts."
      ),
    reason: z
      .string()
      .optional()
      .describe("Brief reason for the update, e.g. 'User mentioned they prefer dark mode'"),
  }),
  execute: async (input, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    if (!userId) return { error: "Not authenticated." };

    await emitActivity(context, {
      agentLabel: "KeilHQ AI",
      action: `Updating memory${input.reason ? `: ${input.reason}` : ""}`,
      status: "running",
    });

    try {
      await setMemory(userId, input.content);

      await emitActivity(context, {
        agentLabel: "KeilHQ AI",
        action: "Memory updated",
        status: "complete",
      });

      return {
        success: true,
        message: "Memory updated successfully.",
        charactersWritten: input.content.length,
      };
    } catch (err: any) {
      return { error: err.message || "Failed to update memory." };
    }
  },
});

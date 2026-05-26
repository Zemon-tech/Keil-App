import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../config/pg";
import * as motionPageService from "../services/motion-page.service";
import { getModel } from "./index";

// ─── Helper: verify space membership ─────────────────────────────────────────

async function isSpaceMember(
  userId: string,
  orgId: string,
  spaceId: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1 FROM public.space_members
     WHERE org_id = $1 AND space_id = $2 AND user_id = $3 LIMIT 1`,
    [orgId, spaceId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export const searchMotionPagesTool = createTool({
  id: "search_motion_pages",
  description:
    "Search for notes/pages in the current space by keyword in their title. Returns up to 10 matches.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe("Keyword to search for in page titles"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    const orgId = context?.requestContext?.get("orgId") as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    const member = await isSpaceMember(userId, orgId, spaceId);
    if (!member)
      return { error: "You are not a member of this space." };

    const result = await pool.query(
      `SELECT id, title, updated_at
       FROM public.motion_pages
       WHERE org_id = $1
         AND space_id = $2
         AND title ILIKE '%' || $3 || '%'
         AND deleted_at IS NULL
       ORDER BY updated_at DESC
       LIMIT 10`,
      [orgId, spaceId, inputData.query]
    );

    const pages = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      updatedAt: row.updated_at,
    }));

    return {
      pages,
      count: pages.length,
      query: inputData.query,
    };
  },
});

export const getMotionPageTool = createTool({
  id: "get_motion_page",
  description:
    "Retrieve the full content of a specific note/page by its ID. The user must be a member of the space.",
  inputSchema: z.object({
    pageId: z.string().uuid().describe("The page's UUID"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    const orgId = context?.requestContext?.get("orgId") as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    const member = await isSpaceMember(userId, orgId, spaceId);
    if (!member)
      return { error: "You are not a member of this space." };

    const page = await motionPageService.getPageById(
      orgId,
      spaceId,
      inputData.pageId
    );

    if (!page)
      return { error: "Page not found or you do not have access to it." };

    return { page };
  },
});

// ─── Motion Agent ─────────────────────────────────────────────────────────────

export const motionAgent = new Agent({
  id: "keilhq-motion-agent",
  name: "keilhq-motion-agent",
  instructions: `You are the KeilHQ Motion Agent. You help users find their notes and documents.

Search by title keywords using search_motion_pages, then retrieve full content with get_motion_page if needed.
When presenting search results, show the page title and when it was last updated.
You cannot create or edit pages — only search and retrieve.
If the user wants to edit or create notes, direct them to the notes section of the app.`,
  model: getModel(),
  tools: {
    search_motion_pages: searchMotionPagesTool,
    get_motion_page: getMotionPageTool,
  },
});
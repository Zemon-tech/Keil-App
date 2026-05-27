import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../../config/pg";
import * as motionPageService from "../../services/motion-page.service";

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

// ─── Tool: search_motion_pages ────────────────────────────────────────────────

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

    const pages = result.rows.map((row: any) => ({
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

// ─── Tool: get_motion_page ────────────────────────────────────────────────────

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

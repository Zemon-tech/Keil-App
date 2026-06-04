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

// ─── Tool: list_motion_pages ──────────────────────────────────────────────────

export const listMotionPagesTool = createTool({
  id: "list_motion_pages",
  description: "List all notes and document pages inside the current space. Returns only IDs and titles (lite payload). Useful when the user wants to browse their notes without fetching massive contents.",
  inputSchema: z.object({}),
  execute: async (_inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    const orgId = context?.requestContext?.get("orgId") as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    const member = await isSpaceMember(userId, orgId, spaceId);
    if (!member)
      return { error: "You are not a member of this space." };

    const result = await pool.query(
      `SELECT id, title, parent_id, updated_at
       FROM public.motion_pages
       WHERE org_id = $1
         AND space_id = $2
         AND deleted_at IS NULL
       ORDER BY parent_id NULLS FIRST, position ASC, created_at ASC`,
      [orgId, spaceId]
    );

    return {
      pages: result.rows,
      count: result.rows.length,
    };
  },
});

// Helper to recursively parse Tiptap JSON node structure into Markdown format
function tiptapToMarkdown(node: any): string {
  if (!node) return "";
  
  if (node.type === "text") {
    return node.text || "";
  }

  const childrenText = (node.content || [])
    .map((child: any) => tiptapToMarkdown(child))
    .join("");

  switch (node.type) {
    case "paragraph":
      return childrenText ? `${childrenText}\n\n` : "\n";
    case "heading": {
      const level = node.attrs?.level || 1;
      return `${"#".repeat(level)} ${childrenText}\n\n`;
    }
    case "bulletList":
      return `${childrenText}`;
    case "orderedList":
      return `${childrenText}`;
    case "listItem":
      return `- ${childrenText}\n`;
    case "taskList":
      return `${childrenText}`;
    case "taskItem": {
      const checked = node.attrs?.checked ? "[x]" : "[ ]";
      return `- ${checked} ${childrenText}\n`;
    }
    case "blockquote":
      return `> ${childrenText.trim().replace(/\n/g, "\n> ")}\n\n`;
    case "codeBlock":
      return `\`\`\`${node.attrs?.language || ""}\n${childrenText}\n\`\`\`\n\n`;
    case "hardBreak":
      return "\n";
    case "horizontalRule":
      return "---\n\n";
    default:
      return childrenText;
  }
}

// ─── Tool: get_motion_page ────────────────────────────────────────────────────

export const getMotionPageTool = createTool({
  id: "get_motion_page",
  description:
    "Retrieve the content of a specific note/page by its ID in Markdown format. Supports character offset chunking for large documents.",
  inputSchema: z.object({
    pageId: z.string().uuid().describe("The page's UUID"),
    offset: z.number().int().min(0).optional().default(0).describe("Character offset for reading large documents in chunks (default 0)"),
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

    let markdown = "";
    if (page.content) {
      markdown = tiptapToMarkdown(page.content);
    }

    const offset = inputData.offset || 0;
    const limit = 20000; // 20k characters limit per fetch
    const totalLength = markdown.length;
    const chunk = markdown.substring(offset, offset + limit);
    const hasMore = offset + limit < totalLength;

    return {
      page: {
        id: page.id,
        title: page.title,
        updatedAt: page.updated_at,
        icon: page.icon,
        coverImage: page.cover_image,
      },
      content: chunk,
      pagination: {
        offset,
        chunkLength: chunk.length,
        totalLength,
        hasMore,
        nextOffset: hasMore ? offset + limit : null
      }
    };
  },
});

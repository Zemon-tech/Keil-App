import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import pool from "../../config/pg";
import { Pool } from "pg";
import * as motionPageService from "../../services/motion-page.service";
import { ActivityEvent } from "../types/activity";
import { emitActivity } from "../lib/activity-stream";



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

async function searchPagesByTitle(
  query: string,
  orgId: string,
  spaceId: string,
  db: Pool
): Promise<Array<{ id: string; title: string; updated_at: string }>> {
  const result = await db.query(
    `SELECT id, title, updated_at,
            ts_rank(title_search, websearch_to_tsquery('english', $3)) AS rank
     FROM public.motion_pages
     WHERE org_id = $1
       AND space_id = $2
       AND deleted_at IS NULL
       AND (
         title_search @@ websearch_to_tsquery('english', $3)
         OR title ILIKE $4
       )
     ORDER BY rank DESC, updated_at DESC
     LIMIT 10`,
    [orgId, spaceId, query, `%${query}%`]
  );
  return result.rows;
}

// ─── Tool: search_motion_pages ────────────────────────────────────────────────

export const searchMotionPagesTool = createTool({
  id: "search_motion_pages",
  description:
    "Smartly search for notes/pages in the current space by matching the query context to page titles. Returns relevant pages.",
  inputSchema: z.object({
    query: z
      .string()
      .min(1)
      .describe("The search prompt or keywords to look for"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    const orgId = context?.requestContext?.get("orgId") as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    await emitActivity(context, {
      agentLabel: "Notes",
      action: "Searching notes",
      status: "running",
    });

    const member = await isSpaceMember(userId, orgId, spaceId);
    if (!member)
      return { error: "You are not a member of this space." };

    const pages = await searchPagesByTitle(inputData.query, orgId, spaceId, pool);

    await emitActivity(context, {
      agentLabel: "Notes",
      action: `Searching notes for "${inputData.query}"`,
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-motion-agent',
        agentLabel: 'Notes',
        tool: 'search_motion_pages',
        icon: 'search',
        action: `Searching notes for "${inputData.query}"`,
        details: `Found ${pages.length} matching page(s)`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      pages,
      count: pages.length,
      query: inputData.query,
    };
  },
});

// ─── Tool: list_motion_pages ──────────────────────────────────────────────────

export const listMotionPagesTool = createTool({
  id: "list_motion_pages",
  description: "List all notes and document pages inside the current space, optionally matching a query smartly.",
  inputSchema: z.object({
    query: z.string().optional().describe("Optional search query to filter listed pages smartly"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    const orgId = context?.requestContext?.get("orgId") as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    await emitActivity(context, {
      agentLabel: "Notes",
      action: "Listing pages",
      status: "running",
    });

    const member = await isSpaceMember(userId, orgId, spaceId);
    if (!member)
      return { error: "You are not a member of this space." };

    let pages: any[] = [];
    if (inputData.query) {
      pages = await searchPagesByTitle(inputData.query, orgId, spaceId, pool);
    } else {
      const result = await pool.query(
        `SELECT id, title, parent_id, updated_at
         FROM public.motion_pages
         WHERE org_id = $1
           AND space_id = $2
           AND deleted_at IS NULL
         ORDER BY parent_id NULLS FIRST, position ASC, created_at ASC`,
        [orgId, spaceId]
      );
      pages = result.rows;
    }

    await emitActivity(context, {
      agentLabel: "Notes",
      action: inputData.query ? `Browsing notes matching "${inputData.query}"` : 'Listing all notes',
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-motion-agent',
        agentLabel: 'Notes',
        tool: 'list_motion_pages',
        icon: 'layout',
        action: inputData.query ? `Browsing notes matching "${inputData.query}"` : 'Listing all notes',
        details: `Found ${pages.length} page(s)`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
      pages,
      count: pages.length,
    };
  },
});

// Helper to recursively parse Tiptap JSON node structure into Markdown format
function tiptapToMarkdown(node: any, parentType?: string, itemIndex = 0): string {
  if (!node) return "";
  
  if (node.type === "text") {
    let text = node.text || "";
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === "bold") {
          text = `**${text}**`;
        } else if (mark.type === "italic") {
          text = `*${text}*`;
        } else if (mark.type === "code") {
          text = `\`${text}\``;
        } else if (mark.type === "strike") {
          text = `~~${text}~~`;
        } else if (mark.type === "link" && mark.attrs?.href) {
          text = `[${text}](${mark.attrs.href})`;
        }
      }
    }
    return text;
  }

  const childrenText = (node.content || [])
    .map((child: any, idx: number) => tiptapToMarkdown(child, node.type, idx))
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
      if (parentType === "orderedList") {
        return `${itemIndex + 1}. ${childrenText}\n`;
      }
      return `- ${childrenText}\n`;
    case "taskList":
      return `${childrenText}`;
    case "taskItem": {
      const checked = node.attrs?.checked ? "[x]" : "[ ]";
      return `- ${checked} ${childrenText}\n`;
    }
    case "blockquote": {
      const isCallout = node.attrs?.type === "callout";
      if (isCallout) {
        return `> [!NOTE]\n> ${childrenText.trim().replace(/\n/g, "\n> ")}\n\n`;
      }
      return `> ${childrenText.trim().replace(/\n/g, "\n> ")}\n\n`;
    }
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
    "Retrieve the content of a specific note/page by either its ID or by searching its title smartly.",
  inputSchema: z.object({
    pageId: z.string().uuid().optional().describe("The page's UUID"),
    title: z.string().optional().describe("Alternatively, match by title smartly if ID is unknown"),
    offset: z.number().int().min(0).optional().default(0).describe("Character offset for reading large documents in chunks (default 0)"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    const orgId = context?.requestContext?.get("orgId") as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    await emitActivity(context, {
      agentLabel: "Notes",
      action: "Reading page content",
      status: "running",
    });

    const member = await isSpaceMember(userId, orgId, spaceId);
    if (!member)
      return { error: "You are not a member of this space." };

    let resolvedId = inputData.pageId;

    if (!resolvedId && inputData.title) {
      const matchedPages = await searchPagesByTitle(inputData.title, orgId, spaceId, pool);
      if (matchedPages.length > 0) {
        resolvedId = matchedPages[0].id;
      }
    }

    if (!resolvedId) {
      return { error: "Could not find a relevant page matching the provided identifier." };
    }

    const page = await motionPageService.getPageById(
      orgId,
      spaceId,
      resolvedId
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

    await emitActivity(context, {
      agentLabel: "Notes",
      action: `Reading "${page.title}"`,
      status: "complete",
    });

    return {
      activity: {
        agent: 'keilhq-motion-agent',
        agentLabel: 'Notes',
        tool: 'get_motion_page',
        icon: 'file',
        action: `Reading "${page.title}"`,
        details: `Fetched ${chunk.length} of ${totalLength} characters (offset ${offset})`,
        status: 'complete',
        timestamp: new Date().toISOString(),
      },
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

// ─── Helper: get space role ──────────────────────────────────────────────────

async function getSpaceRole(
  userId: string,
  orgId: string,
  spaceId: string
): Promise<string | null> {
  const result = await pool.query(
    `SELECT role FROM public.space_members
     WHERE org_id = $1 AND space_id = $2 AND user_id = $3 LIMIT 1`,
    [orgId, spaceId, userId]
  );
  return result.rows[0]?.role || null;
}

// ─── Helper: parse inline markdown marks (bold, italic, code, strike, link) ────

interface TextToken {
  text: string;
  marks?: { type: string; attrs?: Record<string, any> }[];
}

function splitTokens(
  tokens: TextToken[],
  regex: RegExp,
  createMatchToken: (match: RegExpExecArray) => TextToken
): TextToken[] {
  const result: TextToken[] = [];

  for (const token of tokens) {
    if (token.marks && token.marks.length > 0) {
      result.push(token);
      continue;
    }

    let remainingText = token.text;
    regex.lastIndex = 0;

    while (remainingText) {
      const match = regex.exec(remainingText);
      if (!match) {
        result.push({ text: remainingText });
        break;
      }

      const matchIndex = match.index;
      const matchLength = match[0].length;

      if (matchIndex > 0) {
        result.push({ text: remainingText.substring(0, matchIndex) });
      }

      const matchToken = createMatchToken(match);
      result.push(matchToken);

      remainingText = remainingText.substring(matchIndex + matchLength);
      regex.lastIndex = 0;
    }
  }

  return result;
}

function parseInlineFormatting(text: string): TextToken[] {
  if (!text) return [];

  let tokens: TextToken[] = [{ text }];

  // 1. Link: [text](url)
  tokens = splitTokens(tokens, /\[([^\]]+)\]\(([^)]+)\)/, (match) => ({
    text: match[1],
    marks: [{ type: "link", attrs: { href: match[2], target: "_blank" } }],
  }));

  // 2. Bold: **text** or __text__
  tokens = splitTokens(tokens, /\*\*([^*]+)\*\*|__([^_]+)__/, (match) => ({
    text: match[1] || match[2],
    marks: [{ type: "bold" }],
  }));

  // 3. Code: `code`
  tokens = splitTokens(tokens, /`([^`]+)`/, (match) => ({
    text: match[1],
    marks: [{ type: "code" }],
  }));

  // 4. Italic: *text* or _text_
  tokens = splitTokens(tokens, /\*([^*]+)\*|_([^_]+)_/, (match) => ({
    text: match[1] || match[2],
    marks: [{ type: "italic" }],
  }));

  // 5. Strikethrough: ~~text~~
  tokens = splitTokens(tokens, /~~([^~]+)~~/, (match) => ({
    text: match[1],
    marks: [{ type: "strike" }],
  }));

  return tokens.map(t => ({
    type: "text",
    text: t.text,
    ...(t.marks ? { marks: t.marks } : {})
  })) as any[];
}

// ─── Helper: parse Markdown to Tiptap JSON ───────────────────────────────────

function parseMarkdownToTiptap(markdown: string, pageTitle?: string): Record<string, any> {
  let cleanMarkdown = markdown.trim();
  
  // Strip duplicate header if it matches pageTitle
  if (pageTitle) {
    const trimmedTitle = pageTitle.trim().toLowerCase();
    const escaped = trimmedTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const titleRegex = new RegExp(`^#{1,3}\\s+${escaped}\\s*\\r?\\n+`, "i");
    cleanMarkdown = cleanMarkdown.replace(titleRegex, "").trim();
  }

  const lines = cleanMarkdown.split(/\r?\n/);
  const contentNodes: any[] = [];

  // Stack of active lists
  const listStack: { indent: number; type: "bulletList" | "orderedList" | "taskList"; node: any; currentListItem: any }[] = [];

  const flushAllLists = () => {
    listStack.length = 0;
  };

  let inCodeBlock = false;
  let codeLanguage = "";
  let codeLines: string[] = [];

  let inBlockquote = false;
  let isCallout = false;
  let blockquoteLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // --- Code Block Parsing ---
    if (inCodeBlock) {
      if (trimmed.startsWith("```")) {
        contentNodes.push({
          type: "codeBlock",
          attrs: { language: codeLanguage || null },
          content: [{ type: "text", text: codeLines.join("\n") }],
        });
        inCodeBlock = false;
        codeLines = [];
        codeLanguage = "";
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (trimmed.startsWith("```")) {
      flushAllLists();
      inCodeBlock = true;
      codeLanguage = trimmed.slice(3).trim();
      codeLines = [];
      continue;
    }

    // --- Blockquote / Callout Parsing ---
    const quoteMatch = line.match(/^\s*>\s?(.*)$/);
    if (quoteMatch) {
      flushAllLists();
      const content = quoteMatch[1];
      if (!inBlockquote) {
        inBlockquote = true;
        isCallout = false;
        blockquoteLines = [];
        const calloutMarker = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
        if (calloutMarker) {
          isCallout = true;
          continue;
        }
      }
      blockquoteLines.push(content);
      continue;
    } else if (inBlockquote) {
      const textContent = blockquoteLines.join("\n").trim();
      const blockquoteNode: any = {
        type: "blockquote",
        content: [{
          type: "paragraph",
          content: parseInlineFormatting(textContent),
        }],
      };
      if (isCallout) {
        blockquoteNode.attrs = { type: "callout" };
      }
      contentNodes.push(blockquoteNode);
      inBlockquote = false;
      blockquoteLines = [];
    }

    // --- Empty lines ---
    if (!trimmed) {
      flushAllLists();
      continue;
    }

    // --- Horizontal Rule ---
    if (trimmed === "---" || trimmed === "___" || trimmed === "***") {
      flushAllLists();
      contentNodes.push({
        type: "horizontalRule",
      });
      continue;
    }

    // --- Headings ---
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushAllLists();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      contentNodes.push({
        type: "heading",
        attrs: { level },
        content: parseInlineFormatting(text),
      });
      continue;
    }

    // --- List Parsing with Indentation Stack ---
    const indent = line.match(/^\s*/)?.[0].length || 0;
    
    const taskMatch = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);

    if (taskMatch || bulletMatch || orderedMatch) {
      let listType: "bulletList" | "orderedList" | "taskList";
      let text = "";
      let checked = false;

      if (taskMatch) {
        listType = "taskList";
        checked = taskMatch[1].toLowerCase() === "x";
        text = taskMatch[2];
      } else if (bulletMatch) {
        listType = "bulletList";
        text = bulletMatch[1];
      } else {
        listType = "orderedList";
        text = orderedMatch![1];
      }

      while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
        listStack.pop();
      }

      const top = listStack.length > 0 ? listStack[listStack.length - 1] : null;

      if (top && top.indent === indent && top.type === listType) {
        let itemNode: any;
        if (listType === "taskList") {
          itemNode = {
            type: "taskItem",
            attrs: { checked },
            content: [{
              type: "paragraph",
              content: parseInlineFormatting(text),
            }],
          };
        } else {
          itemNode = {
            type: "listItem",
            content: [{
              type: "paragraph",
              content: parseInlineFormatting(text),
            }],
          };
        }
        top.node.content.push(itemNode);
        top.currentListItem = itemNode;
      } else {
        if (top && top.indent === indent) {
          listStack.pop();
        }

        const newListNode: any = {
          type: listType,
          content: [],
        };

        let itemNode: any;
        if (listType === "taskList") {
          itemNode = {
            type: "taskItem",
            attrs: { checked },
            content: [{
              type: "paragraph",
              content: parseInlineFormatting(text),
            }],
          };
        } else {
          itemNode = {
            type: "listItem",
            content: [{
              type: "paragraph",
              content: parseInlineFormatting(text),
            }],
          };
        }
        newListNode.content.push(itemNode);

        const parentTop = listStack.length > 0 ? listStack[listStack.length - 1] : null;
        if (parentTop) {
          if (!parentTop.currentListItem.content) {
            parentTop.currentListItem.content = [];
          }
          parentTop.currentListItem.content.push(newListNode);
        } else {
          contentNodes.push(newListNode);
        }

        listStack.push({
          indent,
          type: listType,
          node: newListNode,
          currentListItem: itemNode,
        });
      }
      continue;
    }

    // --- Fallback: Paragraph ---
    flushAllLists();
    contentNodes.push({
      type: "paragraph",
      content: parseInlineFormatting(line),
    });
  }

  // Handle final open blockquote if any
  if (inBlockquote) {
    const textContent = blockquoteLines.join("\n").trim();
    const blockquoteNode: any = {
      type: "blockquote",
      content: [{
        type: "paragraph",
        content: parseInlineFormatting(textContent),
      }],
    };
    if (isCallout) {
      blockquoteNode.attrs = { type: "callout" };
    }
    contentNodes.push(blockquoteNode);
  }

  if (contentNodes.length === 0) {
    contentNodes.push({
      type: "paragraph",
    });
  }

  return {
    type: "doc",
    content: contentNodes,
  };
}

// ─── Tool: create_motion_page ────────────────────────────────────────────────

export const createMotionPageTool = createTool({
  id: "create_motion_page",
  description: "Create a new page/note in the current space with a title and optional markdown content. Returns the page details on success.",
  inputSchema: z.object({
    title: z.string().min(1).describe("The title of the page"),
    content: z.string().optional().describe("Optional body content of the page in markdown or text format"),
    parentId: z.string().uuid().optional().describe("Optional parent page ID if creating a subpage"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    const orgId = context?.requestContext?.get("orgId") as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    await emitActivity(context, {
      agentLabel: "Notes",
      action: `Creating page "${inputData.title}"`,
      status: "running",
    });

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role)
      return { error: "You are not a member of this space." };

    if (role !== "admin" && role !== "manager") {
      return { error: "You must be an admin or manager to create pages." };
    }

    try {
      const page = await motionPageService.createPage(orgId, spaceId, userId, {
        title: inputData.title,
        parent_id: inputData.parentId || null,
      });

      if (inputData.content) {
        const tiptapContent = parseMarkdownToTiptap(inputData.content, inputData.title);
        const updatedPage = await motionPageService.updatePage(
          orgId,
          spaceId,
          page.id,
          userId,
          { content: tiptapContent },
          role
        );
        await emitActivity(context, {
          agentLabel: "Notes",
          action: `Creating page "${inputData.title}"`,
          status: "complete",
        });
        return {
          activity: {
            agent: 'keilhq-motion-agent',
            agentLabel: 'Notes',
            tool: 'create_motion_page',
            icon: 'file-plus',
            action: `Creating page "${inputData.title}"`,
            details: `Page "${updatedPage?.title || page.title}" created successfully`,
            status: 'complete',
            timestamp: new Date().toISOString(),
          },
          success: true,
          message: `Created page "${inputData.title}" with content.`,
          page: updatedPage || page,
        };
      }

      await emitActivity(context, {
        agentLabel: "Notes",
        action: `Creating page "${inputData.title}"`,
        status: "complete",
      });

      return {
        activity: {
          agent: 'keilhq-motion-agent',
          agentLabel: 'Notes',
          tool: 'create_motion_page',
          icon: 'file-plus',
          action: `Creating page "${inputData.title}"`,
          details: `Page "${page.title}" created successfully`,
          status: 'complete',
          timestamp: new Date().toISOString(),
        },
        success: true,
        message: `Created page "${inputData.title}".`,
        page,
      };
    } catch (err: any) {
      return { error: err?.message || "Failed to create page." };
    }
  },
});

// ─── Tool: update_motion_page ────────────────────────────────────────────────

export const updateMotionPageTool = createTool({
  id: "update_motion_page",
  description: "Update the title and/or content of an existing page/note in the current space.",
  inputSchema: z.object({
    pageId: z.string().uuid().describe("The UUID of the page to update"),
    title: z.string().optional().describe("New title for the page"),
    content: z.string().optional().describe("New body content of the page in markdown or text format"),
  }),
  execute: async (inputData, context) => {
    const userId = context?.requestContext?.get("userId") as string;
    const orgId = context?.requestContext?.get("orgId") as string;
    const spaceId = context?.requestContext?.get("spaceId") as string;

    if (!userId || !orgId || !spaceId)
      return { error: "Missing org or space context." };

    await emitActivity(context, {
      agentLabel: "Notes",
      action: "Updating page content",
      status: "running",
    });

    const role = await getSpaceRole(userId, orgId, spaceId);
    if (!role)
      return { error: "You are not a member of this space." };

    try {
      const updates: any = {};
      if (inputData.title !== undefined) {
        updates.title = inputData.title;
      }
      if (inputData.content !== undefined) {
        let resolvedTitle = inputData.title;
        if (!resolvedTitle) {
          const existingPage = await motionPageService.getPageById(orgId, spaceId, inputData.pageId);
          resolvedTitle = existingPage?.title;
        }
        updates.content = parseMarkdownToTiptap(inputData.content, resolvedTitle);
      }

      const updatedPage = await motionPageService.updatePage(
        orgId,
        spaceId,
        inputData.pageId,
        userId,
        updates,
        role
      );

      const updatedFields = Object.keys(updates).join(", ");

      await emitActivity(context, {
        agentLabel: "Notes",
        action: "Updating page",
        status: "complete",
      });

      return {
        activity: {
          agent: 'keilhq-motion-agent',
          agentLabel: 'Notes',
          tool: 'update_motion_page',
          icon: 'file-edit',
          action: `Updating page`,
          details: `Updated "${updatedPage?.title || inputData.pageId}" — changed: ${updatedFields}`,
          status: 'complete',
          timestamp: new Date().toISOString(),
        },
        success: true,
        message: `Updated page successfully.`,
        page: updatedPage,
      };
    } catch (err: any) {
      return { error: err?.message || "Failed to update page." };
    }
  },
});



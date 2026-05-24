import { motionAnalyticsRepository } from "../repositories";
import { User } from "../types/entities";

// ─── Tiptap JSON Content Recursive Text Extractor ──────────────────────────────

function extractTextFromTiptap(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  let text = "";
  if (Array.isArray(node.content)) {
    text += node.content.map(extractTextFromTiptap).join(" ");
  }
  return text;
}

function getParagraphTexts(content: any): string[] {
  if (!content) return [];
  
  let parsed = content;
  if (typeof content === "string") {
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return [];
    }
  }

  // Handle case where content is a Tiptap document:
  if (parsed.type === "doc" && Array.isArray(parsed.content)) {
    return parsed.content
      .map((node: any) => extractTextFromTiptap(node).trim())
      .filter((text: string) => text.length > 0);
  }

  // Handle case where content is a direct array of nodes:
  if (Array.isArray(parsed)) {
    return parsed
      .map((node: any) => extractTextFromTiptap(node).trim())
      .filter((text: string) => text.length > 0);
  }

  // Handle case where content has a "content" field but no "type" field:
  if (Array.isArray(parsed.content)) {
    return parsed.content
      .map((node: any) => extractTextFromTiptap(node).trim())
      .filter((text: string) => text.length > 0);
  }

  return [];
}

export function computeContentDiff(oldContent: any, newContent: any) {
  const oldBlocks = getParagraphTexts(oldContent);
  const newBlocks = getParagraphTexts(newContent);

  // Simple paragraph set difference
  const deleted = oldBlocks.filter(x => !newBlocks.includes(x));
  const added = newBlocks.filter(x => !oldBlocks.includes(x));

  return { deleted, added };
}

// ─── Edit Logging ─────────────────────────────────────────────────────────────

export const logPageEdit = async (
  pageId: string,
  userId: string,
  oldPage: any,
  input: any
) => {
  try {
    const titleChanged = input.title !== undefined && input.title.trim() !== oldPage.title;
    const contentChanged = input.content !== undefined && JSON.stringify(input.content) !== JSON.stringify(oldPage.content);
    const iconChanged = input.icon !== undefined && input.icon !== oldPage.icon;
    const coverChanged = input.cover_image !== undefined && input.cover_image !== oldPage.cover_image;

    if (!titleChanged && !contentChanged && !iconChanged && !coverChanged) {
      return;
    }

    if (titleChanged && !contentChanged && !iconChanged && !coverChanged) {
      await motionAnalyticsRepository.logUpdate({
        page_id: pageId,
        user_id: userId,
        action_type: "rename",
        description: `Renamed page from "${oldPage.title}" to "${input.title}"`
      });
      return;
    }

    if (iconChanged) {
      await motionAnalyticsRepository.logUpdate({
        page_id: pageId,
        user_id: userId,
        action_type: "icon",
        description: `Changed page icon`
      });
    }

    if (coverChanged) {
      await motionAnalyticsRepository.logUpdate({
        page_id: pageId,
        user_id: userId,
        action_type: "cover",
        description: `Changed cover image`
      });
    }

    if (contentChanged || (titleChanged && contentChanged)) {
      const { deleted, added } = computeContentDiff(oldPage.content, input.content);

      if (deleted.length === 0 && added.length === 0 && !titleChanged) {
        return;
      }

      const existingSession = await motionAnalyticsRepository.findRecentUpdateSession(pageId, userId);

      if (existingSession) {
        const sessionDiff = computeContentDiff(existingSession.before_content, input.content);
        let desc = "Edited page content";
        if (existingSession.before_title && input.title && input.title.trim() !== existingSession.before_title) {
          desc = `Renamed page to "${input.title}" and edited content`;
        }

        await motionAnalyticsRepository.updateUpdateSession(existingSession.id, {
          deleted_content: sessionDiff.deleted,
          added_content: sessionDiff.added,
          description: desc
        });
      } else {
        await motionAnalyticsRepository.logUpdate({
          page_id: pageId,
          user_id: userId,
          action_type: "edit",
          description: titleChanged ? `Renamed page to "${input.title}" and edited content` : "Edited page content",
          before_title: oldPage.title,
          before_content: oldPage.content,
          deleted_content: deleted,
          added_content: added
        });
      }
    }
  } catch (err) {
    console.error("Error logging page edit:", err);
  }
};

export const logPageCreation = async (pageId: string, userId: string) => {
  try {
    await motionAnalyticsRepository.logUpdate({
      page_id: pageId,
      user_id: userId,
      action_type: "create",
      description: "Created page"
    });
  } catch (err) {
    console.error("Error logging page creation:", err);
  }
};

// ─── Page Views and Perms ───────────────────────────────────────────────────

export const recordPageView = async (pageId: string, userId: string | null) => {
  return await motionAnalyticsRepository.recordView(pageId, userId);
};

export const getViewsSummary = async (pageId: string, daysRange = 28) => {
  const summary = await motionAnalyticsRepository.getViewsSummary(pageId, daysRange);
  const total = summary.reduce((acc, curr) => acc + curr.views, 0);
  return { total, chartData: summary };
};

export const getViewPermission = async (pageId: string, userId: string) => {
  const perm = await motionAnalyticsRepository.getViewPermission(pageId, userId);
  return perm ? perm.allow_view_history : false;
};

export const setViewPermission = async (pageId: string, userId: string, allow: boolean) => {
  return await motionAnalyticsRepository.setViewPermission(pageId, userId, allow);
};

export const getViewers = async (pageId: string) => {
  return await motionAnalyticsRepository.getViewers(pageId);
};

// ─── Updates Feed ─────────────────────────────────────────────────────────────

export const getUpdates = async (pageId: string, limit = 20, offset = 0) => {
  return await motionAnalyticsRepository.getUpdates(pageId, limit, offset);
};

// ─── Editors ──────────────────────────────────────────────────────────────────

export const getEditors = async (pageId: string) => {
  const creator = await motionAnalyticsRepository.getPageCreator(pageId);
  const recent = await motionAnalyticsRepository.getRecentEditors(pageId);
  return { creator, recent };
};

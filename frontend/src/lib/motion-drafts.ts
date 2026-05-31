import type { JSONContent } from "@tiptap/core";

export interface MotionDraft {
  pageId: string;
  content: JSONContent;
  timestamp: number;
}

const DRAFT_PREFIX = "motion:draft:";
const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export function saveDraft(pageId: string, content: JSONContent): void {
  try {
    const draft: MotionDraft = {
      pageId,
      content,
      timestamp: Date.now(),
    };
    localStorage.setItem(`${DRAFT_PREFIX}${pageId}`, JSON.stringify(draft));
  } catch (error) {
    // Catch localStorage quota limit errors silently
    console.warn("Failed to save draft to localStorage (quota limit or disabled):", error);
  }
}

export function getDraft(pageId: string): JSONContent | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${pageId}`);
    if (!raw) return null;

    const draft = JSON.parse(raw) as MotionDraft;
    const isStale = Date.now() - draft.timestamp > DRAFT_MAX_AGE_MS;
    if (isStale) {
      clearDraft(pageId);
      return null;
    }

    return draft.content;
  } catch {
    return null;
  }
}

export function clearDraft(pageId: string): void {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${pageId}`);
  } catch {}
}

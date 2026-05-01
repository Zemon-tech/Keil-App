import type { JSONContent } from "@tiptap/core";

export type MotionPageId = string;

export interface MotionPageRecord {
  id: MotionPageId;
  title: string;
  icon?: string;
  coverImage?: string;
  content: JSONContent;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "motion.pages.v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function now() {
  return Date.now();
}

function createId(): MotionPageId {
  return `mp_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function getEmptyDoc(): JSONContent {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
      },
    ],
  };
}

export function getAllMotionPages(): MotionPageRecord[] {
  const data = safeParse<MotionPageRecord[]>(localStorage.getItem(STORAGE_KEY));
  if (!data || !Array.isArray(data)) return [];

  return data
    .filter((p) => p && typeof p.id === "string")
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getMotionPageById(id: MotionPageId): MotionPageRecord | null {
  const pages = getAllMotionPages();
  return pages.find((p) => p.id === id) ?? null;
}

export function upsertMotionPage(page: MotionPageRecord): MotionPageRecord {
  const pages = getAllMotionPages();
  const idx = pages.findIndex((p) => p.id === page.id);
  const next: MotionPageRecord = {
    ...page,
    updatedAt: now(),
  };

  if (idx === -1) {
    pages.unshift(next);
  } else {
    pages[idx] = next;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  return next;
}

export function createMotionPage(partial?: {
  title?: string;
  icon?: string;
  coverImage?: string;
}): MotionPageRecord {
  const createdAt = now();
  const page: MotionPageRecord = {
    id: createId(),
    title: partial?.title ?? "Untitled",
    icon: partial?.icon,
    coverImage: partial?.coverImage,
    content: getEmptyDoc(),
    createdAt,
    updatedAt: createdAt,
  };

  return upsertMotionPage(page);
}

export function updateMotionPageTitle(id: MotionPageId, title: string) {
  const page = getMotionPageById(id);
  if (!page) return null;
  return upsertMotionPage({ ...page, title });
}

export function updateMotionPageContent(id: MotionPageId, content: JSONContent) {
  const page = getMotionPageById(id);
  if (!page) return null;
  return upsertMotionPage({ ...page, content });
}

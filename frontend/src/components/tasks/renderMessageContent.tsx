// src/components/tasks/renderMessageContent.tsx
//
// Utility that parses a comment/message string and renders @mention, #task-name,
// and $event-name tokens as styled chips. All other text is rendered as plain text.
//
// Usage:
//   renderMessageContent(content, allTasks, onTaskClick, members?)
//
// The caller is responsible for managing the preview dialog state.

import { AtSign, CheckSquare, CalendarDays, FileText } from "lucide-react";
import type { TaskDTO } from "@/hooks/api/useTasks";
import type { MotionPageDTO } from "@/hooks/api/useMotionPages";
import { cn } from "@/lib/utils";

/** Shape of a space member — only the fields we need here. */
export interface MentionMember {
  user_id: string;
  name?: string | null;
  email?: string | null;
}

export function tiptapJsonToPlainText(jsonStr: string): string {
  if (!jsonStr) return "";
  try {
    const doc = JSON.parse(jsonStr);
    if (doc && doc.type === "doc" && Array.isArray(doc.content)) {
      return getTiptapNodeText(doc);
    }
  } catch (e) {
    // Not JSON
  }
  return jsonStr;
}

function getTiptapNodeText(node: any): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  let text = "";
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += getTiptapNodeText(child);
    }
  }
  if (node.type === "paragraph" || node.type === "heading" || node.type === "listItem") {
    text += "\n";
  }
  return text;
}

export function renderTextWithLinks(text: string): React.ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part as any;
  });
}

/**
 * Splits `content` into segments of plain text, universal mentions, and legacy
 * @person, #task-name, and $event-name tokens, then renders each segment appropriately.
 */
export function renderMessageContent(
  content: string,
  allTasks: TaskDTO[],
  onTaskClick: (taskId: string) => void,
  members: MentionMember[] = [],
  onPageClick?: (pageId: string) => void,
  pages: MotionPageDTO[] = []
): React.ReactNode {
  if (!content) return null;

  // Set up all potential candidates to match for universal mention format: @Name
  const candidates: { label: string; type: "user" | "task" | "event" | "page"; id: string }[] = [];

  for (const m of members) {
    const label = m.name || m.email || "";
    if (label) {
      candidates.push({ label, type: "user", id: m.user_id });
    }
  }

  for (const t of allTasks) {
    if (t.title) {
      candidates.push({ label: t.title, type: t.type as "task" | "event", id: t.id });
    }
  }

  for (const p of pages) {
    const title = p.title || "Untitled";
    if (title) {
      candidates.push({ label: title, type: "page", id: p.id });
    }
  }

  // Sort candidates by label length in descending order to match the longest one first.
  candidates.sort((a, b) => b.label.length - a.label.length);

  const segments: React.ReactNode[] = [];
  let i = 0;
  let plainBuffer = "";
  let keyCounter = 0;

  while (i < content.length) {
    const char = content[i];

    // ── Universal Mention / Legacy User Mention Parsing ───────────────────────
    if (char === "@") {
      const rest = content.slice(i);
      
      // 1. Check for the backward-compatible structured pattern first: @[label](type:id)
      const match = /^@\[([^\]]+)\]\((user|task|event|page):([^)]+)\)/.exec(rest);
      if (match) {
        if (plainBuffer) {
          segments.push(<span key={`plain-${keyCounter++}`}>{renderTextWithLinks(plainBuffer)}</span>);
          plainBuffer = "";
        }
        const [fullMatch, label, type, id] = match;

        if (type === "user") {
          segments.push(
            <span
              key={`mention-${id}-${keyCounter++}`}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-semibold",
                "bg-primary/8 text-primary border border-primary/20",
                "dark:bg-primary/15 dark:border-primary/30",
                "transition-colors"
              )}
            >
              <AtSign className="size-3 shrink-0 opacity-70" />
              {label}
            </span>
          );
        } else if (type === "task" || type === "event") {
          const isEvent = type === "event";
          segments.push(
            <button
              key={`${type}-${id}-${keyCounter++}`}
              type="button"
              onClick={(e) => { e.stopPropagation(); onTaskClick(id); }}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium transition-colors cursor-pointer",
                isEvent
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
              )}
            >
              {isEvent ? (
                <CalendarDays className="size-3.5 shrink-0" />
              ) : (
                <CheckSquare className="size-3.5 shrink-0" />
              )}
              {label}
            </button>
          );
        } else if (type === "page") {
          segments.push(
            <button
              key={`page-${id}-${keyCounter++}`}
              type="button"
              onClick={(e) => { e.stopPropagation(); onPageClick?.(id); }}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium transition-colors cursor-pointer",
                "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
              )}
            >
              <FileText className="size-3.5 shrink-0" />
              {label}
            </button>
          );
        }

        i += fullMatch.length;
        continue;
      }

      // 2. Check for universal clean format: @Name (matching user, task, event, or page)
      const restAfterAt = content.slice(i + 1);
      let matchedCandidate: typeof candidates[number] | null = null;
      for (const cand of candidates) {
        const labelLower = cand.label.toLowerCase();
        if (restAfterAt.toLowerCase().startsWith(labelLower)) {
          const afterMatch = restAfterAt[cand.label.length];
          if (
            afterMatch === undefined ||
            afterMatch === " " ||
            afterMatch === "\n" ||
            /[.,!?;:)]/.test(afterMatch)
          ) {
            matchedCandidate = cand;
            break;
          }
        }
      }

      if (matchedCandidate) {
        if (plainBuffer) {
          segments.push(<span key={`plain-${keyCounter++}`}>{renderTextWithLinks(plainBuffer)}</span>);
          plainBuffer = "";
        }
        const { label, type, id } = matchedCandidate;

        if (type === "user") {
          segments.push(
            <span
              key={`mention-${id}-${keyCounter++}`}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-semibold",
                "bg-primary/8 text-primary border border-primary/20",
                "dark:bg-primary/15 dark:border-primary/30",
                "transition-colors"
              )}
            >
              <AtSign className="size-3 shrink-0 opacity-70" />
              {label}
            </span>
          );
        } else if (type === "task" || type === "event") {
          const isEvent = type === "event";
          segments.push(
            <button
              key={`${type}-${id}-${keyCounter++}`}
              type="button"
              onClick={(e) => { e.stopPropagation(); onTaskClick(id); }}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium transition-colors cursor-pointer",
                isEvent
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
              )}
            >
              {isEvent ? (
                <CalendarDays className="size-3.5 shrink-0" />
              ) : (
                <CheckSquare className="size-3.5 shrink-0" />
              )}
              {label}
            </button>
          );
        } else if (type === "page") {
          segments.push(
            <button
              key={`page-${id}-${keyCounter++}`}
              type="button"
              onClick={(e) => { e.stopPropagation(); onPageClick?.(id); }}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium transition-colors cursor-pointer",
                "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
              )}
            >
              <FileText className="size-3.5 shrink-0" />
              {label}
            </button>
          );
        }

        i += 1 + label.length;
        continue;
      }
    }

    // ── Legacy #task / $event ─────────────────────────────────────────────
    if (char === "#" || char === "$") {
      const rest = content.slice(i + 1);
      let matched: TaskDTO | null = null;
      const targetType = char === "#" ? "task" : "event";

      // Filter tasks based on type associated with the symbol
      const potentialMatches = allTasks
        .filter((t) => t.type === targetType)
        .sort((a, b) => b.title.length - a.title.length);

      for (const t of potentialMatches) {
        const titleLower = t.title.toLowerCase();
        if (rest.toLowerCase().startsWith(titleLower)) {
          const afterMatch = rest[titleLower.length];
          if (
            afterMatch === undefined ||
            afterMatch === " " ||
            afterMatch === "\n" ||
            /[.,!?;:)]/.test(afterMatch)
          ) {
            matched = t;
            break;
          }
        }
      }

      if (matched) {
        if (plainBuffer) {
          segments.push(<span key={`plain-${keyCounter++}`}>{renderTextWithLinks(plainBuffer)}</span>);
          plainBuffer = "";
        }

        const task = matched;
        const isEvent = task.type === "event";

        segments.push(
          <button
            key={`${task.type}-${task.id}-${keyCounter++}`}
            type="button"
            onClick={(e) => { e.stopPropagation(); onTaskClick(task.id); }}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium transition-colors cursor-pointer",
              isEvent
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
            )}
          >
            {isEvent ? (
              <CalendarDays className="size-3.5 shrink-0" />
            ) : (
              <CheckSquare className="size-3.5 shrink-0" />
            )}
            {task.title}
          </button>
        );

        i += 1 + matched.title.length;
        continue;
      }
    }

    plainBuffer += char;
    i++;
  }

  if (plainBuffer) {
    segments.push(<span key={`plain-${keyCounter++}`}>{renderTextWithLinks(plainBuffer)}</span>);
  }

  return <>{segments}</>;
}

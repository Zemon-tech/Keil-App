// src/components/tasks/renderMessageContent.tsx
//
// Utility that parses a comment/message string and renders @mention, #task-name,
// and $event-name tokens as styled chips. All other text is rendered as plain text.
//
// Usage:
//   renderMessageContent(content, allTasks, onTaskClick, members?)
//
// The caller is responsible for managing the preview dialog state.

import { Hash, DollarSign, AtSign } from "lucide-react";
import type { TaskDTO } from "@/hooks/api/useTasks";
import { cn } from "@/lib/utils";

/** Shape of a space member — only the fields we need here. */
export interface MentionMember {
  user_id: string;
  name?: string | null;
  email?: string | null;
}

/**
 * Splits `content` into segments of plain text, @person, #task-name, and
 * $event-name tokens, then renders each segment appropriately.
 */
export function renderMessageContent(
  content: string,
  allTasks: TaskDTO[],
  onTaskClick: (taskId: string) => void,
  members: MentionMember[] = []
): React.ReactNode {
  if (!content) return null;

  const segments: React.ReactNode[] = [];
  let i = 0;
  let plainBuffer = "";
  let keyCounter = 0;

  while (i < content.length) {
    const char = content[i];

    // ── @mention ──────────────────────────────────────────────────────────
    if (char === "@") {
      const rest = content.slice(i + 1);

      // Try to match the longest member name/email starting at this position
      const sortedMembers = [...members].sort(
        (a, b) =>
          (b.name || b.email || "").length - (a.name || a.email || "").length
      );

      let matchedMember: MentionMember | null = null;
      for (const m of sortedMembers) {
        const label = (m.name || m.email || "").toLowerCase();
        if (!label) continue;
        if (rest.toLowerCase().startsWith(label)) {
          const afterMatch = rest[label.length];
          if (
            afterMatch === undefined ||
            afterMatch === " " ||
            afterMatch === "\n" ||
            /[.,!?;:)]/.test(afterMatch)
          ) {
            matchedMember = m;
            break;
          }
        }
      }

      if (matchedMember) {
        if (plainBuffer) {
          segments.push(<span key={`plain-${keyCounter++}`}>{plainBuffer}</span>);
          plainBuffer = "";
        }
        const label = matchedMember.name || matchedMember.email || "";
        segments.push(
          <span
            key={`mention-${matchedMember.user_id}-${keyCounter++}`}
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
        i += 1 + label.length;
        continue;
      }
    }

    // ── #task / $event ─────────────────────────────────────────────────────
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
          segments.push(<span key={`plain-${keyCounter++}`}>{plainBuffer}</span>);
          plainBuffer = "";
        }

        const task = matched;
        const isEvent = task.type === "event";

        segments.push(
          <button
            key={`${task.type}-${task.id}-${keyCounter++}`}
            type="button"
            onClick={() => onTaskClick(task.id)}
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[13px] font-medium transition-colors cursor-pointer",
              isEvent
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
            )}
          >
            {isEvent ? (
              <DollarSign className="size-3 shrink-0" />
            ) : (
              <Hash className="size-3 shrink-0" />
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
    segments.push(<span key={`plain-${keyCounter++}`}>{plainBuffer}</span>);
  }

  return <>{segments}</>;
}

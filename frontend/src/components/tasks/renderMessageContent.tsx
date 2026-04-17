// src/components/tasks/renderMessageContent.tsx
//
// Utility that parses a comment/message string and renders #task-name tokens
// as clickable chips. All other text is rendered as plain text.
//
// Usage:
//   renderMessageContent(content, allTasks, onTaskClick)
//
// The caller is responsible for managing the preview dialog state.

import { Hash } from "lucide-react";
import type { TaskDTO } from "@/hooks/api/useTasks";

/**
 * Splits `content` into segments of plain text and #task-name tokens,
 * then renders each segment appropriately.
 *
 * A "#task-name" token is matched when the text after "#" exactly matches
 * a task title (case-insensitive). Unrecognised #words are rendered as plain text.
 */
export function renderMessageContent(
  content: string,
  allTasks: TaskDTO[],
  onTaskClick: (taskId: string) => void
): React.ReactNode {
  if (!content) return null;

  // Build a lookup: lowercase title → task
  const titleMap = new Map<string, TaskDTO>();
  for (const t of allTasks) {
    titleMap.set(t.title.toLowerCase(), t);
  }

  // Split on #<word-or-phrase> tokens — we match # followed by non-whitespace chars
  // We'll do a greedy match: try the longest possible title after # first.
  // Strategy: scan character by character, detect "#", then try to match a task title.
  const segments: React.ReactNode[] = [];
  let i = 0;
  let plainBuffer = "";
  let keyCounter = 0;

  while (i < content.length) {
    if (content[i] === "#") {
      // Try to match a task title starting at i+1
      const rest = content.slice(i + 1);
      let matched: TaskDTO | null = null;
      let matchedLength = 0;

      // Try longest match first (greedy): check all tasks sorted by title length desc
      const sortedTasks = [...allTasks].sort(
        (a, b) => b.title.length - a.title.length
      );

      for (const t of sortedTasks) {
        const titleLower = t.title.toLowerCase();
        if (rest.toLowerCase().startsWith(titleLower)) {
          // Make sure the match ends at a word boundary (space, end, or punctuation)
          const afterMatch = rest[titleLower.length];
          if (
            afterMatch === undefined ||
            afterMatch === " " ||
            afterMatch === "\n" ||
            /[.,!?;:)]/.test(afterMatch)
          ) {
            matched = t;
            matchedLength = t.title.length;
            break;
          }
        }
      }

      if (matched) {
        // Flush plain buffer
        if (plainBuffer) {
          segments.push(
            <span key={`plain-${keyCounter++}`}>{plainBuffer}</span>
          );
          plainBuffer = "";
        }

        const task = matched;
        segments.push(
          <button
            key={`task-${task.id}-${keyCounter++}`}
            type="button"
            onClick={() => onTaskClick(task.id)}
            className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[13px] font-medium
                       bg-emerald-500/10 text-emerald-600 dark:text-emerald-400
                       hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            <Hash className="h-3 w-3 shrink-0" />
            {task.title}
          </button>
        );

        i += 1 + matchedLength; // skip "#" + title
      } else {
        // No task matched — treat "#" as plain text
        plainBuffer += content[i];
        i++;
      }
    } else {
      plainBuffer += content[i];
      i++;
    }
  }

  // Flush remaining plain text
  if (plainBuffer) {
    segments.push(<span key={`plain-${keyCounter++}`}>{plainBuffer}</span>);
  }

  return <>{segments}</>;
}

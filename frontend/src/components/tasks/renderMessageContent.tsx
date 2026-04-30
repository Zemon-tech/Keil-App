// src/components/tasks/renderMessageContent.tsx
//
// Utility that parses a comment/message string and renders #task-name tokens
// as clickable chips. All other text is rendered as plain text.
//
// Usage:
//   renderMessageContent(content, allTasks, onTaskClick)
//
// The caller is responsible for managing the preview dialog state.

import { Hash, DollarSign } from "lucide-react";
import type { TaskDTO } from "@/hooks/api/useTasks";

/**
 * Splits `content` into segments of plain text, #task-name, and $event-name tokens,
 * then renders each segment appropriately.
 */
export function renderMessageContent(
  content: string,
  allTasks: TaskDTO[],
  onTaskClick: (taskId: string) => void
): React.ReactNode {
  if (!content) return null;

  const segments: React.ReactNode[] = [];
  let i = 0;
  let plainBuffer = "";
  let keyCounter = 0;

  while (i < content.length) {
    const char = content[i];
    if (char === "#" || char === "$") {
      const rest = content.slice(i + 1);
      let matched: TaskDTO | null = null;
      const targetType = char === "#" ? "task" : "event";

      // Filter tasks based on type associated with the symbol
      const potentialMatches = allTasks
        .filter(t => t.type === targetType)
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
                ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
            )}
          >
            {isEvent ? <DollarSign className="h-3 w-3 shrink-0" /> : <Hash className="h-3 w-3 shrink-0" />}
            {task.title}
          </button>
        );

        i += 1 + matched.title.length;
      } else {
        plainBuffer += char;
        i++;
      }
    } else {
      plainBuffer += char;
      i++;
    }
  }

  if (plainBuffer) {
    segments.push(<span key={`plain-${keyCounter++}`}>{plainBuffer}</span>);
  }

  return <>{segments}</>;
}

import { cn } from "@/lib/utils";

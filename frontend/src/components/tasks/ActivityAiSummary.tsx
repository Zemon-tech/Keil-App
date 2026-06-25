import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Comment } from "@/types/task";
import type { TaskDTO } from "@/hooks/api/useTasks";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5001/api").replace(/\/$/, "");
const CHAT_API = API_BASE.replace(/\/api\/?$/, "") + "/chat";

type ModelSelection = "gemini" | "github" | "github-models" | "openrouter" | "local";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

function getModelPayload(modelSelection: ModelSelection) {
  return {
    modelSelection,
    ...(modelSelection === "local" && {
      localAiBaseUrl: localStorage.getItem("local_ai_base_url") || "http://localhost:8080/v1",
      localAiModel: localStorage.getItem("local_ai_model") || "gemma-4",
    }),
    ...(modelSelection === "openrouter" && {
      openRouterModel: localStorage.getItem("openrouter_model") || "openai/gpt-4o-mini",
    }),
  };
}

function buildPrompt(task: TaskDTO, comments: Comment[], existingSummary: string | null): string {
  const commentLines = comments
    .flatMap((c) => {
      const lines: string[] = [];
      const author = c.user?.name || c.user?.email || "Unknown";
      lines.push(`- [${author}]: ${c.content}`);
      if (c.replies?.length) {
        c.replies.forEach((r) => {
          const rAuthor = r.user?.name || r.user?.email || "Unknown";
          lines.push(`  ↳ [${rAuthor}]: ${r.content}`);
        });
      }
      return lines;
    })
    .join("\n");

  if (!existingSummary) {
    return `You are a concise activity summarizer for a task management tool called KeilHQ.

Task: "${task.title}"
Status: ${task.status} | Priority: ${task.priority}
${task.description ? `Description: ${task.description}` : ""}
${task.objective ? `Objective: ${task.objective}` : ""}

Activity comments:
${commentLines || "(no comments yet)"}

Write a brief, factual summary of the key updates and decisions from this activity thread. Use plain prose, 2-4 sentences max. Focus on progress, blockers, decisions, and next steps. Be neutral and objective. Do not use bullet points. Do not start with "Summary:" or any header.`;
  }

  return `You are a concise activity summarizer for a task management tool called KeilHQ.

Task: "${task.title}"

Here is the EXISTING summary (do NOT repeat these facts):
"""
${existingSummary}
"""

New activity since the last summary:
${commentLines}

Write ONLY the new information from the new activity that is NOT already in the existing summary. This will be appended to the existing summary. 1-2 sentences max. Factual and terse. If there is nothing meaningfully new, respond with exactly the token: [NO_UPDATE]`;
}

/**
 * Parses a single line from the AI SDK v6 UIMessage stream.
 * Protocol:
 *   f:{...}          — message start (ignore)
 *   0:"text chunk"   — text delta (JSON-encoded string after "0:")
 *   e:{...}          — step finish (ignore)
 *   d:{...}          — stream finish (ignore)
 *   2:[...]          — data parts (ignore for text extraction)
 */
function parseStreamLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith("0:")) return "";
  try {
    const json = JSON.parse(trimmed.slice(2));
    if (typeof json === "string") return json;
  } catch {
    // not a valid text delta line
  }
  return "";
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActivityAiSummaryProps {
  task: TaskDTO;
  comments: Comment[];
}

export function ActivityAiSummary({ task, comments }: ActivityAiSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Total comment count including replies — used to detect new activity
  const totalCommentCount = comments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length ?? 0),
    0
  );

  // Track what count was last summarised so we know when to show "new activity"
  const lastSummarisedCountRef = useRef(0);
  const summaryRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSummary = useCallback(
    async (isUpdate: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStreaming(true);
      setError(null);
      setHasNewActivity(false);

      const modelSelection =
        (localStorage.getItem("ai_model_selection") as ModelSelection) || "gemini";
      const token = await getAuthToken();
      const prompt = buildPrompt(task, comments, isUpdate ? summaryRef.current : null);

      try {
        const response = await fetch(CHAT_API, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            messages: [
              {
                id: crypto.randomUUID(),
                role: "user",
                content: prompt,
              },
            ],
            // Use a unique ephemeral thread — we don't want this polluting the user's chat history
            memory: { thread: `summary-${task.id}-${Date.now()}`, resource: "summary" },
            ...getModelPayload(modelSelection),
          }),
        });

        if (!response.ok) {
          throw new Error(`AI request failed (${response.status}): ${response.statusText}`);
        }
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep potentially-incomplete last line in buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const text = parseStreamLine(line);
            if (!text) continue;
            accumulated += text;

            // Live-update while streaming
            if (isUpdate) {
              const trimmed = accumulated.trim();
              if (trimmed && trimmed !== "[NO_UPDATE]") {
                const base = summaryRef.current ?? "";
                setSummary(base + (base ? " " : "") + trimmed);
              }
            } else {
              setSummary(accumulated);
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const text = parseStreamLine(buffer);
          if (text) accumulated += text;
        }

        const final = accumulated.trim();

        if (isUpdate) {
          if (final && final !== "[NO_UPDATE]") {
            const base = summaryRef.current ?? "";
            const merged = base + (base ? " " : "") + final;
            summaryRef.current = merged;
            setSummary(merged);
          } else {
            // Nothing new — restore existing summary cleanly
            setSummary(summaryRef.current);
          }
        } else {
          summaryRef.current = final;
          setSummary(final);
        }

        lastSummarisedCountRef.current = totalCommentCount;
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        const msg = (err as Error)?.message ?? "Unknown error";
        setError(`Failed to generate summary. ${msg}`);
        console.error("[ActivityAiSummary]", err);
        // On error during update, restore previous summary
        if (isUpdate) setSummary(summaryRef.current);
      } finally {
        setStreaming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task, comments, totalCommentCount]
  );

  // Generate initial summary once we have at least one comment
  useEffect(() => {
    if (comments.length > 0 && summary === null && !streaming) {
      runSummary(false);
    }
  }, [comments.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect new activity after initial summary exists
  useEffect(() => {
    if (
      summary !== null &&
      !streaming &&
      totalCommentCount > lastSummarisedCountRef.current &&
      lastSummarisedCountRef.current > 0
    ) {
      setHasNewActivity(true);
    }
  }, [totalCommentCount, summary, streaming]);

  // Nothing to show until there are comments
  if (comments.length === 0 && !streaming) return null;

  return (
    <div
      className={cn(
        "mx-8 mb-5 rounded-xl border transition-all duration-300",
        "bg-gradient-to-br from-violet-500/[0.04] via-background to-indigo-500/[0.04]",
        "border-violet-500/15 dark:border-violet-400/10",
        hasNewActivity && "border-violet-500/35 dark:border-violet-400/25 shadow-sm shadow-violet-500/5"
      )}
    >
      {/* ── Header row ── */}
      <button
        onClick={() => setCollapsed((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left group select-none"
      >
        {/* Icon */}
        <div className="flex items-center justify-center size-5 rounded-md bg-violet-500/12 shrink-0">
          <Sparkles className="size-3 text-violet-500 dark:text-violet-400" />
        </div>

        {/* Label */}
        <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 flex-1">
          AI Summary
        </span>

        {/* New activity badge */}
        {hasNewActivity && !streaming && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
            <span className="size-1.5 rounded-full bg-violet-500 animate-pulse" />
            New activity
          </span>
        )}

        {/* Streaming spinner */}
        {streaming && (
          <Loader2 className="size-3 text-violet-400 animate-spin shrink-0" />
        )}

        {/* Update button — visible when there's new activity */}
        {hasNewActivity && !streaming && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              runSummary(true);
            }}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 transition-colors border border-violet-500/20 ml-1"
            title="Update summary with new activity"
          >
            <RefreshCw className="size-3" />
            Update
          </button>
        )}

        {/* Regenerate — hover-only, no new activity */}
        {!hasNewActivity && !streaming && summary && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              summaryRef.current = null;
              lastSummarisedCountRef.current = 0;
              setSummary(null);
              runSummary(false);
            }}
            title="Regenerate summary"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-violet-500/10 text-violet-400 ml-1"
          >
            <RefreshCw className="size-3" />
          </button>
        )}

        {/* Collapse chevron */}
        {collapsed ? (
          <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronUp className="size-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* ── Body ── */}
      {!collapsed && (
        <div className="px-4 pb-4">
          {error ? (
            <p className="text-xs text-destructive/80 leading-relaxed">{error}</p>
          ) : streaming && !summary ? (
            // Skeleton while first-load streams in
            <div className="space-y-2">
              <div className="h-2.5 w-full rounded-full bg-violet-500/8 animate-pulse" />
              <div className="h-2.5 w-[85%] rounded-full bg-violet-500/8 animate-pulse" style={{ animationDelay: "0.15s" }} />
              <div className="h-2.5 w-[60%] rounded-full bg-violet-500/6 animate-pulse" style={{ animationDelay: "0.3s" }} />
            </div>
          ) : (
            <p
              className={cn(
                "text-sm leading-relaxed text-foreground/80",
                // Blinking cursor while streaming
                streaming && "after:content-['▋'] after:ml-0.5 after:text-violet-400 after:animate-pulse"
              )}
            >
              {summary}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
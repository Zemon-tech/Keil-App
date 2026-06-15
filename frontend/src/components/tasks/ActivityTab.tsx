import { useState, useRef, useEffect, useCallback } from "react";
import {
  AtSign,
  Hash,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  Send,
  Smile,
  Trash2,
  X,
  DollarSign,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { TaskDTO } from "@/hooks/api/useTasks";
import { useOrgTasks } from "@/hooks/api/useTasks";
import { useSpaceMembers } from "@/hooks/api/useSpaces";
import { useAppContext } from "@/contexts/AppContext";
import { useOrgTaskComments, useCreateOrgComment, useDeleteOrgComment } from "@/hooks/api/useComments";
import type { Comment } from "@/types/task";
import { useAuth } from "@/contexts/AuthContext";
import { useTaskPermissions } from "@/hooks/useTaskPermissions";

import { formatRelTime } from "./task-detail-shared";
import { TaskPreviewDialog } from "./TaskPreviewDialog";
import { renderMessageContent, type MentionMember } from "./renderMessageContent";

// ─── Types ────────────────────────────────────────────────────────────────────

type PickerType = "user" | "task" | "event";

interface MentionState {
  /** Which picker is active, or null if none */
  type: PickerType | null;
  /** Index in `input` where the trigger symbol (@, #, $) was typed */
  triggerIndex: number;
  /** Text the user has typed after the trigger — used to filter results */
  query: string;
  /** Which result item is keyboard-highlighted */
  highlightedIndex: number;
}

const MENTION_TRIGGERS: Record<string, PickerType> = {
  "@": "user",
  "#": "task",
  $: "event",
};

// ─── CommentNode ──────────────────────────────────────────────────────────────

function CommentNode({
  comment,
  taskId,
  allTasks,
  onTaskClick,
  orgId,
  spaceId,
  task,
  members,
}: {
  comment: Comment;
  taskId: string;
  allTasks: TaskDTO[];
  onTaskClick: (taskId: string) => void;
  orgId: string | null;
  spaceId: string | null;
  task: TaskDTO;
  members: MentionMember[];
}) {
  const authorName = comment.user?.name || comment.user?.email || "Unknown";
  const [isReplying, setIsReplying] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const createComment = useCreateOrgComment(orgId, spaceId);
  const deleteComment = useDeleteOrgComment(orgId, spaceId);
  const { user } = useAuth();
  const { canComment, canDeleteOwnComment, canDeleteAnyComment } = useTaskPermissions(task);

  // Close reply box when clicking outside it.
  // We defer adding the listener by one frame so the mousedown that
  // triggered setIsReplying(true) doesn't immediately close the box.
  const replyBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isReplying) return;
    let rafId: number;
    let cleanup: (() => void) | undefined;

    rafId = requestAnimationFrame(() => {
      const handleMouseDown = (e: MouseEvent) => {
        if (replyBoxRef.current && !replyBoxRef.current.contains(e.target as Node)) {
          setIsReplying(false);
          setReplyInput("");
        }
      };
      document.addEventListener("mousedown", handleMouseDown);
      cleanup = () => document.removeEventListener("mousedown", handleMouseDown);
    });

    return () => {
      cancelAnimationFrame(rafId);
      cleanup?.();
    };
  }, [isReplying]);

  const handleReplySubmit = () => {
    if (!replyInput.trim()) return;
    createComment.mutate(
      { taskId, content: replyInput.trim(), parent_comment_id: comment.id },
      {
        onSuccess: () => {
          setReplyInput("");
          setIsReplying(false);
        }
      }
    );
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      deleteComment.mutate({ commentId: comment.id, taskId });
    }
  };

  return (
    <div className="group relative flex items-start gap-2.5 px-4 py-1 hover:bg-black/5 dark:hover:bg-accent/40 transition-colors -mx-4 rounded-md">
      {/* Author Avatar — small, like WhatsApp */}
      <Avatar className="size-6 shrink-0 rounded-full mt-0.5">
        <AvatarImage src={getOptimizedImageUrl(comment.user?.avatar_url || comment.user?.avatarUrl, { width: 48, height: 48 })} alt={authorName} />
        <AvatarFallback className="text-[10px] font-semibold bg-indigo-500 text-white">
          {authorName.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Author Name & Time — compact, inline */}
        <div className="flex items-baseline gap-1.5 leading-none mb-0.5">
          <span className="text-xs font-semibold text-foreground">
            {authorName}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatRelTime(comment.created_at)}
          </span>
        </div>

        {/* Message Content */}
        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {renderMessageContent(comment.content, allTasks, onTaskClick, members)}
        </p>

        {/* Floating Action Menu */}
        {(canComment || (user?.id === comment.user_id && canDeleteOwnComment) || canDeleteAnyComment) && (
          <div className="absolute right-4 -top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border shadow-sm rounded-md flex items-center overflow-hidden z-10">
            {canComment && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
                title="Reply"
              >
                <span className="text-xs font-semibold px-2">Reply</span>
              </button>
            )}

            {((user?.id === comment.user_id && canDeleteOwnComment) || canDeleteAnyComment) && (
              <button
                onClick={handleDelete}
                disabled={deleteComment.isPending}
                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center disabled:opacity-50"
                title="Delete message"
              >
                {deleteComment.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Reply Box Toggle */}
        {isReplying && canComment && (
          <div ref={replyBoxRef} className="mt-2 flex items-center gap-2 max-w-2xl bg-muted/50 p-1 rounded-md border border-border/40 focus-within:border-border/80">
            <Input
              autoFocus
              placeholder="Write a reply..."
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleReplySubmit()}
              className="h-8 flex-1 text-sm bg-transparent border-none shadow-none focus-visible:ring-0"
            />
            <Button
              size="sm"
              className="h-7 shrink-0 px-3 text-xs rounded"
              onClick={handleReplySubmit}
              disabled={createComment.isPending || !replyInput.trim()}
            >
              {createComment.isPending ? <Loader2 className="size-3 animate-spin" /> : "Post"}
            </Button>
          </div>
        )}

        {/* Nested Replies tree — Reddit-style collapsible */}
        {(comment.replies?.length ?? 0) > 0 && (
          <div className="mt-1.5 ml-1">
            {repliesExpanded ? (
              <div className="relative">
                {/* Clickable collapse line */}
                <button
                  onClick={() => setRepliesExpanded(false)}
                  className="absolute left-0 top-0 bottom-0 w-4 flex items-stretch group/line z-10"
                  title="Collapse replies"
                >
                  <span className="mx-auto w-0.5 bg-border group-hover/line:bg-primary transition-colors rounded-full" />
                </button>
                {/* Replies */}
                <div className="pl-4 space-y-0">
                  {comment.replies.map((reply) => (
                    <CommentNode key={reply.id} comment={reply} taskId={taskId} allTasks={allTasks} onTaskClick={onTaskClick} orgId={orgId} spaceId={spaceId} task={task} members={members} />
                  ))}
                </div>
              </div>
            ) : (
              /* Collapsed state — show "N replies" button */
              <button
                onClick={() => setRepliesExpanded(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-0.5"
              >
                <span className="inline-flex items-center justify-center size-4 rounded-full border border-border text-[10px]">+</span>
                {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ActivityTab ──────────────────────────────────────────────────────────────

export function ActivityTab({ task }: { task: TaskDTO }) {
  const [input, setInput] = useState("");
  const { activeOrgId, activeSpaceId } = useAppContext();
  const taskOrgId = task.org_id ?? activeOrgId;
  const taskSpaceId = task.space_id ?? activeSpaceId;

  const { data: comments, isPending } = useOrgTaskComments(taskOrgId, taskSpaceId, task.id);
  const createComment = useCreateOrgComment(taskOrgId, taskSpaceId);
  const { canComment } = useTaskPermissions(task);

  // ── Inline mention state ──
  // We detect @query / #query / $query directly from the caret position in the
  // main input. No separate popup input — the user keeps typing in the same field.
  const [mention, setMention] = useState<MentionState>({
    type: null,
    triggerIndex: -1,
    query: "",
    highlightedIndex: 0,
  });

  const mainInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const { data: members = [] } = useSpaceMembers(taskOrgId, taskSpaceId);
  const { data: allTasks = [] } = useOrgTasks(taskOrgId, taskSpaceId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Task preview dialog state ──
  const [previewTaskId, setPreviewTaskId] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleTaskClick = (taskId: string) => {
    setPreviewTaskId(taskId);
    setPreviewOpen(true);
  };

  // ── Filtered lists for the inline picker ──
  const filteredMembers = (members || []).filter((m) =>
    (m.name || m.email).toLowerCase().includes(mention.query.toLowerCase())
  );

  const filteredTasks = allTasks.filter(
    (t) =>
      t.type === "task" &&
      t.id !== task.id &&
      t.title.toLowerCase().includes(mention.query.toLowerCase())
  );

  const filteredEvents = allTasks.filter(
    (t) =>
      t.type === "event" &&
      t.id !== task.id &&
      t.title.toLowerCase().includes(mention.query.toLowerCase())
  );

  const activeResults =
    mention.type === "user"
      ? filteredMembers
      : mention.type === "task"
      ? filteredTasks
      : filteredEvents;

  // ── Detect mention triggers as the user types ──
  // Scans backwards from the caret to find the nearest unescaped trigger char.
  const detectMentionFromInput = useCallback(
    (value: string, caretPos: number) => {
      // Walk backwards from caret to find a trigger character
      for (let i = caretPos - 1; i >= 0; i--) {
        const ch = value[i];
        if (ch in MENTION_TRIGGERS) {
          // Make sure there is no whitespace between trigger and caret
          // (i.e. the user hasn't moved past the word)
          const between = value.slice(i + 1, caretPos);
          if (!between.includes(" ") && !between.includes("\n")) {
            setMention({
              type: MENTION_TRIGGERS[ch],
              triggerIndex: i,
              query: between,
              highlightedIndex: 0,
            });
            return;
          }
          // Found a trigger but it's separated by whitespace — stop
          break;
        }
        // If we hit whitespace before finding a trigger, stop
        if (ch === " " || ch === "\n") break;
      }
      // No active mention
      setMention({ type: null, triggerIndex: -1, query: "", highlightedIndex: 0 });
    },
    []
  );

  const closePicker = useCallback(() => {
    setMention({ type: null, triggerIndex: -1, query: "", highlightedIndex: 0 });
  }, []);

  // ── Handle changes in the main input ──
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    const caretPos = e.target.selectionStart ?? value.length;
    detectMentionFromInput(value, caretPos);
  };

  // Re-run detection when caret moves (click / arrow keys move position)
  const handleInputSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement;
    detectMentionFromInput(target.value, target.selectionStart ?? target.value.length);
  };

  // ── Insert selected mention into the input ──
  const handleInsertMention = useCallback(
    (symbol: string, label: string) => {
      if (mention.triggerIndex === -1) return;

      const before = input.slice(0, mention.triggerIndex); // text before the trigger
      const after = input.slice(
        mention.triggerIndex + 1 + mention.query.length // skip trigger + typed query
      );
      const inserted = `${symbol}${label} `;
      const newValue = before + inserted + after;
      setInput(newValue);

      // Place caret right after the inserted mention
      const newCaretPos = before.length + inserted.length;
      requestAnimationFrame(() => {
        if (mainInputRef.current) {
          mainInputRef.current.focus();
          mainInputRef.current.setSelectionRange(newCaretPos, newCaretPos);
        }
      });

      closePicker();
    },
    [input, mention, closePicker]
  );

  // ── Keyboard navigation in the picker ──
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mention.type) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((prev) => ({
          ...prev,
          highlightedIndex: Math.min(prev.highlightedIndex + 1, activeResults.length - 1),
        }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMention((prev) => ({
          ...prev,
          highlightedIndex: Math.max(prev.highlightedIndex - 1, 0),
        }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const item = activeResults[mention.highlightedIndex];
        if (item) {
          const triggerSymbol = Object.keys(MENTION_TRIGGERS).find(
            (k) => MENTION_TRIGGERS[k] === mention.type
          )!;
          const label =
            mention.type === "user"
              ? (item as (typeof members)[number]).name ||
                (item as (typeof members)[number]).email
              : (item as TaskDTO).title;
          handleInsertMention(triggerSymbol, label);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closePicker();
        return;
      }
    }

    // Normal send shortcut
    if (e.key === "Enter" && !e.shiftKey && !mention.type && canComment) {
      handleSend();
    }
  };

  // ── Close picker when clicking outside ──
  useEffect(() => {
    if (!mention.type) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        mainInputRef.current &&
        !mainInputRef.current.contains(e.target as Node)
      ) {
        closePicker();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mention.type, closePicker]);

  // ── Open picker from the + dropdown (without losing main-input focus) ──
  const openPickerFromMenu = (type: PickerType) => {
    // Append the trigger symbol to the input and activate the picker
    const triggerSymbol = Object.keys(MENTION_TRIGGERS).find(
      (k) => MENTION_TRIGGERS[k] === type
    )!;
    const newValue = input + triggerSymbol;
    setInput(newValue);
    setMention({
      type,
      triggerIndex: newValue.length - 1,
      query: "",
      highlightedIndex: 0,
    });
    requestAnimationFrame(() => mainInputRef.current?.focus());
  };

  const handleSend = () => {
    if (!input.trim()) return;
    createComment.mutate(
      { taskId: task.id, content: input.trim() },
      { onSuccess: () => setInput("") }
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInput((prev) => prev + `[Attachment: ${file.name}] `);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Picker label helpers ──
  const pickerLabel =
    mention.type === "user" ? "people" : mention.type === "event" ? "events" : "tasks";

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background h-full relative">
      {/* Task/event preview dialog — opened when a #task-name chip is clicked */}
      <TaskPreviewDialog
        taskId={previewTaskId}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
      <ScrollArea className="flex-1 min-h-0">
        <div className="w-full px-8 py-6 flex flex-col min-h-full justify-end max-w-5xl mx-auto">
          {isPending ? (
            <div className="flex justify-center py-8 my-auto">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (comments ?? []).length > 0 ? (
            <div className="space-y-0.5 mt-auto">
              {(comments ?? []).map((comment) => (
                <CommentNode key={comment.id} comment={comment} taskId={task.id} allTasks={allTasks} onTaskClick={handleTaskClick} orgId={taskOrgId} spaceId={taskSpaceId} task={task} members={members} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center my-auto py-12 text-center">
              <div className="size-16 bg-accent rounded-full mb-4 flex items-center justify-center">
                <MessageSquare className="size-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">Welcome to the conversation</h3>
              <p className="mt-1 text-sm text-muted-foreground">This is the start of the activity history for this task.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ── Inline mention picker — sits above the input bar ── */}
      {mention.type && (
        <div
          ref={pickerRef}
          className="absolute bottom-[80px] left-8 w-72 flex flex-col bg-popover text-popover-foreground rounded-lg border shadow-lg z-50 overflow-hidden"
        >
          {/* Header: shows what we're filtering + a dismiss button */}
          <div className="px-3 py-2 border-b bg-muted/50 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {mention.query
                ? `Searching ${pickerLabel} for "${mention.query}"`
                : `Matching ${pickerLabel}…`}
            </span>
            <button
              onMouseDown={(e) => {
                // Use mousedown + preventDefault so the main input doesn't blur
                e.preventDefault();
                closePicker();
              }}
              className="p-1 hover:bg-muted rounded-md text-muted-foreground"
              aria-label="Close picker"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <ScrollArea className="max-h-60 overflow-y-auto">
            {mention.type === "user" ? (
              <div className="p-1.5 space-y-0.5">
                {filteredMembers.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground text-center">No people found</p>
                ) : (
                  filteredMembers.map((m, idx) => {
                    const name = m.name || m.email;
                    return (
                      <button
                        key={m.user_id}
                        // mousedown prevents blur on main input; click handles selection
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleInsertMention("@", name)}
                        className={`w-full flex items-center gap-2 p-1.5 rounded-md text-left transition-colors ${
                          idx === mention.highlightedIndex
                            ? "bg-accent"
                            : "hover:bg-accent"
                        }`}
                      >
                        <Avatar className="size-6">
                          <AvatarImage src={getOptimizedImageUrl(m.avatar_url || m.avatarUrl, { width: 48, height: 48 })} alt={name} />
                          <AvatarFallback className="text-[10px] bg-indigo-500/10 text-indigo-500 font-semibold">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate font-medium">{name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : mention.type === "task" ? (
              <div className="p-1.5 space-y-0.5">
                {filteredTasks.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground text-center">No tasks found</p>
                ) : (
                  filteredTasks.map((t, idx) => (
                    <button
                      key={t.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleInsertMention("#", t.title)}
                      className={`w-full flex items-center gap-2 p-1.5 rounded-md text-left transition-colors ${
                        idx === mention.highlightedIndex ? "bg-accent" : "hover:bg-accent"
                      }`}
                    >
                      <Hash className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate font-medium flex-1">{t.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono hidden sm:inline-block">
                        {t.id.slice(0, 8)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {filteredEvents.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground text-center">No events found</p>
                ) : (
                  filteredEvents.map((t, idx) => (
                    <button
                      key={t.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleInsertMention("$", t.title)}
                      className={`w-full flex items-center gap-2 p-1.5 rounded-md text-left transition-colors ${
                        idx === mention.highlightedIndex ? "bg-accent" : "hover:bg-accent"
                      }`}
                    >
                      <DollarSign className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate font-medium flex-1">{t.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono hidden sm:inline-block">
                        {t.id.slice(0, 8)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        multiple
      />

      {/* Sticky comment input - WhatsApp Style */}
      <div className="shrink-0 px-6 pb-6 pt-2">
        {/* Active mention chip preview — shown while the user is mid-mention */}
        {mention.type && (
          <div className="mb-1.5 flex items-center gap-1.5 px-1 max-w-5xl mx-auto">
            <span className="text-[11px] text-muted-foreground">Mentioning:</span>
            <span
              className={[
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold border",
                mention.type === "user"
                  ? "bg-primary/8 text-primary border-primary/25 dark:bg-primary/15 dark:border-primary/35"
                  : mention.type === "task"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
                  : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/25",
              ].join(" ")}
            >
              {mention.type === "user" ? (
                <AtSign className="size-3 shrink-0 opacity-70" />
              ) : mention.type === "task" ? (
                <Hash className="size-3 shrink-0 opacity-70" />
              ) : (
                <DollarSign className="size-3 shrink-0 opacity-70" />
              )}
              {mention.query || <span className="opacity-50 italic">type to search…</span>}
            </span>
            <span className="text-[11px] text-muted-foreground">
              ↑↓ navigate · Enter select · Esc cancel
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 w-full max-w-5xl mx-auto bg-background rounded-full px-4 py-2.5 border border-border focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all shadow-sm">
          {canComment && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0 rounded-full size-8 ml-0.5 outline-none">
                  <Plus className="h-[22px] w-[22px] text-foreground/70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-64 p-2 mb-2 rounded-xl border border-border shadow-md">
                <DropdownMenuItem
                  onClick={() => openPickerFromMenu("user")}
                  className="gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-accent focus:bg-accent"
                >
                  <div className="flex items-center justify-center size-8 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
                    <AtSign className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Mention someone</span>
                    <span className="text-xs text-muted-foreground">Notify a team member</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openPickerFromMenu("task")}
                  className="gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-accent focus:bg-accent"
                >
                  <div className="flex items-center justify-center size-8 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                    <Hash className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Mention task</span>
                    <span className="text-xs text-muted-foreground">Reference a task name</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openPickerFromMenu("event")}
                  className="gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-accent focus:bg-accent"
                >
                  <div className="flex items-center justify-center size-8 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
                    <DollarSign className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Mention event</span>
                    <span className="text-xs text-muted-foreground">Reference an event name</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="mx-2 my-1" />
                <DropdownMenuItem
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-accent focus:bg-accent"
                >
                  <div className="flex items-center justify-center size-8 rounded-full bg-violet-500/10 text-violet-500 shrink-0">
                    <Paperclip className="size-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Add files</span>
                    <span className="text-xs text-muted-foreground">Opens file picker dialog</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canComment && (
            <button className="flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0 rounded-full size-8 outline-none">
              <Smile className="size-5 text-foreground/70" />
            </button>
          )}

          <Input
            ref={mainInputRef}
            placeholder={canComment ? "Type a message" : "You don't have permission to comment in this space"}
            value={input}
            onChange={handleInputChange}
            onSelect={handleInputSelect}
            disabled={!canComment}
            onKeyDown={handleKeyDown}
            className="h-9 text-[15px] border-none shadow-none bg-transparent focus-visible:ring-0 px-1 py-0 text-foreground placeholder:text-muted-foreground"
          />

          <div className="flex shrink-0 pr-1">
            {canComment && (input.trim() || createComment.isPending) ? (
              <Button
                size="sm"
                variant="ghost"
                className="size-8 p-0 text-primary hover:bg-primary/10 hover:text-primary font-semibold rounded-full flex items-center justify-center"
                onClick={handleSend}
                disabled={createComment.isPending}
              >
                {createComment.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
              </Button>
            ) : canComment ? (
              <button className="flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0 rounded-full size-8 outline-none text-foreground/70">
                <Mic className="h-[22px] w-[22px]" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

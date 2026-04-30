import { useState, useRef, useEffect } from "react";
import {
  AtSign,
  Hash,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  Search,
  Send,
  Smile,
  Trash2,
  X,
  DollarSign,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useTasks } from "@/hooks/api/useTasks";
import { useWorkspaceMembers } from "@/hooks/api/useWorkspace";
import { useTaskComments, useCreateComment, useDeleteComment } from "@/hooks/api/useComments";
import type { Comment } from "@/types/task";
import { useAuth } from "@/contexts/AuthContext";

import { formatRelTime } from "./task-detail-shared";
import { TaskPreviewDialog } from "./TaskPreviewDialog";
import { EventPreviewDialog } from "./EventPreviewDialog";
import { renderMessageContent } from "./renderMessageContent";

// ─── CommentNode ──────────────────────────────────────────────────────────────

function CommentNode({
  comment,
  taskId,
  allTasks,
  onTaskClick,
}: {
  comment: Comment;
  taskId: string;
  allTasks: TaskDTO[];
  onTaskClick: (taskId: string) => void;
}) {
  const authorName = comment.user?.name || comment.user?.email || "Unknown";
  const [isReplying, setIsReplying] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();
  const { user } = useAuth();

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
      <Avatar className="h-6 w-6 shrink-0 rounded-full mt-0.5">
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
          {renderMessageContent(comment.content, allTasks, onTaskClick)}
        </p>

        {/* Floating Action Menu */}
        <div className="absolute right-4 -top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border shadow-sm rounded-md flex items-center overflow-hidden z-10">
          <button
            onClick={() => setIsReplying(!isReplying)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
            title="Reply"
          >
            <span className="text-xs font-semibold px-2">Reply</span>
          </button>

          {user?.id === comment.user_id && (
            <button
              onClick={handleDelete}
              disabled={deleteComment.isPending}
              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center disabled:opacity-50"
              title="Delete message"
            >
              {deleteComment.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Reply Box Toggle */}
        {isReplying && (
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
              {createComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Post"}
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
                    <CommentNode key={reply.id} comment={reply} taskId={taskId} allTasks={allTasks} onTaskClick={onTaskClick} />
                  ))}
                </div>
              </div>
            ) : (
              /* Collapsed state — show "N replies" button */
              <button
                onClick={() => setRepliesExpanded(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-0.5"
              >
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full border border-border text-[10px]">+</span>
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
  const { data: comments, isPending } = useTaskComments(task.id);
  const createComment = useCreateComment();

  const [activePicker, setActivePicker] = useState<"user" | "task" | "event" | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const { data: members } = useWorkspaceMembers(task.workspace_id);
  const { data: allTasks = [] } = useTasks();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-trigger picker on special characters
  useEffect(() => {
    const lastChar = input.slice(-1);
    if (lastChar === "@") {
      setActivePicker("user");
      setPickerSearch("");
    } else if (lastChar === "#") {
      setActivePicker("task");
      setPickerSearch("");
    } else if (lastChar === "$") {
      setActivePicker("event");
      setPickerSearch("");
    }
  }, [input]);

  // ── Task preview dialog state ──
  const [previewTaskId, setPreviewTaskId] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleTaskClick = (taskId: string) => {
    setPreviewTaskId(taskId);
    setPreviewOpen(true);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    createComment.mutate(
      { taskId: task.id, content: input.trim() },
      { onSuccess: () => setInput("") }
    );
  };

  const handleInsertMention = (symbol: string, text: string) => {
    setInput((prev) => {
      const trimmed = prev.trim();
      if (trimmed.endsWith(symbol)) {
        return trimmed + text + " ";
      }
      // If we're midway through a search (e.g. "#te"), this simple logic will append.
      // A full solution would use cursor position/regex replacement, but this matches
      // the existing manual trigger behavior while supporting the new symbols.
      return (trimmed ? trimmed + " " : "") + symbol + text + " ";
    });
    setActivePicker(null);
    setPickerSearch("");
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setInput((prev) => prev + `[Attachment: ${file.name}] `);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filteredMembers = (members || []).filter(m =>
    (m.user.name || m.user.email).toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const filteredTasks = allTasks.filter(t =>
    t.type === "task" && t.id !== task.id && t.title.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  const filteredEvents = allTasks.filter(t =>
    t.type === "event" && t.id !== task.id && t.title.toLowerCase().includes(pickerSearch.toLowerCase())
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background h-full relative">
      {/* Task preview dialog — opened when a #task-name chip is clicked */}
      {allTasks.find(t => t.id === previewTaskId)?.type === "event" ? (
        <EventPreviewDialog
          eventId={previewTaskId}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      ) : (
        <TaskPreviewDialog
          taskId={previewTaskId}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
      <ScrollArea className="flex-1 min-h-0">
        <div className="w-full px-8 py-6 flex flex-col min-h-full justify-end max-w-5xl mx-auto">
          {isPending ? (
            <div className="flex justify-center py-8 my-auto">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (comments ?? []).length > 0 ? (
            <div className="space-y-0.5 mt-auto">
              {(comments ?? []).map((comment) => (
                <CommentNode key={comment.id} comment={comment} taskId={task.id} allTasks={allTasks} onTaskClick={handleTaskClick} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center my-auto py-12 text-center">
              <div className="h-16 w-16 bg-accent rounded-full mb-4 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg text-foreground">Welcome to the conversation</h3>
              <p className="mt-1 text-sm text-muted-foreground">This is the start of the activity history for this task.</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Picker overlay above the input */}
      {activePicker && (
        <div className="absolute bottom-[80px] left-8 w-72 flex flex-col bg-popover text-popover-foreground rounded-lg border shadow-lg z-50 overflow-hidden">
          <div className="p-2 border-b flex items-center gap-2 bg-muted/50">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              autoFocus
              placeholder={`Search ${activePicker === 'user' ? 'people' : activePicker === 'event' ? 'events' : 'tasks'}...`}
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="h-7 text-sm border-none shadow-none focus-visible:ring-0 p-0 bg-transparent flex-1"
            />
            <button onClick={() => setActivePicker(null)} className="p-1 hover:bg-muted rounded-md text-muted-foreground shrink-0">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <ScrollArea className="max-h-60 overflow-y-auto">
            {activePicker === 'user' ? (
              <div className="p-1.5 space-y-0.5">
                {filteredMembers.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground text-center">No people found</p>
                ) : (
                  filteredMembers.map(m => {
                    const name = m.user.name || m.user.email;
                    return (
                      <button
                        key={m.id}
                        onClick={() => handleInsertMention("@", name)}
                        className="w-full flex items-center gap-2 p-1.5 hover:bg-accent rounded-md text-left transition-colors"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px] bg-indigo-500/10 text-indigo-500 font-semibold">{name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate font-medium">{name}</span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : activePicker === 'task' ? (
              <div className="p-1.5 space-y-0.5">
                {filteredTasks.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground text-center">No tasks found</p>
                ) : (
                  filteredTasks.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleInsertMention("#", t.title)}
                      className="w-full flex items-center gap-2 p-1.5 hover:bg-accent rounded-md text-left transition-colors"
                    >
                      <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate font-medium flex-1">{t.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono hidden sm:inline-block">{t.id.slice(0, 8)}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <div className="p-1.5 space-y-0.5">
                {filteredEvents.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground text-center">No events found</p>
                ) : (
                  filteredEvents.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleInsertMention("$", t.title)}
                      className="w-full flex items-center gap-2 p-1.5 hover:bg-accent rounded-md text-left transition-colors"
                    >
                      <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate font-medium flex-1">{t.title}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono hidden sm:inline-block">{t.id.slice(0, 8)}</span>
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
        <div className="flex items-center gap-2 w-full max-w-5xl mx-auto bg-background rounded-full px-4 py-2.5 border border-border focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all shadow-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0 rounded-full h-8 w-8 ml-0.5 outline-none">
                <Plus className="h-[22px] w-[22px] text-foreground/70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-64 p-2 mb-2 rounded-xl border border-border shadow-md">
              <DropdownMenuItem onClick={() => setActivePicker('user')} className="gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-accent focus:bg-accent">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
                  <AtSign className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Mention someone</span>
                  <span className="text-xs text-muted-foreground">Notify a team member</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActivePicker('task')} className="gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-accent focus:bg-accent">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                  <Hash className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Mention task</span>
                  <span className="text-xs text-muted-foreground">Reference a task name</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActivePicker('event')} className="gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-accent focus:bg-accent">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-500/10 text-indigo-500 shrink-0">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Mention event</span>
                  <span className="text-xs text-muted-foreground">Reference an event name</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-2 my-1" />
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-3 p-2.5 cursor-pointer rounded-lg hover:bg-accent focus:bg-accent">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-violet-500/10 text-violet-500 shrink-0">
                  <Paperclip className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Add files</span>
                  <span className="text-xs text-muted-foreground">Opens file picker dialog</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button className="flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0 rounded-full h-8 w-8 outline-none">
            <Smile className="h-5 w-5 text-foreground/70" />
          </button>

          <Input
            placeholder="Type a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !activePicker) {
                handleSend();
              }
            }}
            className="h-9 text-[15px] border-none shadow-none bg-transparent focus-visible:ring-0 px-1 py-0 text-foreground placeholder:text-muted-foreground"
          />

          <div className="flex shrink-0 pr-1">
            {input.trim() || createComment.isPending ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-primary hover:bg-primary/10 hover:text-primary font-semibold rounded-full flex items-center justify-center"
                onClick={handleSend}
                disabled={createComment.isPending}
              >
                {createComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
              </Button>
            ) : (
              <button className="flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors shrink-0 rounded-full h-8 w-8 outline-none text-foreground/70">
                <Mic className="h-[22px] w-[22px]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

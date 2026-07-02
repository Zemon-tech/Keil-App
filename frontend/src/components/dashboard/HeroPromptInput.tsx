"use client";

import { useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent, type ElementType } from "react";
import {
  ArrowRight,
  FileText,
  GlobeIcon,
  Image,
  Plus,
  SearchIcon,
  Mic,
  Brain,
  CheckSquare,
  CalendarDays,
  User,
  X,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import { getMediaCategory } from "@/components/ai-elements/attachments-utils";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputCommand,
  PromptInputCommandEmpty,
  PromptInputCommandGroup,
  PromptInputCommandInput,
  PromptInputCommandItem,
  PromptInputCommandList,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  PromptInputActionMenuItem,
} from "@/components/ai-elements/prompt-input";
import { usePromptInputAttachments } from "@/components/ai-elements/prompt-input-context";
import type { AttachmentData } from "@/components/ai-elements/attachments-utils";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import { useSpaceMembers } from "@/hooks/api/useSpaces";
import { useOrgTasks } from "@/hooks/api/useTasks";
import { useMotionPages, useSharedToSpace } from "@/hooks/api/useMotionPages";
import { preprocessMentions } from "../tasks/renderMessageContent";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import { ScrollArea } from "@/components/ui/scroll-area";

// Models are defined dynamically based on user settings

const suggestions: {
  id: string;
  label: string;
  icon: ElementType;
  description: string;
}[] = [
  {
    id: "1",
    label: "Draft an email",
    icon: FileText,
    description: "to my team about the project update",
  },
  {
    id: "2",
    label: "Explain",
    icon: SearchIcon,
    description: "quantum computing in simple terms",
  },
  {
    id: "3",
    label: "Help me write",
    icon: FileText,
    description: "a Python function for data analysis",
  },
  {
    id: "4",
    label: "Create a",
    icon: Image,
    description: "marketing strategy for a new product",
  },
];

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  const hasVisualAttachment = attachments.files.some(
    (attachment: AttachmentData) => {
      const category = getMediaCategory(attachment);
      return category === "image" || category === "video";
    },
  );

  if (!hasVisualAttachment) {
    return (
      <Attachments variant="inline" className="w-full gap-2 px-1">
        {attachments.files.map((attachment: AttachmentData) => (
          <Attachment
            key={attachment.id}
            className="h-10 rounded-full border border-border/60 bg-background/65 pr-2 shadow-sm"
            data={attachment}
            onRemove={() => attachments.remove(attachment.id)}
          >
            <AttachmentPreview className="rounded-full bg-background/80" />
            <AttachmentInfo />
            <AttachmentRemove className="size-6 opacity-100" />
          </Attachment>
        ))}
      </Attachments>
    );
  }

  return (
    <Attachments variant="grid" className="w-full gap-3 px-1">
      {attachments.files.map((attachment: AttachmentData, index: number) => (
        <Attachment
          key={attachment.id}
          className={cn(
            "overflow-hidden border border-border/60 bg-background/65 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.3)]",
            index === 0
              ? "size-28 rounded-[1.5rem] sm:size-36"
              : "size-20 rounded-[1.15rem] sm:size-24",
          )}
          data={attachment}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview className="bg-muted/30" />
          <AttachmentRemove className="bg-background/90 opacity-100 backdrop-blur-sm hover:bg-background" />
        </Attachment>
      ))}
    </Attachments>
  );
};

type PickerType = "all" | "user" | "task" | "event" | "page";

interface MentionState {
  type: PickerType | null;
  triggerIndex: number;
  query: string;
  highlightedIndex: number;
}

interface HeroPromptSurfaceProps {
  isChatStarted: boolean;
  onSuggestionClick: (suggestion: (typeof suggestions)[number]) => void;
  onStop?: () => void;
  setUseWebSearch: (value: boolean | ((prev: boolean) => boolean)) => void;
  setUseThinking: (value: boolean | ((prev: boolean) => boolean)) => void;
  showCommandMenu: boolean;
  status?: "submitted" | "streaming" | "ready" | "error";
  text: string;
  setText: (value: string) => void;
  useWebSearch: boolean;
  useThinking: boolean;
  valueChanged: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}

function HeroPromptSurface({
  isChatStarted,
  onSuggestionClick,
  onStop,
  setUseWebSearch,
  setUseThinking,
  showCommandMenu,
  status,
  text,
  setText,
  useWebSearch,
  useThinking,
  valueChanged,
}: HeroPromptSurfaceProps) {
  const attachments = usePromptInputAttachments();
  const hasAttachments = attachments.files.length > 0;
  const canSubmit = Boolean(text.trim()) || hasAttachments || useWebSearch;
  const isActive = status === "submitted" || status === "streaming";

  // --- Universal Mentions Data ---
  const { user } = useAuth();
  const userId = user?.id;
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { data: members = [] } = useSpaceMembers(activeOrgId, activeSpaceId);
  const { data: allTasks = [] } = useOrgTasks(activeOrgId, activeSpaceId);
  const { data: pages = [] } = useMotionPages(activeOrgId, activeSpaceId);
  const { data: sharedPages = [] } = useSharedToSpace(activeOrgId, activeSpaceId);

  const [mention, setMention] = useState<MentionState>({
    type: null,
    triggerIndex: -1,
    query: "",
    highlightedIndex: 0,
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const filteredMembers = useMemo(() => {
    return (members || []).filter((m: any) => {
      const name = m.name || m.email || "";
      return name.toLowerCase().includes(mention.query.toLowerCase());
    });
  }, [members, mention.query]);

  const filteredTasks = useMemo(() => {
    return allTasks
      .filter(
        (t: any) =>
          t.type === "task" &&
          t.title.toLowerCase().includes(mention.query.toLowerCase())
      )
      .sort((a: any, b: any) => {
        if (!userId) return 0;
        const aAssigned = a.assignees?.some((asg: any) => asg.id === userId);
        const bAssigned = b.assignees?.some((asg: any) => asg.id === userId);
        if (aAssigned && !bAssigned) return -1;
        if (!aAssigned && bAssigned) return 1;
        return 0;
      });
  }, [allTasks, mention.query, userId]);

  const filteredEvents = useMemo(() => {
    return allTasks.filter(
      (t: any) =>
        t.type === "event" &&
        t.title.toLowerCase().includes(mention.query.toLowerCase())
    );
  }, [allTasks, mention.query]);

  const filteredPages = useMemo(() => {
    const combined = [...pages, ...sharedPages];
    const unique = combined.reduce((acc: any[], current: any) => {
      if (!acc.some(p => p.id === current.id)) {
        acc.push(current);
      }
      return acc;
    }, []);
    return unique.filter(
      (p: any) =>
        !p.deleted_at &&
        (p.title || "Untitled").toLowerCase().includes(mention.query.toLowerCase())
    );
  }, [pages, sharedPages, mention.query]);

  const categories = useMemo(() => [
    { id: "cat-user", kind: "category" as const, type: "user" as const, title: "People", icon: <User className="size-4" /> },
    { id: "cat-task", kind: "category" as const, type: "task" as const, title: "Tasks", icon: <CheckSquare className="size-4" /> },
    { id: "cat-event", kind: "category" as const, type: "event" as const, title: "Events", icon: <CalendarDays className="size-4" /> },
    { id: "cat-page", kind: "category" as const, type: "page" as const, title: "Pages", icon: <FileText className="size-4" /> },
  ], []);

  const groupedResults = useMemo(() => {
    if (mention.type !== "all" || !mention.query) return [];
    return [
      { label: "People", items: filteredMembers.slice(0, 3).map((m: any) => ({ ...m, kind: "user" as const })) },
      { label: "Tasks", items: filteredTasks.slice(0, 3).map((t: any) => ({ ...t, kind: "task" as const })) },
      { label: "Events", items: filteredEvents.slice(0, 3).map((e: any) => ({ ...e, kind: "event" as const })) },
      { label: "Pages", items: filteredPages.slice(0, 3).map((p: any) => ({ ...p, kind: "page" as const })) },
    ].filter(g => g.items.length > 0);
  }, [mention.type, mention.query, filteredMembers, filteredTasks, filteredEvents, filteredPages]);

  const flatResults = useMemo(() => {
    if (mention.type === "all") {
      if (!mention.query) {
        return categories;
      }
      return groupedResults.flatMap(g => g.items);
    }
    if (mention.type === "user") return filteredMembers.map((m: any) => ({ ...m, kind: "user" as const }));
    if (mention.type === "task") return filteredTasks.map((t: any) => ({ ...t, kind: "task" as const }));
    if (mention.type === "event") return filteredEvents.map((e: any) => ({ ...e, kind: "event" as const }));
    if (mention.type === "page") return filteredPages.map((p: any) => ({ ...p, kind: "page" as const }));
    return [];
  }, [mention.type, mention.query, categories, groupedResults, filteredMembers, filteredTasks, filteredEvents, filteredPages]);

  const clampedIndex = useMemo(() => {
    return flatResults.length > 0
      ? Math.min(Math.max(0, mention.highlightedIndex), flatResults.length - 1)
      : 0;
  }, [flatResults.length, mention.highlightedIndex]);

  const detectMentionFromInput = useCallback(
    (value: string, caretPos: number) => {
      const MENTION_TRIGGERS: Record<string, "all" | "user" | "task" | "event" | "page"> = {
        "@": "all",
      };
      for (let i = caretPos - 1; i >= 0; i--) {
        const ch = value[i];
        if (ch in MENTION_TRIGGERS) {
          const between = value.slice(i + 1, caretPos);
          if (!between.includes(" ") && !between.includes("\n")) {
            setMention((prev) => {
              const keepType =
                prev.type && prev.type !== "all" && prev.triggerIndex === i
                  ? prev.type
                  : MENTION_TRIGGERS[ch];
              const nextHighlighted = prev.query === between ? prev.highlightedIndex : 0;
              return {
                type: keepType,
                triggerIndex: i,
                query: between,
                highlightedIndex: nextHighlighted,
              };
            });
            return;
          }
          break;
        }
        if (ch === " " || ch === "\n") break;
      }
      setMention({ type: null, triggerIndex: -1, query: "", highlightedIndex: 0 });
    },
    []
  );

  const closePicker = useCallback(() => {
    setMention({ type: null, triggerIndex: -1, query: "", highlightedIndex: 0 });
  }, []);

  useEffect(() => {
    if (!mention.type) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        closePicker();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mention.type, closePicker]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    valueChanged(e);
    const value = e.target.value;
    const caretPos = e.target.selectionStart ?? value.length;
    detectMentionFromInput(value, caretPos);
  };

  const handleInputSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    detectMentionFromInput(target.value, target.selectionStart ?? target.value.length);
  };

  const handleInsertMention = useCallback(
    (label: string, _type: string, _id: string) => {
      if (mention.triggerIndex === -1) return;

      const before = text.slice(0, mention.triggerIndex);
      const after = text.slice(mention.triggerIndex + 1 + mention.query.length);
      const inserted = `@${label} `;
      const newValue = before + inserted + after;
      
      setText(newValue);

      const newCaretPos = before.length + inserted.length;
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(newCaretPos, newCaretPos);
        }
      });

      closePicker();
    },
    [text, mention, setText, closePicker]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.type) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMention((prev) => ({
          ...prev,
          highlightedIndex: Math.min(prev.highlightedIndex + 1, flatResults.length - 1),
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
        const item = flatResults[clampedIndex];
        if (item) {
          if (item.kind === "category") {
            setMention((prev) => ({
              ...prev,
              type: item.type,
              highlightedIndex: 0,
            }));
          } else {
            const type = item.kind;
            const label = item.kind === "user"
              ? (item.name || item.email?.split('@')[0] || "")
              : (item.title || "Untitled");
            const id = item.kind === "user" ? item.user_id : item.id;
            handleInsertMention(label, type, id);
          }
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closePicker();
        return;
      }
    }
  };

  const pickerLabel =
    mention.type === "user"
      ? "people"
      : mention.type === "event"
      ? "events"
      : mention.type === "task"
      ? "tasks"
      : "pages";

  return (
    <>
      {hasAttachments && (
        <PromptInputHeader className="px-4 pt-4 pb-0 sm:px-5 sm:pt-5">
          <PromptInputAttachmentsDisplay />
        </PromptInputHeader>
      )}

      <PromptInputBody>
        <div className="relative w-full px-4 sm:px-5">
          {mention.type && (
            <div
              ref={pickerRef}
              className="absolute bottom-[calc(100%+8px)] left-4 right-4 flex flex-col bg-popover text-popover-foreground rounded-xl border shadow-2xl z-[9999] overflow-hidden font-sans border-border/70"
            >
              <div className="px-3 py-2 border-b bg-muted/50 border-border/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  {mention.type === "all" && !mention.query
                    ? "Tag everything..."
                    : mention.type === "all"
                    ? `Searching for "${mention.query}"`
                    : mention.query
                    ? `Searching ${pickerLabel} for "${mention.query}"`
                    : `Matching ${pickerLabel}…`}
                </span>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault();
                    closePicker();
                  }}
                  className="p-1 hover:bg-muted rounded-md text-muted-foreground transition-colors"
                  aria-label="Close picker"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <ScrollArea className="max-h-48 overflow-y-auto">
                {mention.type === "all" && !mention.query ? (
                  <div className="p-1.5 space-y-0.5">
                    {categories.map((cat, idx) => (
                      <button
                        key={cat.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setMention((prev) => ({
                            ...prev,
                            type: cat.type,
                            highlightedIndex: 0,
                          }));
                        }}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-colors ${
                          idx === clampedIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent/60 text-foreground"
                        }`}
                      >
                        <span className="shrink-0 size-6 rounded flex items-center justify-center bg-muted text-muted-foreground">
                          {cat.icon}
                        </span>
                        <span className="text-xs font-medium">{cat.title}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-1.5 space-y-2">
                    {flatResults.length === 0 ? (
                      <p className="py-4 text-xs text-muted-foreground text-center">No results found</p>
                    ) : mention.type === "all" ? (
                      (() => {
                        let flatIdx = 0;
                        return groupedResults.map((group) => (
                          <div key={group.label} className="space-y-0.5">
                            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                              {group.label}
                            </p>
                            {group.items.map((item: any) => {
                              const idx = flatIdx++;
                              const icon =
                                item.kind === "user" ? (
                                  <Avatar className="size-5 shrink-0">
                                    <AvatarImage
                                      src={getOptimizedImageUrl(item.avatar_url || item.avatarUrl, { width: 40, height: 40 })}
                                      alt={item.name || item.email || "User"}
                                    />
                                    <AvatarFallback className="text-[9px] bg-indigo-500/10 text-indigo-500 font-semibold">
                                      {(item.name || item.email || "U").charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                ) : item.kind === "task" ? (
                                  <CheckSquare className="size-4 text-muted-foreground shrink-0" />
                                ) : item.kind === "event" ? (
                                  <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                                ) : (
                                  <FileText className="size-4 text-muted-foreground shrink-0" />
                                );

                              const displayTitle =
                                item.kind === "user"
                                  ? item.email?.split('@')[0] || item.name || item.email || ""
                                  : item.title || "Untitled";

                              const label = item.kind === "user"
                                ? item.name || item.email?.split('@')[0] || ""
                                : item.title || "Untitled";

                              return (
                                <button
                                  key={item.kind === "user" ? item.user_id : item.id}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    handleInsertMention(label, item.kind, item.kind === "user" ? item.user_id : item.id);
                                  }}
                                  className={`w-full flex items-center gap-2.5 p-1.5 rounded-md text-left transition-colors ${
                                    idx === clampedIndex
                                      ? "bg-accent text-accent-foreground"
                                      : "hover:bg-accent/60 text-foreground"
                                  }`}
                                >
                                  {icon}
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-medium truncate">{displayTitle}</span>
                                    {item.kind === "user" && item.email && (
                                      <span className="text-[9px] text-muted-foreground truncate">{item.email}</span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ));
                      })()
                    ) : (
                      flatResults.map((item: any, idx) => {
                        const icon =
                          item.kind === "user" ? (
                            <Avatar className="size-5 shrink-0">
                              <AvatarImage
                                src={getOptimizedImageUrl(item.avatar_url || item.avatarUrl, { width: 40, height: 40 })}
                                alt={item.name || item.email || "User"}
                              />
                              <AvatarFallback className="text-[9px] bg-indigo-500/10 text-indigo-500 font-semibold">
                                {(item.name || item.email || "U").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : item.kind === "task" ? (
                            <CheckSquare className="size-4 text-muted-foreground shrink-0" />
                          ) : item.kind === "event" ? (
                            <CalendarDays className="size-4 text-muted-foreground shrink-0" />
                          ) : (
                            <FileText className="size-4 text-muted-foreground shrink-0" />
                          );

                        const displayTitle =
                          item.kind === "user"
                            ? item.email?.split('@')[0] || item.name || item.email || ""
                            : item.title || "Untitled";

                        const label = item.kind === "user"
                          ? item.name || item.email?.split('@')[0] || ""
                          : item.title || "Untitled";

                        return (
                          <button
                            key={item.kind === "user" ? item.user_id : item.id}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              handleInsertMention(label, item.kind, item.kind === "user" ? item.user_id : item.id);
                            }}
                            className={`w-full flex items-center gap-2.5 p-1.5 rounded-md text-left transition-colors ${
                              idx === clampedIndex
                                ? "bg-accent text-accent-foreground"
                                : "hover:bg-accent/60 text-foreground"
                            }`}
                          >
                            {icon}
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium truncate">{displayTitle}</span>
                              {item.kind === "user" && item.email && (
                                <span className="text-[9px] text-muted-foreground truncate">{item.email}</span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          <PromptInputTextarea
            ref={textareaRef}
            className={cn(
              "bg-transparent border-none px-0 text-foreground placeholder:text-muted-foreground/55 focus-visible:ring-0 resize-none font-normal transition-all duration-200",
              isChatStarted
                ? "min-h-[3.25rem] pt-3 pb-1 text-[0.95rem] max-h-36 overflow-y-auto"
                : hasAttachments
                  ? "min-h-[5rem] pt-3 pb-2 text-base sm:text-lg max-h-48 overflow-y-auto"
                  : "min-h-[5rem] pt-3 pb-2 text-[1rem] sm:text-[1.05rem] max-h-48 overflow-y-auto",
            )}
            onChange={handleInputChange}
            onSelect={handleInputSelect}
            onKeyDown={handleKeyDown}
            placeholder={
              isChatStarted ? "Write a message..." : "How can I help you today?"
            }
            value={text}
          />

          {showCommandMenu && (
            <div className="absolute inset-x-0 top-full z-50 mt-3 px-0">
              <PromptInputCommand className="overflow-hidden rounded-[1.35rem] border border-border/70 bg-popover/95 p-2 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                <PromptInputCommandInput
                  className="hidden"
                  placeholder="Search commands..."
                />
                <PromptInputCommandList>
                  <PromptInputCommandEmpty>
                    No commands found.
                  </PromptInputCommandEmpty>
                  <PromptInputCommandGroup heading="Suggestions">
                    {suggestions.map((suggestion) => (
                      <PromptInputCommandItem
                        key={suggestion.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3"
                        onSelect={() => onSuggestionClick(suggestion)}
                      >
                        <div className="mt-0.5 rounded-full border border-border/60 bg-background/70 p-2">
                          <suggestion.icon className="size-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {suggestion.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {suggestion.description}
                          </span>
                        </div>
                      </PromptInputCommandItem>
                    ))}
                  </PromptInputCommandGroup>
                </PromptInputCommandList>
              </PromptInputCommand>
            </div>
          )}
        </div>
      </PromptInputBody>

      <PromptInputFooter className="border-none px-3 pb-3 pt-1 sm:px-4 sm:pb-3">
        <PromptInputTools className="flex-wrap gap-2">
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger
              className="rounded-full border border-border/60 bg-background/60 text-muted-foreground shadow-none transition-colors hover:bg-background hover:text-foreground"
              size="icon-sm"
              tooltip={{ content: "Add attachments", shortcut: "⌘U" }}
              variant="ghost"
            >
              <Plus className="size-4" />
            </PromptInputActionMenuTrigger>
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments label="Add photos or files" />
              <PromptInputActionMenuItem onSelect={(e) => { e.preventDefault(); setUseThinking(!useThinking); }}>
                <Brain className="mr-2 size-4" />
                {useThinking ? "Disable Thinking" : "Enable Thinking"}
              </PromptInputActionMenuItem>
              <PromptInputActionMenuItem onSelect={(e) => { e.preventDefault(); setUseWebSearch(!useWebSearch); }}>
                <GlobeIcon className="mr-2 size-4" />
                {useWebSearch ? "Disable Web Search" : "Enable Web Search"}
              </PromptInputActionMenuItem>
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
        </PromptInputTools>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden h-5 w-px bg-border/60 sm:block" />

          <PromptInputButton
            className="rounded-full text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
            size="icon-sm"
            tooltip={{ content: "Voice input", shortcut: "⌘M" }}
            variant="ghost"
          >
            <Mic className="size-4" />
          </PromptInputButton>

          {isActive ? (
            <PromptInputSubmit
              className="rounded-full bg-foreground text-background hover:bg-foreground/92 hover:text-background active:bg-foreground/90 active:text-background shadow-none transition-transform hover:scale-[1.02]"
              status={status}
              onClick={onStop}
              type="button"
              variant="ghost"
            />
          ) : canSubmit ? (
            <PromptInputSubmit
              className="rounded-full bg-foreground text-background hover:bg-foreground/92 hover:text-background active:bg-foreground/90 active:text-background shadow-none transition-transform hover:scale-[1.02]"
              status={status}
              variant="ghost"
            />
          ) : (
            <PromptInputButton
              className="rounded-full bg-foreground text-background hover:bg-foreground/92 hover:text-background active:bg-foreground/90 active:text-background shadow-none transition-transform hover:scale-[1.02]"
              size="icon-sm"
              variant="ghost"
            >
              <ArrowRight className="size-4" />
            </PromptInputButton>
          )}
        </div>
      </PromptInputFooter>
    </>
  );
}

interface HeroPromptInputProps {
  isChatStarted?: boolean;
  onSubmit?: (message: PromptInputMessage) => void;
  status?: "submitted" | "streaming" | "ready" | "error";
  onStop?: () => void;
}

export function HeroPromptInput({
  isChatStarted = false,
  onSubmit,
  status,
  onStop,
}: HeroPromptInputProps) {
  const { user } = useAuth();
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { data: members = [] } = useSpaceMembers(activeOrgId, activeSpaceId);
  const { data: allTasks = [] } = useOrgTasks(activeOrgId, activeSpaceId);
  const { data: pages = [] } = useMotionPages(activeOrgId, activeSpaceId);
  const { data: sharedPages = [] } = useSharedToSpace(activeOrgId, activeSpaceId);

  const [text, setText] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);

  const userName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";

  const getDynamicGreeting = () => {
    const hour = new Date().getHours();
    const greetings = [];
    if (hour < 12) greetings.push("Good morning", "Rise and shine", "Ready for the day");
    else if (hour < 18) greetings.push("Good afternoon", "Hope your day is going well");
    else greetings.push("Good evening", "Winding down", "Still at it");

    // We can add more context like day of the week
    const day = new Date().getDay();
    if (day === 1 && hour < 12) greetings.push("Happy Monday", "Let's conquer this week");
    if (day === 5 && hour > 14) greetings.push("Happy Friday", "Almost the weekend");

    // Pick a random greeting
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    return `${greeting}, ${userName.split(" ")[0]}`;
  };

  const [greeting, setGreeting] = useState("");

  useEffect(() => {
    setGreeting(getDynamicGreeting());
  }, [userName]);

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text?.trim());
    const hasAttachments = Boolean(message.files?.length);

    if (!(hasText || hasAttachments || useWebSearch)) {
      return;
    }

    const processedText = preprocessMentions(message.text || "", members, allTasks, pages, sharedPages);

    onSubmit?.({
      ...message,
      text: processedText,
    });
    setText("");
    setShowCommandMenu(false);
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setText(value);
    setShowCommandMenu(value.startsWith("/") && value.length > 0);
  };

  const handleSuggestionClick = (suggestion: (typeof suggestions)[number]) => {
    setText(`${suggestion.label} ${suggestion.description}`);
    setShowCommandMenu(false);
  };

  return (
    <section
      className={cn(
        "relative flex w-full max-w-[54rem] flex-col items-center px-4",
        isChatStarted ? "gap-0 py-4" : "gap-6 pt-12 sm:gap-7 sm:pt-14",
      )}
    >
      {!isChatStarted && (
        <div className="flex items-center gap-5 text-center">
          <h1 className="text-4xl font-medium tracking-tight font-serif text-white sm:text-5xl md:text-6xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            {greeting || `Hey, ${userName.split(" ")[0]}`}
          </h1>
        </div>
      )}

      <div className="w-full max-w-[54rem]">
        <PromptInput
          className={cn(
            "w-full overflow-visible bg-transparent",
            "[&_[data-slot=input-group]]:relative [&_[data-slot=input-group]]:overflow-visible",
            isChatStarted
              ? "[&_[data-slot=input-group]]:rounded-[1.35rem]"
              : "[&_[data-slot=input-group]]:rounded-[1.25rem]",
            "[&_[data-slot=input-group]]:border [&_[data-slot=input-group]]:border-border/70",
            "[&_[data-slot=input-group]]:has-[[data-slot=input-group-control]:focus-visible]:border-border/70",
            "[&_[data-slot=input-group]]:bg-background/88",
            isChatStarted
              ? "[&_[data-slot=input-group]]:shadow-[0_18px_55px_-36px_rgba(15,23,42,0.4)]"
              : "[&_[data-slot=input-group]]:shadow-[0_26px_70px_-42px_rgba(15,23,42,0.28)]",
            "[&_[data-slot=input-group]]:backdrop-blur-xl",
            "transition-all duration-300 dark:shadow-[0_30px_80px_-42px_rgba(0,0,0,0.65)]",
            "[&_[data-slot=input-group]]:before:pointer-events-none [&_[data-slot=input-group]]:before:absolute [&_[data-slot=input-group]]:before:inset-x-6 [&_[data-slot=input-group]]:before:top-0 [&_[data-slot=input-group]]:before:h-px [&_[data-slot=input-group]]:before:bg-white/10 [&_[data-slot=input-group]]:before:content-['']",
          )}
          globalDrop
          multiple
          onSubmit={handleSubmit}
        >
          <HeroPromptSurface
            isChatStarted={isChatStarted}
            onSuggestionClick={handleSuggestionClick}
            onStop={onStop}
            setUseWebSearch={setUseWebSearch}
            setUseThinking={setUseThinking}
            showCommandMenu={showCommandMenu}
            status={status}
            text={text}
            setText={setText}
            useWebSearch={useWebSearch}
            useThinking={useThinking}
            valueChanged={handleTextChange}
          />
        </PromptInput>
      </div>
    </section>
  );
}

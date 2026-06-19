import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Suggestion from "@tiptap/suggestion";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { common, createLowlight } from "lowlight";
import { cn } from "@/lib/utils";
import {
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  CalendarDays,
  FileText,
  User
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";
import type { MentionMember } from "./renderMessageContent";
import type { TaskDTO } from "@/hooks/api/useTasks";
import type { MotionPageDTO } from "@/hooks/api/useMotionPages";

import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"

const lowlight = createLowlight(common);

export const MentionSuggestionPluginKey = new PluginKey("mentionSuggestion");

export type MentionItem =
  | { kind: "category"; type: "user" | "task" | "event" | "page"; id: string; label: string }
  | { kind: "user"; id: string; label: string; email?: string | null; avatar_url?: string | null; avatarUrl?: string | null }
  | { kind: "task"; id: string; label: string }
  | { kind: "event"; id: string; label: string }
  | { kind: "page"; id: string; label: string };

// Define slash command items
const COMMANDS = [
  {
    title: "Heading 1",
    shortcut: "Ctrl Alt 1",
    icon: <span className="font-serif font-bold text-[13px] tracking-tighter">H1</span>,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: "Heading 2",
    shortcut: "Ctrl Alt 2",
    icon: <span className="font-serif font-bold text-[13px] tracking-tighter">H2</span>,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: "Heading 3",
    shortcut: "Ctrl Alt 3",
    icon: <span className="font-serif font-bold text-[13px] tracking-tighter">H3</span>,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },
  {
    title: "Bulleted list",
    shortcut: "Ctrl ⇧ 8",
    icon: <List className="size-4" />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    title: "Numbered list",
    shortcut: "Ctrl ⇧ 9",
    icon: <ListOrdered className="size-4" />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    title: "Checklist",
    shortcut: "Ctrl ⇧ 7",
    icon: <CheckSquare className="size-4" />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    title: "Quote",
    shortcut: "Ctrl ⇧ >",
    icon: <Quote className="size-4" />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    title: "Code Block",
    shortcut: "Ctrl Alt \\",
    icon: <Code className="size-4" />,
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
];

function parseInitialContent(val: string) {
  if (!val) return "";
  try {
    const parsed = JSON.parse(val);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") {
      return parsed; // it's valid tiptap json
    }
  } catch (e) {
    // not json, fallback to string
  }
  return val;
}

export function TaskDescriptionEditor({
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder = "Add description...",
  members = [],
  allTasks = [],
  pages = [],
}: {
  value: string;
  onChange?: (val: string) => void;
  onBlur?: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  members?: MentionMember[];
  allTasks?: TaskDTO[];
  pages?: MotionPageDTO[];
}) {
  const [slashState, setSlashState] = useState<{
    items: typeof COMMANDS;
    command: (item: any) => void;
    rect: DOMRect;
  } | null>(null);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [slashState?.items]);

  const [mentionState, setMentionState] = useState<{
    query: string;
    command: (item: any) => void;
    rect: DOMRect;
  } | null>(null);

  const [mentionType, setMentionType] = useState<"all" | "user" | "task" | "event" | "page">("all");
  const [mentionIndex, setMentionIndex] = useState(0);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionState?.query, mentionType]);

  const membersRef = useRef(members);
  const allTasksRef = useRef(allTasks);
  const pagesRef = useRef(pages);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    allTasksRef.current = allTasks;
  }, [allTasks]);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const getDisplayItems = (): MentionItem[] => {
    if (!mentionState) return [];

    const query = mentionState.query.toLowerCase();
    const currentMembers = membersRef.current || [];
    const currentAllTasks = allTasksRef.current || [];
    const currentPages = pagesRef.current || [];

    const filteredMembers: MentionItem[] = currentMembers
      .filter((m) => {
        const name = m.name || m.email || "";
        return name.toLowerCase().includes(query);
      })
      .map((m) => ({
        kind: "user",
        id: m.user_id,
        label: m.name || m.email || "",
        email: m.email,
        avatar_url: (m as any).avatar_url || (m as any).avatarUrl,
      }));

    const filteredTasks: MentionItem[] = currentAllTasks
      .filter((t) => t.type === "task" && t.title.toLowerCase().includes(query))
      .map((t) => ({
        kind: "task",
        id: t.id,
        label: t.title,
      }));

    const filteredEvents: MentionItem[] = currentAllTasks
      .filter((t) => t.type === "event" && t.title.toLowerCase().includes(query))
      .map((t) => ({
        kind: "event",
        id: t.id,
        label: t.title,
      }));

    const filteredPages: MentionItem[] = currentPages
      .filter((p) => !p.deleted_at && (p.title || "Untitled").toLowerCase().includes(query))
      .map((p) => ({
        kind: "page",
        id: p.id,
        label: p.title || "Untitled",
      }));

    if (mentionType === "all") {
      if (!mentionState.query) {
        return [
          { kind: "category", type: "user", id: "cat-user", label: "People" },
          { kind: "category", type: "task", id: "cat-task", label: "Tasks" },
          { kind: "category", type: "event", id: "cat-event", label: "Events" },
          { kind: "category", type: "page", id: "cat-page", label: "Pages" },
        ];
      }
      return [
        ...filteredMembers.slice(0, 3),
        ...filteredTasks.slice(0, 3),
        ...filteredEvents.slice(0, 3),
        ...filteredPages.slice(0, 3),
      ];
    }

    if (mentionType === "user") return filteredMembers;
    if (mentionType === "task") return filteredTasks;
    if (mentionType === "event") return filteredEvents;
    if (mentionType === "page") return filteredPages;

    return [];
  };

  const handleItemSelection = (item: MentionItem) => {
    if (item.kind === "category") {
      setMentionType(item.type);
      setMentionIndex(0);
    } else {
      if (mentionState) {
        mentionState.command(item);
        setMentionState(null);
      }
    }
  };

  const displayItems = getDisplayItems();
  const clampedIndex = displayItems.length > 0
    ? Math.min(Math.max(0, mentionIndex), displayItems.length - 1)
    : 0;

  // Handle keyboard events for the slash menu manually via document listener to intercept before editor
  useEffect(() => {
    if (!slashState) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev + slashState.items.length - 1) % slashState.items.length);
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % slashState.items.length);
        e.preventDefault();
      } else if (e.key === "Enter") {
        const item = slashState.items[selectedIndex];
        if (item) {
          slashState.command(item);
          setSlashState(null);
        }
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === "Escape") {
        setSlashState(null);
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true); // Use capture phase to prevent Tiptap from eating the Enter
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [slashState, selectedIndex]);

  const SlashCommands = Extension.create({
    name: "slashCommands",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "/",
          command: ({ editor, range, props }) => {
            props.command({ editor, range });
          },
          items: ({ query }) => {
            return COMMANDS.filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase())
            );
          },
          render: () => {
            return {
              onStart: (props) => {
                const rect = props.clientRect?.();
                if (!rect) return;
                setSlashState({ items: props.items, command: props.command, rect });
              },
              onUpdate: (props) => {
                const rect = props.clientRect?.();
                if (!rect) return;
                setSlashState({ items: props.items, command: props.command, rect });
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  setSlashState(null);
                  return true;
                }
                // Arrow up/down/enter are handled by the document listener above
                // But we should signal tiptap suggestion that we "handled" it so it doesn't do its own thing.
                if (["ArrowUp", "ArrowDown", "Enter"].includes(props.event.key)) {
                  return true;
                }
                return false;
              },
              onExit: () => {
                setSlashState(null);
              },
            };
          },
        }),
      ];
    },
  });



  const MentionSuggestion = Extension.create({
    name: "mentionSuggestion",
    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          char: "@",
          pluginKey: MentionSuggestionPluginKey,
          command: ({ editor, range, props }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent("@" + props.label + " ")
              .run();
          },
          items: () => {
            return getDisplayItems();
          },
          render: () => {
            return {
              onStart: (props) => {
                const rect = props.clientRect?.();
                if (!rect) return;
                setMentionState({
                  query: props.query,
                  command: props.command,
                  rect,
                });
                setMentionType("all");
                setMentionIndex(0);
              },
              onUpdate: (props) => {
                const rect = props.clientRect?.();
                if (!rect) return;
                setMentionState({
                  query: props.query,
                  command: props.command,
                  rect,
                });
              },
              onKeyDown: (props) => {
                if (props.event.key === "Escape") {
                  setMentionState(null);
                  return true;
                }
                if (["ArrowUp", "ArrowDown", "Enter"].includes(props.event.key)) {
                  return true;
                }
                return false;
              },
              onExit: () => {
                setMentionState(null);
              },
            };
          },
        }),
      ];
    },
  });

  const getDecorations = (doc: any) => {
    const decorations: Decoration[] = [];
    
    // Get current candidates
    const currentMembers = membersRef.current || [];
    const currentAllTasks = allTasksRef.current || [];
    const currentPages = pagesRef.current || [];

    const candidates: { label: string; type: "user" | "task" | "event" | "page"; id: string }[] = [];

    for (const m of currentMembers) {
      const label = m.name || m.email || "";
      if (label) {
        candidates.push({ label, type: "user", id: m.user_id });
      }
    }
    for (const t of currentAllTasks) {
      if (t.title) {
        candidates.push({ label: t.title, type: t.type as "task" | "event", id: t.id });
      }
    }
    for (const p of currentPages) {
      const title = p.title || "Untitled";
      if (title) {
        candidates.push({ label: title, type: "page", id: p.id });
      }
    }

    // Sort candidates by label length in descending order to match the longest one first.
    candidates.sort((a, b) => b.label.length - a.label.length);

    if (candidates.length === 0) {
      return DecorationSet.empty;
    }

    doc.descendants((node: any, pos: number) => {
      if (node.isText) {
        const text = node.text || "";
        let offset = 0;

        while (offset < text.length) {
          const atIdx = text.indexOf("@", offset);
          if (atIdx === -1) break;

          const rest = text.slice(atIdx + 1);
          let matched: typeof candidates[number] | null = null;

          for (const cand of candidates) {
            const labelLower = cand.label.toLowerCase();
            if (rest.toLowerCase().startsWith(labelLower)) {
              const afterMatch = rest[cand.label.length];
              if (
                afterMatch === undefined ||
                afterMatch === " " ||
                afterMatch === "\n" ||
                /[.,!?;:)]/.test(afterMatch)
              ) {
                matched = cand;
                break;
              }
            }
          }

          if (matched) {
            const from = pos + atIdx;
            const to = from + 1 + matched.label.length;

            let className = "";
            if (matched.type === "user") {
              className = "bg-primary/8 text-primary border border-primary/20 dark:bg-primary/15 dark:border-primary/30 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-semibold transition-colors";
            } else if (matched.type === "task") {
              className = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium transition-colors";
            } else if (matched.type === "event") {
              className = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium transition-colors";
            } else if (matched.type === "page") {
              className = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[13px] font-medium transition-colors";
            }

            decorations.push(
              Decoration.inline(from, to, {
                class: className,
              })
            );

            offset = atIdx + 1 + matched.label.length;
          } else {
            offset = atIdx + 1;
          }
        }
      }
    });

    return DecorationSet.create(doc, decorations);
  };

  const MentionHighlighter = Extension.create({
    name: "mentionHighlighter",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("mentionHighlighter"),
          state: {
            init(_, { doc }) {
              return getDecorations(doc);
            },
            apply(tr, oldState) {
              if (tr.docChanged || tr.getMeta("forceDecorationUpdate")) {
                return getDecorations(tr.doc);
              }
              return oldState.map(tr.mapping, tr.doc);
            },
          },
          props: {
            decorations(state) {
              return this.getState(state);
            },
          },
        }),
      ];
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder }),
      Underline,
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight }),
      SlashCommands,
      MentionSuggestion,
      MentionHighlighter,
    ],
    content: parseInitialContent(value),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange?.(JSON.stringify(editor.getJSON()));
    },
    onBlur: ({ editor }) => {
      onBlur?.(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[100px] w-full text-foreground/90 custom-scrollbar",
      },
    },
  });

  // Handle keyboard events for the mention menu manually via document listener
  useEffect(() => {
    if (!mentionState) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentItems = getDisplayItems();
      if (currentItems.length === 0) return;

      if (e.key === "ArrowUp") {
        setMentionIndex((prev) => (prev + currentItems.length - 1) % currentItems.length);
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        setMentionIndex((prev) => (prev + 1) % currentItems.length);
        e.preventDefault();
      } else if (e.key === "Enter") {
        const item = currentItems[clampedIndex];
        if (item) {
          handleItemSelection(item);
          editor?.commands.focus();
        }
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === "Escape") {
        setMentionState(null);
        e.preventDefault();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [mentionState, mentionIndex, mentionType, clampedIndex, editor]);

  // Re-run decorations when members, tasks, or pages change
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const tr = editor.state.tr.setMeta("forceDecorationUpdate", true);
      editor.view.dispatch(tr);
    }
  }, [members, allTasks, pages, editor]);

  // Keep editor content in sync if 'value' changes externally
  useEffect(() => {
    if (editor && value) {
      const currentJson = JSON.stringify(editor.getJSON());
      if (value !== currentJson && value !== editor.getText()) {
        const parsed = parseInitialContent(value);
        editor.commands.setContent(parsed, { emitUpdate: false });
      }
    }
  }, [value, editor]);

  return (
    <div className="relative w-full">
      <EditorContent editor={editor} className={cn("w-full", disabled && "opacity-80")} />

      {/* Slash Menu */}
      {slashState && slashState.items.length > 0 && typeof document !== "undefined" && createPortal(
        <div
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-[9999] w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl py-1.5 flex flex-col pointer-events-auto"
          style={{
            left: slashState.rect.left,
            ...(slashState.rect.bottom + 280 > window.innerHeight
              ? { top: slashState.rect.top - 8, transform: "translateY(-100%)" }
              : { top: slashState.rect.bottom + 8 }),
          }}
        >
          {slashState.items.map((item, index) => (
            <button
              key={index}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                slashState.command(item);
                setSlashState(null);
                editor?.commands.focus();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "flex items-center justify-between w-full px-3 py-2 text-sm text-left transition-colors outline-none",
                selectedIndex === index
                  ? "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-black dark:hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-5 text-zinc-500 dark:text-zinc-400 shrink-0">
                  {item.icon}
                </div>
                <span className="font-medium text-inherit">{item.title}</span>
              </div>
              <span className="text-[10px] tracking-widest opacity-50 font-mono shrink-0">
                {item.shortcut}
              </span>
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* Mention Menu */}
      {mentionState && displayItems.length > 0 && typeof document !== "undefined" && createPortal(
        <div
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-[9999] w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden font-sans"
          style={{
            left: mentionState.rect.left,
            ...(mentionState.rect.bottom + 320 > window.innerHeight
              ? { top: mentionState.rect.top - 8, transform: "translateY(-100%)" }
              : { top: mentionState.rect.bottom + 8 }),
          }}
        >
          {/* Header */}
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              {mentionType === "all" && !mentionState.query
                ? "Tag everything..."
                : mentionType === "all"
                ? `Searching for "${mentionState.query}"`
                : `Searching ${mentionType === "user" ? "people" : mentionType + "s"} for "${mentionState.query}"`}
            </span>
          </div>

          {/* List content */}
          <div className="max-h-60 overflow-y-auto custom-scrollbar py-1">
            {/* Render items */}
            {mentionType === "all" && mentionState.query ? (
              (() => {
                const items = displayItems;
                const people = items.filter(i => i.kind === "user");
                const tasks = items.filter(i => i.kind === "task");
                const events = items.filter(i => i.kind === "event");
                const pages = items.filter(i => i.kind === "page");

                const groups = [
                  { label: "People", items: people },
                  { label: "Tasks", items: tasks },
                  { label: "Events", items: events },
                  { label: "Pages", items: pages },
                ].filter(g => g.items.length > 0);

                let flatIdx = 0;
                return groups.map(group => (
                  <div key={group.label} className="flex flex-col">
                    <span className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      {group.label}
                    </span>
                    {group.items.map(item => {
                      const idx = flatIdx++;
                      return renderItem(item, idx);
                    })}
                  </div>
                ));
              })()
            ) : (
              displayItems.map((item, idx) => renderItem(item, idx))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );

  function renderItem(item: MentionItem, idx: number) {
    const isSelected = clampedIndex === idx;

    let icon: React.ReactNode;
    let label = item.label;
    let sublabel: string | undefined;

    if (item.kind === "category") {
      label = item.label;
      if (item.type === "user") icon = <User className="size-4" />;
      else if (item.type === "task") icon = <CheckSquare className="size-4" />;
      else if (item.type === "event") icon = <CalendarDays className="size-4" />;
      else icon = <FileText className="size-4" />;
    } else if (item.kind === "user") {
      icon = (
        <Avatar className="size-5 shrink-0">
          <AvatarImage
            src={getOptimizedImageUrl(item.avatar_url || item.avatarUrl, { width: 40, height: 40 })}
            alt={item.label}
          />
          <AvatarFallback className="text-[9px] bg-indigo-500/10 text-indigo-500 font-semibold">
            {item.label.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      );
      sublabel = item.email || undefined;
    } else if (item.kind === "task") {
      icon = <CheckSquare className="size-4 text-emerald-500 shrink-0" />;
    } else if (item.kind === "event") {
      icon = <CalendarDays className="size-4 text-indigo-500 shrink-0" />;
    } else if (item.kind === "page") {
      icon = <FileText className="size-4 text-amber-500 shrink-0" />;
    }

    return (
      <button
        key={item.id}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          handleItemSelection(item);
          editor?.commands.focus();
        }}
        onMouseEnter={() => setMentionIndex(idx)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-1.5 text-sm text-left transition-colors outline-none",
          isSelected
            ? "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-black dark:hover:text-white"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex items-center justify-center size-5 text-zinc-500 dark:text-zinc-400 shrink-0">
            {icon}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-medium truncate text-inherit leading-normal">{label}</span>
            {sublabel && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate leading-none mt-0.5">
                {sublabel}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }
}

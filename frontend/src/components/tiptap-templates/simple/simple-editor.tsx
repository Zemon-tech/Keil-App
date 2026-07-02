"use client"

import type { JSONContent } from "@tiptap/core"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import type { Editor } from "@tiptap/core"
import { NodeSelection, type EditorState } from "@tiptap/pm/state"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { CustomTable, CustomTableCell, CustomTableHeader } from "@/extensions/CustomTableExtension"
import { TableRow } from "@tiptap/extension-table-row"
import { Placeholder } from "@tiptap/extension-placeholder"
import { Link } from "@tiptap/extension-link"
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { common, createLowlight } from "lowlight"
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details"
import { BlockIdExtension } from "@/extensions/BlockIdExtension"
import { EnforceFinalBlockExtension } from "@/extensions/EnforceFinalBlockExtension"
import { SubpageExtension } from "@/extensions/SubpageExtension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import { useMotionAi } from "@/hooks/api/useMotionAi"
import { AiCommandMenu } from "./AiCommandMenu"
import { AiBubbleMenu, AiStreamToolbar } from "./AiBubbleMenu"
import { AiBlock } from "@/components/tiptap-node/ai-block-node/ai-block-extension"
import { useAppContext } from "@/contexts/AppContext"
import { useParams } from "react-router-dom"
import { Extension } from "@tiptap/core"
import { markdownToHtml } from "@/utils/markdown-parser"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { Plugin, PluginKey } from "@tiptap/pm/state"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    aiHighlight: {
      setAiHighlight: (range: { from: number; to: number }) => ReturnType
      unsetAiHighlight: () => ReturnType
    }
  }
}

// --- ProseMirror AI Highlight Extension ---
export const AiHighlightExtension = Extension.create({
  name: "aiHighlight",
  addStorage() {
    return { range: null as { from: number; to: number } | null };
  },
  addCommands() {
    return {
      setAiHighlight: (range: { from: number; to: number }) => ({ editor }: any) => {
        editor.storage.aiHighlight.range = range;
        editor.view.dispatch(editor.state.tr);
        return true;
      },
      unsetAiHighlight: () => ({ editor }: any) => {
        editor.storage.aiHighlight.range = null;
        editor.view.dispatch(editor.state.tr);
        return true;
      }
    } as any;
  },
  addProseMirrorPlugins() {
    const { storage } = this;
    return [
      new Plugin({
        key: new PluginKey("aiHighlightPlugin"),
        props: {
          decorations(state) {
            const { range } = storage;
            if (!range) return DecorationSet.empty;
            const docSize = state.doc.content.size;
            const from = Math.max(0, Math.min(range.from, docSize));
            const to = Math.max(from, Math.min(range.to, docSize));
            if (from === to) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.inline(from, to, { class: "motion-ai-context-highlight" })
            ]);
          }
        }
      })
    ];
  }
});

import Paragraph from '@tiptap/extension-paragraph'
import Heading from '@tiptap/extension-heading'
import Blockquote from '@tiptap/extension-blockquote'

const CustomBlockquote = Blockquote.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      type: {
        default: 'quote',
        parseHTML: element => element.getAttribute('data-type') || 'quote',
        renderHTML: attributes => ({ 'data-type': attributes.type })
      }
    }
  }
})

const CustomDetailsSummary = DetailsSummary.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      level: {
        default: null,
        parseHTML: element => {
          const val = element.getAttribute('data-level')
          return val ? parseInt(val, 10) : null
        },
        renderHTML: attributes => {
          if (!attributes.level) return {}
          return { 'data-level': attributes.level }
        }
      }
    }
  }
})

import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import { FontFamily } from "@tiptap/extension-font-family"
import { CharacterCount } from "@tiptap/extension-character-count"
import { Youtube } from "@tiptap/extension-youtube"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getOptimizedImageUrl } from "@/lib/image-optimizer"
import { useSpaceMembers } from "@/hooks/api/useSpaces"
import { useOrgTasks } from "@/hooks/api/useTasks"
import { useMotionPages } from "@/hooks/api/useMotionPages"
import Suggestion from "@tiptap/suggestion"
import { createPortal } from "react-dom"

// Throttled toast function to avoid spamming the user on every keystroke
let lastToastTime = 0
const throttleToast = (message: string, type: 'error' | 'warning' = 'error') => {
  const now = Date.now()
  if (now - lastToastTime > 2000) {
    if (type === 'error') {
      toast.error(message)
    } else {
      toast.warning(message)
    }
    lastToastTime = now
  }
}

const CustomCharacterCount = CharacterCount.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('characterCount'),
        filterTransaction: (transaction, state) => {
          const limit = this.options.limit

          // Nothing has changed or no limit is defined. Ignore it.
          if (!transaction.docChanged || limit === null || limit === undefined || limit === 0) {
            return true
          }

          const oldSize = this.storage.characters?.({ node: state.doc }) || 0
          const newSize = this.storage.characters?.({ node: transaction.doc }) || 0

          // Everything is in the limit. Good.
          if (newSize <= limit) {
            return true
          }

          // The limit has already been exceeded but will be reduced.
          if (oldSize > limit && newSize > limit && newSize <= oldSize) {
            return true
          }

          // The limit has already been exceeded and will be increased further.
          if (oldSize > limit && newSize > limit && newSize > oldSize) {
            throttleToast(`Character limit of ${limit.toLocaleString()} reached!`)
            return false
          }

          const isPaste = transaction.getMeta('paste')

          // Block all exceeding transactions that were not pasted.
          if (!isPaste) {
            throttleToast(`Character limit of ${limit.toLocaleString()} reached!`)
            return false
          }

          // For pasted content, we try to remove the exceeding content.
          const pos = transaction.selection.$head.pos
          const over = newSize - limit
          const from = pos - over
          const to = pos

          // It’s probably a bad idea to mutate transactions within `filterTransaction`
          // but for now this is working fine.
          transaction.deleteRange(from, to)

          // In some situations, the limit will continue to be exceeded after trimming.
          // This happens e.g. when truncating within a complex node (e.g. table)
          // and ProseMirror has to close this node again.
          // If this is the case, we prevent the transaction completely.
          const updatedSize = this.storage.characters?.({ node: transaction.doc }) || 0

          if (updatedSize > limit) {
            throttleToast(`Cannot paste: character limit of ${limit.toLocaleString()} would be exceeded.`)
            return false
          }

          // The paste was successfully trimmed
          throttleToast(`Pasted content was trimmed to fit the ${limit.toLocaleString()} character limit.`, 'warning')
          return true
        },
      }),
    ]
  }
})

const CustomParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: element => element.style.color,
        renderHTML: attributes => {
          if (!attributes.color) return {}
          return { style: `color: ${attributes.color}` }
        }
      },
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {}
          return { style: `background-color: ${attributes.backgroundColor}` }
        }
      }
    }
  }
})

const CustomHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: element => element.style.color,
        renderHTML: attributes => {
          if (!attributes.color) return {}
          return { style: `color: ${attributes.color}` }
        }
      },
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor,
        renderHTML: attributes => {
          if (!attributes.backgroundColor) return {}
          return { style: `background-color: ${attributes.backgroundColor}` }
        }
      }
    }
  }
})

import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Table as TableIcon,
  Sparkles,
  Smile,
  FileText,
  Youtube as YoutubeIcon,
  ChevronRight,
  Palette,
  Search,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  CalendarDays,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"
import { TableControlsOverlay } from "./TableControlsOverlay"
import { BlockDragHandle } from "./BlockDragHandle"

const lowlight = createLowlight(common)

type SlashItem = {
  title: string
  subtitle?: string
  icon?: any
  keywords: string[]
  shortcut?: string
  run: () => void
}

type BlockTarget = {
  from: number
  to: number
}


function getTextBeforeCursorInParent(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { selection } = editor.state
  const $from = selection.$from
  return $from.parent.textBetween(0, $from.parentOffset, "\n")
}

function rangeSpansMultipleBlocks(doc: any, from: number, to: number) {
  let blockCount = 0
  doc.nodesBetween(from, to, (node: any) => {
    if (node.isBlock) {
      blockCount++
    }
    return blockCount <= 1
  })
  return blockCount > 1
}

export type MentionItem =
  | { kind: "category"; type: "user" | "task" | "event" | "page"; id: string; label: string }
  | { kind: "user"; id: string; label: string; email?: string | null; avatar_url?: string | null; avatarUrl?: string | null }
  | { kind: "task"; id: string; label: string }
  | { kind: "event"; id: string; label: string }
  | { kind: "page"; id: string; label: string };

const MentionSuggestionPluginKey = new PluginKey("mentionSuggestion");

export function SimpleEditor({
  content,
  onContentChange,
  onReady,
  onAddSubpage,
  onDeleteSubpage,
  onRestoreSubpage,
  editable,
}: {
  content?: JSONContent
  onContentChange?: (content: JSONContent) => void
  onReady?: (editor: NonNullable<ReturnType<typeof useEditor>>) => void
  onAddSubpage?: () => any
  onDeleteSubpage?: (id: string) => void
  onRestoreSubpage?: (id: string) => void
  editable?: boolean
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const activeItemRef = useRef<HTMLDivElement>(null)
  const [slashOpen, setSlashOpen] = useState(false)

  // --- Motion AI Integration ---
  const { pageId } = useParams<{ pageId: string }>();
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { stream, isStreaming } = useMotionAi(activeOrgId, activeSpaceId, pageId ?? null);

  // --- Universal Mentions Data Loading ---
  const { data: members = [] } = useSpaceMembers(activeOrgId, activeSpaceId);
  const { data: allTasks = [] } = useOrgTasks(activeOrgId, activeSpaceId);
  const { data: pages = [] } = useMotionPages(activeOrgId, activeSpaceId);

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

  const MentionSuggestion = useMemo(() => Extension.create({
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
  }), []);

  const MentionHighlighter = useMemo(() => Extension.create({
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
  }), []);


  const [aiCommandOpen, setAiCommandOpen] = useState(false);
  const [aiCommandPos, setAiCommandPos] = useState<any>(null);
  const [aiCommandDeleteRange, setAiCommandDeleteRange] = useState<{ from: number; to: number } | null>(null);

  const [aiBubbleOpen, setAiBubbleOpen] = useState(false);
  const [showAiToolbar, setShowAiToolbar] = useState(false);

  const originalRangeRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const streamRangeRef = useRef<{ from: number; to: number } | null>(null);
  const savedParamsRef = useRef<any>(null);


  const [slashQuery, setSlashQuery] = useState("")
  const [slashPos, setSlashPos] = useState<{
    left: number
    top: number
    bottom: number
    direction: "up" | "down"
    maxHeight: number
  } | null>(null)
  const [slashDeleteRange, setSlashDeleteRange] = useState<{
    from: number
    to: number
  } | null>(null)
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)

  // Use refs for callbacks to keep them stable in useEditor while always using latest logic
  const onContentChangeRef = useRef(onContentChange)
  useEffect(() => {
    onContentChangeRef.current = onContentChange
  }, [onContentChange])

  const onAddSubpageRef = useRef(onAddSubpage)
  useEffect(() => {
    onAddSubpageRef.current = onAddSubpage
  }, [onAddSubpage])

  const onDeleteSubpageRef = useRef(onDeleteSubpage)
  useEffect(() => {
    onDeleteSubpageRef.current = onDeleteSubpage
  }, [onDeleteSubpage])

  const onRestoreSubpageRef = useRef(onRestoreSubpage)
  useEffect(() => {
    onRestoreSubpageRef.current = onRestoreSubpage
  }, [onRestoreSubpage])

  const previousSubpageIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    setSlashSelectedIndex(0)
  }, [slashQuery])

  const virtualSlashStartRef = useRef<number | null>(null)

  const [editorEmojiPicker, setEditorEmojiPicker] = useState<{
    left: number
    top: number
    pos: number
  } | null>(null)
  const [editorEmojiSearch, setEditorEmojiSearch] = useState("")

  const extensions = useMemo(() => [
    AiHighlightExtension,
    BlockIdExtension,
    EnforceFinalBlockExtension,
    StarterKit.configure({
      paragraph: false,
      heading: false,
      blockquote: false,
      horizontalRule: false,
      codeBlock: false,
      link: false,
    }),
    CustomParagraph,
    CustomHeading,
    CustomBlockquote,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Highlight.configure({ multicolor: true }),
    Image,
    Typography,
    Superscript,
    Subscript,
    Link.configure({
      openOnClick: true,
      autolink: true,
      defaultProtocol: "https",
      HTMLAttributes: {
        class: "text-primary underline underline-offset-4 cursor-pointer",
      },
    }),
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === "heading") {
          return `Heading ${node.attrs.level}`
        }
        if (node.type.name === "detailsSummary") {
          return "Toggle"
        }
        return "Type '/' for commands..."
      },
    }),
    CustomTable.configure({
      resizable: true,
    }),
    TableRow,
    CustomTableHeader,
    CustomTableCell,
    CodeBlockLowlight.configure({
      lowlight,
    }),
    ImageUploadNode.configure({
      accept: "image/*",
      maxSize: MAX_FILE_SIZE,
      limit: 3,
      upload: handleImageUpload,
      onError: (error) => console.error("Upload failed:", error),
    }),
    AiBlock,
    Details.configure({
      HTMLAttributes: {
        class: "details",
      },
    }),
    CustomDetailsSummary,
    DetailsContent,
    HorizontalRule,
    TextStyle,
    Color,
    FontFamily,
    CustomCharacterCount.configure({
      limit: 1000000,
    }),
    Youtube.configure({
      inline: false,
      width: 640,
      height: 480,
    }),
    MentionSuggestion,
    MentionHighlighter,
    SubpageExtension,
  ], [lowlight, MentionSuggestion, MentionHighlighter]) // Removed onAddSubpage from deps

  // Deduplicate extensions by name to prevent Tiptap warnings
  const uniqueExtensions = useMemo(() => {
    const seen = new Set<string>()
    return extensions.filter(ext => {
      if (!ext.name) return true
      if (seen.has(ext.name)) return false
      seen.add(ext.name)
      return true
    })
  }, [extensions])

  // Ref so handleKeyDown (inside useEditor) can access the editor instance
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editable: editable ?? true,
    onCreate: ({ editor: e }) => {
      editorRef.current = e as any
    },
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "tiptap simple-editor",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === " " && !event.shiftKey) {
          const e = editorRef.current as any;
          if (!e) return false;
          const { selection } = e.state;
          const $from = selection.$from;
          const parent = $from.parent;

          if (parent.type.name === "paragraph" && parent.content.size === 0) {
            event.preventDefault();
            // Insert the inline AI block pill directly at the cursor position
            e.chain().focus().setAiBlock().run();
            return true;
          }
        }
        return false;
      },
      transformPastedHTML: (html) => {
        try {
          const parser = new DOMParser()
          const doc = parser.parseFromString(html, "text/html")
          const cells = doc.querySelectorAll("td, th")

          if (cells.length > 0) {
            const allowedInlineTags = ["span", "strong", "em", "code", "a", "br", "img"]

            cells.forEach((cell) => {
              const blockElements = cell.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, pre, blockquote")
              if (blockElements.length > 0) {
                const newContent = doc.createDocumentFragment()

                const extractInline = (node: Node) => {
                  if (node.nodeType === Node.TEXT_NODE) {
                    newContent.appendChild(node.cloneNode(true))
                  } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const el = node as HTMLElement
                    const tagName = el.tagName.toLowerCase()

                    if (allowedInlineTags.includes(tagName)) {
                      const newEl = el.cloneNode(false)
                      el.childNodes.forEach(child => {
                        newEl.appendChild(child.cloneNode(true))
                      })
                      newContent.appendChild(newEl)
                    } else {
                      el.childNodes.forEach(child => {
                        extractInline(child)
                      })
                      if (el.nextSibling) {
                        newContent.appendChild(doc.createElement("br"))
                      }
                    }
                  }
                }

                cell.childNodes.forEach(child => {
                  extractInline(child)
                })

                cell.innerHTML = ""
                cell.appendChild(newContent)
              }
            })

            return doc.body.innerHTML
          }
        } catch (e) {
          console.error("Error transforming pasted table HTML:", e)
        }
        return html
      }
    },
    extensions: uniqueExtensions,
    content,
    onUpdate: ({ editor }) => {
      onContentChangeRef.current?.(editor.getJSON())

      // Detect subpages added or removed
      const currentSubpageIds = new Set<string>()
      editor.state.doc.descendants((node) => {
        if (node.type.name === "subpage" && node.attrs.id) {
          currentSubpageIds.add(node.attrs.id)
        }
      })

      // Find deleted subpage IDs
      previousSubpageIdsRef.current.forEach((id) => {
        if (!currentSubpageIds.has(id)) {
          onDeleteSubpageRef.current?.(id)
        }
      })

      // Find restored subpage IDs
      currentSubpageIds.forEach((id) => {
        if (!previousSubpageIdsRef.current.has(id)) {
          onRestoreSubpageRef.current?.(id)
        }
      })

      previousSubpageIdsRef.current = currentSubpageIds
    },
  })

  // Keep editorRef in sync
  useEffect(() => {
    if (editor) editorRef.current = editor as any
  }, [editor])

  // Sync external content prop changes (e.g. from database/socket/AI) when editor is not focused
  useEffect(() => {
    if (!editor || !content) return
    const currentJson = editor.getJSON()
    if (JSON.stringify(currentJson) !== JSON.stringify(content)) {
      if (!editor.isFocused) {
        editor.commands.setContent(content, { emitUpdate: false })
      }
    }
  }, [editor, content])

  useEffect(() => {
    if (editor) {
      const initialIds = new Set<string>()
      editor.state.doc.descendants((node) => {
        if (node.type.name === "subpage" && node.attrs.id) {
          initialIds.add(node.attrs.id)
        }
      })
      previousSubpageIdsRef.current = initialIds
    }
  }, [editor])

  useEffect(() => {
    if (editor && editable !== undefined) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // --- Motion AI Helper Callbacks (Declared after editor initialization to resolve scope bindings) ---
  const runStream = useCallback(async (params: any) => {
    if (!editor) return;
    setShowAiToolbar(true);
    setAiCommandOpen(false);
    setAiBubbleOpen(false);
    let accumulatedText = "";
    savedParamsRef.current = params;

    if (originalRangeRef.current && originalRangeRef.current.from !== originalRangeRef.current.to) {
      editor.commands.setAiHighlight(streamRangeRef.current!);
    }

    try {
      await stream(
        params,
        (chunk) => {
          const currentRange = streamRangeRef.current;
          if (currentRange) {
            accumulatedText += chunk;
            const htmlContent = markdownToHtml(accumulatedText);

            const docSizeBefore = editor.state.doc.content.size;
            const deleteLength = currentRange.to - currentRange.from;

            editor.chain()
              .deleteRange({ from: currentRange.from, to: currentRange.to })
              .insertContentAt(currentRange.from, htmlContent)
              .run();

            const docSizeAfter = editor.state.doc.content.size;
            const insertedContentSize = (docSizeAfter - docSizeBefore) + deleteLength;

            streamRangeRef.current = {
              from: currentRange.from,
              to: currentRange.from + insertedContentSize
            };

            if (originalRangeRef.current && originalRangeRef.current.from !== originalRangeRef.current.to) {
              editor.commands.setAiHighlight(streamRangeRef.current!);
            }
          }
        },
        () => {
          editor.commands.unsetAiHighlight();
        }
      );
    } catch (e) {
      console.error(e);
      editor.commands.unsetAiHighlight();
    }
  }, [editor, stream]);

  const cleanupAiState = useCallback(() => {
    setShowAiToolbar(false);
    originalRangeRef.current = null;
    streamRangeRef.current = null;
    savedParamsRef.current = null;
    editor?.commands.unsetAiHighlight();
  }, [editor]);

  const handleAiCommandSubmit = useCallback((prompt: string, action?: string) => {
    if (!editor) return;
    if (aiCommandDeleteRange) {
      editor.chain().deleteRange({ from: aiCommandDeleteRange.from, to: aiCommandDeleteRange.to }).run();
    }
    const currentPos = editor.state.selection.from;
    originalRangeRef.current = { from: currentPos, to: currentPos, text: "" };
    streamRangeRef.current = { from: currentPos, to: currentPos };
    const fullText = editor.getText();

    runStream({
      action: action || "generate",
      prompt,
      context: fullText
    });
  }, [editor, aiCommandDeleteRange, runStream]);

  const handleAiBubbleSubmit = useCallback((action: string, payload?: any) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    originalRangeRef.current = { from, to, text: selectedText };
    streamRangeRef.current = { from, to };
    const fullText = editor.getText();

    runStream({
      action,
      text: selectedText,
      context: fullText,
      ...payload
    });
  }, [editor, runStream]);

  const handleDiscard = useCallback(() => {
    const orig = originalRangeRef.current;
    const curr = streamRangeRef.current;
    if (orig && curr && editor) {
      editor.chain()
        .focus()
        .deleteRange({ from: curr.from, to: curr.to })
        .insertContentAt(curr.from, orig.text)
        .run();
    }
    cleanupAiState();
  }, [editor, cleanupAiState]);

  const handleKeep = useCallback(() => {
    cleanupAiState();
  }, [cleanupAiState]);

  const handleTryAgain = useCallback(() => {
    const orig = originalRangeRef.current;
    const curr = streamRangeRef.current;
    if (orig && curr && editor) {
      editor.chain()
        .deleteRange({ from: curr.from, to: curr.to })
        .insertContentAt(curr.from, orig.text)
        .run();
      streamRangeRef.current = { from: curr.from, to: curr.from + orig.text.length };
      runStream(savedParamsRef.current);
    }
  }, [editor, runStream]);

  const closeSlashMenu = useCallback(() => {
    virtualSlashStartRef.current = null
    setSlashOpen(false)
    setSlashQuery("")
    setSlashPos(null)
    setSlashDeleteRange(null)
    if (editor && !editor.isFocused) {
      editor.commands.focus()
    }
  }, [editor])

  const calculateSlashPosition = useCallback((coords: { left: number; top: number; bottom: number }) => {
    const spaceBelow = window.innerHeight - coords.bottom - 8
    const spaceAbove = coords.top - 8
    const maxMenuHeight = 340

    let direction: "up" | "down" = "down"
    let maxHeight = maxMenuHeight
    let top = coords.bottom + 8
    let bottom = 0

    if (spaceBelow >= maxMenuHeight) {
      direction = "down"
      maxHeight = maxMenuHeight
      top = coords.bottom + 8
    } else if (spaceAbove >= maxMenuHeight) {
      direction = "up"
      maxHeight = maxMenuHeight
      bottom = window.innerHeight - coords.top + 8
    } else {
      if (spaceBelow >= spaceAbove) {
        direction = "down"
        maxHeight = Math.max(150, spaceBelow - 16)
        top = coords.bottom + 8
      } else {
        direction = "up"
        maxHeight = Math.max(150, spaceAbove - 16)
        bottom = window.innerHeight - coords.top + 8
      }
    }

    const menuWidth = 280
    let left = coords.left
    if (left + menuWidth > window.innerWidth - 16) {
      left = window.innerWidth - menuWidth - 16
    }
    left = Math.max(16, left)

    return { left, top, bottom, direction, maxHeight }
  }, [])

  const openSlashMenuAtSelection = useCallback(
    (deleteRange: BlockTarget | null = null) => {
      if (!editor) return

      const { from } = editor.state.selection
      const coords = editor.view.coordsAtPos(from)
      const wrapperRect = wrapperRef.current?.getBoundingClientRect()
      if (!wrapperRect) return

      setSlashOpen(true)
      setSlashQuery("")
      setSlashDeleteRange(deleteRange)
      setSlashPos(calculateSlashPosition(coords))
    },
    [editor, calculateSlashPosition]
  )

  useEffect(() => {
    if (!editor) return
    onReady?.(editor)
  }, [editor, onReady])

  const insertParagraphAfterTarget = useCallback(
    (target: BlockTarget | null) => {
      if (!editor) return

      const insertAt = target?.to ?? editor.state.doc.content.size

      editor
        .chain()
        .focus()
        .insertContentAt(insertAt, { type: "paragraph" })
        .setTextSelection(insertAt + 1)
        .run()

      virtualSlashStartRef.current = insertAt + 1
      openSlashMenuAtSelection()
    },
    [editor, openSlashMenuAtSelection]
  )


  const slashItems = useMemo<SlashItem[]>(() => {
    if (!editor) return []
    return [
      {
        title: "Ask AI...",
        subtitle: "Draft or edit with AI",
        icon: <Sparkles className="size-4 text-purple-400 animate-pulse" />,
        keywords: ["ai", "gpt", "assistant", "generate", "write", "draft"],
        run: () => {
          const { from } = editor.state.selection;
          const coords = editor.view.coordsAtPos(from);
          setAiCommandOpen(true);
          setAiCommandDeleteRange(null);
          setAiCommandPos(calculateSlashPosition(coords));
        },
      },
      {
        title: "AI block",
        subtitle: "Add an inline AI block generator",
        icon: <Sparkles className="size-4 text-indigo-400" />,
        keywords: ["ai block", "custom block", "prompt block", "ai prompt"],
        run: () => {
          editor.chain().focus().setAiBlock().run()
        },
      },
      {
        title: "Sub-page",
        subtitle: "Embed a sub-page",
        icon: <FileText className="size-4" />,
        keywords: ["page", "subpage", "nested"],
        run: () => {
          onAddSubpageRef.current?.()
        },
      },
      {
        title: "Heading 1",
        subtitle: "Big section heading",
        icon: <Heading1 className="size-4" />,
        keywords: ["h1", "heading", "title"],
        shortcut: "#",
        run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        title: "Heading 2",
        subtitle: "Medium section heading",
        icon: <Heading2 className="size-4" />,
        keywords: ["h2", "heading"],
        shortcut: "##",
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        title: "Heading 3",
        subtitle: "Small section heading",
        icon: <Heading3 className="size-4" />,
        keywords: ["h3", "heading"],
        shortcut: "###",
        run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        title: "Heading 4",
        subtitle: "Extra small heading",
        icon: <Heading3 className="size-4" />,
        keywords: ["h4", "heading"],
        shortcut: "####",
        run: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
      },
      {
        title: "Toggle Heading 1",
        subtitle: "H1 with a toggle drop-down",
        icon: <Heading1 className="size-4" />,
        keywords: ["toggle h1", "h1 toggle", "toggle heading 1", "details"],
        run: () => {
          if (editor.isActive("detailsSummary")) {
            editor.chain().focus().updateAttributes("detailsSummary", { level: 1 }).run()
          } else {
            editor.chain().focus().setDetails().updateAttributes("detailsSummary", { level: 1 }).run()
          }
        },
      },
      {
        title: "Toggle Heading 2",
        subtitle: "H2 with a toggle drop-down",
        icon: <Heading2 className="size-4" />,
        keywords: ["toggle h2", "h2 toggle", "toggle heading 2", "details"],
        run: () => {
          if (editor.isActive("detailsSummary")) {
            editor.chain().focus().updateAttributes("detailsSummary", { level: 2 }).run()
          } else {
            editor.chain().focus().setDetails().updateAttributes("detailsSummary", { level: 2 }).run()
          }
        },
      },
      {
        title: "Toggle Heading 3",
        subtitle: "H3 with a toggle drop-down",
        icon: <Heading3 className="size-4" />,
        keywords: ["toggle h3", "h3 toggle", "toggle heading 3", "details"],
        run: () => {
          if (editor.isActive("detailsSummary")) {
            editor.chain().focus().updateAttributes("detailsSummary", { level: 3 }).run()
          } else {
            editor.chain().focus().setDetails().updateAttributes("detailsSummary", { level: 3 }).run()
          }
        },
      },
      {
        title: "Toggle Heading 4",
        subtitle: "H4 with a toggle drop-down",
        icon: <Heading3 className="size-4 opacity-70" />,
        keywords: ["toggle h4", "h4 toggle", "toggle heading 4", "details"],
        run: () => {
          if (editor.isActive("detailsSummary")) {
            editor.chain().focus().updateAttributes("detailsSummary", { level: 4 }).run()
          } else {
            editor.chain().focus().setDetails().updateAttributes("detailsSummary", { level: 4 }).run()
          }
        },
      },
      {
        title: "Bullet list",
        subtitle: "Create a bulleted list",
        icon: <List className="size-4" />,
        keywords: ["bullet", "list", "ul"],
        shortcut: "-",
        run: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        title: "Numbered list",
        subtitle: "Create a numbered list",
        icon: <ListOrdered className="size-4" />,
        keywords: ["ordered", "list", "ol"],
        shortcut: "1.",
        run: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        title: "To-do list",
        subtitle: "Track tasks with checkboxes",
        icon: <CheckSquare className="size-4" />,
        keywords: ["todo", "task", "checkbox"],
        shortcut: "[]",
        run: () => editor.chain().focus().toggleTaskList().run(),
      },
      {
        title: "Quote",
        subtitle: "Capture a quote",
        icon: <Quote className="size-4" />,
        keywords: ["quote", "blockquote"],
        shortcut: ">",
        run: () => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        title: "Code block",
        subtitle: "Write code with monospaced font",
        icon: <Code className="size-4" />,
        keywords: ["code", "snippet"],
        shortcut: "```",
        run: () => editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        title: "Divider",
        subtitle: "Insert a horizontal rule",
        icon: <Minus className="size-4" />,
        keywords: ["divider", "hr", "rule"],
        shortcut: "---",
        run: () => editor.chain().focus().setHorizontalRule().run(),
      },
      {
        title: "Table",
        subtitle: "Insert a 3x3 table",
        icon: <TableIcon className="size-4" />,
        keywords: ["table", "grid"],
        run: () =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run(),
      },
      {
        title: "Toggle list",
        subtitle: "Toggle content visibility",
        icon: <ChevronRight className="size-4" />,
        keywords: ["toggle", "details", "expand"],
        run: () => editor.chain().focus().setDetails().run(),
      },
      {
        title: "Callout",
        subtitle: "Make it stand out",
        icon: <Sparkles className="size-4" />,
        keywords: ["callout", "info", "notice"],
        run: () => editor.chain().focus().toggleBlockquote().updateAttributes('blockquote', { type: 'callout' }).run(),
      },
      {
        title: "YouTube",
        subtitle: "Embed a video",
        icon: <YoutubeIcon className="size-4" />,
        keywords: ["youtube", "video", "embed"],
        run: () => {
          const url = prompt("Enter YouTube URL")
          if (url) {
            editor.chain().focus().setYoutubeVideo({ src: url }).run()
          }
        },
      },
      {
        title: "Emoji",
        subtitle: "Insert an emoji",
        icon: <Smile className="size-4" />,
        keywords: ["emoji", "face", "smile"],
        run: () => {
          const { from } = editor.state.selection
          const coords = editor.view.coordsAtPos(from)
          const wrapperRect = wrapperRef.current?.getBoundingClientRect()
          if (!wrapperRect) return

          setEditorEmojiPicker({
            left: coords.left,
            top: coords.bottom + 8,
            pos: from
          })
        },
      },
    ]
  }, [editor, onAddSubpage])



  const filteredSlashItems = useMemo(() => {
    const q = slashQuery.trim().toLowerCase()
    if (!q) return slashItems
    return slashItems.filter((item) => {
      const hay = [item.title, item.subtitle ?? "", ...item.keywords]
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [slashItems, slashQuery])

  const onSearchInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && slashQuery === "") {
      e.preventDefault()
      closeSlashMenu()
      editor?.commands.focus()
    }
  }, [slashQuery, closeSlashMenu, editor])

  useEffect(() => {
    if (!editor) return

    const updateSlash = () => {
      const before = getTextBeforeCursorInParent(editor)

      const match = before.match(/(?:^|\s)\/(\S*)$/)
      if (!match) {
        const virtualStart = virtualSlashStartRef.current
        const { selection } = editor.state

        if (virtualStart !== null && selection.empty && selection.from >= virtualStart) {
          const query = editor.state.doc.textBetween(virtualStart, selection.from, "\n")
          const sameTextblock =
            editor.state.doc.resolve(virtualStart).parent === selection.$from.parent

          if (sameTextblock && !query.includes("\n")) {
            const coords = editor.view.coordsAtPos(selection.from)
            const wrapperRect = wrapperRef.current?.getBoundingClientRect()
            if (!wrapperRect) return

            setSlashOpen(true)
            setSlashQuery(query)
            setSlashDeleteRange(
              selection.from > virtualStart
                ? { from: virtualStart, to: selection.from }
                : null
            )
            setSlashPos(calculateSlashPosition(coords))
            return
          }
        }

        closeSlashMenu()
        return
      }

      virtualSlashStartRef.current = null
      const query = match[1] ?? ""

      const { from } = editor.state.selection
      const deleteFrom = from - (query.length + 1)
      const deleteTo = from

      const coords = editor.view.coordsAtPos(from)
      const wrapperRect = wrapperRef.current?.getBoundingClientRect()
      if (!wrapperRect) return

      setSlashOpen(true)
      setSlashQuery(query)
      setSlashDeleteRange({ from: deleteFrom, to: deleteTo })
      setSlashPos(calculateSlashPosition(coords))
    }

    updateSlash()

    editor.on("update", updateSlash)
    editor.on("selectionUpdate", updateSlash)

    return () => {
      editor.off("update", updateSlash)
      editor.off("selectionUpdate", updateSlash)
    }
  }, [closeSlashMenu, editor, calculateSlashPosition])

  const runSlashItem = useCallback((item: SlashItem) => {
    if (!editor) return
    if (slashDeleteRange) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: slashDeleteRange.from, to: slashDeleteRange.to })
        .run()
    }
    item.run()
    closeSlashMenu()
  }, [editor, slashDeleteRange, closeSlashMenu])

  useEffect(() => {
    if (!slashOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        closeSlashMenu()
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        if (filteredSlashItems.length > 0) {
          setSlashSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredSlashItems.length - 1
          )
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        if (filteredSlashItems.length > 0) {
          setSlashSelectedIndex((prev) =>
            prev < filteredSlashItems.length - 1 ? prev + 1 : 0
          )
        }
      } else if (e.key === "Enter") {
        e.preventDefault()
        if (filteredSlashItems.length > 0) {
          const item = filteredSlashItems[slashSelectedIndex]
          if (item) {
            runSlashItem(item)
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [closeSlashMenu, slashOpen, filteredSlashItems, slashSelectedIndex, runSlashItem])

  useEffect(() => {
    if (!slashOpen) return

    const preventDefault = (e: Event) => {
      const target = e.target as Element | null
      if (target?.closest(".motion-slash-menu-list")) {
        return
      }
      e.preventDefault()
    }

    window.addEventListener("wheel", preventDefault, { passive: false })
    window.addEventListener("touchmove", preventDefault, { passive: false })

    const preventScrollKeys = (e: KeyboardEvent) => {
      const keys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]
      if (keys.includes(e.key)) {
        const target = e.target as Element | null
        if (target?.closest(".motion-slash-menu")) {
          return
        }
        e.preventDefault()
      }
    }
    window.addEventListener("keydown", preventScrollKeys, { passive: false })

    return () => {
      window.removeEventListener("wheel", preventDefault)
      window.removeEventListener("touchmove", preventDefault)
      window.removeEventListener("keydown", preventScrollKeys)
    }
  }, [slashOpen])

  useEffect(() => {
    if (!slashOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest(".motion-slash-menu")) {
        return
      }
      closeSlashMenu()
    }

    window.addEventListener("pointerdown", onPointerDown)
    return () => window.removeEventListener("pointerdown", onPointerDown)
  }, [slashOpen, closeSlashMenu])

  useEffect(() => {
    if (slashOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 10)
    }
  }, [slashOpen])

  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "auto",
        block: "nearest",
      })
    }
  }, [slashSelectedIndex])

  useEffect(() => {
    if (!editorEmojiPicker) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest(".emoji-picker-dialog")) return
      setEditorEmojiPicker(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditorEmojiPicker(null)
    }

    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [editorEmojiPicker])

  // Global Keyboard Shortcuts for selected blocks
  useEffect(() => {
    if (!editor) return

    const onKeyDown = (e: KeyboardEvent) => {
      const { selection } = editor.state
      if (!(selection instanceof NodeSelection)) return

      const target = { from: selection.from, to: selection.to }

      // Duplicate: Ctrl+D
      if (e.ctrlKey && e.key === "d") {
        e.preventDefault()
        const { from, to } = target
        const isMulti = rangeSpansMultipleBlocks(editor.state.doc, from, to)
        if (isMulti) {
          const slice = editor.state.doc.slice(from, to)
          editor.chain().focus().insertContentAt(to, slice.content.toJSON()).run()
        } else {
          const node = editor.state.doc.nodeAt(from)
          if (node) {
            editor.chain().focus().insertContentAt(to, {
              type: node.type.name,
              attrs: { ...node.attrs, id: undefined },
              content: node.content.toJSON()
            }).run()
          }
        }
      }
      // Delete: Del
      if (e.key === "Delete") {
        e.preventDefault()
        try {
          const sel = NodeSelection.create(editor.state.doc, target.from)
          const tr = editor.state.tr.setSelection(sel).deleteSelection()
          editor.view.dispatch(tr)
        } catch {
          editor.view.dispatch(editor.state.tr.delete(target.from, target.to))
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [editor])

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
        className={`flex items-center justify-between w-full px-3 py-1.5 text-sm text-left transition-colors outline-none ${
          isSelected
            ? "bg-zinc-100 dark:bg-zinc-800 text-black dark:text-white"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-black dark:hover:text-white"
        }`}
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

  const handleWrapperClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (editor && !editor.isEditable) {
      const target = e.target as HTMLElement
      const detailsContainer = target.closest('[data-type="details"]')
      if (detailsContainer) {
        const isContentClick = target.closest('[data-type="detailsContent"]')
        const isLinkClick = target.closest('a')
        if (!isContentClick && !isLinkClick) {
          const toggleButton = detailsContainer.querySelector('button[type="button"]') as HTMLButtonElement | null
          if (toggleButton && target !== toggleButton) {
            toggleButton.click()
            e.preventDefault()
            e.stopPropagation()
          }
        }
      }
    }
  }, [editor])

  return (
    <div ref={wrapperRef} className="simple-editor-wrapper relative" onClick={handleWrapperClick}>
      <EditorContext.Provider value={{ editor }}>
        {/* Custom Table handles are handled natively inside TableNodeView */}

        {/* Text Formatting Bubble Menu */}
        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor, state }: { editor: Editor; state: EditorState }) => {
              const { selection } = state
              const { empty } = selection

              if (empty || selection instanceof NodeSelection || editor.isActive("image") || editor.isActive("codeBlock") || showAiToolbar) {
                return false
              }
              return true
            }}

          >
            <div className="flex flex-col items-start gap-1">
              <div className="flex items-center gap-0.5 p-1 rounded-lg border bg-popover shadow-xl">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 text-purple-400 hover:text-purple-300 hover:bg-purple-950/20 ${aiBubbleOpen ? 'bg-purple-950/30' : ''}`}
                  onClick={() => setAiBubbleOpen(!aiBubbleOpen)}
                  title="Ask AI"
                >
                  <Sparkles className="size-3.5 animate-pulse" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive('bold') ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                >
                  <Bold className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive('italic') ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                  <Italic className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive('underline') ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                  <UnderlineIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive('strike') ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                >
                  <Strikethrough className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive('code') ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().toggleCode().run()}
                >
                  <Code className="size-3.5" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive('subscript') ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().toggleSubscript().run()}
                >
                  <SubscriptIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive('superscript') ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().toggleSuperscript().run()}
                >
                  <SuperscriptIcon className="size-3.5" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />

                {/* Font Family Selector (Simple) */}
                <select
                  className="bg-transparent text-[11px] outline-none cursor-pointer px-1 hover:bg-muted rounded"
                  onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
                  value={editor.getAttributes('textStyle').fontFamily || ''}
                >
                  <option value="">Default</option>
                  <option value="Inter">Inter</option>
                  <option value="DM Sans">DM Sans</option>
                  <option value="monospace">Monospace</option>
                  <option value="serif">Serif</option>
                </select>

                <div className="w-px h-4 bg-border mx-1" />

                {/* Color Selection (Simplified) */}
                <div className="flex items-center gap-0.5 px-1">
                  {['inherit', '#ff0000', '#00ff00', '#0000ff', '#f59e0b', '#8b5cf6', '#ec4899'].map(c => (
                    <button
                      key={c}
                      className="size-3.5 rounded-full border border-border/50 transition-transform hover:scale-125"
                      style={{ backgroundColor: c === 'inherit' ? 'transparent' : c }}
                      onClick={() => editor.chain().focus().setColor(c === 'inherit' ? '' : c).run()}
                      title={c === 'inherit' ? 'Default' : c}
                    />
                  ))}
                </div>

                <div className="w-px h-4 bg-border mx-1" />

                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive('highlight') ? 'bg-muted text-primary' : ''}`}
                  onClick={() => {
                    const current = editor.getAttributes('highlight').color
                    if (current) editor.chain().focus().unsetHighlight().run()
                    else editor.chain().focus().setHighlight({ color: '#fef08a' }).run()
                  }}
                  title="Highlight"
                >
                  <Palette className="size-3.5" />
                </Button>

                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                >
                  <AlignLeft className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                >
                  <AlignCenter className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`size-7 ${editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''}`}
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                >
                  <AlignRight className="size-3.5" />
                </Button>
              </div>
              {aiBubbleOpen && (
                <div className="z-[110] relative mt-1">
                  <AiBubbleMenu
                    isOpen={aiBubbleOpen}
                    onClose={() => setAiBubbleOpen(false)}
                    onSubmit={handleAiBubbleSubmit}
                  />
                </div>
              )}
            </div>
          </BubbleMenu>
        )}

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />

        {editor && <TableControlsOverlay editor={editor} />}

        {/* Block Drag Handle + Context Menu */}
        {editor && (
          <BlockDragHandle
            editor={editor}
            wrapperRef={wrapperRef}
            onInsertBlock={insertParagraphAfterTarget}
            onAddSubpage={onAddSubpage}
          />
        )}

        {slashOpen && slashPos && editor && (
          <div
            className="fixed z-[100] motion-slash-menu w-[280px] rounded-lg border border-border/80 bg-background text-popover-foreground shadow-[0_4px_16px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-1 duration-100"
            style={{
              left: slashPos.left,
              ...(slashPos.direction === 'up' ? { bottom: slashPos.bottom } : { top: slashPos.top }),
              maxHeight: `${slashPos.maxHeight}px`
            }}
          >
            {/* Inline search input */}
            <div className="px-2.5 pt-2 pb-1.5 flex items-center border-b border-border/10 shrink-0">
              <input
                ref={searchInputRef}
                type="text"
                className="w-full bg-transparent border-none outline-none text-[13px] placeholder:text-muted-foreground/40 text-foreground"
                placeholder="/Type to search"
                value={slashQuery}
                onChange={(e) => setSlashQuery(e.target.value)}
                onKeyDown={onSearchInputKeyDown}
              />
            </div>

            {/* Pinned label header */}
            {filteredSlashItems.length > 0 && (
              <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground/50 tracking-wider uppercase select-none shrink-0">
                Basic blocks
              </div>
            )}

            {/* Scrollable list */}
            <div className="motion-slash-menu-list overflow-y-auto flex-grow p-1 custom-scrollbar">
              {filteredSlashItems.length === 0 ? (
                <div className="px-3 py-6 text-center text-[13px] text-muted-foreground/60 italic select-none">
                  No results
                </div>
              ) : (
                filteredSlashItems.map((item, index) => (
                  <div
                    key={item.title}
                    ref={index === slashSelectedIndex ? activeItemRef : null}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => runSlashItem(item)}
                    className={`px-2.5 py-1.5 flex items-center justify-between cursor-pointer rounded select-none outline-none transition-colors ${index === slashSelectedIndex
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-accent/40"
                      }`}
                    onMouseEnter={() => setSlashSelectedIndex(index)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="size-4 flex items-center justify-center shrink-0 text-muted-foreground/75">
                        {item.icon}
                      </span>
                      <span className="text-[13px] font-medium tracking-tight truncate text-foreground/90">
                        {item.title}
                      </span>
                    </div>
                    {item.shortcut && (
                      <span className="text-[10px] text-muted-foreground/45 font-mono select-none pl-2 shrink-0">
                        {item.shortcut}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Pinned dismiss footer */}
            <div
              onClick={() => {
                closeSlashMenu()
                editor?.commands.focus()
              }}
              className="border-t border-border/10 p-1.5 flex justify-between items-center text-[10.5px] text-muted-foreground/50 hover:text-muted-foreground/80 cursor-pointer hover:bg-accent/30 select-none shrink-0"
            >
              <span>Close menu</span>
              <kbd className="font-mono text-[9px] bg-muted/60 px-1 py-0.5 rounded border border-border/30 text-muted-foreground/60">esc</kbd>
            </div>
          </div>
        )}

        {editorEmojiPicker && editor && (
          <div
            className="fixed z-[100] emoji-picker-dialog"
            style={{ left: editorEmojiPicker.left, top: editorEmojiPicker.top }}
          >
            <div className="w-[320px] bg-popover rounded-xl border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col">
              <div className="p-3 flex flex-col max-h-[320px]">
                <div className="flex gap-2 items-center bg-muted/30 rounded-lg px-2.5 py-1.5 border border-border/50 mb-3 focus-within:border-primary/50 transition-colors">
                  <Search className="size-3.5 text-muted-foreground" />
                  <input
                    placeholder="Search emojis..."
                    className="bg-transparent border-none outline-none text-[13px] w-full"
                    value={editorEmojiSearch}
                    onChange={(e) => setEditorEmojiSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-8 gap-1 overflow-y-auto custom-scrollbar pr-1">
                  {["✨", "🚀", "📝", "🎨", "🌈", "🏔️", "💡", "⚡", "🔥", "🍀", "📖", "📓", "📒", "📚", "📔", "📕", "📗", "📘", "📙", "💼", "📁", "📂", "📅", "📆", "🗓️", "📊", "📈", "📉", "🔍", "🕵️", "🏠", "🏡", "🏘️", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏰", "🏯", "🗼", "🗽", "⛲", "⛺", "🌁", "🌃", "🏙️", "🌆", "🌇", "🌉", "🌌", "🎠", "🎡", "🎢", "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦵", "🦿", "🦶", "👣", "👂", "🦻", "👃", "🫀", "🫁", "🧠", "🦷", "🦴", "👀", "👁", "👅", "👄", "💋", "🩸"]
                    .filter(e => e.includes(editorEmojiSearch) || editorEmojiSearch === "").map(emoji => (
                      <button
                        key={emoji}
                        className="size-8 flex items-center justify-center hover:bg-muted rounded-md transition-colors text-xl"
                        onClick={() => {
                          editor.chain().focus().insertContent(emoji).run()
                          setEditorEmojiPicker(null)
                          setEditorEmojiSearch("")
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {aiCommandOpen && aiCommandPos && editor && (
          <AiCommandMenu
            isOpen={aiCommandOpen}
            onClose={() => setAiCommandOpen(false)}
            onSubmit={handleAiCommandSubmit}
            position={aiCommandPos}
            selectedText={editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)}
          />
        )}

        {showAiToolbar && (
          <AiStreamToolbar
            isStreaming={isStreaming}
            onKeep={handleKeep}
            onTryAgain={handleTryAgain}
            onDiscard={handleDiscard}
            onClose={cleanupAiState}
          />
        )}

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
      </EditorContext.Provider>
    </div>
  )
}

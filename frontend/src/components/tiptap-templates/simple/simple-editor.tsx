"use client"

import type { JSONContent } from "@tiptap/core"
import { useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { Image } from "@tiptap/extension-image"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { Selection } from "@tiptap/extensions"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableCell } from "@tiptap/extension-table-cell"
import { TableHeader } from "@tiptap/extension-table-header"
import { Placeholder } from "@tiptap/extension-placeholder"
import { Link } from "@tiptap/extension-link"
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { common, createLowlight } from "lowlight"
import { Details, DetailsSummary, DetailsContent } from "@tiptap/extension-details"

import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Table as TableIcon,
  Trash2,
  FileText,
  ChevronDown as ChevronDownIcon,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
} from "lucide-react"

import { Button } from "@/components/ui/button"

// --- UI Primitives ---
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
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

const lowlight = createLowlight(common)

type SlashItem = {
  title: string
  subtitle?: string
  icon?: any
  keywords: string[]
  run: () => void
}

function getTextBeforeCursorInParent(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { selection } = editor.state
  const $from = selection.$from
  return $from.parent.textBetween(0, $from.parentOffset, "\n")
}

export function SimpleEditor({
  content,
  onContentChange,
  onReady,
  onAddSubpage,
}: {
  content?: JSONContent
  onContentChange?: (content: JSONContent) => void
  onReady?: (editor: NonNullable<ReturnType<typeof useEditor>>) => void
  onAddSubpage?: () => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState("")
  const [slashPos, setSlashPos] = useState<{ left: number; top: number } | null>(
    null
  )
  const [slashDeleteRange, setSlashDeleteRange] = useState<{
    from: number
    to: number
  } | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "tiptap simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        codeBlock: false,
        link: false,
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Image,
      Typography,
      Superscript,
      Subscript,
      Selection,
      Link.configure({
        openOnClick: false,
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
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
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
      Details.configure({
        HTMLAttributes: {
          class: "details",
        },
      }),
      DetailsSummary,
      DetailsContent,
    ],
    content,
    onUpdate: ({ editor }) => {
      onContentChange?.(editor.getJSON())
    },
  })

  useEffect(() => {
    if (!editor) return
    onReady?.(editor)
  }, [editor, onReady])

  const isEmpty = useMemo(() => {
    if (!editor) return true
    return editor.isEmpty
  }, [editor, editor?.state])

  const slashItems = useMemo<SlashItem[]>(() => {
    if (!editor) return []
    return [
      {
        title: "Subpage",
        subtitle: "Create a nested page",
        icon: <FileText className="size-4" />,
        keywords: ["sub", "page", "child", "nested"],
        run: () => onAddSubpage?.(),
      },
      {
        title: "Heading 1",
        subtitle: "Big section heading",
        icon: <Heading1 className="size-4" />,
        keywords: ["h1", "heading", "title"],
        run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        title: "Heading 2",
        subtitle: "Medium section heading",
        icon: <Heading2 className="size-4" />,
        keywords: ["h2", "heading"],
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        title: "Heading 3",
        subtitle: "Small section heading",
        icon: <Heading3 className="size-4" />,
        keywords: ["h3", "heading"],
        run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        title: "Bullet list",
        subtitle: "Create a bulleted list",
        icon: <List className="size-4" />,
        keywords: ["bullet", "list", "ul"],
        run: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        title: "Numbered list",
        subtitle: "Create a numbered list",
        icon: <ListOrdered className="size-4" />,
        keywords: ["ordered", "list", "ol"],
        run: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        title: "To-do list",
        subtitle: "Track tasks with checkboxes",
        icon: <CheckSquare className="size-4" />,
        keywords: ["todo", "task", "checkbox"],
        run: () => editor.chain().focus().toggleTaskList().run(),
      },
      {
        title: "Quote",
        subtitle: "Capture a quote",
        icon: <Quote className="size-4" />,
        keywords: ["quote", "blockquote"],
        run: () => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        title: "Code block",
        subtitle: "Write code with monospaced font",
        icon: <Code className="size-4" />,
        keywords: ["code", "snippet"],
        run: () => editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        title: "Divider",
        subtitle: "Insert a horizontal rule",
        icon: <Minus className="size-4" />,
        keywords: ["divider", "hr", "rule"],
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

  useEffect(() => {
    if (!editor) return

    const updateSlash = () => {
      const before = getTextBeforeCursorInParent(editor)

      const match = before.match(/(?:^|\s)\/(\S*)$/)
      if (!match) {
        setSlashOpen(false)
        setSlashQuery("")
        setSlashPos(null)
        setSlashDeleteRange(null)
        return
      }

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
      setSlashPos({
        left: coords.left - wrapperRect.left,
        top: coords.bottom - wrapperRect.top + 8,
      })
    }

    updateSlash()

    editor.on("update", updateSlash)
    editor.on("selectionUpdate", updateSlash)

    return () => {
      editor.off("update", updateSlash)
      editor.off("selectionUpdate", updateSlash)
    }
  }, [editor])

  useEffect(() => {
    if (!slashOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSlashOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [slashOpen])

  const runSlashItem = (item: SlashItem) => {
    if (!editor) return
    if (slashDeleteRange) {
      editor
        .chain()
        .focus()
        .deleteRange({ from: slashDeleteRange.from, to: slashDeleteRange.to })
        .run()
    }
    item.run()
    setSlashOpen(false)
  }

  return (
    <div ref={wrapperRef} className="simple-editor-wrapper relative">
      <EditorContext.Provider value={{ editor }}>
        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor }) => editor.isActive("table")}
            options={{ placement: 'top' }}
          >
            <div className="flex items-center gap-0.5 p-1 rounded-lg border bg-popover shadow-xl">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                title="Add column before"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="Add column after"
              >
                <ChevronRight className="size-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => editor.chain().focus().addRowBefore().run()}
                title="Add row before"
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="Add row after"
              >
                <ChevronDownIcon className="size-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 hover:text-destructive"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                title="Delete column"
              >
                <Trash2 className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 hover:text-destructive"
                onClick={() => editor.chain().focus().deleteRow().run()}
                title="Delete row"
              >
                <Trash2 className="size-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 hover:text-destructive"
                onClick={() => editor.chain().focus().deleteTable().run()}
                title="Delete table"
              >
                <TableIcon className="size-3.5 text-destructive" />
              </Button>
            </div>
          </BubbleMenu>
        )}
        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />

        {isEmpty && (
          <div className="pointer-events-none max-w-[900px] mx-auto w-full text-muted-foreground/50 text-sm pt-2">
            Type <span className="text-muted-foreground">/</span> for commands
          </div>
        )}

        {slashOpen && slashPos && editor && (
          <div
            className="absolute z-50"
            style={{ left: slashPos.left, top: slashPos.top }}
          >
            <Command className="w-[320px] rounded-lg border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
              <CommandList className="max-h-[260px]">
                <CommandEmpty className="px-3 py-2 text-xs text-muted-foreground">
                  No results
                </CommandEmpty>
                {filteredSlashItems.map((item) => (
                  <CommandItem
                    key={item.title}
                    value={item.title}
                    onSelect={() => runSlashItem(item)}
                    className="px-3 py-2 flex items-center gap-3"
                  >
                    <div className="size-8 rounded bg-muted flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-sm font-medium text-foreground">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-xs text-muted-foreground">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </div>
        )}
      </EditorContext.Provider>
    </div>
  )
}

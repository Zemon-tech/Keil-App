"use client"

import type { JSONContent } from "@tiptap/core"
import { useEffect, useMemo, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor } from "@tiptap/react"

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

type SlashItem = {
  title: string
  subtitle?: string
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
}: {
  content?: JSONContent
  onContentChange?: (content: JSONContent) => void
  onReady?: (editor: NonNullable<ReturnType<typeof useEditor>>) => void
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
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
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
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
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
        title: "Heading 1",
        subtitle: "Big section heading",
        keywords: ["h1", "heading", "title"],
        run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        title: "Heading 2",
        subtitle: "Medium section heading",
        keywords: ["h2", "heading"],
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        title: "Heading 3",
        subtitle: "Small section heading",
        keywords: ["h3", "heading"],
        run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        title: "Bullet list",
        subtitle: "Create a bulleted list",
        keywords: ["bullet", "list", "ul"],
        run: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        title: "Numbered list",
        subtitle: "Create a numbered list",
        keywords: ["ordered", "list", "ol"],
        run: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        title: "To-do list",
        subtitle: "Track tasks with checkboxes",
        keywords: ["todo", "task", "checkbox"],
        run: () => editor.chain().focus().toggleTaskList().run(),
      },
      {
        title: "Quote",
        subtitle: "Capture a quote",
        keywords: ["quote", "blockquote"],
        run: () => editor.chain().focus().toggleBlockquote().run(),
      },
      {
        title: "Code block",
        subtitle: "Write code with monospaced font",
        keywords: ["code", "snippet"],
        run: () => editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        title: "Divider",
        subtitle: "Insert a horizontal rule",
        keywords: ["divider", "hr", "rule"],
        run: () => editor.chain().focus().setHorizontalRule().run(),
      },
    ]
  }, [editor])

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
                    className="px-3 py-2"
                  >
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

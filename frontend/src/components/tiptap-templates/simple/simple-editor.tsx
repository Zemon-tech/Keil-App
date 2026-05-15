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
import { BlockIdExtension } from "@/extensions/BlockIdExtension"
import { EnforceFinalBlockExtension } from "@/extensions/EnforceFinalBlockExtension"
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'

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
  Copy,
  Plus,
  Trash2,
  FileText,
  ChevronDown as ChevronDownIcon,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Bold,
  Italic,
  Strikethrough,
  RotateCcw,
  Link as LinkIcon,
  ArrowRight,
  MessageSquare,
  PencilLine,
  Sparkles,
  Check,
  SquareTerminal,
  Sigma,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

type BlockTarget = {
  from: number
  to: number
}

const DRAG_HANDLE_WIDTH = 56
const DRAG_HANDLE_GAP = 48
const BLOCK_HOVER_SELECTOR = [
  "li",
  "p",
  "pre",
  "blockquote",
  ".callout",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "table",
  '[data-type="details"]',
].join(", ")

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
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)

  useEffect(() => {
    setSlashSelectedIndex(0)
  }, [slashQuery])

  const [blockMenu, setBlockMenu] = useState<{
    left: number
    top: number
    target: BlockTarget | null
    type: string
  } | null>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<'none' | 'turn-into' | 'color'>('none')
  const [menuSearch, setMenuSearch] = useState("")
  const virtualSlashStartRef = useRef<number | null>(null)
  const currentBlockTargetRef = useRef<BlockTarget | null>(null)
  const blockMenuOpenRef = useRef(false)
  const hideHandleTimerRef = useRef<number | null>(null)

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
      BlockIdExtension,
      EnforceFinalBlockExtension,
      GlobalDragHandle.configure({
        dragHandleWidth: DRAG_HANDLE_WIDTH,
        scrollTreshold: 100,
        customNodes: ['taskItem', 'listItem'],
      }),
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

  const closeSlashMenu = useCallback(() => {
    virtualSlashStartRef.current = null
    setSlashOpen(false)
    setSlashQuery("")
    setSlashPos(null)
    setSlashDeleteRange(null)
  }, [])

  useEffect(() => {
    blockMenuOpenRef.current = Boolean(blockMenu)
  }, [blockMenu])

  const getDragHandle = useCallback(
    () => wrapperRef.current?.querySelector<HTMLElement>(".drag-handle") ?? null,
    []
  )

  const clearScheduledHandleHide = useCallback(() => {
    if (hideHandleTimerRef.current === null) return

    window.clearTimeout(hideHandleTimerRef.current)
    hideHandleTimerRef.current = null
  }, [])

  const showDragHandle = useCallback(
    (handle: HTMLElement, pinned = false) => {
      clearScheduledHandleHide()
      handle.dataset.show = "true"
      if (pinned) handle.dataset.pinned = "true"
      handle.classList.remove("hide")
    },
    [clearScheduledHandleHide]
  )

  const hasSelectedBlock = useCallback(() => {
    return editor?.state.selection instanceof NodeSelection
  }, [editor])

  const hideDragHandle = useCallback(
    (force = false) => {
      const handle = getDragHandle()
      if (!handle) return

      if (
        !force &&
        (blockMenuOpenRef.current ||
          handle.matches(":hover") ||
          hasSelectedBlock())
      ) {
        showDragHandle(handle, blockMenuOpenRef.current || hasSelectedBlock())
        return
      }

      currentBlockTargetRef.current = null
      handle.removeAttribute("data-show")
      handle.removeAttribute("data-pinned")
      handle.classList.add("hide")
    },
    [getDragHandle, hasSelectedBlock, showDragHandle]
  )

  const scheduleHandleHide = useCallback(
    (delay = 120) => {
      clearScheduledHandleHide()
      hideHandleTimerRef.current = window.setTimeout(() => {
        hideHandleTimerRef.current = null
        hideDragHandle()
      }, delay)
    },
    [clearScheduledHandleHide, hideDragHandle]
  )

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
      setSlashPos({
        left: coords.left - wrapperRect.left,
        top: coords.bottom - wrapperRect.top + 8,
      })
    },
    [editor]
  )

  const getTargetFromDragHandle = useCallback((): BlockTarget | null => {
    if (!editor) return null
    if (currentBlockTargetRef.current) return currentBlockTargetRef.current

    const handle = wrapperRef.current?.querySelector<HTMLElement>(".drag-handle")
    if (!handle) return null

    const rect = handle.getBoundingClientRect()
    const pos = editor.view.posAtCoords({
      left: rect.right + DRAG_HANDLE_GAP + 8,
      top: rect.top + rect.height / 2,
    })
    if (!pos) return null

    const $pos = editor.state.doc.resolve(pos.pos)
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth)
      if (node.type.name === "listItem" || node.type.name === "taskItem") {
        return { from: $pos.before(depth), to: $pos.after(depth) }
      }
    }

    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      const node = $pos.node(depth)
      if (node.isBlock) {
        return { from: $pos.before(depth), to: $pos.after(depth) }
      }
    }

    return null
  }, [editor])

  const getBlockTargetFromElement = useCallback(
    (element: HTMLElement): BlockTarget | null => {
      if (!editor) return null

      const rect = element.getBoundingClientRect()
      const pos = editor.view.posAtCoords({
        left: Math.min(rect.left + 8, rect.right - 1),
        top: rect.top + Math.min(12, Math.max(1, rect.height / 2)),
      })
      if (!pos) return null

      const $pos = editor.state.doc.resolve(pos.pos)

      for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth)
        if (node.type.name === "listItem" || node.type.name === "taskItem") {
          return { from: $pos.before(depth), to: $pos.after(depth) }
        }
      }

      for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth)
        if (node.isBlock) {
          return { from: $pos.before(depth), to: $pos.after(depth) }
        }
      }

      return null
    },
    [editor]
  )

  const getBlockElementAtPoint = useCallback(
    (clientX: number, clientY: number): HTMLElement | null => {
      if (!editor) return null

      const editorDom = editor.view.dom
      const findCandidate = (x: number, y: number) => {
        const elements = document.elementsFromPoint(x, y)

        for (const element of elements) {
          if (!(element instanceof HTMLElement)) continue
          if (!editorDom.contains(element)) continue

          const listItem = element.closest<HTMLElement>("li")
          if (listItem && editorDom.contains(listItem)) return listItem

          const details = element.closest<HTMLElement>('[data-type="details"]')
          if (details && editorDom.contains(details)) return details

          const block = element.closest<HTMLElement>(BLOCK_HOVER_SELECTOR)
          if (block && editorDom.contains(block)) return block
        }

        return null
      }

      const blockAtCursor = findCandidate(clientX, clientY)
      if (blockAtCursor) return blockAtCursor

      const editorRect = editorDom.getBoundingClientRect()
      const inEditorRow = clientY >= editorRect.top && clientY <= editorRect.bottom
      const inLeftGutter =
        clientX >= editorRect.left - DRAG_HANDLE_WIDTH - DRAG_HANDLE_GAP - 16 &&
        clientX < editorRect.left

      if (inEditorRow && inLeftGutter) {
        return findCandidate(editorRect.left + 8, clientY)
      }

      return null
    },
    [editor]
  )

  const positionDragHandleForBlock = useCallback((block: HTMLElement) => {
    const handle = getDragHandle()
    if (!handle) return

    const rect = block.getBoundingClientRect()
    const style = window.getComputedStyle(block)
    const parsedLineHeight = Number.parseFloat(style.lineHeight)
    const parsedFontSize = Number.parseFloat(style.fontSize)
    const lineHeight = Number.isFinite(parsedLineHeight)
      ? parsedLineHeight
      : parsedFontSize * 1.2
    const paddingTop = Number.parseFloat(style.paddingTop) || 0
    const top = rect.top + paddingTop + (lineHeight - 20) / 2
    const left = rect.left - DRAG_HANDLE_WIDTH - DRAG_HANDLE_GAP

    handle.style.left = `${Math.round(left)}px`
    handle.style.top = `${Math.round(top)}px`
    showDragHandle(handle)
  }, [getDragHandle, showDragHandle])

  const selectBlockTarget = useCallback(
    (target: BlockTarget | null) => {
      if (!editor || !target) return false

      try {
        const selection = NodeSelection.create(editor.state.doc, target.from)
        editor.view.dispatch(editor.state.tr.setSelection(selection))
        editor.view.focus()
        return true
      } catch {
        editor.chain().focus().setTextSelection(target.from).run()
        return false
      }
    },
    [editor]
  )

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

  useEffect(() => {
    if (!editor) return
    onReady?.(editor)
  }, [editor, onReady])

  useEffect(() => {
    if (!editor) return

    let handle: HTMLElement | null = null
    let plusButton: HTMLButtonElement | null = null
    let keepHandleVisible: (() => void) | null = null
    let releaseHandle: ((event: PointerEvent) => void) | null = null

    const openBlockMenu = (event: MouseEvent) => {
      if (!handle || plusButton?.contains(event.target as Node)) return

      event.preventDefault()
      event.stopPropagation()

      const target = getTargetFromDragHandle()
      selectBlockTarget(target)
      showDragHandle(handle, true)

      const rect = handle.getBoundingClientRect()
      const wrapperRect = wrapperRef.current?.getBoundingClientRect()
      if (!wrapperRect) return

      setBlockMenu({
        left: rect.right + 12,
        top: rect.top - 8,
        target,
        type: editor.state.doc.nodeAt(target.from)?.type.name || "text"
      })
      setActiveSubmenu('none')
      setMenuSearch("")
      closeSlashMenu()
    }

    const addBlockFromHandle = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      setBlockMenu(null)
      const handle = getDragHandle()
      if (handle) showDragHandle(handle, true)
      insertParagraphAfterTarget(getTargetFromDragHandle())
    }

    const wireHandle = () => {
      const nextHandle =
        wrapperRef.current?.querySelector<HTMLElement>(".drag-handle") ?? null
      if (!nextHandle || nextHandle === handle) return

      handle?.removeEventListener("click", openBlockMenu)
      if (keepHandleVisible) {
        handle?.removeEventListener("pointerenter", keepHandleVisible)
      }
      if (releaseHandle) {
        handle?.removeEventListener("pointerleave", releaseHandle)
      }
      plusButton?.removeEventListener("click", addBlockFromHandle)

      handle = nextHandle
      handle.setAttribute("aria-label", "Open block actions")
      handle.setAttribute("title", "Click for actions. Drag to move.")

      plusButton = document.createElement("button")
      plusButton.type = "button"
      plusButton.innerHTML = "+"
      plusButton.className = "plus-button"
      plusButton.title = "Add a block below"
      plusButton.setAttribute("aria-label", "Add a block below")

      handle.querySelector(".plus-button")?.remove()
      handle.prepend(plusButton)

      keepHandleVisible = () => showDragHandle(handle!)
      releaseHandle = (event: PointerEvent) => {
        const relatedTarget = event.relatedTarget as Element | null
        if (
          relatedTarget?.closest(".motion-block-menu") ||
          relatedTarget?.closest(".drag-handle")
        ) {
          return
        }

        scheduleHandleHide()
      }

      handle.addEventListener("click", openBlockMenu)
      handle.addEventListener("pointerenter", keepHandleVisible)
      handle.addEventListener("pointerleave", releaseHandle)
      plusButton.addEventListener("click", addBlockFromHandle)
    }

    const frame = window.requestAnimationFrame(wireHandle)
    const observer = new MutationObserver(wireHandle)
    if (wrapperRef.current) {
      observer.observe(wrapperRef.current, { childList: true, subtree: true })
    }
    const editorParent = editor.view.dom.parentElement
    const keepExtensionFromHidingHandle = (event: MouseEvent) => {
      const relatedTarget = event.relatedTarget as Element | null
      if (
        relatedTarget?.closest(".drag-handle") ||
        relatedTarget?.closest(".motion-block-menu")
      ) {
        event.stopImmediatePropagation()
      }
    }
    editorParent?.addEventListener("mouseout", keepExtensionFromHidingHandle, true)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      clearScheduledHandleHide()
      editorParent?.removeEventListener(
        "mouseout",
        keepExtensionFromHidingHandle,
        true
      )
      handle?.removeEventListener("click", openBlockMenu)
      if (keepHandleVisible) {
        handle?.removeEventListener("pointerenter", keepHandleVisible)
      }
      if (releaseHandle) {
        handle?.removeEventListener("pointerleave", releaseHandle)
      }
      plusButton?.removeEventListener("click", addBlockFromHandle)
    }
  }, [
    closeSlashMenu,
    clearScheduledHandleHide,
    editor,
    getDragHandle,
    getTargetFromDragHandle,
    insertParagraphAfterTarget,
    scheduleHandleHide,
    selectBlockTarget,
    showDragHandle,
  ])

  useEffect(() => {
    if (!editor) return

    const wrapper = wrapperRef.current
    if (!wrapper) return

    const onPointerMove = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest(".motion-block-menu") || target?.closest(".drag-handle")) {
        clearScheduledHandleHide()
        return
      }

      const block = getBlockElementAtPoint(event.clientX, event.clientY)
      if (!block) {
        scheduleHandleHide()
        return
      }

      currentBlockTargetRef.current = getBlockTargetFromElement(block)
      positionDragHandleForBlock(block)
    }

    const onPointerLeave = (event: PointerEvent) => {
      const relatedTarget = event.relatedTarget as Element | null
      if (
        relatedTarget?.closest(".drag-handle") ||
        relatedTarget?.closest(".motion-block-menu")
      ) {
        return
      }

      if (!blockMenu) scheduleHandleHide()
    }

    wrapper.addEventListener("pointermove", onPointerMove)
    wrapper.addEventListener("pointerleave", onPointerLeave)

    return () => {
      wrapper.removeEventListener("pointermove", onPointerMove)
      wrapper.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [
    blockMenu,
    clearScheduledHandleHide,
    editor,
    getBlockElementAtPoint,
    getBlockTargetFromElement,
    positionDragHandleForBlock,
    scheduleHandleHide,
  ])



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
        title: "Heading 4",
        subtitle: "Extra small heading",
        icon: <Heading3 className="size-4" />, // Reusing Heading3 icon or similar
        keywords: ["h4", "heading"],
        run: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
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
      {
        title: "Callout",
        subtitle: "Make it stand out",
        icon: <Sparkles className="size-4" />,
        keywords: ["callout", "info", "notice"],
        run: () => editor.chain().focus().toggleBlockquote().run(), // Fallback to blockquote for now, will style it
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
            setSlashPos({
              left: coords.left,
              top: coords.bottom + 8,
            })
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
      setSlashPos({
        left: coords.left,
        top: coords.bottom + 8,
      })
    }

    updateSlash()

    editor.on("update", updateSlash)
    editor.on("selectionUpdate", updateSlash)

    return () => {
      editor.off("update", updateSlash)
      editor.off("selectionUpdate", updateSlash)
    }
  }, [closeSlashMenu, editor])

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
    if (!blockMenu) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest(".motion-block-menu") || target?.closest(".drag-handle")) {
        return
      }
      setBlockMenu(null)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBlockMenu(null)
    }

    window.addEventListener("pointerdown", onPointerDown)
    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("pointerdown", onPointerDown)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [blockMenu])

  const deleteBlockTarget = (target: BlockTarget | null) => {
    if (!editor || !target) return
    editor
      .chain()
      .focus()
      .deleteRange({ from: target.from, to: target.to })
      .run()
    setBlockMenu(null)
    closeSlashMenu()
  }

  const duplicateBlockTarget = (target: BlockTarget | null) => {
    if (!editor || !target) return
    const slice = editor.state.doc.slice(target.from, target.to)
    editor.view.dispatch(editor.state.tr.insert(target.to, slice.content))
    editor.view.focus()
    setBlockMenu(null)
    closeSlashMenu()
  }

  const copyBlockTarget = (target: BlockTarget | null) => {
    if (!editor || !target) return
    const text = editor.state.doc.textBetween(target.from, target.to, "\n\n")
    navigator.clipboard?.writeText(text).catch(() => undefined)
    setBlockMenu(null)
    closeSlashMenu()
  }

  return (
    <div ref={wrapperRef} className="simple-editor-wrapper relative">
      <EditorContext.Provider value={{ editor }}>
        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor }: { editor: Editor }) => editor.isActive("table")}
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
        
        {/* Text Formatting Bubble Menu */}
        {editor && (
          <BubbleMenu
            editor={editor}
            shouldShow={({ editor, state }: { editor: Editor; state: EditorState }) => {
              const { selection } = state
              const { empty } = selection
              
              if (empty || editor.isActive("image") || editor.isActive("table") || editor.isActive("codeBlock")) {
                return false
              }
              return true
            }}

          >
            <div className="flex items-center gap-0.5 p-1 rounded-lg border bg-popover shadow-xl">
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
            </div>
          </BubbleMenu>
        )}

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />

        {/* {isEmpty && (
          <div className="pointer-events-none max-w-[900px] mx-auto w-full text-muted-foreground/50 text-sm pt-2">
            Type <span className="text-muted-foreground">/</span> for commands
          </div>
        )} */}

        {blockMenu && (
          <div className="fixed z-[100] flex gap-1" style={{ left: blockMenu.left, top: blockMenu.top }}>
            {/* Main Block Menu */}
            <div
              className="motion-block-menu w-[260px] rounded-xl border bg-background p-1.5 text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-2 pb-2 pt-1">
                <input 
                  autoFocus
                  placeholder="Search actions..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full bg-muted/50 rounded-md px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground/50 border border-transparent focus:border-border/50"
                />
              </div>

              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-tight">
                {blockMenu.type.replace(/([A-Z])/g, ' $1').trim()}
              </div>

              <button
                type="button"
                className={cn("motion-block-menu__item justify-between group", activeSubmenu === 'turn-into' && "bg-accent")}
                onMouseEnter={() => setActiveSubmenu('turn-into')}
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="size-4" />
                  <span>Turn into</span>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              </button>

              <button
                type="button"
                className="motion-block-menu__item justify-between"
                onMouseEnter={() => setActiveSubmenu('none')}
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-4 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                    <div className="size-2 rounded-full bg-primary/40" />
                  </div>
                  <span>Color</span>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              </button>

              <div className="my-1.5 h-px bg-border/50" />

              <button className="motion-block-menu__item justify-between" onClick={() => copyBlockTarget(blockMenu.target)}>
                <div className="flex items-center gap-2.5">
                  <LinkIcon className="size-4" />
                  <span>Copy link to block</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Alt+⇧+L</span>
              </button>

              <button className="motion-block-menu__item justify-between" onClick={() => duplicateBlockTarget(blockMenu.target)}>
                <div className="flex items-center gap-2.5">
                  <Copy className="size-4" />
                  <span>Duplicate</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+D</span>
              </button>

              <button className="motion-block-menu__item justify-between">
                <div className="flex items-center gap-2.5">
                  <ArrowRight className="size-4" />
                  <span>Move to</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+⇧+P</span>
              </button>

              <button className="motion-block-menu__item motion-block-menu__item--danger justify-between" onClick={() => deleteBlockTarget(blockMenu.target)}>
                <div className="flex items-center gap-2.5">
                  <Trash2 className="size-4" />
                  <span>Delete</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Del</span>
              </button>

              <div className="my-1.5 h-px bg-border/50" />

              <button className="motion-block-menu__item justify-between">
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="size-4" />
                  <span>Comment</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+⇧+M</span>
              </button>

              <button className="motion-block-menu__item justify-between">
                <div className="flex items-center gap-2.5">
                  <PencilLine className="size-4" />
                  <span>Suggest edits</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+Alt+X</span>
              </button>

              <div className="my-1.5 h-px bg-border/50" />

              <button className="motion-block-menu__item justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="size-4 text-primary" />
                  <span>Ask AI</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+J</span>
              </button>

              <div className="mt-2 px-2.5 py-2 border-t border-border/40 text-[10px] text-muted-foreground/50 leading-relaxed">
                Last edited by Rohan Vashist<br />
                May 15, 2026, 7:55 PM
              </div>
            </div>

            {/* Turn Into Submenu */}
            {activeSubmenu === 'turn-into' && (
              <div className="motion-block-menu w-[220px] rounded-xl border bg-background p-1 text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-left-2 duration-150 h-fit max-h-[400px] overflow-y-auto custom-scrollbar">
                {[
                  { id: 'paragraph', title: 'Text', icon: <FileText className="size-4" />, run: () => editor?.chain().focus().setParagraph().run() },
                  { id: 'heading1', title: 'Heading 1', icon: <Heading1 className="size-4" />, run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
                  { id: 'heading2', title: 'Heading 2', icon: <Heading2 className="size-4" />, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
                  { id: 'heading3', title: 'Heading 3', icon: <Heading3 className="size-4" />, run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
                  { id: 'heading4', title: 'Heading 4', icon: <Heading3 className="size-4 opacity-70" />, run: () => editor?.chain().focus().toggleHeading({ level: 4 }).run() },
                  { id: 'page', title: 'Page', icon: <FileText className="size-4" />, run: () => onAddSubpage?.() },
                  { id: 'page_in', title: 'Page in', icon: <FileText className="size-4" />, run: () => {}, hasSub: true },
                  { id: 'bulletList', title: 'Bulleted list', icon: <List className="size-4" />, run: () => editor?.chain().focus().toggleBulletList().run() },
                  { id: 'orderedList', title: 'Numbered list', icon: <ListOrdered className="size-4" />, run: () => editor?.chain().focus().toggleOrderedList().run() },
                  { id: 'taskList', title: 'To-do list', icon: <CheckSquare className="size-4" />, run: () => editor?.chain().focus().toggleTaskList().run() },
                  { id: 'details', title: 'Toggle list', icon: <ChevronRight className="size-4" />, run: () => editor?.chain().focus().setDetails().run() },
                  { id: 'codeBlock', title: 'Code', icon: <Code className="size-4" />, run: () => editor?.chain().focus().toggleCodeBlock().run() },
                  { id: 'blockquote', title: 'Quote', icon: <Quote className="size-4" />, run: () => editor?.chain().focus().toggleBlockquote().run() },
                  { id: 'callout', title: 'Callout', icon: <SquareTerminal className="size-4" />, run: () => editor?.chain().focus().toggleBlockquote().run() },
                  { id: 'equation', title: 'Block equation', icon: <Sigma className="size-4" />, run: () => {} },
                  { id: 'synced', title: 'Synced block', icon: <RotateCcw className="size-4" />, run: () => {} },
                ].map((item) => (
                  <button
                    key={item.id}
                    className="motion-block-menu__item justify-between"
                    onClick={() => {
                      if (!item.hasSub) {
                        item.run();
                        setBlockMenu(null);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {blockMenu.type.toLowerCase().includes(item.id.toLowerCase()) && <Check className="size-3.5 text-primary" />}
                      {item.hasSub && <ChevronRight className="size-3.5 text-muted-foreground/30" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {slashOpen && slashPos && editor && (
          <div
            className="fixed z-[100]"
            style={{ left: slashPos.left, top: slashPos.top }}
          >
            <div className="w-[320px] rounded-xl border bg-popover/95 backdrop-blur-md text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="max-h-[320px] overflow-y-auto p-1.5 custom-scrollbar">
                {filteredSlashItems.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground/60 italic">
                    No results found.
                  </div>
                )}
                <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Basic blocks
                </div>
                {filteredSlashItems.map((item, index) => (
                  <div
                    key={item.title}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => runSlashItem(item)}
                    className={`px-3 py-2 flex items-center gap-3 cursor-pointer rounded-lg select-none outline-none transition-colors ${
                      index === slashSelectedIndex ? "bg-accent text-accent-foreground shadow-sm" : "text-foreground/80 hover:bg-accent/50"
                    }`}
                    onMouseEnter={() => setSlashSelectedIndex(index)}
                  >
                    <div className="size-9 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/40 text-muted-foreground shadow-sm transition-transform duration-200 group-hover:scale-105">
                      {item.icon}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="text-[13.5px] font-semibold tracking-tight">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-muted-foreground leading-none">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </EditorContext.Provider>
    </div>
  )
}

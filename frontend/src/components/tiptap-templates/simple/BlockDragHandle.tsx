"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react"
import type { Editor } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import {
  Plus,
  GripVertical,
  RotateCcw,
  Link as LinkIcon,
  Copy,
  ArrowRight,
  Trash2,
  MessageSquare,
  PencilLine,
  Sparkles,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Check,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  FileText,
  SquareTerminal,
  Sigma,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type BlockTarget = { from: number; to: number }

type BlockMenu = {
  left: number
  top?: number
  bottom?: number
  target: BlockTarget | null
  type: string
}

// How far the handle sits to the left of the block text
const DRAG_HANDLE_WIDTH = 36
const DRAG_HANDLE_GAP = 32 // increased to prevent overlapping nested block outlines/borders (Notion spacing)

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
  '[data-type="horizontalRule"]',
].join(", ")

const NOTION_COLORS = [
  { name: "Default", color: "inherit", bg: "transparent" },
  { name: "Gray", color: "#9B9A97", bg: "#EBeced" },
  { name: "Brown", color: "#64473A", bg: "#E9E5E3" },
  { name: "Orange", color: "#D9730D", bg: "#FAEBDD" },
  { name: "Yellow", color: "#DFAB01", bg: "#FBF3DB" },
  { name: "Green", color: "#0F7B6C", bg: "#DDEDEA" },
  { name: "Blue", color: "#0B6E99", bg: "#DDEBF1" },
  { name: "Purple", color: "#6940A5", bg: "#EAE4F2" },
  { name: "Pink", color: "#AD1A72", bg: "#F4DFEB" },
  { name: "Red", color: "#E03E3E", bg: "#FBE4E4" },
]

function rangeSpansMultipleBlocks(doc: any, from: number, to: number) {
  let blockCount = 0
  doc.nodesBetween(from, to, (node: any) => {
    if (node.isBlock) blockCount++
    return blockCount <= 1
  })
  return blockCount > 1
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface BlockDragHandleProps {
  editor: Editor
  wrapperRef: RefObject<HTMLDivElement | null>
  /** Called when the + button is clicked — inserts a new paragraph and opens slash menu */
  onInsertBlock: (target: BlockTarget | null) => void
  /** Last editor display string for the footer */
  lastEditedBy?: string
  lastEditedAt?: string
  /** onAddSubpage callback for "Turn into > Page" */
  onAddSubpage?: () => any
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BlockDragHandle({
  editor,
  wrapperRef,
  onInsertBlock,
  lastEditedBy,
  lastEditedAt,
  onAddSubpage,
}: BlockDragHandleProps) {
  // ── Handle position & visibility ──────────────────────────────────────────
  const [handlePos, setHandlePos] = useState<{ left: number; top: number } | null>(null)
  const [handleVisible, setHandleVisible] = useState(false)
  const [handlePinned, setHandlePinned] = useState(false)

  // ── Block menu ────────────────────────────────────────────────────────────
  const [blockMenu, setBlockMenu] = useState<BlockMenu | null>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<"none" | "turn-into" | "color" | "move-to">("none")
  const [menuSearch, setMenuSearch] = useState("")

  // ── Refs ──────────────────────────────────────────────────────────────────
  const currentBlockTargetRef = useRef<BlockTarget | null>(null)
  const blockMenuOpenRef = useRef(false)
  const hideTimerRef = useRef<number | null>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  // Keep blockMenuOpenRef in sync
  useEffect(() => {
    blockMenuOpenRef.current = Boolean(blockMenu)
  }, [blockMenu])

  // Reset submenu and search whenever menu closes
  useEffect(() => {
    if (!blockMenu) {
      setActiveSubmenu("none")
      setMenuSearch("")
    }
  }, [blockMenu])

  // ── Hide timer helpers ────────────────────────────────────────────────────
  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const hasSelectedBlock = useCallback(() => {
    return editor.state.selection instanceof NodeSelection
  }, [editor])

  const showHandle = useCallback(
    (pinned = false) => {
      clearHideTimer()
      setHandleVisible(true)
      if (pinned) setHandlePinned(true)
    },
    [clearHideTimer]
  )

  const hideHandle = useCallback(
    (force = false) => {
      if (
        !force &&
        (blockMenuOpenRef.current ||
          handleRef.current?.matches(":hover") ||
          hasSelectedBlock())
      ) {
        showHandle(blockMenuOpenRef.current || hasSelectedBlock())
        return
      }
      currentBlockTargetRef.current = null
      setHandleVisible(false)
      setHandlePinned(false)
    },
    [hasSelectedBlock, showHandle]
  )

  const scheduleHide = useCallback(
    (delay = 180) => {
      clearHideTimer()
      hideTimerRef.current = window.setTimeout(() => {
        hideTimerRef.current = null
        hideHandle()
      }, delay)
    },
    [clearHideTimer, hideHandle]
  )

  // ── Block element resolution ──────────────────────────────────────────────
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
          if (details && editorDom.contains(details)) {
            // ONLY return details if cursor is NOT inside the detailsContent wrapper (nested blocks)
            const detailsContent = element.closest<HTMLElement>('[data-type="detailsContent"]')
            if (!detailsContent) {
              return details
            }
          }

          const block = element.closest<HTMLElement>(BLOCK_HOVER_SELECTOR)
          if (block && editorDom.contains(block)) return block
        }
        return null
      }

      const editorRect = editorDom.getBoundingClientRect()
      const inEditorRow = clientY >= editorRect.top && clientY <= editorRect.bottom
      const isLeftArea = clientX < editorRect.left + 200

      if (inEditorRow && isLeftArea) {
        // Scan horizontally from right (inside content) to left (gutter edge)
        // to resolve the deepest (most specific) nested block at this clientY.
        // This handles indentation gaps for lists, toggles, blockquotes, and tables.
        let bestCandidate: HTMLElement | null = null
        for (let offset = 200; offset >= 8; offset -= 8) {
          const candidate = findCandidate(editorRect.left + offset, clientY)
          if (candidate) {
            if (!bestCandidate) {
              bestCandidate = candidate
            } else if (bestCandidate.contains(candidate)) {
              bestCandidate = candidate
            }
          }
        }
        if (bestCandidate) return bestCandidate
      }

      const blockAtCursor = findCandidate(clientX, clientY)
      if (blockAtCursor) return blockAtCursor

      return null
    },
    [editor]
  )

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

      const isDetailsElement = element.getAttribute("data-type") === "details" || element.closest('[data-type="detailsSummary"]')
      const isTableElement = element.tagName.toLowerCase() === "table" || element.closest('table')

      for (let depth = $pos.depth; depth > 0; depth -= 1) {
        const node = $pos.node(depth)
        if ((node.type.name === "table" && isTableElement) || (node.type.name === "details" && isDetailsElement)) {
          return { from: $pos.before(depth), to: $pos.after(depth) }
        }
      }
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

  // ── Position handle for a given block DOM element ─────────────────────────
  const positionHandleForBlock = useCallback(
    (block: HTMLElement) => {
      const rect = block.getBoundingClientRect()
      
      // Resolve the vertical reference element for complex blocks to target the first line/row
      let verticalRef = block
      const isDetails = block.getAttribute("data-type") === "details" || block.tagName.toLowerCase() === "details"
      
      if (isDetails) {
        const summary = block.querySelector('summary, [data-type="detailsSummary"]')
        if (summary instanceof HTMLElement) {
          verticalRef = summary
        }
      } else if (block.tagName.toLowerCase() === "table") {
        const firstRow = block.querySelector("tr")
        if (firstRow instanceof HTMLElement) {
          verticalRef = firstRow
        }
      }

      const verticalRect = verticalRef.getBoundingClientRect()
      const style = window.getComputedStyle(verticalRef)
      const parsedLineHeight = Number.parseFloat(style.lineHeight)
      const parsedFontSize = Number.parseFloat(style.fontSize)
      const lineHeight = Number.isFinite(parsedLineHeight)
        ? parsedLineHeight
        : parsedFontSize * 1.2
      const paddingTop = Number.parseFloat(style.paddingTop) || 0
      
      let top = verticalRect.top + paddingTop + (lineHeight - 24) / 2
      
      const isHorizontalRule = block.getAttribute("data-type") === "horizontalRule"
      if (isHorizontalRule) {
        // Center the drag handle vertically within the height of the divider block
        top = verticalRect.top + (verticalRect.height - 24) / 2
      }
      
      const left = rect.left - DRAG_HANDLE_WIDTH - DRAG_HANDLE_GAP

      setHandlePos({ left: Math.round(left), top: Math.round(top) })
      showHandle()
    },
    [showHandle]
  )

  // ── Pointer tracking ──────────────────────────────────────────────────────
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || !editor) return

    const onPointerMove = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest(".motion-block-menu") || target?.closest(".block-drag-handle")) {
        clearHideTimer()
        return
      }

      const block = getBlockElementAtPoint(event.clientX, event.clientY)
      if (!block) {
        scheduleHide()
        return
      }

      currentBlockTargetRef.current = getBlockTargetFromElement(block)
      positionHandleForBlock(block)
    }

    const onPointerLeave = (event: PointerEvent) => {
      const relatedTarget = event.relatedTarget as Element | null
      if (
        relatedTarget?.closest(".block-drag-handle") ||
        relatedTarget?.closest(".motion-block-menu")
      ) {
        return
      }
      if (!blockMenu) scheduleHide()
    }

    // Intercept the GlobalDragHandle extension's own mouseout-driven hide
    const editorParent = editor.view.dom.parentElement
    const keepExtensionFromHidingHandle = (event: MouseEvent) => {
      const relatedTarget = event.relatedTarget as Element | null
      if (
        relatedTarget?.closest(".block-drag-handle") ||
        relatedTarget?.closest(".motion-block-menu")
      ) {
        event.stopImmediatePropagation()
      }
    }

    wrapper.addEventListener("pointermove", onPointerMove)
    wrapper.addEventListener("pointerleave", onPointerLeave)
    editorParent?.addEventListener("mouseout", keepExtensionFromHidingHandle, true)

    return () => {
      wrapper.removeEventListener("pointermove", onPointerMove)
      wrapper.removeEventListener("pointerleave", onPointerLeave)
      editorParent?.removeEventListener("mouseout", keepExtensionFromHidingHandle, true)
    }
  }, [
    blockMenu,
    clearHideTimer,
    editor,
    getBlockElementAtPoint,
    getBlockTargetFromElement,
    positionHandleForBlock,
    scheduleHide,
    wrapperRef,
  ])

  // ── Close block menu on outside click / Escape ────────────────────────────
  useEffect(() => {
    if (!blockMenu) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (target?.closest(".motion-block-menu") || target?.closest(".block-drag-handle")) return
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

  // ── Block actions ─────────────────────────────────────────────────────────
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

  const deleteBlockTarget = useCallback(
    (target: BlockTarget | null) => {
      if (!editor || !target) return
      editor.commands.focus()
      const { state, view } = editor
      try {
        const selection = NodeSelection.create(state.doc, target.from)
        const tr = state.tr.setSelection(selection).deleteSelection()
        view.dispatch(tr)
      } catch {
        const tr = state.tr.delete(target.from, target.to)
        view.dispatch(tr)
      }
      setBlockMenu(null)
    },
    [editor]
  )

  const duplicateBlockTarget = useCallback(
    (target: BlockTarget | null) => {
      if (!editor || !target) return
      const { from, to } = target
      const isMultiBlock = rangeSpansMultipleBlocks(editor.state.doc, from, to)
      if (isMultiBlock) {
        const slice = editor.state.doc.slice(from, to)
        editor.chain().focus().insertContentAt(to, slice.content.toJSON()).run()
      } else {
        const node = editor.state.doc.nodeAt(from)
        if (!node) return
        editor
          .chain()
          .focus()
          .insertContentAt(to, {
            type: node.type.name,
            attrs: { ...node.attrs, id: undefined },
            content: node.content.toJSON(),
          })
          .run()
      }
      setBlockMenu(null)
    },
    [editor]
  )

  const copyBlockLink = useCallback(
    (target: BlockTarget | null) => {
      if (!editor || !target) return
      const node = editor.state.doc.nodeAt(target.from)
      const blockId = node?.attrs.id
      const url = blockId
        ? `${window.location.origin}${window.location.pathname}#${blockId}`
        : window.location.href
      navigator.clipboard?.writeText(url).catch(() => undefined)
      setBlockMenu(null)
    },
    [editor]
  )

  const executeMoveTo = useCallback(
    (position: "top" | "bottom") => {
      if (!editor || !blockMenu?.target) return
      const target = blockMenu.target
      const isMultiBlock = rangeSpansMultipleBlocks(editor.state.doc, target.from, target.to)
      let contentJSON: any
      if (isMultiBlock) {
        contentJSON = editor.state.doc.slice(target.from, target.to).content.toJSON()
      } else {
        const node = editor.state.doc.nodeAt(target.from)
        if (!node) return
        contentJSON = node.toJSON()
      }
      if (position === "top") {
        editor.chain().focus().deleteRange({ from: target.from, to: target.to }).insertContentAt(0, contentJSON).run()
      } else {
        editor
          .chain()
          .focus()
          .deleteRange({ from: target.from, to: target.to })
          .command(({ tr }) => {
            if (Array.isArray(contentJSON)) {
              contentJSON.forEach((n: any) => tr.insert(tr.doc.content.size, editor.schema.nodeFromJSON(n)))
            } else {
              tr.insert(tr.doc.content.size, editor.schema.nodeFromJSON(contentJSON))
            }
            return true
          })
          .run()
      }
      setBlockMenu(null)
    },
    [editor, blockMenu]
  )

  // ── Handle click → open block menu ───────────────────────────────────────
  const handleDragHandleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      const target = currentBlockTargetRef.current
      if (!target) return

      const { selection } = editor.state
      const spansMultiple = (() => {
        if (selection.empty) return false
        return rangeSpansMultipleBlocks(editor.state.doc, selection.from, selection.to)
      })()
      const isTargetInSelection =
        spansMultiple && target.from < selection.to && target.to > selection.from

      if (!isTargetInSelection) selectBlockTarget(target)
      showHandle(true)

      if (!handlePos) return

      // Clamp horizontally so menu never goes off-screen
      const menuWidth = 268
      const rawLeft = handlePos.left + DRAG_HANDLE_WIDTH + DRAG_HANDLE_GAP + 12
      const clampedLeft = Math.min(rawLeft, window.innerWidth - menuWidth - 16)

      // Clamp vertically if we are near the bottom
      const estimatedMenuHeight = 350
      const spaceBelow = window.innerHeight - handlePos.top
      const openUpwards = spaceBelow < estimatedMenuHeight

      setBlockMenu({
        left: Math.max(16, clampedLeft),
        ...(openUpwards
          ? { bottom: window.innerHeight - handlePos.top - 24 }
          : { top: handlePos.top - 8 }
        ),
        target: isTargetInSelection
          ? { from: selection.from, to: selection.to }
          : target,
        type: editor.state.doc.nodeAt(target.from)?.type.name || "text",
      })
      setActiveSubmenu("none")
    },
    [editor, handlePos, selectBlockTarget, showHandle]
  )

  // ── Plus button click → insert block below ────────────────────────────────
  const handlePlusClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setBlockMenu(null)
      showHandle(true)
      // Defer so any pending layout from the close above settles
      window.requestAnimationFrame(() => {
        onInsertBlock(currentBlockTargetRef.current)
      })
    },
    [onInsertBlock, showHandle]
  )

  // ── Color application ─────────────────────────────────────────────────────
  const applyColor = useCallback(
    (target: BlockTarget, colorValue: string, type: "color" | "backgroundColor") => {
      if (!editor) return
      const isMultiBlock = rangeSpansMultipleBlocks(editor.state.doc, target.from, target.to)
      if (isMultiBlock) {
        editor
          .chain()
          .focus()
          .updateAttributes("paragraph", { [type]: colorValue })
          .updateAttributes("heading", { [type]: colorValue })
          .run()
      } else {
        const node = editor.state.doc.nodeAt(target.from)
        if (node) {
          editor
            .chain()
            .focus()
            .setNodeSelection(target.from)
            .updateAttributes(node.type.name, { [type]: colorValue })
            .run()
        }
      }
      setBlockMenu(null)
    },
    [editor]
  )

  // ── Turn-into items ───────────────────────────────────────────────────────
  const turnIntoItems = useMemo(
    () => [
      { id: "paragraph", title: "Text", icon: <FileText className="size-4" />, run: () => editor?.chain().focus().setParagraph().run() },
      { id: "heading1", title: "Heading 1", icon: <Heading1 className="size-4" />, run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
      { id: "heading2", title: "Heading 2", icon: <Heading2 className="size-4" />, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
      { id: "heading3", title: "Heading 3", icon: <Heading3 className="size-4" />, run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
      { id: "heading4", title: "Heading 4", icon: <Heading3 className="size-4 opacity-70" />, run: () => editor?.chain().focus().toggleHeading({ level: 4 }).run() },
      {
        id: "page",
        title: "Page",
        icon: <FileText className="size-4" />,
        run: () => onAddSubpage?.(),
      },
      { id: "bulletList", title: "Bulleted list", icon: <List className="size-4" />, run: () => editor?.chain().focus().toggleBulletList().run() },
      { id: "orderedList", title: "Numbered list", icon: <ListOrdered className="size-4" />, run: () => editor?.chain().focus().toggleOrderedList().run() },
      { id: "taskList", title: "To-do list", icon: <CheckSquare className="size-4" />, run: () => editor?.chain().focus().toggleTaskList().run() },
      {
        id: "details",
        title: "Toggle list",
        icon: <ChevronRight className="size-4" />,
        run: () => {
          if (editor?.isActive("detailsSummary")) {
            editor.chain().focus().updateAttributes("detailsSummary", { level: null }).run()
          } else {
            editor?.chain().focus().setDetails().run()
          }
        },
      },
      {
        id: "toggle_h1",
        title: "Toggle Heading 1",
        icon: <Heading1 className="size-4" />,
        run: () => {
          if (editor?.isActive("detailsSummary")) {
            editor.chain().focus().updateAttributes("detailsSummary", { level: 1 }).run()
          } else {
            editor?.chain().focus().setDetails().updateAttributes("detailsSummary", { level: 1 }).run()
          }
        },
      },
      {
        id: "toggle_h2",
        title: "Toggle Heading 2",
        icon: <Heading2 className="size-4" />,
        run: () => {
          if (editor?.isActive("detailsSummary")) {
            editor.chain().focus().updateAttributes("detailsSummary", { level: 2 }).run()
          } else {
            editor?.chain().focus().setDetails().updateAttributes("detailsSummary", { level: 2 }).run()
          }
        },
      },
      {
        id: "toggle_h3",
        title: "Toggle Heading 3",
        icon: <Heading3 className="size-4" />,
        run: () => {
          if (editor?.isActive("detailsSummary")) {
            editor.chain().focus().updateAttributes("detailsSummary", { level: 3 }).run()
          } else {
            editor?.chain().focus().setDetails().updateAttributes("detailsSummary", { level: 3 }).run()
          }
        },
      },
      {
        id: "toggle_h4",
        title: "Toggle Heading 4",
        icon: <Heading3 className="size-4 opacity-70" />,
        run: () => {
          if (editor?.isActive("detailsSummary")) {
            editor.chain().focus().updateAttributes("detailsSummary", { level: 4 }).run()
          } else {
            editor?.chain().focus().setDetails().updateAttributes("detailsSummary", { level: 4 }).run()
          }
        },
      },
      { id: "codeBlock", title: "Code", icon: <Code className="size-4" />, run: () => editor?.chain().focus().toggleCodeBlock().run() },
      { id: "blockquote", title: "Quote", icon: <Quote className="size-4" />, run: () => editor?.chain().focus().toggleBlockquote().run() },
      { id: "callout", title: "Callout", icon: <SquareTerminal className="size-4" />, run: () => editor?.chain().focus().toggleBlockquote().run() },
      { id: "equation", title: "Block equation", icon: <Sigma className="size-4" />, run: () => { } },
    ],
    [editor, onAddSubpage]
  )

  // ── Filtered turn-into items ──────────────────────────────────────────────
  const filteredTurnIntoItems = useMemo(() => {
    const q = menuSearch.trim().toLowerCase()
    if (!q) return turnIntoItems
    return turnIntoItems.filter((item) =>
      item.title.toLowerCase().includes(q)
    )
  }, [turnIntoItems, menuSearch])

  // ── Main block menu actions filtered by search ────────────────────────────
  const mainMenuItems = useMemo(() => {
    const all = [
      "Turn into",
      "Color",
      "Copy link to block",
      "Duplicate",
      "Move to",
      "Delete",
      "Comment",
      "Suggest edits",
      "Ask AI",
    ]
    const q = menuSearch.trim().toLowerCase()
    if (!q) return all
    return all.filter((label) => label.toLowerCase().includes(q))
  }, [menuSearch])

  const showItem = (label: string) => mainMenuItems.includes(label)

  // ── Render ────────────────────────────────────────────────────────────────
  if (!handlePos) return null

  return (
    <>
      {/* ── Drag Handle ───────────────────────────────────────────────────── */}
      <div
        ref={handleRef}
        className={cn(
          "block-drag-handle",
          (!handleVisible && !handlePinned) && "block-drag-handle--hidden"
        )}
        style={{ left: handlePos.left, top: handlePos.top }}
        onPointerEnter={() => {
          clearHideTimer()
          showHandle()
        }}
        onPointerLeave={(e) => {
          const related = e.relatedTarget as Element | null
          if (related?.closest(".motion-block-menu") || related?.closest(".block-drag-handle")) return
          scheduleHide()
        }}
      >
        {/* + button */}
        <button
          type="button"
          className="block-drag-handle__plus"
          title="Add a block below"
          aria-label="Add a block below"
          onClick={handlePlusClick}
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
        </button>

        {/* ⋮⋮ drag dots button */}
        <button
          type="button"
          className="block-drag-handle__grip"
          title="Click for actions. Drag to move."
          aria-label="Open block actions"
          onClick={handleDragHandleClick}
          draggable="true"
          onDragStart={(e) => {
            if (!editor) return
            const target = currentBlockTargetRef.current
            if (!target) {
              e.preventDefault()
              return
            }

            const { state, view } = editor
            try {
              const selection = NodeSelection.create(state.doc, target.from)
              view.dispatch(state.tr.setSelection(selection))

              const slice = selection.content()
              // Prosemirror drop listener uses view.dragging
              view.dragging = { slice, move: true }

              // Set visual drag image
              const nodeDom = view.nodeDOM(target.from)
              if (nodeDom instanceof HTMLElement) {
                e.dataTransfer.setDragImage(nodeDom, 0, 0)
              }

              // Required for HTML5 drag to work properly
              e.dataTransfer.effectAllowed = "copyMove"
              e.dataTransfer.setData("text/html", "")
            } catch (err) {
              console.error("Drag start failed:", err)
              e.preventDefault()
            }
          }}
          onDragEnd={() => {
            if (!editor) return
            // Cleanup dragging state if needed
            if (editor.view.dragging) {
              editor.view.dragging = null
            }
          }}
        >
          <GripVertical className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* ── Block Context Menu ────────────────────────────────────────────── */}
      {blockMenu && (
        <div
          className="fixed z-[100] flex gap-1"
          style={{
            left: blockMenu.left,
            ...(blockMenu.top !== undefined ? { top: blockMenu.top } : {}),
            ...(blockMenu.bottom !== undefined ? { bottom: blockMenu.bottom } : {})
          }}
        >
          {/* Main menu */}
          <div className="motion-block-menu w-[264px] rounded-xl border bg-background p-1.5 text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-100">
            {/* Search */}
            <div className="px-1.5 pb-1.5 pt-1">
              <input
                autoFocus
                placeholder="Filter actions…"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                className="w-full bg-muted/50 rounded-md px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground/50 border border-transparent focus:border-border/50"
              />
            </div>

            {/* Block type label */}
            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-tight">
              {blockMenu.type.replace(/([A-Z])/g, " $1").trim()}
            </div>

            {/* Turn into */}
            {showItem("Turn into") && (
              <button
                type="button"
                className={cn("motion-block-menu__item justify-between", activeSubmenu === "turn-into" && "bg-accent")}
                onMouseEnter={() => setActiveSubmenu("turn-into")}
              >
                <div className="flex items-center gap-2.5">
                  <RotateCcw className="size-4" />
                  <span>Turn into</span>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              </button>
            )}

            {/* Color */}
            {showItem("Color") && (
              <button
                type="button"
                className={cn("motion-block-menu__item justify-between", activeSubmenu === "color" && "bg-accent")}
                onMouseEnter={() => setActiveSubmenu("color")}
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-4 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                    <div className="size-2 rounded-full bg-primary/40" />
                  </div>
                  <span>Color</span>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              </button>
            )}

            {(showItem("Copy link to block") || showItem("Duplicate") || showItem("Move to") || showItem("Delete")) && (
              <div className="my-1.5 h-px bg-border/50" />
            )}

            {showItem("Copy link to block") && (
              <button className="motion-block-menu__item justify-between" onClick={() => copyBlockLink(blockMenu.target)}>
                <div className="flex items-center gap-2.5">
                  <LinkIcon className="size-4" />
                  <span>Copy link to block</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Alt+⇧+L</span>
              </button>
            )}

            {showItem("Duplicate") && (
              <button className="motion-block-menu__item justify-between" onClick={() => duplicateBlockTarget(blockMenu.target)}>
                <div className="flex items-center gap-2.5">
                  <Copy className="size-4" />
                  <span>Duplicate</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+D</span>
              </button>
            )}

            {showItem("Move to") && (
              <button
                className={cn("motion-block-menu__item justify-between", activeSubmenu === "move-to" && "bg-accent")}
                onMouseEnter={() => setActiveSubmenu("move-to")}
                onClick={() => setActiveSubmenu("move-to")}
              >
                <div className="flex items-center gap-2.5">
                  <ArrowRight className="size-4" />
                  <span>Move to</span>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              </button>
            )}

            {showItem("Delete") && (
              <button
                className="motion-block-menu__item motion-block-menu__item--danger justify-between"
                onClick={() => deleteBlockTarget(blockMenu.target)}
              >
                <div className="flex items-center gap-2.5">
                  <Trash2 className="size-4" />
                  <span>Delete</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Del</span>
              </button>
            )}

            {(showItem("Comment") || showItem("Suggest edits") || showItem("Ask AI")) && (
              <div className="my-1.5 h-px bg-border/50" />
            )}

            {showItem("Comment") && (
              <button
                className="motion-block-menu__item justify-between"
                onClick={() => { alert("Comment feature coming soon!"); setBlockMenu(null) }}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="size-4" />
                  <span>Comment</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+⇧+M</span>
              </button>
            )}

            {showItem("Suggest edits") && (
              <button
                className="motion-block-menu__item justify-between"
                onClick={() => { alert("Suggest edits feature coming soon!"); setBlockMenu(null) }}
              >
                <div className="flex items-center gap-2.5">
                  <PencilLine className="size-4" />
                  <span>Suggest edits</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+Alt+X</span>
              </button>
            )}

            {showItem("Ask AI") && (
              <button className="motion-block-menu__item justify-between">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="size-4 text-primary" />
                  <span>Ask AI</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+J</span>
              </button>
            )}

            {/* Footer */}
            <div className="mt-2 px-2.5 py-2 border-t border-border/40 text-[10px] text-muted-foreground/50 leading-relaxed">
              {lastEditedBy ? (
                <>
                  Last edited by {lastEditedBy}
                  {lastEditedAt && <><br />{lastEditedAt}</>}
                </>
              ) : (
                "Last edited recently"
              )}
            </div>
          </div>

          {/* Turn Into submenu */}
          {activeSubmenu === "turn-into" && (
            <div className="motion-block-menu w-[220px] rounded-xl border bg-background p-1 text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-left-2 duration-150 h-fit max-h-[400px] overflow-y-auto custom-scrollbar">
              {filteredTurnIntoItems.map((item) => (
                <button
                  key={item.id}
                  className="motion-block-menu__item justify-between"
                  onClick={() => { item.run(); setBlockMenu(null) }}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  {blockMenu.type.toLowerCase().includes(item.id.toLowerCase()) && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </button>
              ))}
              {filteredTurnIntoItems.length === 0 && (
                <div className="px-3 py-4 text-center text-[12px] text-muted-foreground/60 italic">
                  No results
                </div>
              )}
            </div>
          )}

          {/* Move To submenu */}
          {activeSubmenu === "move-to" && (
            <div className="motion-block-menu w-[200px] rounded-xl border bg-background p-1 text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-left-2 duration-150">
              <button className="motion-block-menu__item" onClick={() => executeMoveTo("top")}>
                <ChevronUp className="size-4" />
                <span>Move to top</span>
              </button>
              <button className="motion-block-menu__item" onClick={() => executeMoveTo("bottom")}>
                <ChevronDown className="size-4" />
                <span>Move to bottom</span>
              </button>
              <div className="my-1 h-px bg-border/50" />
              <div className="px-2.5 py-1.5 text-[10px] text-muted-foreground/50 italic leading-tight">
                Search pages feature coming soon…
              </div>
            </div>
          )}

          {/* Color submenu */}
          {activeSubmenu === "color" && (
            <div className="motion-block-menu w-[224px] rounded-xl border bg-background p-1 text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-left-2 duration-150 h-fit max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                Color
              </div>
              {NOTION_COLORS.map((c) => {
                const currentNode = blockMenu.target ? editor.state.doc.nodeAt(blockMenu.target.from) : null
                const currentAttrs = currentNode ? editor.getAttributes(currentNode.type.name) : {}
                return (
                  <button
                    key={`text-${c.name}`}
                    className="motion-block-menu__item gap-2.5"
                    onClick={() => blockMenu.target && applyColor(blockMenu.target, c.color, "color")}
                  >
                    <div
                      className="size-5 rounded border border-border/50 flex items-center justify-center text-[11px] font-bold"
                      style={{ color: c.color }}
                    >
                      A
                    </div>
                    <span>{c.name}</span>
                    {currentAttrs.color === c.color && <Check className="size-3 ml-auto text-primary" />}
                  </button>
                )
              })}

              <div className="my-1 h-px bg-border/50" />
              <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                Background
              </div>
              {NOTION_COLORS.slice(1).map((c) => {
                const currentNode = blockMenu.target ? editor.state.doc.nodeAt(blockMenu.target.from) : null
                const currentAttrs = currentNode ? editor.getAttributes(currentNode.type.name) : {}
                return (
                  <button
                    key={`bg-${c.name}`}
                    className="motion-block-menu__item gap-2.5"
                    onClick={() => blockMenu.target && applyColor(blockMenu.target, c.bg, "backgroundColor")}
                  >
                    <div className="size-5 rounded border border-border/50" style={{ backgroundColor: c.bg }} />
                    <span>{c.name} background</span>
                    {currentAttrs.backgroundColor === c.bg && <Check className="size-3 ml-auto text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </>
  )
}

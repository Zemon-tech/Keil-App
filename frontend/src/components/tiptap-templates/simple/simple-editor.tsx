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
import GlobalDragHandle from 'tiptap-extension-global-drag-handle'
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
import { Mention } from "@tiptap/extension-mention"

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
  Link as LinkIcon,
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
  Trash2,
  Copy,
  ChevronDown,
  Palette,
  Check,
  Search,
  Underline as UnderlineIcon,
  ArrowRight,
  ChevronUp,
  RotateCcw,
  MessageSquare,
  PencilLine,
  SquareTerminal,
  Sigma,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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

const DRAG_HANDLE_WIDTH = 56
const DRAG_HANDLE_GAP = 48

const NOTION_COLORS = [
  { name: 'Default', color: 'inherit', bg: 'transparent' },
  { name: 'Gray', color: '#9B9A97', bg: '#EBeced' },
  { name: 'Brown', color: '#64473A', bg: '#E9E5E3' },
  { name: 'Orange', color: '#D9730D', bg: '#FAEBDD' },
  { name: 'Yellow', color: '#DFAB01', bg: '#FBF3DB' },
  { name: 'Green', color: '#0F7B6C', bg: '#DDEDEA' },
  { name: 'Blue', color: '#0B6E99', bg: '#DDEBF1' },
  { name: 'Purple', color: '#6940A5', bg: '#EAE4F2' },
  { name: 'Pink', color: '#AD1A72', bg: '#F4DFEB' },
  { name: 'Red', color: '#E03E3E', bg: '#FBE4E4' },
]
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

function selectionSpansMultipleBlocks(state: EditorState) {
  const { selection } = state
  if (selection.empty) return false
  return rangeSpansMultipleBlocks(state.doc, selection.from, selection.to)
}

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

  const [blockMenu, setBlockMenu] = useState<{
    left: number
    top: number
    target: BlockTarget | null
    type: string
  } | null>(null)
  const [activeSubmenu, setActiveSubmenu] = useState<'none' | 'turn-into' | 'color' | 'move-to'>('none')
  const [menuSearch, setMenuSearch] = useState("")
  const virtualSlashStartRef = useRef<number | null>(null)
  const currentBlockTargetRef = useRef<BlockTarget | null>(null)
  const blockMenuOpenRef = useRef(false)
  const hideHandleTimerRef = useRef<number | null>(null)

  const [editorEmojiPicker, setEditorEmojiPicker] = useState<{
    left: number
    top: number
    pos: number
  } | null>(null)
  const [editorEmojiSearch, setEditorEmojiSearch] = useState("")

  const extensions = useMemo(() => [
    BlockIdExtension,
    EnforceFinalBlockExtension,
    GlobalDragHandle.configure({
      dragHandleWidth: DRAG_HANDLE_WIDTH,
      scrollTreshold: 100,
      customNodes: ['taskItem', 'listItem', 'subpage'],
    }),
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
    CharacterCount.configure({
      limit: 10000,
    }),
    Youtube.configure({
      inline: false,
      width: 640,
      height: 480,
    }),
    Mention.configure({
      HTMLAttributes: {
        class: "mention",
      },
    }),
    SubpageExtension,
  ], [lowlight]) // Removed onAddSubpage from deps

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

  const editor = useEditor({
    immediatelyRender: false,
    editable: editable ?? true,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "tiptap simple-editor",
      },
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
        if (node.type.name === "table" || node.type.name === "details") {
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

      const target = currentBlockTargetRef.current
      if (!target) return

      const { selection } = editor.state
      const spansMultiple = selectionSpansMultipleBlocks(editor.state)
      const isTargetInSelection = spansMultiple && 
                                  target.from < selection.to && 
                                  target.to > selection.from

      if (!isTargetInSelection) {
        selectBlockTarget(target)
      }
      showDragHandle(handle, true)

      const rect = handle.getBoundingClientRect()
      const wrapperRect = wrapperRef.current?.getBoundingClientRect()
      if (!wrapperRect) return

      setBlockMenu({
        left: rect.right + 12,
        top: rect.top - 8,
        target: isTargetInSelection ? { from: selection.from, to: selection.to } : target,
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
      insertParagraphAfterTarget(currentBlockTargetRef.current)
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

  const deleteBlockTarget = useCallback((target: BlockTarget | null) => {
    if (!editor || !target) return
    console.log("Deleting block at", target)
    
    editor.commands.focus()
    const { state, view } = editor
    
    try {
      // Create a node selection at target.from
      const selection = NodeSelection.create(state.doc, target.from)
      const tr = state.tr.setSelection(selection).deleteSelection()
      view.dispatch(tr)
    } catch (err) {
      // Fallback: delete the range directly
      console.warn("NodeSelection delete failed, falling back to raw delete:", err)
      const tr = state.tr.delete(target.from, target.to)
      view.dispatch(tr)
    }
    
    setBlockMenu(null)
    closeSlashMenu()
  }, [editor, closeSlashMenu])

  const duplicateBlockTarget = useCallback((target: BlockTarget | null) => {
    if (!editor || !target) return
    console.log("Duplicating block at", target)
    const { from, to } = target

    const isMultiBlock = rangeSpansMultipleBlocks(editor.state.doc, from, to)

    if (isMultiBlock) {
      const slice = editor.state.doc.slice(from, to)
      const content = slice.content.toJSON()
      editor
        .chain()
        .focus()
        .insertContentAt(to, content)
        .run()
    } else {
      const node = editor.state.doc.nodeAt(from)
      if (!node) return
      const content = node.content.toJSON()
      editor
        .chain()
        .focus()
        .insertContentAt(to, {
          type: node.type.name,
          attrs: { ...node.attrs, id: undefined }, // Let extension generate new ID
          content: content
        })
        .run()
    }
      
    setBlockMenu(null)
    closeSlashMenu()
  }, [editor, closeSlashMenu])

  const copyBlockTarget = useCallback((target: BlockTarget | null) => {
    if (!editor || !target) return
    const node = editor.state.doc.nodeAt(target.from)
    const blockId = node?.attrs.id
    const url = blockId 
      ? `${window.location.origin}${window.location.pathname}#${blockId}`
      : window.location.href
    
    navigator.clipboard?.writeText(url).then(() => {
      // Small feedback
      console.log("Link copied:", url)
    }).catch(() => undefined)
    setBlockMenu(null)
    closeSlashMenu()
  }, [editor, closeSlashMenu])

  const commentOnBlock = useCallback((target: BlockTarget | null) => {
    if (!editor || !target) return
    alert("Comment feature coming soon!")
    setBlockMenu(null)
  }, [editor])

  const moveToBlock = useCallback((target: BlockTarget | null) => {
    if (!editor || !target) return
    setActiveSubmenu('move-to')
  }, [])

  const executeMoveTo = useCallback((position: 'top' | 'bottom') => {
    if (!editor || !blockMenu?.target) return
    const target = blockMenu.target

    const isMultiBlock = rangeSpansMultipleBlocks(editor.state.doc, target.from, target.to)

    let contentJSON: any
    if (isMultiBlock) {
      const slice = editor.state.doc.slice(target.from, target.to)
      contentJSON = slice.content.toJSON()
    } else {
      const node = editor.state.doc.nodeAt(target.from)
      if (!node) return
      contentJSON = node.toJSON()
    }
    
    if (position === 'top') {
      editor
        .chain()
        .focus()
        .deleteRange({ from: target.from, to: target.to })
        .insertContentAt(0, contentJSON)
        .run()
    } else {
      editor
        .chain()
        .focus()
        .deleteRange({ from: target.from, to: target.to })
        .command(({ tr }) => {
          if (Array.isArray(contentJSON)) {
            contentJSON.forEach((nodeObj) => {
              tr.insert(tr.doc.content.size, editor.schema.nodeFromJSON(nodeObj))
            })
          } else {
            tr.insert(tr.doc.content.size, editor.schema.nodeFromJSON(contentJSON))
          }
          return true
        })
        .run()
    }
      
    setBlockMenu(null)
  }, [editor, blockMenu])

  const suggestOnBlock = useCallback((target: BlockTarget | null) => {
    if (!editor || !target) return
    alert("Suggest edits feature coming soon!")
    setBlockMenu(null)
  }, [editor])

  // Global Keyboard Shortcuts for selected blocks
  useEffect(() => {
    if (!editor) return

    const onKeyDown = (e: KeyboardEvent) => {
      // Only handle if a block is selected (NodeSelection)
      const { selection } = editor.state
      if (!(selection instanceof NodeSelection)) return

      const target = { from: selection.from, to: selection.to }

      // Duplicate: Ctrl+D
      if (e.ctrlKey && e.key === "d") {
        e.preventDefault()
        duplicateBlockTarget(target)
      }
      // Delete: Del
      if (e.key === "Delete") {
        e.preventDefault()
        deleteBlockTarget(target)
      }
      // Copy Link: Alt+Shift+L
      if (e.altKey && e.shiftKey && e.key === "L") {
        e.preventDefault()
        copyBlockTarget(target)
      }
      // Comment: Ctrl+Shift+M
      if (e.ctrlKey && e.shiftKey && e.key === "M") {
        e.preventDefault()
        commentOnBlock(target)
      }
      // Move to: Ctrl+Shift+P
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault()
        moveToBlock(target)
      }
      // Suggest edits: Ctrl+Alt+X
      if (e.ctrlKey && e.altKey && e.key === "x") {
        e.preventDefault()
        suggestOnBlock(target)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [editor, duplicateBlockTarget, deleteBlockTarget, copyBlockTarget, commentOnBlock, moveToBlock, suggestOnBlock])

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
              
              if (empty || selection instanceof NodeSelection || editor.isActive("image") || editor.isActive("codeBlock")) {
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
          </BubbleMenu>
        )}

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />

        {editor && <TableControlsOverlay editor={editor} />}


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
                className={cn("motion-block-menu__item justify-between group", activeSubmenu === 'color' && "bg-accent")}
                onMouseEnter={() => setActiveSubmenu('color')}
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

              <button 
                className={cn("motion-block-menu__item justify-between group", activeSubmenu === 'move-to' && "bg-accent")}
                onMouseEnter={() => setActiveSubmenu('move-to')}
                onClick={() => moveToBlock(blockMenu.target)}
              >
                <div className="flex items-center gap-2.5">
                  <ArrowRight className="size-4" />
                  <span>Move to</span>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/50" />
              </button>

              <button className="motion-block-menu__item motion-block-menu__item--danger justify-between" onClick={() => deleteBlockTarget(blockMenu.target)}>
                <div className="flex items-center gap-2.5">
                  <Trash2 className="size-4" />
                  <span>Delete</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Del</span>
              </button>

              <div className="my-1.5 h-px bg-border/50" />

              <button className="motion-block-menu__item justify-between" onClick={() => commentOnBlock(blockMenu.target)}>
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="size-4" />
                  <span>Comment</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40 font-mono">Ctrl+⇧+M</span>
              </button>

              <button className="motion-block-menu__item justify-between" onClick={() => suggestOnBlock(blockMenu.target)}>
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
                  { 
                    id: 'details', 
                    title: 'Toggle list', 
                    icon: <ChevronRight className="size-4" />, 
                    run: () => {
                      if (editor?.isActive('detailsSummary')) {
                        editor.chain().focus().updateAttributes('detailsSummary', { level: null }).run()
                      } else {
                        editor?.chain().focus().setDetails().run()
                      }
                    }
                  },
                  { 
                    id: 'toggle_h1', 
                    title: 'Toggle Heading 1', 
                    icon: <Heading1 className="size-4" />, 
                    run: () => {
                      if (editor?.isActive('detailsSummary')) {
                        editor.chain().focus().updateAttributes('detailsSummary', { level: 1 }).run()
                      } else {
                        editor?.chain().focus().setDetails().updateAttributes('detailsSummary', { level: 1 }).run()
                      }
                    }
                  },
                  { 
                    id: 'toggle_h2', 
                    title: 'Toggle Heading 2', 
                    icon: <Heading2 className="size-4" />, 
                    run: () => {
                      if (editor?.isActive('detailsSummary')) {
                        editor.chain().focus().updateAttributes('detailsSummary', { level: 2 }).run()
                      } else {
                        editor?.chain().focus().setDetails().updateAttributes('detailsSummary', { level: 2 }).run()
                      }
                    }
                  },
                  { 
                    id: 'toggle_h3', 
                    title: 'Toggle Heading 3', 
                    icon: <Heading3 className="size-4" />, 
                    run: () => {
                      if (editor?.isActive('detailsSummary')) {
                        editor.chain().focus().updateAttributes('detailsSummary', { level: 3 }).run()
                      } else {
                        editor?.chain().focus().setDetails().updateAttributes('detailsSummary', { level: 3 }).run()
                      }
                    }
                  },
                  { 
                    id: 'toggle_h4', 
                    title: 'Toggle Heading 4', 
                    icon: <Heading3 className="size-4 opacity-70" />, 
                    run: () => {
                      if (editor?.isActive('detailsSummary')) {
                        editor.chain().focus().updateAttributes('detailsSummary', { level: 4 }).run()
                      } else {
                        editor?.chain().focus().setDetails().updateAttributes('detailsSummary', { level: 4 }).run()
                      }
                    }
                  },
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

            {/* Move To Submenu */}
            {activeSubmenu === 'move-to' && (
              <div className="motion-block-menu w-[200px] rounded-xl border bg-background p-1 text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-left-2 duration-150">
                <button className="motion-block-menu__item" onClick={() => executeMoveTo('top')}>
                  <ChevronUp className="size-4" />
                  <span>Move to top</span>
                </button>
                <button className="motion-block-menu__item" onClick={() => executeMoveTo('bottom')}>
                  <ChevronDown className="size-4" />
                  <span>Move to bottom</span>
                </button>
                <div className="my-1 h-px bg-border/50" />
                <div className="px-2.5 py-1.5 text-[10px] text-muted-foreground/50 italic leading-tight">
                  Search pages feature coming soon...
                </div>
              </div>
            )}

            {/* Color Submenu */}
            {activeSubmenu === 'color' && (
              <div className="motion-block-menu w-[220px] rounded-xl border bg-background p-1 text-popover-foreground shadow-[0_10px_40px_rgba(0,0,0,0.15)] animate-in fade-in slide-in-from-left-2 duration-150 h-fit max-h-[400px] overflow-y-auto custom-scrollbar">
                <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Color
                </div>
                {NOTION_COLORS.map((c) => (
                  <button
                    key={`text-${c.name}`}
                    className="motion-block-menu__item gap-2.5"
                    onClick={() => {
                      if (blockMenu?.target && editor) {
                        const { from, to } = blockMenu.target;
                        
                        const isMultiBlock = rangeSpansMultipleBlocks(editor.state.doc, from, to)

                        if (isMultiBlock) {
                          editor.chain()
                            .focus()
                            .updateAttributes('paragraph', { color: c.color })
                            .updateAttributes('heading', { color: c.color })
                            .run();
                        } else {
                          const node = editor.state.doc.nodeAt(from);
                          if (node) {
                            editor.chain()
                              .focus()
                              .setNodeSelection(from)
                              .updateAttributes(node.type.name, { color: c.color })
                              .run();
                          }
                        }
                        setBlockMenu(null);
                      }
                    }}
                  >
                    <div className="size-5 rounded border border-border/50 flex items-center justify-center text-[11px] font-bold" style={{ color: c.color }}>
                      A
                    </div>
                    <span>{c.name}</span>
                    {(() => {
                      if (!editor || !blockMenu?.target) return null;
                      const node = editor.state.doc.nodeAt(blockMenu.target.from);
                      const attrs = editor.getAttributes(node?.type.name || 'paragraph');
                      return attrs.color === c.color && <Check className="size-3 ml-auto text-primary" />;
                    })()}
                  </button>
                ))}
                <div className="my-1 h-px bg-border/50" />
                <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Background
                </div>
                {NOTION_COLORS.slice(1).map((c) => (
                  <button
                    key={`bg-${c.name}`}
                    className="motion-block-menu__item gap-2.5"
                    onClick={() => {
                      if (blockMenu?.target && editor) {
                        const { from, to } = blockMenu.target;
                        
                        const isMultiBlock = rangeSpansMultipleBlocks(editor.state.doc, from, to)

                        if (isMultiBlock) {
                          editor.chain()
                            .focus()
                            .updateAttributes('paragraph', { backgroundColor: c.bg })
                            .updateAttributes('heading', { backgroundColor: c.bg })
                            .run();
                        } else {
                          const node = editor.state.doc.nodeAt(from);
                          if (node) {
                            editor.chain()
                              .focus()
                              .setNodeSelection(from)
                              .updateAttributes(node.type.name, { backgroundColor: c.bg })
                              .run();
                          }
                        }
                        setBlockMenu(null);
                      }
                    }}
                  >
                    <div className="size-5 rounded border border-border/50" style={{ backgroundColor: c.bg }} />
                    <span>{c.name} background</span>
                    {(() => {
                      if (!editor || !blockMenu?.target) return null;
                      const node = editor.state.doc.nodeAt(blockMenu.target.from);
                      const attrs = editor.getAttributes(node?.type.name || 'paragraph');
                      return attrs.backgroundColor === c.bg && <Check className="size-3 ml-auto text-primary" />;
                    })()}
                  </button>
                ))}
              </div>
            )}
          </div>
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
                    className={`px-2.5 py-1.5 flex items-center justify-between cursor-pointer rounded select-none outline-none transition-colors ${
                      index === slashSelectedIndex
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
      </EditorContext.Provider>
    </div>
  )
}

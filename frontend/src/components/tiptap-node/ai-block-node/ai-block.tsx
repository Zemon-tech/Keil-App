"use client"

import React, { useState, useRef, useEffect } from "react"
import { NodeViewWrapper } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import { 
  Sparkles, Check, X, RotateCcw, 
  FileText, CheckSquare, List, HelpCircle, ArrowUp, Loader2
} from "lucide-react"
import { useAppContext } from "@/contexts/AppContext"
import { useParams } from "react-router-dom"
import { useMotionAi } from "@/hooks/api/useMotionAi"
import { markdownToHtml } from "@/utils/markdown-parser"

const ACTION_OPTIONS = [
  { id: "custom", label: "Custom output", icon: <Sparkles className="size-3.5 text-muted-foreground" />, desc: "Generate text based on your instructions" },
  { id: "summarize", label: "Summary", icon: <FileText className="size-3.5 text-muted-foreground" />, desc: "Summarize the entire page content" },
  { id: "todo", label: "To-do list", icon: <CheckSquare className="size-3.5 text-muted-foreground" />, desc: "Extract action items and checklists" },
  { id: "outline", label: "Outline", icon: <List className="size-3.5 text-muted-foreground" />, desc: "Generate a structured outline" },
  { id: "brainstorm", label: "Brainstorm", icon: <HelpCircle className="size-3.5 text-muted-foreground" />, desc: "Brainstorm ideas and concepts" }
]

const FaceLogo = ({ onClick }: { onClick?: () => void }) => (
  <button
    onClick={onClick}
    type="button"
    className="size-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors"
    style={{
      background: "var(--muted)",
      border: "1px solid var(--border)",
    }}
  >
    <svg viewBox="0 0 100 100" className="size-4" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" style={{ color: "var(--foreground)" }}>
      {/* Eyes */}
      <circle cx="35" cy="42" r="4" fill="currentColor" />
      <circle cx="65" cy="42" r="4" fill="currentColor" />
      {/* Nose/mouth line */}
      <path d="M 50,47 L 50,65 C 50,69 45,71 41,69" />
    </svg>
  </button>
)

export const AiBlockComponent: React.FC<NodeViewProps> = ({ 
  node, 
  editor, 
  getPos, 
  updateAttributes, 
  deleteNode 
}) => {
  const { prompt, action } = node.attrs

  const { activeOrgId, activeSpaceId } = useAppContext()
  const { pageId } = useParams<{ pageId: string }>()
  const { stream, isStreaming, error } = useMotionAi(activeOrgId, activeSpaceId, pageId ?? null)

  // Local prompt state — NOT synced to node attrs on every keystroke to avoid ProseMirror re-render stealing focus
  const [localPrompt, setLocalPrompt] = useState(prompt)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isGenerated, setIsGenerated] = useState(false)
  
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Track the generated text range during streaming to support discard/regenerate
  const generatedRangeRef = useRef<{ from: number; to: number } | null>(null)
  const accumulatedLengthRef = useRef<number>(0)

  // Auto-focus the prompt input when the block is inserted
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 80)
    return () => clearTimeout(timer)
  }, [])

  // Click outside dropdown listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleActionChange = (newAction: string) => {
    updateAttributes({ action: newAction })
    setDropdownOpen(false)
    
    // Auto fill prompt for non-custom actions
    const option = ACTION_OPTIONS.find(o => o.id === newAction)
    if (newAction !== "custom" && option) {
      const defaultPrompts: Record<string, string> = {
        summarize: "Summarize this page.",
        todo: "Create a list of action items from this page.",
        outline: "Create an outline for this page.",
        brainstorm: "Brainstorm ideas from this page."
      }
      setLocalPrompt(defaultPrompts[newAction] || "")
    } else {
      setLocalPrompt("")
    }
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleGenerate = async () => {
    if (!editor) return
    if (isStreaming) return

    const actionOption = ACTION_OPTIONS.find(o => o.id === action)
    const promptToSend = localPrompt.trim() || actionOption?.label || "Generate output"

    // Sync prompt to node attrs only on submit
    updateAttributes({ prompt: promptToSend })

    setIsGenerated(false)
    accumulatedLengthRef.current = 0

    const fullContext = editor.getText()

    const pos = getPos()
    if (typeof pos !== "number") return
    const startPos = pos + node.nodeSize

    generatedRangeRef.current = { from: startPos, to: startPos }

    let accumulatedText = ""

    // Insert an empty paragraph first where we will stream the content
    editor.chain()
      .insertContentAt(startPos, "\n")
      .run()

    generatedRangeRef.current = { from: startPos, to: startPos + 1 }

    try {
      await stream(
        {
          action: action === "custom" ? "custom" : action,
          prompt: promptToSend,
          context: fullContext
        },
        (chunk) => {
          const range = generatedRangeRef.current
          if (range && editor) {
            accumulatedText += chunk
            const htmlContent = markdownToHtml(accumulatedText)

            const docSizeBefore = editor.state.doc.content.size
            const deleteLength = range.to - range.from

            editor.chain()
              .deleteRange({ from: range.from, to: range.to })
              .insertContentAt(range.from, htmlContent)
              .run()

            const docSizeAfter = editor.state.doc.content.size
            const insertedContentSize = (docSizeAfter - docSizeBefore) + deleteLength

            generatedRangeRef.current = {
              from: range.from,
              to: range.from + insertedContentSize
            }
            accumulatedLengthRef.current = insertedContentSize
          }
        },
        () => {
          setIsGenerated(true)
          updateAttributes({ generatedText: accumulatedText })
        }
      )
    } catch (e) {
      console.error("AI Block generation failed:", e)
    }
  }

  const handleDiscard = () => {
    const range = generatedRangeRef.current
    if (range && editor) {
      editor.chain()
        .focus()
        .deleteRange({ from: range.from, to: range.to })
        .run()
    }
    deleteNode()
  }

  const handleDone = () => {
    deleteNode()
  }

  const currentActionOption = ACTION_OPTIONS.find(o => o.id === action) || ACTION_OPTIONS[0]

  return (
    <NodeViewWrapper className="ai-block-wrapper" data-drag-handle="">
      <div className="relative w-full max-w-full flex flex-col gap-2" contentEditable={false}>
        {/* Main Pill Bar */}
        <div
          className="ai-block-pill"
          style={{
            width: "100%",
            height: "44px",
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "9999px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "0 14px",
            boxShadow: "var(--shadow-sm)",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          }}
        >
          
          {/* Left Side: Avatar/Sparkles Trigger */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <FaceLogo onClick={() => !isStreaming && !isGenerated && setDropdownOpen(!dropdownOpen)} />
            
            {dropdownOpen && (
              <div
                className="absolute left-0 bottom-full mb-2 z-50 w-64 overflow-hidden py-1.5"
                style={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow-lg)",
                  animation: "ai-msg-in 0.15s ease-out",
                }}
              >
                <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider select-none" style={{ color: "var(--muted-foreground)" }}>
                  AI Block Action
                </div>
                {ACTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleActionChange(opt.id)}
                    type="button"
                    className="w-full flex items-start gap-2.5 px-3 py-2 cursor-pointer transition-colors text-left border-none outline-none"
                    style={{
                      background: action === opt.id ? "color-mix(in oklch, var(--primary) 8%, transparent)" : "transparent",
                      color: action === opt.id ? "var(--foreground)" : "var(--foreground)",
                    }}
                    onMouseEnter={(e) => {
                      if (action !== opt.id) (e.currentTarget.style.background = "var(--accent)")
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = action === opt.id
                        ? "color-mix(in oklch, var(--primary) 8%, transparent)"
                        : "transparent"
                    }}
                  >
                    <div className="mt-0.5 shrink-0">{opt.icon}</div>
                    <div className="flex flex-col min-w-0 leading-normal">
                      <span className="text-xs font-semibold">{opt.label}</span>
                      <span className="text-[9.5px] truncate" style={{ color: "var(--muted-foreground)" }}>{opt.desc}</span>
                    </div>
                    {action === opt.id && (
                      <Check className="size-3.5 text-purple-400 ml-auto shrink-0 self-center" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Middle Side: Text / Input Area */}
          <div className="flex-grow flex items-center min-w-0 h-full">
            {isStreaming ? (
              <div className="flex items-center gap-2 text-xs font-medium animate-pulse truncate" style={{ color: "var(--muted-foreground)" }}>
                <Loader2 className="size-3.5 text-purple-400 animate-spin" />
                <span>AI is writing...</span>
              </div>
            ) : isGenerated ? (
              <div className="text-xs font-semibold truncate select-none" style={{ color: "var(--muted-foreground)" }}>
                Generated from action: <span className="text-purple-400">{currentActionOption.label}</span>
              </div>
            ) : (
              <input
                ref={inputRef}
                type="text"
                className="w-full h-full bg-transparent border-none outline-none text-[13px] font-medium"
                style={{
                  color: "var(--foreground)",
                  caretColor: "var(--foreground)",
                }}
                placeholder={
                  action === "custom" 
                    ? "Ask AI to write anything..." 
                    : `Run "${currentActionOption.label}" — or type a prompt`
                }
                value={localPrompt}
                onChange={(e) => {
                  setLocalPrompt(e.target.value)
                }}
                onKeyDown={(e) => {
                  // Stop ProseMirror from handling any key events on this input
                  e.stopPropagation()
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleGenerate()
                  }
                  if (e.key === "Escape") {
                    e.preventDefault()
                    deleteNode()
                    editor?.commands.focus()
                  }
                }}
              />
            )}
          </div>

          {/* Right Side: Action Buttons */}
          <div className="shrink-0 flex items-center gap-1.5">
            {isStreaming ? (
              <button
                type="button"
                onClick={handleDiscard}
                className="size-7 rounded-full flex items-center justify-center transition-colors cursor-pointer border-none"
                style={{
                  background: "var(--muted)",
                  color: "var(--muted-foreground)",
                }}
                title="Stop generation"
              >
                <X className="size-3.5" />
              </button>
            ) : isGenerated ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDone}
                  className="px-3 py-1 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-[10.5px] font-semibold transition-colors cursor-pointer border-none shadow-sm"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="p-1.5 rounded-full transition-colors cursor-pointer border-none"
                  style={{ color: "var(--muted-foreground)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--muted)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                  title="Try again"
                >
                  <RotateCcw className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="p-1.5 rounded-full transition-colors cursor-pointer border-none"
                  style={{ color: "var(--destructive)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--muted)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
                  title="Discard and delete"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!localPrompt.trim() && action === "custom"}
                className={`size-7 rounded-full flex items-center justify-center transition-all border-none ${
                  (localPrompt.trim() || action !== "custom")
                    ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-sm hover:scale-105"
                    : "cursor-default"
                }`}
                style={
                  !(localPrompt.trim() || action !== "custom")
                    ? { background: "var(--muted)", color: "var(--muted-foreground)" }
                    : undefined
                }
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>

        </div>

        {/* Floating Error Bar */}
        {error && (
          <div
            className="w-full px-4 py-2 text-[10px] font-semibold flex items-center justify-between"
            style={{
              background: "color-mix(in oklch, var(--destructive) 8%, transparent)",
              border: "1px solid color-mix(in oklch, var(--destructive) 20%, transparent)",
              borderRadius: "12px",
              color: "var(--destructive)",
              animation: "ai-msg-in 0.15s ease-out",
            }}
          >
            <span>Error: {error}</span>
            <button type="button" onClick={handleGenerate} className="flex items-center gap-1 border-none bg-transparent cursor-pointer" style={{ color: "var(--destructive)" }}>
              <RotateCcw className="size-3" /> Retry
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default AiBlockComponent

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";

// ─── EditableText (single-line) ───────────────────────────────────────────────

interface EditableTextProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
}

export function EditableText({
  value,
  onSave,
  placeholder = "Click to edit…",
  className,
  inputClassName,
  disabled = false,
}: EditableTextProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when server value changes while not editing
  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  // Auto-focus the input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commit = useCallback(() => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value); // revert
    }
  }, [draft, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      setDraft(value);
      setIsEditing(false);
    }
  };

  if (disabled) {
    return (
      <span className={cn("block", className)}>
        {value || <span className="italic text-muted-foreground">{placeholder}</span>}
      </span>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-auto px-1.5 py-0.5 text-inherit font-inherit border-primary/40 focus-visible:ring-1",
          inputClassName
        )}
      />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setIsEditing(true);
      }}
      className={cn(
        "group/editable block cursor-text rounded px-1.5 py-0.5 -mx-1.5 -my-0.5",
        "transition-colors hover:bg-accent/50",
        className
      )}
    >
      {value || <span className="italic text-muted-foreground">{placeholder}</span>}
      <Pencil className="ml-1.5 inline-block h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover/editable:opacity-60" />
    </span>
  );
}

// ─── EditableTextarea (multi-line) ────────────────────────────────────────────

interface EditableTextareaProps {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  textareaClassName?: string;
  disabled?: boolean;
  minRows?: number;
}

export function EditableTextarea({
  value,
  onSave,
  placeholder = "Click to edit…",
  className,
  textareaClassName,
  disabled = false,
  minRows = 2,
}: EditableTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(value);
  }, [value, isEditing]);

  useEffect(() => {
    if (isEditing) {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [isEditing]);

  const commit = useCallback(() => {
    setIsEditing(false);
    const trimmed = draft.trim();
    // Allow saving empty string (clearing the field)
    if (trimmed !== value) {
      onSave(trimmed);
    } else {
      setDraft(value);
    }
  }, [draft, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + Enter commits
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      setDraft(value);
      setIsEditing(false);
    }
  };

  if (disabled) {
    return (
      <div className={cn("text-sm leading-relaxed", className)}>
        {value || <span className="italic text-muted-foreground">{placeholder}</span>}
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="space-y-1">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          rows={minRows}
          className={cn(
            "text-sm leading-relaxed resize-y border-primary/40 focus-visible:ring-1",
            textareaClassName
          )}
        />
        <p className="text-[10px] text-muted-foreground">
          Press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">Ctrl+Enter</kbd> to save · <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px]">Esc</kbd> to cancel
        </p>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setIsEditing(true);
      }}
      className={cn(
        "group/editable cursor-text rounded px-2 py-1.5 -mx-2 -my-1.5",
        "transition-colors hover:bg-accent/50",
        className
      )}
    >
      <span className="text-sm leading-relaxed">
        {value || <span className="italic text-muted-foreground">{placeholder}</span>}
      </span>
      <Pencil className="ml-1.5 inline-block h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover/editable:opacity-60" />
    </div>
  );
}

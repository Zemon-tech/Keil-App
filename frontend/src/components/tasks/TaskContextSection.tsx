import { useState, useRef, useEffect } from "react";
import { FileText, Link2, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { TaskDTO } from "@/hooks/api/useTasks";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContextItemType = "note" | "link";

interface TaskContextItem {
  id: string;
  type: ContextItemType;
  title: string;
  content: string; // For notes: the note text, For links: the URL
}

// ─── TaskContextSection ───────────────────────────────────────────────────────

export function TaskContextSection({
  task,
  onUpdateTask,
}: {
  task: TaskDTO;
  onUpdateTask?: (id: string, updates: any) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newItemType, setNewItemType] = useState<ContextItemType>("note");
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemContent, setNewItemContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  const addFormRef = useRef<HTMLDivElement>(null);
  const editFormRef = useRef<HTMLDivElement>(null);

  const contextItems: TaskContextItem[] = (task.context ?? []).map((item: any) => ({
    id: item.id,
    type: item.type === "link" || item.url ? "link" : "note",
    title: item.title,
    content: item.content || item.url || item.title,
  }));

  // Close add form on outside click
  useEffect(() => {
    if (!isAdding) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addFormRef.current && !addFormRef.current.contains(e.target as Node)) {
        setIsAdding(false);
        setNewItemTitle("");
        setNewItemContent("");
        setNewItemType("note");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAdding]);

  // Close edit form on outside click
  useEffect(() => {
    if (!editingId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (editFormRef.current && !editFormRef.current.contains(e.target as Node)) {
        setEditingId(null);
        setEditTitle("");
        setEditContent("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingId]);

  const handleAdd = () => {
    if (!newItemTitle.trim() || !newItemContent.trim()) return;

    const newItem: any = {
      id: crypto.randomUUID(),
      title: newItemTitle.trim(),
      url: newItemType === "link" ? newItemContent.trim() : "",
      content: newItemType === "note" ? newItemContent.trim() : "",
      type: newItemType === "link" ? "link" : "doc",
    };

    const updatedContext = [
      ...contextItems.map((i) => ({
        id: i.id,
        title: i.title,
        url: i.type === "link" ? i.content : "",
        content: i.type === "note" ? i.content : "",
        type: i.type === "link" ? "link" : "doc",
      })),
      newItem,
    ];

    onUpdateTask?.(task.id, { context: updatedContext });

    setNewItemTitle("");
    setNewItemContent("");
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const updatedContext = contextItems.filter((item) => item.id !== id);
    onUpdateTask?.(task.id, { context: updatedContext as any });
  };

  const handleStartEdit = (item: TaskContextItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim() || !editContent.trim() || !editingId) return;

    const updatedContext = contextItems
      .map((item) =>
        item.id === editingId
          ? { ...item, title: editTitle.trim(), content: editContent.trim() }
          : item
      )
      .map((i) => ({
        id: i.id,
        title: i.title,
        url: i.type === "link" ? i.content : "",
        content: i.type === "note" ? i.content : "",
        type: i.type === "link" ? "link" : "doc",
      }));

    onUpdateTask?.(task.id, { context: updatedContext });

    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  };

  return (
    <div>
      {/* Header — no Add button */}
      <div className="mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Context
        </span>
      </div>

      {/* Inline Add Form — opens on click, closes on outside click */}
      {isAdding ? (
        <div
          ref={addFormRef}
          className="mb-3 rounded-md border border-border p-3 bg-muted/30"
        >
          {/* Type Selector */}
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setNewItemType("note")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                newItemType === "note"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border border-border hover:bg-accent"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              Note
            </button>
            <button
              onClick={() => setNewItemType("link")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                newItemType === "link"
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border border-border hover:bg-accent"
              )}
            >
              <Link2 className="h-3.5 w-3.5" />
              Link
            </button>
          </div>

          {/* Title Input */}
          <Input
            placeholder={newItemType === "note" ? "Note title..." : "Link title..."}
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            className="mb-2 h-8 text-sm"
            autoFocus
          />

          {/* Content Input */}
          {newItemType === "note" ? (
            <textarea
              placeholder="Write your note here..."
              value={newItemContent}
              onChange={(e) => setNewItemContent(e.target.value)}
              className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <Input
              placeholder="https://..."
              value={newItemContent}
              onChange={(e) => setNewItemContent(e.target.value)}
              className="h-8 text-sm"
            />
          )}

          {/* Save action only — no Cancel button */}
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={!newItemTitle.trim() || !newItemContent.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      ) : (
        /* Placeholder — click to open form, styled like description */
        <button
          onClick={() => setIsAdding(true)}
          className="mb-3 w-full text-left text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors py-0.5"
        >
          Add context...
        </button>
      )}

      {/* Context Items List */}
      <div className="space-y-2">
        {contextItems.length > 0 ? (
          contextItems.map((item) => (
            <div
              key={item.id}
              className="group rounded-md border border-border p-2.5 transition-colors hover:bg-accent/30"
            >
              {editingId === item.id ? (
                // Edit Mode
                <div ref={editFormRef} className="space-y-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="h-7 text-sm"
                    placeholder="Title..."
                    autoFocus
                  />
                  {item.type === "note" ? (
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Content..."
                    />
                  ) : (
                    <Input
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="h-7 text-sm"
                      placeholder="URL..."
                    />
                  )}
                  <div className="flex justify-end">
                    <Button size="sm" className="h-6 text-xs" onClick={handleSaveEdit}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {item.type === "note" ? (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.type === "note" ? (
                      <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                        {item.content}
                      </p>
                    ) : (
                      <a
                        href={item.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 text-xs text-blue-500 hover:underline truncate block"
                      >
                        {item.content}
                      </a>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-muted-foreground hover:text-destructive rounded"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          !isAdding && (
            <p className="text-xs italic text-muted-foreground">No context items</p>
          )
        )}
      </div>
    </div>
  );
}

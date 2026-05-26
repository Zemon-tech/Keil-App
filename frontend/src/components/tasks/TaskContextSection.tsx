import { useState, useRef, useEffect } from "react";
import { Link2, Pencil, Trash2, Loader2 } from "lucide-react";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/lib/api";

import type { TaskDTO } from "@/hooks/api/useTasks";
import { ContextIcon } from "./task-detail-shared";

interface TaskContextItem {
  id: string;
  title: string;
  url: string;
  description: string;
  type: "doc" | "link" | "figma" | "github" | "notion";
  favicon?: string;
}

function parseUrlMetadata(urlStr: string): { title: string; description: string; type: "github" | "notion" | "figma" | "doc" | "link" } {
  let cleanUrl = urlStr.trim();
  if (!cleanUrl) {
    return { title: "", description: "", type: "link" };
  }
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = "https://" + cleanUrl;
  }

  try {
    const url = new URL(cleanUrl);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname;

    if (hostname.includes("github.com")) {
      const parts = pathname.split("/").filter(Boolean);
      const repoName = parts.slice(0, 2).join("/");
      return {
        title: repoName ? `GitHub: ${repoName}` : "GitHub Repository",
        description: "Source code repository and version control on GitHub.",
        type: "github"
      };
    }

    if (hostname.includes("figma.com")) {
      const parts = pathname.split("/").filter(Boolean);
      const fileIndex = parts.indexOf("file");
      const fileName = fileIndex !== -1 && parts[fileIndex + 2] 
        ? decodeURIComponent(parts[fileIndex + 2].replace(/-/g, " ")) 
        : "Design File";
      return {
        title: `Figma: ${fileName}`,
        description: "Collaborative interface design file in Figma.",
        type: "figma"
      };
    }

    if (hostname.includes("notion.so") || hostname.includes("notion.site")) {
      const parts = pathname.split("/").filter(Boolean);
      const lastPart = parts[parts.length - 1] || "";
      const docName = lastPart.split("-").slice(0, -1).join(" ") || "Document";
      const cleanDocName = docName ? decodeURIComponent(docName) : "Notion Workspace";
      return {
        title: `Notion: ${cleanDocName}`,
        description: "Connected workspace document in Notion.",
        type: "notion"
      };
    }

    // Default parser for generic website
    const domainName = hostname.replace("www.", "");
    const parts = pathname.split("/").filter(Boolean);
    const pageTitle = parts[parts.length - 1] 
      ? decodeURIComponent(parts[parts.length - 1].replace(/[-_]/g, " ")) 
      : "";
    
    return {
      title: pageTitle ? `${domainName}: ${pageTitle}` : domainName,
      description: `Linked web resource from ${domainName}.`,
      type: "link"
    };
  } catch (e) {
    return {
      title: cleanUrl,
      description: "External web link.",
      type: "link"
    };
  }
}

export function TaskContextSection({
  task,
  onUpdateTask,
}: {
  task: TaskDTO;
  onUpdateTask?: (id: string, updates: any) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const addFormRef = useRef<HTMLDivElement>(null);
  const editFormRef = useRef<HTMLDivElement>(null);
  const addUrlRef = useRef<HTMLInputElement>(null);
  const editUrlRef = useRef<HTMLInputElement>(null);

  // Focus the add input when opening
  useEffect(() => {
    if (isAdding) {
      addUrlRef.current?.focus();
    }
  }, [isAdding]);

  // Focus the edit input when opening
  useEffect(() => {
    if (editingId) {
      editUrlRef.current?.focus();
    }
  }, [editingId]);

  const contextItems: TaskContextItem[] = (task.context ?? []).map((item: any) => ({
    id: item.id,
    title: item.title ?? "",
    url: item.url || item.content || "",
    description: item.description || "",
    type: item.type || "link",
    favicon: item.favicon || undefined,
  }));

  // Close add form on outside click
  useEffect(() => {
    if (!isAdding) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addFormRef.current && !addFormRef.current.contains(e.target as Node)) {
        setIsAdding(false);
        setNewUrl("");
        setNewTitle("");
        setNewDescription("");
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
        setEditUrl("");
        setEditDescription("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingId]);

  const fetchMetadata = async (urlVal: string) => {
    const url = urlVal.trim();
    if (!url) return null;

    setIsFetchingMeta(true);
    try {
      const res = await api.get<{ data: { title: string; description: string; favicon: string } }>(
        `v1/tasks/link-meta`,
        { params: { url } }
      );
      setIsFetchingMeta(false);
      return res.data.data;
    } catch (err) {
      console.error("Failed to fetch metadata:", err);
      setIsFetchingMeta(false);
      return null;
    }
  };

  const handleAdd = async () => {
    if (!newUrl.trim()) return;

    let title = newTitle.trim();
    let description = newDescription.trim();
    let favicon = "";

    const meta = await fetchMetadata(newUrl);
    if (meta) {
      if (!title) title = meta.title;
      if (!description) description = meta.description;
      favicon = meta.favicon;
    }

    if (!title) {
      const parsed = parseUrlMetadata(newUrl);
      title = parsed.title;
      if (!description) description = parsed.description;
    }

    const parsed = parseUrlMetadata(newUrl);
    const newItem = {
      id: crypto.randomUUID(),
      title: title || newUrl,
      url: newUrl.trim(),
      description,
      type: parsed.type,
      favicon,
    };

    const updatedContext = [
      ...(task.context ?? []),
      newItem,
    ];

    onUpdateTask?.(task.id, { context: updatedContext });

    setNewUrl("");
    setNewTitle("");
    setNewDescription("");
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const updatedContext = (task.context ?? []).filter((item: any) => item.id !== id);
    onUpdateTask?.(task.id, { context: updatedContext as any });
  };

  const handleStartEdit = (item: TaskContextItem) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditUrl(item.url);
    setEditDescription(item.description);
  };

  const handleSaveEdit = async () => {
    if (!editUrl.trim() || !editingId) return;

    let title = editTitle.trim();
    let description = editDescription.trim();
    let favicon = "";

    const meta = await fetchMetadata(editUrl);
    if (meta) {
      if (!title) title = meta.title;
      if (!description) description = meta.description;
      favicon = meta.favicon;
    }

    if (!title) {
      const parsed = parseUrlMetadata(editUrl);
      title = parsed.title;
      if (!description) description = parsed.description;
    }

    const parsed = parseUrlMetadata(editUrl);
    const updatedContext = (task.context ?? []).map((item: any) =>
      item.id === editingId
        ? {
            ...item,
            title: title || editUrl,
            url: editUrl.trim(),
            description,
            type: parsed.type,
            favicon: favicon || item.favicon,
          }
        : item
    );

    onUpdateTask?.(task.id, { context: updatedContext });

    setEditingId(null);
    setEditTitle("");
    setEditUrl("");
    setEditDescription("");
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Context Links
        </span>
      </div>

      {/* Inline Add Form */}
      {isAdding ? (
        <div
          ref={addFormRef}
          className="mb-3 rounded-md border border-border p-3 bg-muted/30 space-y-2.5"
        >
          {/* Link URL (Required) */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Link URL</label>
            <div className="relative">
              <Input
                ref={addUrlRef}
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onBlur={async () => {
                  if (newUrl.trim() && !newTitle.trim()) {
                    const meta = await fetchMetadata(newUrl);
                    if (meta) {
                      setNewTitle(meta.title);
                      if (meta.description) {
                        setNewDescription(meta.description);
                      }
                    }
                  }
                }}
                className="h-8 text-sm bg-background pr-8"
              />
              {isFetchingMeta && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground animate-spin" />
              )}
            </div>
          </div>

          {/* Title (Optional) */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Title (Optional - Auto-fetched if empty)</label>
            <Input
              placeholder="Custom title..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-8 text-sm bg-background"
            />
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Description (Optional - Auto-fetched if empty)</label>
            <textarea
              placeholder="Custom description..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Save action */}
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              className="h-7 text-xs px-4"
              onClick={handleAdd}
              disabled={!newUrl.trim() || isFetchingMeta}
            >
              {isFetchingMeta ? "Fetching..." : "Add Link"}
            </Button>
          </div>
        </div>
      ) : (
        /* Add Link Trigger button */
        <button
          onClick={() => setIsAdding(true)}
          className="mb-3 w-full text-left text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1 flex items-center gap-1.5"
        >
          <Link2 className="size-3.5" />
          Add context link...
        </button>
      )}

      {/* Context Links List */}
      <div className="space-y-2">
        {contextItems.length > 0 ? (
          contextItems.map((item) => (
            <div
              key={item.id}
              className="group rounded-md border border-border p-3 transition-colors hover:bg-accent/30"
            >
              {editingId === item.id ? (
                // Edit Mode
                <div ref={editFormRef} className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Link URL</label>
                    <Input
                      ref={editUrlRef}
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Title (Optional)</label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Title..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Description (Optional)</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full min-h-[60px] rounded-md border border-border bg-background px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Description..."
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" className="h-7 text-xs px-4" onClick={handleSaveEdit} disabled={!editUrl.trim() || isFetchingMeta}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start gap-3">
                  <div className="shrink-0 flex items-center justify-center size-7 bg-muted/40 rounded-md border border-border/40 shadow-sm p-1">
                    {item.favicon ? (
                      <img 
                        src={item.favicon} 
                        alt="" 
                        className="size-5 shrink-0 rounded-sm object-contain"
                        onError={(e) => {
                          // Hide broken favicons and fall back to the standard icons
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <ContextIcon type={item.type} className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <a
                      href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-foreground hover:text-blue-500 hover:underline transition-colors block truncate"
                    >
                      {item.title}
                    </a>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground/90 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity shrink-0">
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                      title="Edit Link"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                      title="Delete Link"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          !isAdding && (
            <p className="text-xs italic text-muted-foreground pl-1">No context links added</p>
          )
        )}
      </div>
    </div>
  );
}

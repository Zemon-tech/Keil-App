// src/components/chat/MessageTaskModal.tsx
// Convert any chat message into a tracked task (Huly core feature)

import { useState } from "react";
import { X, CheckCircle2, User, Calendar, Flag } from "lucide-react";
import type { ChatMessage, ChatMember } from "@/hooks/api/useChat";

interface Props {
  message: ChatMessage;
  members: ChatMember[];
  onClose: () => void;
  onCreated?: (task: CreatedTask) => void;
}

export interface CreatedTask {
  title: string;
  assignee: string;
  dueDate: string;
  priority: string;
  sourceMessageId: string;
}

const PRIORITIES = [
  { value: "urgent", label: "🔴 Urgent" },
  { value: "high",   label: "🟠 High" },
  { value: "medium", label: "🟡 Medium" },
  { value: "low",    label: "🟢 Low" },
];

export function MessageTaskModal({ message, members, onClose, onCreated }: Props) {
  const [title, setTitle] = useState(message.content.slice(0, 80));
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [created, setCreated] = useState(false);

  const handleCreate = () => {
    if (!title.trim()) return;
    const task: CreatedTask = {
      title: title.trim(),
      assignee,
      dueDate,
      priority,
      sourceMessageId: message.id,
    };
    onCreated?.(task);
    setCreated(true);
    setTimeout(onClose, 1200);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-full max-w-md px-4">
        <div className="bg-background rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-base text-foreground">Create Task from Message</h3>
            </div>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Source message preview */}
          <div className="mx-5 mt-4 px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-muted-foreground">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 text-primary">Source Message</p>
            <p className="line-clamp-2">&ldquo;{message.content}&rdquo;</p>
            <p className="text-[11px] mt-1 opacity-70">— {message.sender.name}</p>
          </div>

          {/* Form */}
          <div className="px-5 py-4 space-y-3">
            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Task Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                placeholder="Describe the task…"
              />
            </div>

            {/* Assignee */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Assign To
              </label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/50 transition-all"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Deadline + Priority */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/50 transition-all"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                  <Flag className="w-3 h-3" /> Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full bg-muted/50 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary/50 transition-all"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!title.trim() || created}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
            >
              {created ? (
                <><CheckCircle2 className="w-4 h-4" /> Task Created!</>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /> Create Task</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

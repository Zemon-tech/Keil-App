import { useState, useRef, useEffect } from "react";
import {
    Bell,
    X,
    Maximize2,
    Check,
    Trash2,
    CheckSquare,
    User,
    MessageCircle,
    Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { useNotifications, type Notification } from "@/contexts/NotificationContext";
import { formatDistanceToNow } from "date-fns";

interface NotificationDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenFullView: () => void;
}

const notificationStyles = {
    task_assigned: {
        label: "Task Assigned",
        icon: CheckSquare,
        className: "bg-[var(--event-task-bg)] text-[var(--event-task-text)] ring-[var(--event-task-border)]",
    },
    someone_messaged: {
        label: "Chat",
        icon: MessageCircle,
        className: "bg-[var(--event-focus-bg)] text-[var(--event-focus-text)] ring-[var(--event-focus-border)]",
    },
    motion_shared: {
        label: "Motion",
        icon: User,
        className: "bg-[var(--event-reminder-bg)] text-[var(--event-reminder-text)] ring-[var(--event-reminder-border)]",
    },
    task_status_changed: {
        label: "Task Update",
        icon: CheckSquare,
        className: "bg-[var(--event-task-bg)] text-[var(--event-task-text)] ring-[var(--event-task-border)]",
    },
    membership_updates: {
        label: "System",
        icon: Settings,
        className: "bg-[var(--event-deadline-bg)] text-[var(--event-deadline-text)] ring-[var(--event-deadline-border)]",
    },
    mention_in_comment: {
        label: "Mention",
        icon: User,
        className: "bg-[var(--event-reminder-bg)] text-[var(--event-reminder-text)] ring-[var(--event-reminder-border)]",
    },
} as const;

const getNotificationMeta = (eventType: string) =>
    notificationStyles[eventType as keyof typeof notificationStyles] ?? {
        label: "Update",
        icon: Bell,
        className: "bg-muted text-muted-foreground ring-border",
    };

function getNotificationTitle(n: Notification): string {
  const actor = n.payload.sender_name || "Someone";
  switch (n.event_type) {
    case "task_assigned":
      return `Task Assigned`;
    case "someone_messaged":
      return `New message from ${actor}`;
    case "motion_shared":
      return `Motion Shared`;
    case "task_status_changed":
      return `Task Status Updated`;
    case "membership_updates":
      return `Membership Update`;
    case "mention_in_comment":
      return `Mentioned in Comment`;
    default:
      return `New Notification`;
  }
}

function getNotificationSnippet(n: Notification): string {
  const actor = n.payload.sender_name || "Someone";
  switch (n.event_type) {
    case "task_assigned":
      return `${actor} assigned you to "${n.payload.task_title}"`;
    case "someone_messaged":
      return n.payload.message_snippet || `New message in channel`;
    case "motion_shared":
      return `${actor} shared "${n.payload.page_title}" with space`;
    case "task_status_changed":
      return `"${n.payload.task_title}" moved to ${n.payload.status}`;
    case "membership_updates":
      const action = n.payload.action === 'added_space' || n.payload.action === 'added_workspace' ? 'added you to' : 'updated your role in';
      const place = n.payload.space_name || n.payload.workspace_name || 'workspace';
      return `${actor} ${action} ${place} as ${n.payload.role}`;
    case "mention_in_comment":
      return `${actor} mentioned you: "${n.payload.comment_snippet}"`;
    default:
      return `You have a new alert`;
  }
}

export function NotificationDrawer({ open, onOpenChange, onOpenFullView }: NotificationDrawerProps) {
    const [width, setWidth] = useState(392);
    const isResizing = useRef(false);
    const [filter, setFilter] = useState<"All" | "Unread" | "Tasks" | "Mentions">("All");

    const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

    // Mark all as read when drawer is opened
    useEffect(() => {
        if (open) {
            markAllAsRead();
        }
    }, [open]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 340 && newWidth < 800) {
                setWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            if (isResizing.current) {
                isResizing.current = false;
                document.body.style.cursor = "default";
                document.body.style.userSelect = "auto";
            }
        };

        if (open) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
        }

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [open]);

    const filteredNotifications = notifications.filter((n) => {
        if (filter === "Unread") return !n.read_at;
        if (filter === "Tasks") return n.event_type === "task_assigned" || n.event_type === "task_status_changed";
        if (filter === "Mentions") return n.event_type === "mention_in_comment";
        return true;
    });

    if (!open) return null;

    return (
        <div
            style={{ width: `${width}px` }}
            className="fixed inset-y-0 right-0 z-[60] flex border-l border-border/80 bg-background/95 shadow-[var(--shadow-lg)] backdrop-blur-xl transition-colors duration-200"
        >
            <div
                className="absolute left-0 top-0 bottom-0 z-[70] w-1.5 cursor-ew-resize transition-colors hover:bg-primary/30 active:bg-primary/50"
                onMouseDown={(e) => {
                    e.preventDefault();
                    isResizing.current = true;
                    document.body.style.cursor = "ew-resize";
                    document.body.style.userSelect = "none";
                }}
            />

            <div className="relative flex h-full w-full flex-col overflow-hidden">
                <header className="border-b border-border/70 px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold tracking-[-0.03em] text-foreground">Notification</h2>
                            {unreadCount > 0 && (
                                <Badge className="h-6 border-border/70 bg-card px-2 text-xs text-foreground shadow-sm">
                                    {unreadCount} unread
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card/80 p-1 shadow-sm">
                            <Button 
                                variant="ghost" 
                                size="icon-xs" 
                                className="rounded-full text-muted-foreground hover:text-foreground" 
                                aria-label="Mark all as read"
                                onClick={markAllAsRead}
                            >
                                <Check className="size-3.5" />
                            </Button>
                            <Button 
                                variant="ghost" 
                                size="icon-xs" 
                                className="rounded-full text-muted-foreground hover:text-destructive" 
                                aria-label="Clear all notifications"
                                onClick={clearAll}
                            >
                                <Trash2 className="size-3.5" />
                            </Button>
                            <button
                                onClick={onOpenFullView}
                                className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                aria-label="Open full notification view"
                            >
                                <Maximize2 className="size-3.5" />
                            </button>
                            <button
                                onClick={() => onOpenChange(false)}
                                className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                aria-label="Close notifications"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                        {(["All", "Unread", "Tasks", "Mentions"] as const).map((label) => (
                            <button
                                key={label}
                                onClick={() => setFilter(label)}
                                className={cn(
                                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                    filter === label
                                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                        : "border-border/70 bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-2 py-2">
                    {filteredNotifications.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-muted-foreground">
                            <Bell className="mb-3 size-12 opacity-25" />
                            <p className="text-sm font-medium text-foreground">No notifications</p>
                            <p className="mt-1 text-xs">Important workspace updates will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredNotifications.map((notification) => {
                                const meta = getNotificationMeta(notification.event_type);
                                const Icon = meta.icon;
                                const isRead = !!notification.read_at;

                                return (
                                    <article
                                        key={notification.id}
                                        onClick={() => !isRead && markAsRead(notification.id)}
                                        className={cn(
                                            "group relative overflow-hidden rounded-xl px-3 py-2.5 transition-all duration-200 cursor-pointer",
                                            isRead
                                                ? "bg-transparent hover:bg-muted/40"
                                                : "bg-muted/20 hover:bg-muted/30"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", meta.className)}>
                                                <Icon className="size-3.5" />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="mb-1 flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className={cn(
                                                                "truncate text-sm tracking-[-0.02em]",
                                                                isRead ? "font-medium text-foreground/80" : "font-semibold text-foreground"
                                                            )}>
                                                                {getNotificationTitle(notification)}
                                                            </h3>
                                                            {!isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                                                        </div>
                                                        <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                                            {getNotificationSnippet(notification)}
                                                        </p>
                                                    </div>

                                                    {notification.sender_name && (
                                                        <Avatar className="size-6 border-none bg-muted shadow-none">
                                                            <AvatarFallback className="bg-secondary text-[9px] font-semibold text-secondary-foreground">
                                                                {notification.sender_name.charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    )}
                                                </div>

                                                <div className="mt-2 flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="h-5 border-none bg-muted/60 px-2 text-[9px] font-medium text-muted-foreground shadow-none">
                                                            {meta.label}
                                                        </Badge>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

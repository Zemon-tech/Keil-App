import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  CheckSquare,
  Maximize2,
  MessageCircle,
  Settings,
  Trash2,
  User,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNotifications, type Notification } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";

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
      return "Task Assigned";
    case "someone_messaged":
      return `New message from ${actor}`;
    case "motion_shared":
      return "Motion Shared";
    case "task_status_changed":
      return "Task Status Updated";
    case "membership_updates":
      return "Membership Update";
    case "mention_in_comment":
      return "Mentioned in Comment";
    default:
      return "New Notification";
  }
}

function getNotificationSnippet(n: Notification): string {
  const actor = n.payload.sender_name || "Someone";
  switch (n.event_type) {
    case "task_assigned":
      return `${actor} assigned you to "${n.payload.task_title}"`;
    case "someone_messaged":
      return n.payload.message_snippet || "New message in channel";
    case "motion_shared":
      return `${actor} shared "${n.payload.page_title}" with space`;
    case "task_status_changed":
      return `"${n.payload.task_title}" moved to ${n.payload.status}`;
    case "membership_updates": {
      const action = n.payload.action === "added_space" || n.payload.action === "added_workspace"
        ? "added you to"
        : "updated your role in";
      const place = n.payload.space_name || n.payload.workspace_name || "workspace";
      return `${actor} ${action} ${place} as ${n.payload.role}`;
    }
    case "mention_in_comment":
      return `${actor} mentioned you: "${n.payload.comment_snippet}"`;
    default:
      return "You have a new alert";
  }
}

export function NotificationDrawer({
  open,
  onOpenChange,
  onOpenFullView,
}: NotificationDrawerProps) {
  const width = 400;
  const [filter, setFilter] = useState<"All" | "Unread" | "Tasks" | "Mentions">("All");
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  useEffect(() => {
    if (open) {
      markAllAsRead();
    }
    // markAllAsRead is recreated by the notification context on state changes.
    // The drawer should mark once when it opens, not after every notification update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "Unread") return !n.read_at;
    if (filter === "Tasks") return n.event_type === "task_assigned" || n.event_type === "task_status_changed";
    if (filter === "Mentions") return n.event_type === "mention_in_comment";
    return true;
  });

  if (!open) {
    return null;
  }

  return (
    <div
      style={{ width: `${width}px` }}
      className="absolute inset-y-0 right-0 z-50 flex shadow-2xl border-l border-border bg-background transition-[width] duration-300"
    >
      <div className="flex flex-col size-full relative">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border h-14 shrink-0 bg-card">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-sm">Notifications</h2>
            {unreadCount > 0 && (
              <Badge className="h-5 border-border/70 bg-background px-2 text-[10px] text-foreground shadow-none">
                {unreadCount} unread
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={markAllAsRead}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Mark all as read"
            >
              <Check className="size-4" />
            </button>
            <button
              onClick={clearAll}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Clear all notifications"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              onClick={onOpenFullView}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Open full notification view"
            >
              <Maximize2 className="size-4" />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close notifications"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="shrink-0 border-b border-border/70 px-3 py-2">
            <div className="flex gap-1 overflow-x-auto">
              {(["All", "Unread", "Tasks", "Mentions"] as const).map((label) => (
                <button
                  key={label}
                  onClick={() => setFilter(label)}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    filter === label
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {filteredNotifications.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Bell className="mb-3 size-10 opacity-25" />
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
                        "group relative cursor-pointer rounded-md px-3 py-2.5 transition-colors",
                        isRead ? "hover:bg-muted/40" : "bg-muted/30 hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", meta.className)}>
                          <Icon className="size-3.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3
                              className={cn(
                                "truncate text-sm",
                                isRead ? "font-medium text-foreground/80" : "font-semibold text-foreground",
                              )}
                            >
                              {getNotificationTitle(notification)}
                            </h3>
                            {!isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {getNotificationSnippet(notification)}
                          </p>

                          <div className="mt-2 flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="h-5 border-none bg-muted/60 px-2 text-[9px] font-medium text-muted-foreground shadow-none"
                            >
                              {meta.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                            </span>
                            {notification.sender_name && (
                              <Avatar className="ml-auto size-5 border-none bg-muted shadow-none">
                                <AvatarFallback className="bg-secondary text-[8px] font-semibold text-secondary-foreground">
                                  {notification.sender_name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
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
    </div>
  );
}

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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNotifications, getNotificationTitle, getNotificationSnippet, groupNotifications } from "@/contexts/NotificationContext";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";

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
  comment_created: {
    label: "Comment",
    icon: MessageCircle,
    className: "bg-[var(--event-focus-bg)] text-[var(--event-focus-text)] ring-[var(--event-focus-border)]",
  },
} as const;

const getNotificationMeta = (eventType: string) =>
  notificationStyles[eventType as keyof typeof notificationStyles] ?? {
    label: "Update",
    icon: Bell,
    className: "bg-muted text-muted-foreground ring-border",
  };

export function NotificationDrawer({
  open,
  onOpenChange,
  onOpenFullView,
}: NotificationDrawerProps) {
  const width = 400;
  const { organisations } = useAppContext();
  const [filter, setFilter] = useState<"All" | "Unread" | "Tasks" | "Mentions">("All");
  const { notifications, unreadCount, markAllAsRead, clearAll, handleNotificationClick } = useNotifications();

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
    if (filter === "Tasks") return n.event_type === "task_assigned" || n.event_type === "task_status_changed" || n.event_type === "comment_created";
    if (filter === "Mentions") return n.event_type === "mention_in_comment";
    return true;
  });

  if (!open) {
    return null;
  }

  return (
    <div
      style={{ width: `${width}px` }}
      className="absolute inset-y-0 right-0 z-50 flex shadow-2xl border-l border-border/50 bg-background transition-[width] duration-300 animate-in fade-in slide-in-from-right"
    >
      <div className="flex flex-col size-full relative">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 h-14 shrink-0 bg-card/50 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-semibold text-sm">Notifications</h2>
            {unreadCount > 0 && (
              <Badge className="h-5 border-border/50 bg-background px-2 text-[10px] text-foreground shadow-none">
                {unreadCount} unread
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={markAllAsRead}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-100 ease-out active:scale-90"
              aria-label="Mark all as read"
            >
              <Check className="size-4" />
            </button>
            <button
              onClick={clearAll}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-all duration-100 ease-out active:scale-90"
              aria-label="Clear all notifications"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              onClick={onOpenFullView}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-100 ease-out active:scale-90"
              aria-label="Open full notification view"
            >
              <Maximize2 className="size-4" />
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-100 ease-out active:scale-90"
              aria-label="Close notifications"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="shrink-0 border-b border-border/50 px-3 py-2 bg-card/10">
            <div className="flex gap-1 overflow-x-auto">
              {(["All", "Unread", "Tasks", "Mentions"] as const).map((label) => (
                <button
                  key={label}
                  onClick={() => setFilter(label)}
                  className={cn(
                    "shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all duration-100 ease-out active:scale-95 border",
                    filter === label
                      ? "border-primary/20 bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
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
              <div className="space-y-1.5">
                {groupNotifications(filteredNotifications).map((item) => {
                  const notification = item.main;
                  const meta = getNotificationMeta(notification.event_type);
                  const Icon = meta.icon;
                  const isRead = !!notification.read_at;
                  const actor = notification.payload.sender_name || notification.sender_name || "Someone";
                  const hasSender = !!(notification.sender_name || notification.payload.sender_name);

                  // Custom formatted description to avoid duplicate snippets
                  let descriptionText = "";
                  let calloutText = "";

                  if (notification.event_type === "comment_created") {
                      descriptionText = `${actor} commented on "${notification.payload.task_title || 'Task'}"`;
                      calloutText = notification.payload.comment_snippet || "";
                  } else if (notification.event_type === "mention_in_comment") {
                      descriptionText = `${actor} mentioned you in a comment on "${notification.payload.task_title || 'Task'}"`;
                      calloutText = notification.payload.comment_snippet || "";
                  } else if (notification.event_type === "someone_messaged") {
                      const channelLabel = notification.payload.channel_name ? ` in #${notification.payload.channel_name}` : "";
                      descriptionText = `${actor} sent a message${channelLabel}`;
                      calloutText = notification.payload.message_snippet || "";
                  } else {
                      descriptionText = getNotificationSnippet(notification, organisations);
                  }

                  return (
                    <article
                      key={item.id}
                      onClick={() => {
                        handleNotificationClick(notification);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "group relative flex gap-3 cursor-pointer rounded-xl p-3 transition-[transform,background-color,border-color] duration-150 ease-out border active:scale-[0.98]",
                        isRead 
                          ? "bg-background border-transparent hover:bg-muted/40 hover:border-border/40" 
                          : "bg-muted/15 border-border/10 hover:bg-muted/25 hover:border-border/30 shadow-xs",
                      )}
                    >
                      {/* Left side: Avatar or Icon */}
                      <div className="relative shrink-0">
                        {hasSender ? (
                          <div className="relative">
                            <Avatar className="size-8.5 border border-border/50 shadow-xs rounded-xl">
                              <AvatarImage
                                src={getOptimizedImageUrl(notification.sender_avatar, { width: 68, height: 68 })}
                                alt={actor}
                              />
                              <AvatarFallback className="bg-primary/20 text-foreground text-xs font-semibold uppercase rounded-xl">
                                {actor.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn(
                              "absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-background shadow-xs",
                              meta.className
                            )}>
                              <Icon className="size-2.5" />
                            </div>
                          </div>
                        ) : (
                          <div className={cn("flex size-8.5 items-center justify-center rounded-xl shadow-xs border border-border/20", meta.className)}>
                            <Icon className="size-4" />
                          </div>
                        )}
                      </div>

                      {/* Right side: Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h3
                              className={cn(
                                "truncate text-xs tracking-tight",
                                isRead ? "font-medium text-foreground/80" : "font-semibold text-foreground",
                              )}
                            >
                              {getNotificationTitle(notification)}
                            </h3>
                            {!isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground/80 shrink-0">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {descriptionText}
                        </p>

                        {/* Callout box for comments/messages */}
                        {calloutText && (
                          <div className="mt-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs text-foreground/90 font-normal italic shadow-2xs leading-relaxed line-clamp-3">
                            "{calloutText}"
                          </div>
                        )}

                        <div className="mt-2.5 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="h-5 border-border/40 bg-card/50 px-1.5 text-[9px] font-medium text-muted-foreground shadow-none rounded-md"
                          >
                            {meta.label}
                          </Badge>
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

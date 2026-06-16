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
    className: "bg-emerald-500 text-white border-emerald-600",
  },
  someone_messaged: {
    label: "Chat",
    icon: MessageCircle,
    className: "bg-blue-500 text-white border-blue-600",
  },
  motion_shared: {
    label: "Motion",
    icon: User,
    className: "bg-purple-500 text-white border-purple-600",
  },
  task_status_changed: {
    label: "Task Update",
    icon: CheckSquare,
    className: "bg-amber-500 text-white border-amber-600",
  },
  membership_updates: {
    label: "System",
    icon: Settings,
    className: "bg-rose-500 text-white border-rose-600",
  },
  mention_in_comment: {
    label: "Mention",
    icon: User,
    className: "bg-indigo-500 text-white border-indigo-600",
  },
  comment_created: {
    label: "Comment",
    icon: MessageCircle,
    className: "bg-pink-500 text-white border-pink-600",
  },
} as const;

const getNotificationMeta = (eventType: string) =>
  notificationStyles[eventType as keyof typeof notificationStyles] ?? {
    label: "Update",
    icon: Bell,
    className: "bg-muted text-muted-foreground border-border",
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

          <div className="flex-1 overflow-y-auto px-2 py-1">
            {filteredNotifications.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Bell className="mb-3 size-10 opacity-25" />
                <p className="text-sm font-medium text-foreground">No notifications</p>
                <p className="mt-1 text-xs">Important workspace updates will appear here.</p>
              </div>
            ) : (
              <div className="flex flex-col">
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
                        "group relative flex gap-2.5 cursor-pointer p-2.5 transition-all duration-150 ease-out border-b border-border/40 active:bg-muted/30 select-none",
                        isRead 
                          ? "bg-transparent hover:bg-muted/20" 
                          : "bg-primary/[0.03] hover:bg-primary/[0.05]",
                      )}
                    >
                      {/* Left side: Avatar or Icon */}
                      <div className="relative shrink-0 pt-0.5">
                        {hasSender ? (
                          <div className="relative">
                            <Avatar className="size-8 border border-border/50 shadow-xs rounded-full">
                              <AvatarImage
                                src={getOptimizedImageUrl(notification.sender_avatar, { width: 64, height: 64 })}
                                alt={actor}
                              />
                              <AvatarFallback className="bg-primary/20 text-foreground text-xs font-semibold uppercase rounded-full">
                                {actor.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className={cn(
                              "absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-background shadow-xs",
                              meta.className
                            )}>
                              <Icon className="size-2 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className={cn("flex size-8 items-center justify-center rounded-full shadow-xs border border-border/20", meta.className)}>
                            <Icon className="size-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Right side: Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                            <h3
                              className={cn(
                                "truncate text-xs tracking-tight",
                                isRead ? "font-medium text-foreground/80" : "font-semibold text-foreground",
                              )}
                            >
                              {getNotificationTitle(notification)}
                            </h3>
                            <Badge
                              variant="outline"
                              className="h-auto py-0 px-1 text-[9px] font-normal rounded-md shrink-0 bg-transparent text-muted-foreground border-border/60"
                            >
                              {meta.label}
                            </Badge>
                            {!isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary animate-pulse" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground/70 shrink-0 mt-0.5">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        
                        <p className="mt-0.5 text-xs leading-normal text-muted-foreground/90 line-clamp-2">
                          {descriptionText}
                        </p>

                        {/* Callout box for comments/messages */}
                        {calloutText && (
                          <div className="mt-1.5 border-l-2 border-border/80 pl-2 text-xs text-muted-foreground/75 font-normal italic line-clamp-2 leading-relaxed">
                            "{calloutText}"
                          </div>
                        )}
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

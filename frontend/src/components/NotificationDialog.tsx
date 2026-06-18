import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";
import {
    Bell,
    X,
    Minimize2,
    CheckCheck,
    Trash2,
    CheckSquare,
    User,
    MessageCircle,
    Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getOptimizedImageUrl } from "@/lib/image-optimizer";

interface NotificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onMinimize?: () => void;
}

import { useNotifications, getNotificationTitle, getNotificationSnippet, groupNotifications } from "@/contexts/NotificationContext";
import { formatDistanceToNow } from "date-fns";
import { useState, useEffect } from "react";
import { useAppContext } from "@/contexts/AppContext";



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

export function NotificationDialog({ open, onOpenChange, onMinimize }: NotificationDialogProps) {
    const { notifications, unreadCount, markAllAsRead, clearAll, handleNotificationClick } = useNotifications();
    const { organisations } = useAppContext();
    const [filter, setFilter] = useState<"All" | "Tasks" | "Mentions" | "Chat" | "System">("All");

    // Mark all as read when dialog is opened
    useEffect(() => {
        if (open) {
            markAllAsRead();
        }
    }, [open]);

    const categories = [
        { id: "All" as const, label: "All", icon: Bell, count: notifications.length },
        { id: "Tasks" as const, label: "Tasks", icon: CheckSquare, count: notifications.filter((n) => n.event_type === "task_assigned" || n.event_type === "task_status_changed" || n.event_type === "comment_created").length },
        { id: "Mentions" as const, label: "Mentions", icon: User, count: notifications.filter((n) => n.event_type === "mention_in_comment").length },
        { id: "Chat" as const, label: "Chat", icon: MessageCircle, count: notifications.filter((n) => n.event_type === "someone_messaged").length },
        { id: "System" as const, label: "System", icon: Settings, count: notifications.filter((n) => n.event_type === "membership_updates").length },
    ];

    const filteredNotifications = notifications.filter((n) => {
        if (filter === "Tasks") return n.event_type === "task_assigned" || n.event_type === "task_status_changed" || n.event_type === "comment_created";
        if (filter === "Mentions") return n.event_type === "mention_in_comment";
        if (filter === "Chat") return n.event_type === "someone_messaged";
        if (filter === "System") return n.event_type === "membership_updates";
        return true;
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                aria-describedby={undefined}
                className="!h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !w-[calc(100vw-40px)] !max-w-[1180px] !gap-0 overflow-hidden !rounded-2xl border border-border/80 bg-background !p-0 shadow-2xl"
            >
                <VisuallyHidden.Root>
                    <DialogTitle>Notifications</DialogTitle>
                </VisuallyHidden.Root>

                <div className="flex h-full overflow-hidden">
                    <aside className="hidden h-full w-80 shrink-0 flex-col border-r border-border/50 bg-card/60 backdrop-blur-xs md:flex">
                        <div className="border-b border-border/50 px-4 py-3 h-14 flex items-center shrink-0">
                            <div className="flex w-full items-center justify-between gap-3">
                                <h2 className="text-sm font-semibold tracking-tight text-foreground">Notifications</h2>
                                {onMinimize && (
                                    <button
                                        onClick={onMinimize}
                                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-100 ease-out active:scale-90"
                                        aria-label="Minimize notifications"
                                    >
                                        <Minimize2 className="size-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3">
                            <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Views</p>
                            <div className="space-y-1">
                                {categories.map((category) => {
                                    const Icon = category.icon;
                                    const isSelected = filter === category.id;

                                    return (
                                        <button
                                            key={category.id}
                                            onClick={() => setFilter(category.id)}
                                            className={cn(
                                                "group flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm transition-[transform,background-color,border-color] duration-150 ease-out cursor-pointer active:scale-[0.98]",
                                                isSelected
                                                    ? "border-primary/20 bg-primary/10 text-primary font-medium shadow-xs"
                                                    : "border-transparent text-muted-foreground hover:border-border/60 hover:bg-background hover:text-foreground"
                                            )}
                                        >
                                            <span className="flex items-center gap-3 font-medium">
                                                <Icon className="size-4" />
                                                {category.label}
                                            </span>
                                            <span className={cn(
                                                "rounded-md px-1.5 py-0.5 text-xs font-medium min-w-[20px] text-center transition-colors duration-150",
                                                isSelected 
                                                    ? "bg-primary text-primary-foreground" 
                                                    : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/10 group-hover:text-foreground"
                                            )}>
                                                {category.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    <main className="flex min-w-0 flex-1 flex-col bg-background">
                        <header className="border-b border-border/50 px-5 py-3.5 md:px-7 md:py-0 md:h-14 md:flex md:flex-col md:justify-center shrink-0">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-sm font-semibold tracking-tight text-foreground">
                                        {filter === "All" ? "All Notifications" : `${filter} Notifications`}
                                    </h2>
                                    {unreadCount > 0 && (
                                        <Badge className="h-5 border-border/50 bg-card px-2 text-[10px] text-foreground shadow-none">
                                            {unreadCount} unread
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="rounded-xl h-8 px-3 text-xs bg-card/85 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50 transition-all duration-100 ease-out active:scale-95" 
                                        aria-label="Mark all as read"
                                        onClick={markAllAsRead}
                                    >
                                        <CheckCheck className="size-3.5" />
                                        Mark read
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="icon-sm" 
                                        className="rounded-xl size-8 bg-card/85 text-muted-foreground hover:bg-muted hover:text-destructive border border-border/50 transition-all duration-100 ease-out active:scale-95" 
                                        aria-label="Clear all notifications"
                                        onClick={clearAll}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                    <button
                                        onClick={() => onOpenChange(false)}
                                        className="flex size-8 items-center justify-center rounded-xl bg-card/85 border border-border/50 text-muted-foreground transition-all duration-100 ease-out hover:bg-muted hover:text-foreground active:scale-90 ml-2"
                                        aria-label="Close notifications"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 md:hidden">
                                {categories.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => setFilter(category.id)}
                                        className={cn(
                                            "shrink-0 rounded-xl border px-3 py-1 text-xs font-medium transition-all duration-100 ease-out active:scale-95",
                                            filter === category.id
                                                ? "border-primary/20 bg-primary/10 text-primary font-medium shadow-xs"
                                                : "border-border/50 bg-card/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        {category.label}
                                    </button>
                                ))}
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-7 md:py-5">
                            {filteredNotifications.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/60 p-12 text-center text-muted-foreground">
                                    <Bell className="mb-4 size-16 opacity-25" />
                                    <h3 className="text-lg font-semibold text-foreground">No notifications</h3>
                                    <p className="mt-2 max-w-[320px] text-sm">You're all caught up. Important workspace updates will appear here.</p>
                                </div>
                            ) : (
                                <div className="mx-auto max-w-3xl space-y-2">
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
                                                    "group relative flex gap-4 rounded-xl p-4 transition-[transform,background-color,border-color] duration-150 ease-out cursor-pointer border active:scale-[0.99]",
                                                    isRead
                                                        ? "bg-background border-transparent hover:bg-muted/40 hover:border-border/40"
                                                        : "bg-muted/15 border-border/10 hover:bg-muted/25 hover:border-border/30 shadow-xs"
                                                )}
                                            >
                                                {/* Left side: Avatar or Icon */}
                                                <div className="relative shrink-0">
                                                    {hasSender ? (
                                                        <div className="relative">
                                                            <Avatar className="size-10 border border-border/50 shadow-xs rounded-xl">
                                                                <AvatarImage
                                                                    src={getOptimizedImageUrl(notification.sender_avatar, { width: 80, height: 80 })}
                                                                    alt={actor}
                                                                />
                                                                <AvatarFallback className="bg-primary/20 text-foreground text-sm font-semibold uppercase rounded-xl">
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
                                                        <div className={cn("flex size-10 items-center justify-center rounded-xl shadow-xs border border-border/20", meta.className)}>
                                                            <Icon className="size-5" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Right side: Content */}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className={cn(
                                                                "text-sm tracking-tight",
                                                                isRead ? "font-medium text-foreground/80" : "font-semibold text-foreground"
                                                            )}>
                                                                {getNotificationTitle(notification)}
                                                            </h3>
                                                            {!isRead && <span className="size-2 rounded-full bg-primary" />}
                                                        </div>
                                                        <span className="text-[11px] text-muted-foreground/80">
                                                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                                                        </span>
                                                    </div>

                                                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                                                        {descriptionText}
                                                    </p>

                                                    {/* Callout box for comments/messages */}
                                                    {calloutText && (
                                                        <div className="mt-2 rounded-lg border border-border/40 bg-muted/30 px-3.5 py-2 text-sm text-foreground/90 font-normal italic shadow-2xs leading-relaxed max-w-[70ch]">
                                                            "{calloutText}"
                                                        </div>
                                                    )}

                                                    <div className="mt-2.5 flex items-center gap-2">
                                                        <Badge variant="outline" className="h-5 border-border/40 bg-card/50 px-1.5 text-[9px] font-medium text-muted-foreground shadow-none rounded-md">
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
                    </main>
                </div>
            </DialogContent>
        </Dialog>
    );
}

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
    CheckCheck,
    Trash2,
    CheckSquare,
    User,
    MessageCircle,
    Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface NotificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
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

export function NotificationDialog({ open, onOpenChange }: NotificationDialogProps) {
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
                className="!h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !w-[calc(100vw-40px)] !max-w-[1180px] !gap-0 overflow-hidden !rounded-[2rem] border border-border/80 bg-background !p-0 shadow-[var(--shadow-lg)]"
            >
                <VisuallyHidden.Root>
                    <DialogTitle>Notifications</DialogTitle>
                </VisuallyHidden.Root>

                <div className="flex h-full overflow-hidden">
                    <aside className="hidden h-full w-72 shrink-0 flex-col border-r border-border/70 bg-card/70 md:flex">
                        <div className="border-b border-border/70 px-5 py-5">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-xl font-semibold tracking-[-0.04em] text-foreground">Notification</h2>
                                <button
                                    onClick={() => onOpenChange(false)}
                                    className="flex size-8 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                    aria-label="Close notifications"
                                >
                                    <X className="size-4" />
                                </button>
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
                                                "group flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-sm transition-all cursor-pointer",
                                                isSelected
                                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                                    : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-background hover:text-foreground"
                                            )}
                                        >
                                            <span className="flex items-center gap-3 font-medium">
                                                <Icon className="size-4" />
                                                {category.label}
                                            </span>
                                            <span className={cn(
                                                "rounded-full px-2 py-0.5 text-xs",
                                                isSelected ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground group-hover:text-foreground"
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
                        <header className="border-b border-border/70 px-5 py-4 md:px-7 md:py-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-semibold tracking-[-0.04em] text-foreground md:text-3xl">
                                            {filter === "All" ? "All Notifications" : `${filter} Notifications`}
                                        </h2>
                                        {unreadCount > 0 && (
                                            <Badge className="h-6 border-border/70 bg-card px-2 text-xs text-foreground shadow-sm">
                                                {unreadCount} unread
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="rounded-full bg-card/80 text-muted-foreground hover:text-foreground" 
                                        aria-label="Mark all as read"
                                        onClick={markAllAsRead}
                                    >
                                        <CheckCheck className="size-4" />
                                        Mark read
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="icon-sm" 
                                        className="rounded-full bg-card/80 text-muted-foreground hover:text-destructive" 
                                        aria-label="Clear all notifications"
                                        onClick={clearAll}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                    <button
                                        onClick={() => onOpenChange(false)}
                                        className="flex size-8 items-center justify-center rounded-full border border-border/70 bg-card/80 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
                                        aria-label="Close notifications"
                                    >
                                        <X className="size-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
                                {categories.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => setFilter(category.id)}
                                        className={cn(
                                            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                                            filter === category.id
                                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                                : "border-border/70 bg-card/70 text-muted-foreground hover:bg-accent hover:text-foreground"
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
                                <div className="mx-auto max-w-3xl space-y-1">
                                    {groupNotifications(filteredNotifications).map((item) => {
                                        const notification = item.main;
                                        const meta = getNotificationMeta(notification.event_type);
                                        const Icon = meta.icon;
                                        const isRead = !!notification.read_at;

                                        return (
                                            <article
                                                key={item.id}
                                                onClick={() => {
                                                    handleNotificationClick(notification);
                                                    onOpenChange(false);
                                                }}
                                                className={cn(
                                                    "group relative overflow-hidden rounded-xl p-4 transition-all duration-200 cursor-pointer",
                                                    isRead
                                                        ? "bg-transparent hover:bg-muted/40"
                                                        : "bg-muted/20 hover:bg-muted/30"
                                                )}
                                            >
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="flex min-w-0 flex-1 gap-4">
                                                        <div className={cn("flex size-8.5 shrink-0 items-center justify-center rounded-lg", meta.className)}>
                                                            <Icon className="size-4" />
                                                        </div>

                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <h3 className={cn(
                                                                    "text-base tracking-[-0.03em]",
                                                                    isRead ? "font-medium text-foreground/80" : "font-semibold text-foreground"
                                                                )}>
                                                                    {getNotificationTitle(notification)}
                                                                </h3>
                                                                {!isRead && <span className="size-1.5 rounded-full bg-primary" />}
                                                                <Badge variant="outline" className="h-5 border-none bg-muted/60 px-2 text-[9px] font-medium text-muted-foreground shadow-none">
                                                                    {meta.label}
                                                                </Badge>
                                                            </div>
                                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                                {getNotificationSnippet(notification, organisations)}
                                                            </p>

                                                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                                <span>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</span>
                                                                {notification.sender_name && (
                                                                    <span className="flex items-center gap-2">
                                                                        <Avatar className="size-6 border-none bg-muted shadow-none">
                                                                            <AvatarFallback className="bg-secondary text-[10px] font-semibold text-secondary-foreground">
                                                                                {notification.sender_name.charAt(0).toUpperCase()}
                                                                            </AvatarFallback>
                                                                        </Avatar>
                                                                        {notification.sender_name}
                                                                    </span>
                                                                )}
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
                    </main>
                </div>
            </DialogContent>
        </Dialog>
    );
}

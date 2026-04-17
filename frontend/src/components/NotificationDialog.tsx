import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";
import { Bell, X, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface NotificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Mock notification data - replace with actual API call
const mockNotifications = [
    {
        id: "1",
        type: "task",
        title: "Task assigned to you",
        description: "You have been assigned to 'Fix login bug'",
        time: "2 minutes ago",
        read: false,
        user: { name: "John Doe", email: "john@example.com" }
    },
    {
        id: "2",
        type: "mention",
        title: "You were mentioned",
        description: "Sarah mentioned you in 'Project Planning'",
        time: "15 minutes ago",
        read: false,
        user: { name: "Sarah Smith", email: "sarah@example.com" }
    },
    {
        id: "3",
        type: "chat",
        title: "New message in #general",
        description: "Mike: Hey everyone, check out the new feature!",
        time: "1 hour ago",
        read: true,
        user: { name: "Mike Johnson", email: "mike@example.com" }
    },
    {
        id: "4",
        type: "system",
        title: "Workspace updated",
        description: "Your workspace settings have been updated",
        time: "3 hours ago",
        read: true,
        user: null
    },
    {
        id: "5",
        type: "task",
        title: "Task completed",
        description: "'Design review' has been marked as complete",
        time: "5 hours ago",
        read: true,
        user: { name: "Emily Brown", email: "emily@example.com" }
    },
];

const getNotificationIcon = (type: string) => {
    switch (type) {
        case "task":
            return "📋";
        case "mention":
            return "👤";
        case "chat":
            return "💬";
        case "system":
            return "⚙️";
        default:
            return "🔔";
    }
};

const getNotificationColor = (type: string) => {
    switch (type) {
        case "task":
            return "bg-blue-500/10 text-blue-500";
        case "mention":
            return "bg-purple-500/10 text-purple-500";
        case "chat":
            return "bg-green-500/10 text-green-500";
        case "system":
            return "bg-orange-500/10 text-orange-500";
        default:
            return "bg-gray-500/10 text-gray-500";
    }
};

export function NotificationDialog({ open, onOpenChange }: NotificationDialogProps) {
    const unreadCount = mockNotifications.filter(n => !n.read).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="!max-w-[calc(100vw-40px)] !w-[calc(100vw-40px)] !h-[calc(100vh-40px)] !max-h-[calc(100vh-40px)] !rounded-2xl !p-0 !gap-0 border border-border shadow-2xl overflow-hidden"
            >
                <VisuallyHidden.Root>
                    <DialogTitle>Notifications</DialogTitle>
                </VisuallyHidden.Root>

                <div className="flex h-full">
                    {/* ── Left Sidebar: Notification Categories ── */}
                    <div className="w-72 shrink-0 bg-card border-r border-border flex flex-col h-full">
                        {/* Sidebar Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <div className="flex items-center gap-2">
                                <Bell className="h-4 w-4" />
                                <span className="text-sm font-semibold">Notifications</span>
                                {unreadCount > 0 && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/10 text-primary">
                                        {unreadCount > 9 ? "9+" : unreadCount}
                                    </Badge>
                                )}
                            </div>
                            <button
                                onClick={() => onOpenChange(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                aria-label="Close notifications"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Notification Categories */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-primary/10 text-primary">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">🔔</span>
                                    <span className="text-sm font-medium">All</span>
                                </div>
                                {unreadCount > 0 && (
                                    <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/20 text-primary">
                                        {unreadCount}
                                    </Badge>
                                )}
                            </button>

                            <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-foreground">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">📋</span>
                                    <span className="text-sm font-medium">Tasks</span>
                                </div>
                                <span className="text-xs text-muted-foreground">2</span>
                            </button>

                            <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-foreground">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">👤</span>
                                    <span className="text-sm font-medium">Mentions</span>
                                </div>
                                <span className="text-xs text-muted-foreground">1</span>
                            </button>

                            <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-foreground">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">💬</span>
                                    <span className="text-sm font-medium">Chat</span>
                                </div>
                                <span className="text-xs text-muted-foreground">1</span>
                            </button>

                            <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted text-foreground">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">⚙️</span>
                                    <span className="text-sm font-medium">System</span>
                                </div>
                                <span className="text-xs text-muted-foreground">1</span>
                            </button>

                            <Separator className="my-2" />

                            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-foreground">
                                <CheckCheck className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Mark all as read</span>
                            </button>

                            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-foreground text-red-500 hover:text-red-600">
                                <Trash2 className="h-4 w-4" />
                                <span className="text-sm font-medium">Clear all</span>
                            </button>
                        </div>
                    </div>

                    {/* ── Right Content Area: Notifications List ── */}
                    <div className="flex-1 h-full overflow-hidden bg-background flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h2 className="text-lg font-semibold">All Notifications</h2>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="text-xs rounded-lg">
                                    <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                                    Mark all read
                                </Button>
                            </div>
                        </div>

                        {/* Notifications List */}
                        <div className="flex-1 overflow-y-auto">
                            {mockNotifications.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center">
                                    <Bell className="h-16 w-16 opacity-20 mb-4" />
                                    <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                                    <p className="text-sm max-w-[320px]">
                                        You're all caught up! We'll notify you when something important happens.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {mockNotifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            className={cn(
                                                "px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer",
                                                !notification.read && "bg-primary/5"
                                            )}
                                        >
                                            <div className="flex items-start gap-4">
                                                {/* Icon */}
                                                <div className={cn(
                                                    "h-10 w-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0",
                                                    getNotificationColor(notification.type)
                                                )}>
                                                    {getNotificationIcon(notification.type)}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className={cn(
                                                                    "text-sm font-semibold",
                                                                    !notification.read && "text-foreground"
                                                                )}>
                                                                    {notification.title}
                                                                </h4>
                                                                {!notification.read && (
                                                                    <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-muted-foreground mb-2">
                                                                {notification.description}
                                                            </p>
                                                            <span className="text-xs text-muted-foreground">
                                                                {notification.time}
                                                            </span>
                                                        </div>

                                                        {/* User Avatar (if applicable) */}
                                                        {notification.user && (
                                                            <Avatar className="h-8 w-8 flex-shrink-0">
                                                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                                                    {notification.user.name.charAt(0).toUpperCase()}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Action Button */}
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {!notification.read && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            aria-label="Mark as read"
                                                        >
                                                            <Check className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8"
                                                        aria-label="Delete notification"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

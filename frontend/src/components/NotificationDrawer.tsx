import { useState, useRef, useEffect } from "react";
import { Bell, X, Maximize2, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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

interface NotificationDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenFullView: () => void;
}

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

export function NotificationDrawer({ open, onOpenChange, onOpenFullView }: NotificationDrawerProps) {
    const [width, setWidth] = useState(360);
    const isResizing = useRef(false);
    const unreadCount = mockNotifications.filter(n => !n.read).length;

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing.current) return;
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 320 && newWidth < 800) {
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

    if (!open) return null;

    return (
        <div 
            style={{ width: `${width}px` }}
            className="fixed inset-y-0 right-0 z-[60] flex shadow-2xl border-l border-border bg-background transition-colors duration-200"
        >
            {/* Resize Handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-[70]"
                onMouseDown={(e) => {
                    e.preventDefault();
                    isResizing.current = true;
                    document.body.style.cursor = "ew-resize";
                    document.body.style.userSelect = "none";
                }}
            />

            <div className="flex flex-col w-full h-full relative">

                {/* ── Header ── */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        <h2 className="font-semibold text-sm">Notifications</h2>
                        {unreadCount > 0 && (
                            <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-primary/10 text-primary">
                                {unreadCount > 9 ? "9+" : unreadCount}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onOpenFullView}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Open full notification view"
                        >
                            <Maximize2 className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label="Close notifications"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {/* Quick Actions */}
                    <div className="px-4 py-2 border-b border-border flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-xs rounded-lg h-7">
                            <Check className="h-3 w-3 mr-1.5" />
                            Mark all read
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs rounded-lg h-7 text-red-500 hover:text-red-600">
                            <Trash2 className="h-3 w-3 mr-1.5" />
                            Clear all
                        </Button>
                    </div>

                    {/* Notifications List */}
                    <div className="flex-1 overflow-y-auto">
                        {mockNotifications.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                                <Bell className="h-12 w-12 opacity-20 mb-3" />
                                <p className="text-sm">No notifications</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {mockNotifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={cn(
                                            "px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer",
                                            !notification.read && "bg-primary/5"
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className={cn(
                                                "h-8 w-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0",
                                                getNotificationColor(notification.type)
                                            )}>
                                                {getNotificationIcon(notification.type)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className={cn(
                                                                "text-xs font-semibold",
                                                                !notification.read && "text-foreground"
                                                            )}>
                                                                {notification.title}
                                                            </h4>
                                                            {!notification.read && (
                                                                <div className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                                                            {notification.description}
                                                        </p>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {notification.time}
                                                        </span>
                                                    </div>

                                                    {/* User Avatar (if applicable) */}
                                                    {notification.user && (
                                                        <Avatar className="h-6 w-6 flex-shrink-0">
                                                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                                                {notification.user.name.charAt(0).toUpperCase()}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

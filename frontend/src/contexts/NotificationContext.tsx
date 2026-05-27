import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";
import { useAppContext } from "./AppContext";
import { useAuth } from "./AuthContext";

export interface Notification {
  id: string;
  org_id: string | null;
  space_id: string | null;
  recipient_id: string;
  sender_id: string | null;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: {
    recipient_ids?: string[];
    task_title?: string;
    sender_name?: string;
    comment_snippet?: string;
    message_snippet?: string;
    channel_name?: string | null;
    channel_type?: string;
    page_title?: string;
    space_name?: string;
    workspace_name?: string;
    role?: string;
    action?: string;
    status?: string;
  };
  read_at: string | null;
  created_at: string;
  sender_name?: string | null;
  sender_email?: string | null;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();
  const { activeOrg, activeSpace } = useAppContext();
  
  // Notifications are now scoped by org/space — no workspace_id needed
  const orgId = activeOrg?.id || null;

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get all unread count
      const countRes = await api.get("/v1/notifications/unread-count", {
        params: orgId ? { orgId } : undefined,
      });
      setUnreadCount(countRes.data.data?.count ?? 0);

      // Get notifications
      const listRes = await api.get("/v1/notifications", {
        params: {
          limit: 50,
          orgId: orgId || undefined,
        },
      });
      setNotifications(listRes.data.data || []);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, orgId]);

  // Setup live socket listener for real-time notifications
  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    if (!socket) {
      // Retry in 1 second if socket isn't connected yet
      const timer = setTimeout(() => {
        const retrySocket = getSocket();
        if (retrySocket) setupSocketListener(retrySocket);
      }, 1000);
      return () => clearTimeout(timer);
    }

    setupSocketListener(socket);

    function setupSocketListener(s: any) {
      s.on("new_notification", (notification: Notification) => {
        // If it belongs to our active org, prepend in the UI list
        if (!orgId || notification.org_id === orgId) {
          setNotifications((prev) => [notification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }

        // Show elegant custom toast utilizing sonner
        const title = getNotificationTitle(notification);
        const snippet = getNotificationSnippet(notification);
        
        toast(title, {
          description: snippet,
        });
      });
    }

    return () => {
      const activeSock = getSocket();
      activeSock?.off("new_notification");
    };
  }, [user, orgId]);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/v1/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post("/v1/notifications/read-all", { orgId });
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const clearAll = async () => {
    try {
      await api.delete("/v1/notifications/clear-all", { params: { orgId } });
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to clear notifications:", err);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};

// Helper: Format readable action titles
function getNotificationTitle(n: Notification): string {
  const actor = n.payload.sender_name || "Someone";
  switch (n.event_type) {
    case "task_assigned":
      return `📌 Task Assigned`;
    case "someone_messaged":
      return `💬 New Message from ${actor}`;
    case "motion_shared":
      return `📄 Motion Shared`;
    case "task_status_changed":
      return `🔄 Task Status Updated`;
    case "membership_updates":
      return `👥 Membership Update`;
    case "mention_in_comment":
      return `💬 Mentioned in Comment`;
    default:
      return `🔔 New Notification`;
  }
}

// Helper: Format description snippets
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

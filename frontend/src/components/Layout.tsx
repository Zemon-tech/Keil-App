import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { AiAssistant } from "./AiAssistant";
import { ChatDrawer } from "./chat/ChatDrawer";
import { ChatDialog } from "./ChatDialog";
import { NotificationDialog } from "@/components/NotificationDialog";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { MeetingDialog } from "./MeetingDialog";
import { ChatSocketManager } from "./chat/ChatSocketManager";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { GlobalSearchDialog } from "./GlobalSearchDialog";
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams, Outlet } from "react-router-dom";
import { useChatStore } from "@/store/useChatStore";
import { useMeetingStore } from "@/store/useMeetingStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Toaster } from "@/components/ui/sonner";
import { useTaskOverdueAutoRefresh } from "@/hooks/useTaskOverdueAutoRefresh";
import { useMotionStore } from "@/store/useMotionStore";
import { useCachedPageById, useCreateMotionPage } from "@/hooks/api/useMotionPages";
import { UpdatesAnalyticsDrawer } from "./motion/UpdatesAnalyticsDrawer";
import { CreateTaskDialog } from "./tasks/CreateTaskDialog";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";

type LayoutProps = {
  children?: ReactNode;
  className?: string;
  sidebar?: ReactNode;
};

export function Layout({ children, className, sidebar }: LayoutProps) {
  const { theme, setTheme } = useTheme();
  const { activeOrgId, activeSpaceId } = useAppContext();
  const createPage = useCreateMotionPage(activeOrgId, activeSpaceId);

  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { pageId } = useParams<{ pageId: string }>();
  const { isChatOpen, isChatDialogOpen, closeChatDialog } = useChatStore();

  const { setDrawerOpen } = useMotionStore();
  const page = useCachedPageById(pageId);
  const pageTitle = page?.title ?? "Untitled";

  // Auto-close Updates & Analytics drawer if path changes away from motion page details
  useEffect(() => {
    if (!location.pathname.startsWith("/motion/") || !pageId) {
      setDrawerOpen(false);
    }
  }, [location.pathname, pageId, setDrawerOpen]);

  // Activate automatic task overdue refresh logic
  useTaskOverdueAutoRefresh();

  useEffect(() => {
    const { openSettings } = useSettingsStore.getState();
    const { openDialog: openMeeting } = useMeetingStore.getState();

    const down = (e: KeyboardEvent) => {
      // Skip if focus is inside an input / textarea / contenteditable
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

      const mod = e.metaKey || e.ctrlKey;

      // ⌘K — command palette (allow even in inputs so users can always reach it)
      if (mod && e.key === "k") {
        e.preventDefault();
        setIsCommandOpen((open) => !open);
        return;
      }

      // All remaining shortcuts are blocked inside inputs
      if (isEditable) return;

      // ⌘, — Settings
      if (mod && e.key === ",") {
        e.preventDefault();
        openSettings("account");
        return;
      }

      // ⌘B — Toggle sidebar  (handled by SidebarProvider natively via data-shortcut, but we also support it)
      // (skip — sidebar already handles its own toggle)

      // ⌘G — Go to Dashboard
      if (mod && e.key === "g") {
        e.preventDefault();
        navigate("/");
        return;
      }

      // ⌘M — Open / restore Meeting Studio
      if (mod && e.key === "m") {
        e.preventDefault();
        const { isMinimized, restoreDialog } = useMeetingStore.getState();
        if (isMinimized) {
          restoreDialog();
        } else {
          openMeeting();
        }
        return;
      }

      // ⌘J — Toggle Chat
      if (mod && e.key === "j") {
        e.preventDefault();
        const { isChatOpen, isChatDialogOpen, openChat, closeChat, openChatDialog, closeChatDialog } = useChatStore.getState();
        const defaultView = localStorage.getItem("default_chat_view") || "sidebar";
        if (defaultView === "dialog") {
          isChatDialogOpen ? closeChatDialog() : openChatDialog();
        } else {
          isChatOpen ? closeChat() : openChat();
        }
        return;
      }

      // ⌘L — Toggle Notifications drawer
      if (mod && !e.shiftKey && e.key === "l") {
        e.preventDefault();
        setNotificationDrawerOpen((open) => !open);
        return;
      }

      // ⌘Q — Go to Tasks
      if (mod && e.key === "q") {
        e.preventDefault();
        navigate("/tasks");
        return;
      }

      // ⌘/ — Open Shortcuts settings page
      if (mod && e.key === "/") {
        e.preventDefault();
        const { openSettings } = useSettingsStore.getState();
        openSettings("shortcuts");
        return;
      }

      // ⌘⇧X — Open task/event creation dialog
      if (mod && e.shiftKey && e.key === "X") {
        e.preventDefault();
        setCreateTaskOpen(true);
        return;
      }

      // ⌘⇧C — Open Chat full dialog (modal)
      if (mod && e.shiftKey && e.key === "C") {
        e.preventDefault();
        const { openChatDialog } = useChatStore.getState();
        openChatDialog();
        return;
      }

      // ⌘P — Go to Motion (Pages)
      if (mod && e.key === "p") {
        e.preventDefault();
        navigate("/motion");
        return;
      }

      // ⌘I — Go to Inbox
      if (mod && e.key === "i") {
        e.preventDefault();
        navigate("/inbox");
        return;
      }

      // ⌘D — Toggle theme
      if (mod && e.key === "d") {
        e.preventDefault();
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        toast.success(`Switched theme to ${nextTheme}`);
        return;
      }

      // ⌘⌥N — Create a new Note page
      if (mod && e.altKey && e.key === "n") {
        e.preventDefault();
        toast.promise(
          createPage.mutateAsync({}).then((newPage) => {
            navigate(`/motion/${newPage.id}`);
            return newPage;
          }),
          {
            loading: "Creating new Note page...",
            success: "New Note page created",
            error: "Failed to create Note page",
          }
        );
        return;
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [navigate, theme, setTheme, createPage]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <div className="flex-1 h-full min-w-0 flex flex-col relative transition-all duration-300 ease-in-out">
        <SidebarProvider>
          {sidebar || (
            <AppSidebar
              notificationDrawerOpen={notificationDrawerOpen}
              notificationDialogOpen={notificationDialogOpen}
              onNotificationDrawerOpenChange={setNotificationDrawerOpen}
            />
          )}
          <SidebarInset className="bg-background">
            {/* Global Search / Command Palette */}
            <GlobalSearchDialog
              open={isCommandOpen}
              onOpenChange={setIsCommandOpen}
            />
            <main
              className={cn(
                "flex-1 min-w-0 transition-all duration-300",
                (isChatOpen || notificationDrawerOpen) && "pr-[400px]",
                className
              )}
            >
              {children || <Outlet />}
            </main>
          </SidebarInset>

          {/* AI Assistant - Available on all pages except dashboard and motion */}
          {location.pathname !== "/" &&
            location.pathname !== "/dashboard" &&
            location.pathname !== "/motion" ? (
            <AiAssistant />
          ) : null}

          {/* Global Chat Drawer */}
          <ChatDrawer />

          {/* Global Notification Drawer */}
          <NotificationDrawer
            open={notificationDrawerOpen}
            onOpenChange={setNotificationDrawerOpen}
            onOpenFullView={() => {
              setNotificationDrawerOpen(false);
              setNotificationDialogOpen(true);
            }}
          />

          {/* Global Chat Dialog */}
          <ChatDialog
            open={isChatDialogOpen}
            onOpenChange={(open) => !open && closeChatDialog()}
          />

          <NotificationDialog
            open={notificationDialogOpen}
            onOpenChange={setNotificationDialogOpen}
          />

          {/* Global Meeting Studio */}
          <MeetingDialog />

          {/* Global Create Task Dialog */}
          <CreateTaskDialog
            open={createTaskOpen}
            onOpenChange={setCreateTaskOpen}
          />

          {/* Global Socket Manager for Chat */}
          <ChatSocketManager />
          <Toaster />
        </SidebarProvider>
      </div>

      {/* Persistent Updates & Analytics Drawer */}
      <UpdatesAnalyticsDrawer pageId={pageId ?? null} pageTitle={pageTitle} />
    </div>
  );
}

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
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  MessageSquare,
  Activity,
  User,
  Settings,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useChatStore } from "@/store/useChatStore";
import { useMeetingStore } from "@/store/useMeetingStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Toaster } from "@/components/ui/sonner";
import { useTaskOverdueAutoRefresh } from "@/hooks/useTaskOverdueAutoRefresh";
import { StitchUpdateDialog } from "./StitchUpdateDialog";
import { useMotionStore } from "@/store/useMotionStore";
import { UpdatesAnalyticsDrawer } from "./motion/UpdatesAnalyticsDrawer";

type LayoutProps = {
  children: ReactNode;
  className?: string;
  sidebar?: ReactNode;
};

export function Layout({ children, className, sidebar }: LayoutProps) {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { pageId } = useParams<{ pageId: string }>();
  const { openChat, openChatDialog, isChatOpen, isChatDialogOpen, closeChatDialog } = useChatStore();

  const { setDrawerOpen, getPageById } = useMotionStore();
  const page = pageId ? getPageById(pageId) : null;
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

      // ⌘T — Go to Tasks
      if (mod && e.key === "t") {
        e.preventDefault();
        navigate("/tasks");
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

      // ⌘⇧N — Toggle Notifications drawer
      if (mod && e.shiftKey && e.key === "N") {
        e.preventDefault();
        setNotificationDrawerOpen((open) => !open);
        return;
      }

      // ⌘P — Go to Motion (Pages)
      if (mod && e.key === "p") {
        e.preventDefault();
        navigate("/motion");
        return;
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [navigate]);

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
        {/* Command Palette */}
        <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>
                <LayoutDashboard className="mr-2 size-4 text-slate-400" />
                <span>Go to Dashboard</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setIsCommandOpen(false);
                  setNotificationDrawerOpen(false);
                  const defaultView = localStorage.getItem("default_chat_view") || "sidebar";
                  if (defaultView === "dialog") {
                    openChatDialog();
                  } else {
                    openChat();
                  }
                }}
              >
                <MessageSquare className="mr-2 size-4 text-slate-400" />
                <span>Open Chat</span>
              </CommandItem>
              <CommandItem>
                <Activity className="mr-2 size-4 text-slate-400" />
                <span>View Analytics</span>
              </CommandItem>
              <CommandItem>
                <User className="mr-2 size-4 text-slate-400" />
                <span>Profile Settings</span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Settings">
              <CommandItem>
                <Settings className="mr-2 size-4 text-slate-400" />
                <span>Settings</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
        <main
          className={cn(
            "flex-1 transition-all duration-300",
            (isChatOpen || notificationDrawerOpen) && "pr-[400px]",
            className
          )}
        >
          {children}
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

      {/* Global Socket Manager for Chat */}
      <ChatSocketManager />
      <Toaster />
      {/* Stitch AI feature announcement — shows once per session */}
      <StitchUpdateDialog />
        </SidebarProvider>
      </div>

      {/* Persistent Updates & Analytics Drawer */}
      <UpdatesAnalyticsDrawer pageId={pageId ?? null} pageTitle={pageTitle} />
    </div>
  );
}

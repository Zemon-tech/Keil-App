import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { AiAssistant } from "./AiAssistant";
import { ChatDrawer } from "./chat/ChatDrawer";
import { ChatDialog } from "./ChatDialog";
import { ChatSocketManager } from "./chat/ChatSocketManager";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
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
import { useLocation } from "react-router-dom";
import { useChatStore } from "@/store/useChatStore";
import { Toaster } from "@/components/ui/sonner";
import { useTaskOverdueAutoRefresh } from "@/hooks/useTaskOverdueAutoRefresh";

type LayoutProps = {
  children: ReactNode;
  className?: string;
  sidebar?: ReactNode;
};

export function Layout({ children, className, sidebar }: LayoutProps) {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const location = useLocation();
  const openChat = useChatStore((state: any) => state.openChat);
  const { isChatDialogOpen, closeChatDialog } = useChatStore();

  // Activate automatic task overdue refresh logic
  useTaskOverdueAutoRefresh();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandOpen((open: boolean) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <SidebarProvider>
      {sidebar || <AppSidebar />}
      <SidebarInset className="bg-background">
        {/* Command Palette */}
        <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>
                <LayoutDashboard className="mr-2 h-4 w-4 text-slate-400" />
                <span>Go to Dashboard</span>
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  setIsCommandOpen(false);
                  openChat();
                }}
              >
                <MessageSquare className="mr-2 h-4 w-4 text-slate-400" />
                <span>Open Chat</span>
              </CommandItem>
              <CommandItem>
                <Activity className="mr-2 h-4 w-4 text-slate-400" />
                <span>View Analytics</span>
              </CommandItem>
              <CommandItem>
                <User className="mr-2 h-4 w-4 text-slate-400" />
                <span>Profile Settings</span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Settings">
              <CommandItem>
                <Settings className="mr-2 h-4 w-4 text-slate-400" />
                <span>Settings</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
        <main className={cn("flex-1", className)}>{children}</main>
      </SidebarInset>

      {/* AI Assistant - Available on all pages except dashboard and motion */}
      {location.pathname !== "/" &&
      location.pathname !== "/dashboard" &&
      location.pathname !== "/motion" ? (
        <AiAssistant />
      ) : null}

      {/* Global Chat Drawer */}
      <ChatDrawer />

      {/* Global Chat Dialog */}
      <ChatDialog
        open={isChatDialogOpen}
        onOpenChange={(open) => !open && closeChatDialog()}
      />

      {/* Global Socket Manager for Chat */}
      <ChatSocketManager />
      <Toaster />
    </SidebarProvider>
  );
}

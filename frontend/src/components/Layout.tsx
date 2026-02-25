import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "./AppSidebar";
import { AiAssistant } from "./AiAssistant";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Search, LayoutDashboard, Activity, User, Settings } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem
} from "@/components/ui/command";
import { useState, useEffect } from "react";



type LayoutProps = {
  children: ReactNode;
  className?: string;
};

export function Layout({ children, className }: LayoutProps) {
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-14 shrink-0 items-center justify-between px-6 transition-all bg-background border-b border-border/60">
          <div className="flex items-center gap-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/" className="text-xs font-medium text-muted-foreground hover:text-foreground">KeilApp</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block opacity-50" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-xs font-bold text-foreground">Dashboard</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="relative group cursor-pointer"
              onClick={() => setIsCommandOpen(true)}
            >
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card/80 border border-border/60 shadow-sm hover:bg-card hover:border-border transition-all duration-200">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-medium text-muted-foreground pr-8">Search...</span>
                <kbd className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none h-4 px-1.5 flex items-center gap-1 rounded border border-border/60 bg-muted font-mono text-[9px] font-bold text-muted-foreground">
                  ⌘K
                </kbd>
              </div>
            </div>
          </div>
        </header>

        {/* Command Palette */}
        <CommandDialog open={isCommandOpen} onOpenChange={setIsCommandOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Suggestions">
              <CommandItem>
                <LayoutDashboard className="mr-2 h-4 w-4 text-slate-400" />
                <span>Go to Overview</span>
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
        <main className={cn("flex-1", className)}>
          {children}
        </main>
      </SidebarInset>

      {/* AI Assistant - Available on all pages */}
      <AiAssistant />
    </SidebarProvider>
  );
}

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MeetingsSidebar } from "@/components/meetings/MeetingsSidebar";
import { MeetingsHome } from "@/components/meetings/MeetingsHome";

/**
 * Meetings page layout with collapsible sidebar and content area.
 * Mirrors the MotionHome pattern with sidebar toggle.
 */
export function MeetingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-dvh w-full bg-background text-foreground overflow-hidden relative">
      {/* Meetings sidebar */}
      <div
        className={cn(
          "h-full transition-all duration-300 ease-in-out overflow-hidden border-r border-border",
          sidebarOpen ? "w-72 opacity-100" : "w-0 opacity-0 border-none"
        )}
      >
        <MeetingsSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        <header className="h-12 flex items-center justify-between px-2 z-40 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground/50 hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="size-5" />
          </Button>
        </header>

        <MeetingsHome />
      </div>
    </div>
  );
}

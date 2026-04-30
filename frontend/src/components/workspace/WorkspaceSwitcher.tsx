
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChevronsUpDown,
  Check,
  User,
  Users,
  MoreHorizontal
} from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";

export function WorkspaceSwitcher() {
  const { workspaces, workspaceId, setActiveWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const activeWorkspace = workspaces.find((w) => w.id === workspaceId) || workspaces[0];
  const userEmail = user?.email || "";

  if (!activeWorkspace) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center justify-between rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground py-0.5 px-1 transition-all duration-200 group">
          <div className="flex items-center gap-1.5 overflow-hidden">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
              {activeWorkspace.name.charAt(0).toUpperCase()}
            </div>
            {!isCollapsed && (
              <span className="truncate text-[11px] font-medium tracking-tight text-foreground/70 group-hover:text-foreground">
                {activeWorkspace.name}
              </span>
            )}
          </div>
          {!isCollapsed && (
            <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-50 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[280px] rounded-xl p-2 shadow-xl border-border/50 bg-card/95 backdrop-blur-sm"
        sideOffset={12}
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs text-muted-foreground truncate max-w-[220px]">
            {userEmail}
          </span>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
             <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
        
        <DropdownMenuSeparator className="my-1" />
        
        <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Recent
        </DropdownMenuLabel>
        
        {/* Placeholder for recent workspaces */}
        <div className="mb-2"></div>

        <DropdownMenuSeparator className="my-1" />
        
        <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Workspaces
        </DropdownMenuLabel>
        
        <div className="flex flex-col gap-0.5">
          {workspaces.map((ws, index) => {
            const isPersonal = index === 0;
            const isActive = workspaceId === ws.id;
            
            return (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => setActiveWorkspace(ws.id)}
                className={`flex items-center justify-between cursor-pointer rounded-lg px-2 py-2 text-sm transition-colors ${
                  isActive ? "bg-primary/5 text-primary" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {isPersonal ? <User className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  </div>
                  <span className={`truncate ${isActive ? 'font-medium' : ''}`}>
                    {ws.name}
                  </span>
                </div>
                {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

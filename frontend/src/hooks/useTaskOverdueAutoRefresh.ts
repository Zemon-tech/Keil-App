import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { taskKeys, orgTaskKeys } from "@/hooks/api/useTasks";
import { personalTaskKeys } from "@/hooks/api/usePersonalTasks";
import { useAppContext } from "@/contexts/AppContext";

/**
 * Hook to automatically refresh task lists when tasks become overdue.
 * 
 * It listens for 'task_overdue_moved' from the server and also
 * runs a local timer to catch tasks the moment they expire.
 */
export function useTaskOverdueAutoRefresh() {
  const queryClient = useQueryClient();
  const { activeOrgId, activeSpaceId, mode } = useAppContext();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleOverdueMoved = (data: { 
      id: string; 
      status: string; 
      org_id?: string; 
      space_id?: string;
      owner_user_id?: string;
      is_personal?: boolean;
    }) => {
      // Invalidate the appropriate queries
      if (data.is_personal) {
        queryClient.invalidateQueries({ queryKey: personalTaskKeys.all });
      } else {
        queryClient.invalidateQueries({ queryKey: orgTaskKeys.all });
        // Also invalidate the old 'tasks' key if it's still being used
        queryClient.invalidateQueries({ queryKey: taskKeys.all });
      }
    };

    socket.on("task_overdue_moved", handleOverdueMoved);
    return () => {
      socket.off("task_overdue_moved", handleOverdueMoved);
    };
  }, [queryClient]);

  // Local timer to ensure immediate UI update even if socket is delayed
  useEffect(() => {
    const checkOverdueLocally = () => {
      // We don't want to scan the entire cache deeply, but we can check
      // if any visible tasks (in the current active view) are overdue.
      
      // For simplicity, we just trigger an invalidation of the active task lists
      // every minute. This is safe and ensures the UI eventually catches up.
      // But to be more "reactive", we could do it more often.
      
      if (mode === "organisation" && activeOrgId && activeSpaceId) {
        queryClient.invalidateQueries({ 
          queryKey: orgTaskKeys.lists(activeOrgId, activeSpaceId) 
        });
      } else if (mode === "personal") {
        queryClient.invalidateQueries({ 
          queryKey: personalTaskKeys.lists() 
        });
      }
    };

    // Check every 30 seconds
    const interval = setInterval(checkOverdueLocally, 30000);
    return () => clearInterval(interval);
  }, [queryClient, activeOrgId, activeSpaceId, mode]);
}

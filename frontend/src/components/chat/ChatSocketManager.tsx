import { useChatSocketListeners } from "@/hooks/api/useChat";
import { useAppContext } from "@/contexts/AppContext";
import { useChatStore } from "@/store/useChatStore";

export function ChatSocketManager() {
  const { mode, activeOrgId, activeSpaceId } = useAppContext();
  const { activeChannelId } = useChatStore();

  // If not in organisation mode, or missing org/space, don't mount listeners
  const orgId = mode === "organisation" ? activeOrgId : null;
  const spaceId = mode === "organisation" ? activeSpaceId : null;

  useChatSocketListeners(activeChannelId, orgId, spaceId);

  return null;
}

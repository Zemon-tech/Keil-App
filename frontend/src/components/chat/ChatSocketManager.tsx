import { useChatSocketListeners } from "@/hooks/api/useChat";
import { useAppContext } from "@/contexts/AppContext";
import { useChatStore } from "@/store/useChatStore";

export function ChatSocketManager() {
  const { activeOrgId, activeSpaceId } = useAppContext();
  const { activeChannelId } = useChatStore();

  // Mount listeners if we have activeOrgId and activeSpaceId
  const orgId = activeOrgId;
  const spaceId = activeSpaceId;

  useChatSocketListeners(activeChannelId, orgId, spaceId);

  return null;
}

// src/hooks/api/useAdk.ts
//
// Hook for talking to the KeilHQ ADK agent.
// The agent is multi-turn: pass sessionId back on every follow-up message
// and the backend rehydrates the conversation from its session store.

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdkChatRequest {
  message: string;
  /** Pass the sessionId from the previous response to continue a conversation. */
  sessionId?: string;
}

export interface AdkChatResponse {
  /** The agent's text reply. */
  content: string;
  /**
   * Persist this and send it back as `sessionId` in the next request
   * so the agent remembers the conversation.
   */
  sessionId: string;
}

interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
}

// ─── API call ─────────────────────────────────────────────────────────────────

async function sendAdkMessage(payload: AdkChatRequest): Promise<AdkChatResponse> {
  const { data } = await api.post<ApiResponse<AdkChatResponse>>(
    "v1/adk/chat",
    payload
  );
  return data.data;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useAdkChat
 *
 * Wraps the ADK /v1/adk/chat endpoint.
 * Multi-turn example:
 *
 *   const { mutateAsync, isPending } = useAdkChat();
 *   const [sessionId, setSessionId] = useState<string | undefined>();
 *
 *   const handleSend = async (message: string) => {
 *     const reply = await mutateAsync({ message, sessionId });
 *     setSessionId(reply.sessionId);  // ← persist for next turn
 *   };
 */
export function useAdkChat() {
  return useMutation<AdkChatResponse, Error, AdkChatRequest>({
    mutationFn: sendAdkMessage,
    onError: (error) => {
      console.error("[useAdkChat] error:", error);
      toast.error("KeilHQ AI is unavailable. Please try again.");
    },
  });
}

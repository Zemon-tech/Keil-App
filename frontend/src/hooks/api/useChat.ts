// src/hooks/api/useChat.ts
//
// All hooks that need org/space context accept orgId and spaceId as explicit
// parameters. The caller (component) reads them from useAppContext() and passes
// them in. This keeps the hook layer free of context dependencies and makes
// the enabled/disabled logic explicit.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useChatStore } from "@/store/useChatStore";

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMember {
  id: string;
  name: string;
  email?: string;
  role?: "admin" | "member";
  avatar_url?: string | null;
}

export interface Channel {
  id: string;
  type: "direct" | "group";
  name: string | null;
  unread_count: number;
  last_message_at: string | null;
  members: ChatMember[];
}

export interface ChatAttachment {
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl?: string;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender: ChatMember;
  content: string;
  created_at: string;
  reply_to?: { messageId: string; senderName: string; text: string } | null;
  attachments?: ChatAttachment[] | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — QUERY KEYS
// Keys now include orgId + spaceId so switching spaces auto-invalidates cache.
// ─────────────────────────────────────────────────────────────────────────────

export const chatKeys = {
  channels: (orgId: string | null, spaceId: string | null) =>
    ["chat", "channels", orgId, spaceId] as const,
  messages: (channelId: string) => ["chat", "messages", channelId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// PART 3A — useChatChannels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all channels the current user is a member of inside a space.
 * Calls: GET /api/v1/orgs/:orgId/spaces/:spaceId/chat/channels
 * Disabled (returns empty) when orgId or spaceId is null.
 */
export function useChatChannels(orgId: string | null, spaceId: string | null) {
  return useQuery<Channel[]>({
    queryKey: chatKeys.channels(orgId, spaceId),
    queryFn: async () => {
      const res = await api.get<{ data: { channels: Channel[] } }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/chat/channels`
      );
      return res.data.data.channels ?? [];
    },
    enabled: !!orgId && !!spaceId,
    retry: (failureCount: number, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 1;
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3B — useChatMessages
// Requires orgId + spaceId because the backend validates space membership.
// ─────────────────────────────────────────────────────────────────────────────

export function useChatMessages(
  channelId: string | null,
  orgId: string | null,
  spaceId: string | null,
) {
  return useQuery<ChatMessage[]>({
    queryKey: chatKeys.messages(channelId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: { messages: ChatMessage[] } }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/chat/channels/${channelId}/messages`,
        { params: { limit: 50 } }
      );
      return res.data.data.messages ?? [];
    },
    enabled: !!channelId && !!orgId && !!spaceId,
    staleTime: 0, // refetch on channel open; socket keeps it live while viewing
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3C — useReadChannel
// ─────────────────────────────────────────────────────────────────────────────

export function useReadChannel(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.post(
        `v1/orgs/${orgId}/spaces/${spaceId}/chat/channels/${channelId}/read`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(orgId, spaceId),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3D — useSendMessage
// Socket-only — no org/space context needed.
// ─────────────────────────────────────────────────────────────────────────────

export function useSendMessage() {
  return useCallback((
    channelId: string, 
    content: string, 
    replyTo?: { messageId: string; senderName: string; text: string } | null,
    attachments?: ChatAttachment[]
  ) => {
    const socket = getSocket();
    socket?.emit("send_message", { channel_id: channelId, content, reply_to: replyTo, attachments });
  }, []); // stable ref — socket is a module-level singleton
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3E — useOpenDM
// ─────────────────────────────────────────────────────────────────────────────

export function useOpenDM(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await api.post<{ data: { channel: Channel } }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/chat/channels/direct`,
        { target_user_id: targetUserId }
      );
      return res.data.data.channel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(orgId, spaceId),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3F — useCreateGroup
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateGroup(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name: string; member_ids: string[] }) => {
      const res = await api.post<{ data: { channel: Channel } }>(
        `v1/orgs/${orgId}/spaces/${spaceId}/chat/channels/group`,
        payload
      );
      return res.data.data.channel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(orgId, spaceId),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3G — useAddChannelMembers & useRemoveChannelMember
// ─────────────────────────────────────────────────────────────────────────────

export function useAddChannelMembers(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { channelId: string; member_ids: string[] }) => {
      await api.post(
        `v1/orgs/${orgId}/spaces/${spaceId}/chat/channels/${payload.channelId}/members`,
        { member_ids: payload.member_ids }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(orgId, spaceId),
      });
    },
  });
}

export function useRemoveChannelMember(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { channelId: string; userId: string }) => {
      await api.delete(
        `v1/orgs/${orgId}/spaces/${spaceId}/chat/channels/${payload.channelId}/members/${payload.userId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(orgId, spaceId),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3H — useDeleteChannel
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteChannel(orgId: string | null, spaceId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.delete(
        `v1/orgs/${orgId}/spaces/${spaceId}/chat/channels/${channelId}`
      );
    },
    onSuccess: (_, channelId) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(orgId, spaceId),
      });
      // Clear active channel locally if it was the deleted channel
      if (useChatStore.getState().activeChannelId === channelId) {
        useChatStore.getState().setActiveChannel(null);
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 4 — useChatSocketListeners
//
// ⚠️ Mount this hook ONCE — inside <ChatDialog> only.
//
// orgId + spaceId are passed in so the cache key matches exactly what
// useChatChannels uses. Switching spaces changes the key, which means
// the old space's channel list is no longer updated by these listeners.
// ─────────────────────────────────────────────────────────────────────────────

export function useChatSocketListeners(
  activeChannelId: string | null,
  orgId: string | null,
  spaceId: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // ── EVENT 1: New message ────────────────────────────────────────────────
    const handleReceiveMessage = (message: ChatMessage) => {
      useChatStore.getState().removeTypingUser(message.channel_id, message.sender.id);
      const isViewingThisChannel = message.channel_id === activeChannelId;

      // Only inject into cache if the user is actively viewing this channel.
      // For background channels, invalidate so a full fetch runs on open.
      if (isViewingThisChannel) {
        queryClient.setQueryData<ChatMessage[]>(
          chatKeys.messages(message.channel_id),
          (prev = []) => {
            if (prev.some((m) => m.id === message.id)) {
              return prev;
            }
            return [...prev, message];
          }
        );
      } else {
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(message.channel_id),
        });
      }

      if (orgId && spaceId) {
        queryClient.setQueryData<Channel[]>(
          chatKeys.channels(orgId, spaceId),
          (prev: Channel[] = []) =>
            prev
              .map((ch: Channel) =>
                ch.id === message.channel_id
                  ? {
                      ...ch,
                      unread_count: isViewingThisChannel ? ch.unread_count : ch.unread_count + 1,
                      last_message_at: message.created_at,
                    }
                  : ch
              )
              .sort((a, b) =>
                (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "")
              )
        );
      }
    };

    // ── EVENT 2: New channel added ──────────────────────────────────────────
    const handleChannelAdded = (channel: Channel) => {
      // Auto-join the new channel's socket room
      socket.emit("join_channel", { channel_id: channel.id });
      
      if (orgId && spaceId) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.channels(orgId, spaceId),
        });
      }
    };

    // ── EVENT 3: Socket reconnected ─────────────────────────────────────────
    const handleConnect = () => {
      if (activeChannelId) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(activeChannelId),
        });
      }
      if (orgId && spaceId) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.channels(orgId, spaceId),
        });
      }
    };

    // ── EVENT 4: Channel updated ────────────────────────────────────────────
    const handleChannelUpdated = (_data: { channel_id: string }) => {
      if (orgId && spaceId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.channels(orgId, spaceId) });
      }
    };

    // ── EVENT 5: Removed from channel ──────────────────────────────────────
    const handleChannelRemoved = (data: { channel_id: string }) => {
      if (orgId && spaceId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.channels(orgId, spaceId) });
      }
      if (activeChannelId === data.channel_id) {
        useChatStore.getState().setActiveChannel(null);
      }
    };

    // ── EVENT 6 & 7: Typing indicators ─────────────────────────────────────
    const handleUserTyping = (data: { channel_id: string; user_id: string; name: string }) => {
      useChatStore.getState().addTypingUser(data.channel_id, data.user_id, data.name);
    };

    const handleUserStoppedTyping = (data: { channel_id: string; user_id: string }) => {
      useChatStore.getState().removeTypingUser(data.channel_id, data.user_id);
    };

    const handleError = (error: { message: string; code?: string }) => {
      toast.error(error.message || "A socket error occurred");
    };

    socket.on("receive_message", handleReceiveMessage);
    socket.on("channel_added", handleChannelAdded);
    socket.on("connect", handleConnect);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);
    socket.on("channel_updated", handleChannelUpdated);
    socket.on("channel_removed", handleChannelRemoved);
    socket.on("error", handleError);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("channel_added", handleChannelAdded);
      socket.off("connect", handleConnect);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
      socket.off("channel_updated", handleChannelUpdated);
      socket.off("channel_removed", handleChannelRemoved);
      socket.off("error", handleError);
    };
  }, [activeChannelId, orgId, spaceId, queryClient]);
}

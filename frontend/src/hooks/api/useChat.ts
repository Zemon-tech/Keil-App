// src/hooks/api/useChat.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useChatStore } from "@/store/useChatStore";

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — TYPES
// These match exactly what the backend API returns.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatMember {
  id: string;
  name: string;
}

export interface Channel {
  id: string;
  type: "direct" | "group"; // "direct" = 1:1 DM, "group" = group chat
  name: string | null;       // null for DMs, has a value for groups
  unread_count: number;      // how many messages this user hasn't read yet
  last_message_at: string | null; // ISO date string, used for sorting
  members: ChatMember[];     // for DMs: the OTHER person. for groups: everyone.
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender: ChatMember;   // who sent it
  content: string;      // the message text
  created_at: string;   // ISO date string
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — QUERY KEYS
// Centralised here so we never mistype a key string anywhere.
// ─────────────────────────────────────────────────────────────────────────────

export const chatKeys = {
  // Key for the channel list: ["chat", "channels", "workspace-uuid"]
  channels: (workspaceId: string) => ["chat", "channels", workspaceId] as const,

  // Key for messages in one channel: ["chat", "messages", "channel-uuid"]
  messages: (channelId: string) => ["chat", "messages", channelId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// PART 3A — useChatChannels
// Fetches all channels the current user is a member of.
// Automatically includes unread_count (computed by backend, no extra call).
// ─────────────────────────────────────────────────────────────────────────────

export function useChatChannels() {
  const { workspaceId } = useWorkspace();

  return useQuery<Channel[]>({
    queryKey: chatKeys.channels(workspaceId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: { channels: Channel[] } }>(
        "v1/chat/channels"
      );
      return res.data.data.channels;
    },
    enabled: !!workspaceId, // don't run until workspaceId is available
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3B — useChatMessages
// Fetches the last 50 messages for a given channel.
// New real-time messages are injected into this same cache by the socket hook.
// ─────────────────────────────────────────────────────────────────────────────

export function useChatMessages(channelId: string | null) {
  return useQuery<ChatMessage[]>({
    queryKey: chatKeys.messages(channelId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ data: { messages: ChatMessage[] } }>(
        `v1/chat/channels/${channelId}/messages`,
        { params: { limit: 50 } }
      );
      return res.data.data.messages;
    },
    enabled: !!channelId,    // only runs when a channel is selected
    staleTime: Infinity,     // ⚠️ IMPORTANT: prevents refetch from wiping socket-injected messages
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3C — useReadChannel
// Tells the backend "I've read this channel". This updates last_read_at
// on the server, and then we refetch the channel list to clear the red dot.
// ─────────────────────────────────────────────────────────────────────────────

export function useReadChannel() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (channelId: string) => {
      await api.post(`v1/chat/channels/${channelId}/read`);
    },
    onSuccess: () => {
      // Refetch channel list so the unread badge disappears immediately
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(workspaceId ?? ""),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3D — useSendMessage
// Sends a message via socket (NOT a REST call).
// The sent message will come back to you via the "receive_message" socket event
// and be injected into the cache by useChatSocketListeners below.
// ─────────────────────────────────────────────────────────────────────────────

export function useSendMessage() {
  // Returns a plain function (not a mutation) since there's nothing to await
  return (channelId: string, content: string) => {
    const socket = getSocket();
    socket?.emit("send_message", { channel_id: channelId, content });
    // That's it. The server broadcasts it back. Your own message arrives
    // via receive_message just like everyone else's.
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3E — useOpenDM
// POST /api/v1/chat/channels/direct
// Creates a new 1:1 chat or returns the existing one if it already exists.
// ─────────────────────────────────────────────────────────────────────────────

export function useOpenDM() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await api.post<{ data: { channel: Channel } }>(
        "v1/chat/channels/direct",
        { target_user_id: targetUserId }
      );
      return res.data.data.channel;
    },
    onSuccess: () => {
      // Refresh channel list to show the new DM
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(workspaceId ?? ""),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3F — useCreateGroup
// POST /api/v1/chat/channels/group
// Only admins and owners can do this (enforced on backend too).
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (payload: { name: string; member_ids: string[] }) => {
      const res = await api.post<{ data: { channel: Channel } }>(
        "v1/chat/channels/group",
        payload
      );
      return res.data.data.channel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(workspaceId ?? ""),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 3G — useAddChannelMembers & useRemoveChannelMember
// ─────────────────────────────────────────────────────────────────────────────

export function useAddChannelMembers() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (payload: { channelId: string; member_ids: string[] }) => {
      await api.post(`v1/chat/channels/${payload.channelId}/members`, {
        member_ids: payload.member_ids,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(workspaceId ?? ""), // refresh members list
      });
    },
  });
}

export function useRemoveChannelMember() {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (payload: { channelId: string; userId: string }) => {
      await api.delete(`v1/chat/channels/${payload.channelId}/members/${payload.userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.channels(workspaceId ?? ""),
      });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PART 4 — useChatSocketListeners
//
// ⚠️ Mount this hook ONCE — inside <ChatDrawer> only. Not in multiple places.
//
// It listens for 3 socket events:
//   1. "receive_message" — a new message arrives
//   2. "channel_added"   — admin created a new channel for you
//   3. "connect"         — socket reconnected after being offline
//
// For each event it updates the TanStack Query cache directly,
// so the UI re-renders without any extra fetch.
// ─────────────────────────────────────────────────────────────────────────────

export function useChatSocketListeners(activeChannelId: string | null) {
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return; // user not logged in yet

    // ── EVENT 1: A new message was sent by someone ──────────────────────────
    const handleReceiveMessage = (message: ChatMessage) => {
      useChatStore.getState().removeTypingUser(message.channel_id, message.sender.id);
      const isViewingThisChannel = message.channel_id === activeChannelId;

      // ALWAYS add the message to the message cache for that channel
      queryClient.setQueryData<ChatMessage[]>(
        chatKeys.messages(message.channel_id),
        (prev = []) => [...prev, message] // append to the end
      );

      // If the user is NOT currently viewing this channel → show a red dot
      if (!isViewingThisChannel && workspaceId) {
        queryClient.setQueryData<Channel[]>(
          chatKeys.channels(workspaceId),
          (prev = []) =>
            prev
              .map((ch) =>
                ch.id === message.channel_id
                  ? {
                      ...ch,
                      unread_count: ch.unread_count + 1,    // bump the badge number
                      last_message_at: message.created_at,  // update the timestamp
                    }
                  : ch // leave all other channels unchanged
              )
              // Re-sort so the most recent conversation is at the top
              .sort((a, b) =>
                (b.last_message_at ?? "").localeCompare(a.last_message_at ?? "")
              )
        );
      }
    };

    // ── EVENT 2: Admin added a new group channel you're a member of ─────────
    const handleChannelAdded = () => {
      if (workspaceId) {
        // Just refetch the list — the new channel will appear automatically
        queryClient.invalidateQueries({
          queryKey: chatKeys.channels(workspaceId),
        });
      }
    };

    // ── EVENT 3: Socket reconnected (after network drop / tunnel loss) ───────
    const handleConnect = () => {
      // Re-fetch the active channel's messages to fill any gap while offline
      if (activeChannelId) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(activeChannelId),
        });
      }
    };

    // ── EVENT 4: Channel details updated (e.g., member joined/left) ─────────
    const handleChannelUpdated = (data: { channel_id: string }) => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.channels(workspaceId) });
      }
    };

    // ── EVENT 5: User removed from channel ─────────────────────────────────
    const handleChannelRemoved = (data: { channel_id: string }) => {
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: chatKeys.channels(workspaceId) });
      }
      if (activeChannelId === data.channel_id) {
        // Kick them out to the channel list
        useChatStore.getState().setActiveChannel(null);
      }
    };

    const handleUserTyping = (data: { channel_id: string, user_id: string, name: string }) => {
      useChatStore.getState().addTypingUser(data.channel_id, data.user_id, data.name);
    };

    const handleUserStoppedTyping = (data: { channel_id: string, user_id: string }) => {
      useChatStore.getState().removeTypingUser(data.channel_id, data.user_id);
    };

    // Register all listeners
    socket.on("receive_message", handleReceiveMessage);
    socket.on("channel_added", handleChannelAdded);
    socket.on("connect", handleConnect);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);
    socket.on("channel_updated", handleChannelUpdated);
    socket.on("channel_removed", handleChannelRemoved);

    // Cleanup when component unmounts or activeChannelId changes
    return () => {
      socket.off("receive_message", handleReceiveMessage);
      socket.off("channel_added", handleChannelAdded);
      socket.off("connect", handleConnect);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
      socket.off("channel_updated", handleChannelUpdated);
      socket.off("channel_removed", handleChannelRemoved);
    };
  }, [activeChannelId, workspaceId, queryClient]);
}

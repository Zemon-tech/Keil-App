# 💬 Dev-B Chat Frontend — Step-by-Step Implementation Guide

> **Branch:** `feature/chat-fe`
> **Your job:** Build the UI. Dev-A builds the backend.
> **Before you start:** Make sure Dev-A's backend is running locally on port 3000.

---

## 🧠 Understand This First (Read Before Any Code)

Think of the chat feature as **3 separate systems working together:**

```
┌─────────────────────────────────────────────────────────────────┐
│  SYSTEM 1 — Zustand Store (useChatStore)                        │
│  Just 2 things: Is drawer open? Which channel is active?        │
│  Like a light switch — on/off + which room you're in.           │
└────────────────────────┬────────────────────────────────────────┘
                         │ reads state
┌────────────────────────▼────────────────────────────────────────┐
│  SYSTEM 2 — REST Hooks (useChat.ts via TanStack Query)          │
│  Fetches the channel list + message history on first load.      │
│  Same pattern as useComments.ts and useTasks.ts you already     │
│  know. Nothing new here.                                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ injects new messages into same cache
┌────────────────────────▼────────────────────────────────────────┐
│  SYSTEM 3 — Socket.io (socket.ts + useChatSocketListeners)      │
│  Receives real-time messages from server.                       │
│  Key rule: DO NOT put messages in useState.                     │
│  Instead: inject them directly into TanStack Query's cache.     │
│  This keeps Systems 2 and 3 in sync automatically.             │
└─────────────────────────────────────────────────────────────────┘
```

**The golden rule of this feature:**
> Socket delivers the message → TanStack Query cache stores it → UI re-renders automatically. No `useState` for messages. Ever.

---

## 📋 Files Overview — What You'll Create vs. What You'll Edit

| Status | File | Purpose in 1 line |
|--------|------|-------------------|
| 🆕 NEW | `src/store/useChatStore.ts` | Controls if the drawer is open + which channel is selected |
| 🆕 NEW | `src/lib/socket.ts` | One single socket connection for the whole app |
| 🆕 NEW | `src/hooks/api/useChat.ts` | All API calls + socket event listeners |
| 🆕 NEW | `src/components/chat/ChatDrawer.tsx` | The slide-out panel container |
| 🆕 NEW | `src/components/chat/ChannelList.tsx` | List of conversations with unread dots |
| 🆕 NEW | `src/components/chat/MessageView.tsx` | Messages + send input for one channel |
| ✏️ EDIT | `src/contexts/AuthContext.tsx` | Add: connect socket on login, disconnect on logout |
| ✏️ EDIT | `src/components/Layout.tsx` | Add: `<ChatDrawer />` so it's available on every page |
| ✏️ EDIT | `src/components/AppSidebar.tsx` | Add: a Chat button that opens the drawer |

---

## 📦 Step 0 — Install Two Packages

```bash
npm install zustand socket.io-client
```

- **zustand** → tiny state manager. No Redux boilerplate. No prop drilling.
- **socket.io-client** → real-time connection to the backend.

Also add this line to `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000
```

---

## Step 1 — Create the Zustand Store

**📄 File to create:** `src/store/useChatStore.ts`

**What this does in plain English:**
This is a tiny global state box. Any component anywhere in the app can read from it or update it — no need to pass props down. It stores exactly two things:
1. `isChatOpen` — is the drawer visible right now?
2. `activeChannelId` — which conversation is open inside the drawer?

```ts
// src/store/useChatStore.ts

import { create } from "zustand";

// --- Define the shape of the store ---
interface ChatStore {
  isChatOpen: boolean;           // true = drawer is visible
  activeChannelId: string | null; // null = showing channel list, otherwise showing messages

  // Actions (functions that update the state)
  openChat: () => void;
  closeChat: () => void;
  setActiveChannel: (channelId: string | null) => void; // pass null to go back to list
}

// --- Create and export the store ---
export const useChatStore = create<ChatStore>((set) => ({
  // Initial values
  isChatOpen: false,
  activeChannelId: null,

  // Calling openChat() → sets isChatOpen to true
  openChat: () => set({ isChatOpen: true }),

  // Calling closeChat() → hides drawer AND resets the active channel
  closeChat: () => set({ isChatOpen: false, activeChannelId: null }),

  // Calling setActiveChannel("abc-123") → opens that channel's messages
  // Calling setActiveChannel(null)      → goes back to the channel list
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
}));
```

**How other components use this:**
```ts
// In any component — read state:
const { isChatOpen, activeChannelId } = useChatStore();

// In any component — trigger actions:
const { openChat, closeChat, setActiveChannel } = useChatStore();
openChat();                      // open the drawer
setActiveChannel("channel-id"); // view a specific channel
setActiveChannel(null);         // go back to channel list
closeChat();                    // close the whole drawer
```

---

## Step 2 — Create the Socket Singleton

**📄 File to create:** `src/lib/socket.ts`

**What this does in plain English:**
A socket connection must be created ONCE when the user logs in and destroyed ONCE when they log out. If you put it inside a React component, it would get recreated every render. So we manage it here in a plain TypeScript module — outside React.

```ts
// src/lib/socket.ts

import { io, Socket } from "socket.io-client";

// This variable lives for the LIFETIME of the browser tab.
// It's not tied to any component render cycle.
let socket: Socket | null = null;

/**
 * Call this right after the user logs in.
 * Pass the Supabase JWT token so the server can verify who this is.
 *
 * Safe to call multiple times — if already connected, returns the same socket.
 */
export function connectSocket(token: string): Socket {
  // Guard: don't create a second socket if one already exists
  if (socket?.connected) return socket;

  socket = io(import.meta.env.VITE_API_URL ?? "http://localhost:3000", {
    auth: { token }, // Server reads this to verify the user
  });

  return socket;
}

/**
 * Call this right before the user logs out.
 * ⚠️ Must be called BEFORE supabase.auth.signOut() — otherwise the JWT
 * is already cleared and the server can't cleanly close the session.
 */
export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null; // Reset so connectSocket() can create a fresh one next login
}

/**
 * Use this inside hooks/components to send/receive events.
 * Returns null if the user isn't logged in yet.
 */
export function getSocket(): Socket | null {
  return socket;
}
```

---

## Step 3 — Update AuthContext (2 small changes)

**📄 File to edit:** `src/contexts/AuthContext.tsx`

You only need to make **2 changes** to the existing file. Find each spot described below.

---

### Change A — Connect the socket when a session exists

**Find this existing block** (inside `onAuthStateChange`):
```ts
// EXISTING CODE — find this:
if (session) {
  api.get('users/me').catch(err => console.error("Auth sync failed:", err));
}
```

**Change it to this** (add the connectSocket line):
```ts
// UPDATED CODE:
import { connectSocket, disconnectSocket } from "@/lib/socket"; // ← add to imports at top of file

if (session) {
  connectSocket(session.access_token); // ← ADD THIS. Starts the socket on login/page refresh.
  api.get('users/me').catch(err => console.error("Auth sync failed:", err));
}
```

---

### Change B — Disconnect the socket on logout

**Find this existing function:**
```ts
// EXISTING CODE — find this:
const signOut = async () => {
  await supabase.auth.signOut();
};
```

**Change it to this** (disconnect BEFORE signing out):
```ts
// UPDATED CODE:
const signOut = async () => {
  disconnectSocket();            // ← ADD THIS LINE FIRST
  await supabase.auth.signOut(); // then clear the Supabase session
};
// ⚠️ Order matters! If you sign out first, the JWT is gone and the
// socket teardown on the server won't be able to identify the user.
```

---

## Step 4 — Create All Chat Hooks

**📄 File to create:** `src/hooks/api/useChat.ts`

**What this does in plain English:**
This is the main data layer for chat. It follows the exact same pattern as `useComments.ts` and `useTasks.ts`. There are 3 parts:
1. **Types** — what the data looks like
2. **Query/Mutation hooks** — fetching channels, messages, marking as read
3. **Socket listener hook** — handles real-time events and updates the cache

```ts
// src/hooks/api/useChat.ts

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import api from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useWorkspace } from "@/contexts/WorkspaceContext";

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
    const onReceiveMessage = (message: ChatMessage) => {
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
                      unread_count: ch.unread_count + 1,   // bump the badge number
                      last_message_at: message.created_at, // update the timestamp
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
    const onChannelAdded = () => {
      if (workspaceId) {
        // Just refetch the list — the new channel will appear automatically
        queryClient.invalidateQueries({
          queryKey: chatKeys.channels(workspaceId),
        });
      }
    };

    // ── EVENT 3: Socket reconnected (after network drop / tunnel loss) ───────
    const onReconnect = () => {
      // Re-fetch the active channel's messages to fill any gap while offline
      if (activeChannelId) {
        queryClient.invalidateQueries({
          queryKey: chatKeys.messages(activeChannelId),
        });
      }
    };

    // Register all listeners
    socket.on("receive_message", onReceiveMessage);
    socket.on("channel_added", onChannelAdded);
    socket.on("connect", onReconnect);       // "connect" fires on both first connect AND reconnects

    // Cleanup when component unmounts or activeChannelId changes
    return () => {
      socket.off("receive_message", onReceiveMessage);
      socket.off("channel_added", onChannelAdded);
      socket.off("connect", onReconnect);
    };
  }, [activeChannelId, workspaceId, queryClient]);
}
```

---

## Step 5 — Chat Drawer Shell

**📄 File to create:** `src/components/chat/ChatDrawer.tsx`

**What this does in plain English:**
This is the outer container of the chat panel. It slides in from the right. It reads Zustand to know if it should be visible. It also hosts the socket listeners (one place, mounted once). Inside it shows either the channel list OR a specific channel's messages — based on whether `activeChannelId` is set.

```tsx
// src/components/chat/ChatDrawer.tsx

import { useChatStore } from "@/store/useChatStore";
import { useChatSocketListeners } from "@/hooks/api/useChat";
import { ChannelList } from "./ChannelList";
import { MessageView } from "./MessageView";
import { X } from "lucide-react";

export function ChatDrawer() {
  // Read state from Zustand
  const { isChatOpen, activeChannelId, closeChat } = useChatStore();

  // ⚠️ Mount socket listeners here — once, at the drawer level.
  // They stay active even when you navigate between channel list and messages.
  useChatSocketListeners(activeChannelId);

  // Don't render anything if the drawer is closed
  if (!isChatOpen) return null;

  return (
    // Fixed panel pinned to the right side of the screen, on top of everything
    <div className="fixed inset-y-0 right-0 z-50 flex w-80 shadow-xl border-l border-border bg-background">
      <div className="flex flex-col w-full h-full">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-sm">Chat</h2>
          <button
            onClick={closeChat}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ──
            If a channel is selected → show its messages.
            If no channel selected → show the list of conversations. */}
        {activeChannelId ? (
          <MessageView channelId={activeChannelId} />
        ) : (
          <ChannelList />
        )}

      </div>
    </div>
  );
}
```

---

## Step 6 — Channel List

**📄 File to create:** `src/components/chat/ChannelList.tsx`

**What this does in plain English:**
Shows all the user's conversations (DMs and groups). Each row has the person's name, the time of the last message, and a red badge if there are unread messages. Clicking a row opens the messages AND immediately calls the "mark as read" API to clear the badge.

```tsx
// src/components/chat/ChannelList.tsx

import { useChatChannels, useReadChannel } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import { MessageCircle } from "lucide-react";

export function ChannelList() {
  const { data: channels = [], isLoading } = useChatChannels();
  const { setActiveChannel } = useChatStore();
  const readChannel = useReadChannel();

  // Called when the user clicks a conversation row
  const handleOpenChannel = (channelId: string) => {
    setActiveChannel(channelId);        // → switches view to MessageView
    readChannel.mutate(channelId);      // → tells backend "I've read this"
                                        //   → clears the red dot in the cache
  };

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  // ── Empty state ──
  if (channels.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm p-4">
        <MessageCircle className="h-8 w-8 opacity-40" />
        <p>No conversations yet.</p>
      </div>
    );
  }

  // ── Channel list ──
  return (
    <ul className="flex-1 overflow-y-auto divide-y divide-border">
      {channels.map((channel) => {
        // For DMs → show the other person's name
        // For groups → show the group's name
        const displayName =
          channel.type === "direct"
            ? channel.members[0]?.name ?? "Unknown"
            : channel.name ?? "Group";

        return (
          <li key={channel.id}>
            <button
              onClick={() => handleOpenChannel(channel.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              {/* Avatar circle — just shows the first letter of the name */}
              <span className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold uppercase">
                {displayName.charAt(0)}
              </span>

              {/* Name + timestamp */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                {channel.last_message_at && (
                  <p className="text-xs text-muted-foreground">
                    {new Date(channel.last_message_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>

              {/* Red unread badge — only shown when unread_count > 0 */}
              {channel.unread_count > 0 && (
                <span className="flex-shrink-0 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {channel.unread_count > 9 ? "9+" : channel.unread_count}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
```

---

## Step 7 — Message View

**📄 File to create:** `src/components/chat/MessageView.tsx`

**What this does in plain English:**
Shows all messages for the currently selected channel. Has a text input at the bottom. When you hit Enter or click Send, the message is emitted via socket. The message will come back via the socket listener and appear in the list. Also scrolls to the newest message automatically.

```tsx
// src/components/chat/MessageView.tsx

import { useState, useRef, useEffect } from "react";
import { useChatMessages, useSendMessage } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import { ArrowLeft, Send } from "lucide-react";

interface MessageViewProps {
  channelId: string;
}

export function MessageView({ channelId }: MessageViewProps) {
  const { data: messages = [], isLoading } = useChatMessages(channelId);
  const sendMessage = useSendMessage();
  const { setActiveChannel } = useChatStore();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null); // invisible div at the bottom

  // Auto-scroll: every time the messages array changes, scroll to the bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!text.trim()) return;          // don't send empty messages
    sendMessage(channelId, text.trim()); // emits via socket
    setText("");                         // clear the input
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Back button — goes back to the channel list ── */}
      <button
        onClick={() => setActiveChannel(null)} // null = show channel list
        className="flex items-center gap-1 px-4 py-2 text-xs text-muted-foreground hover:text-foreground border-b border-border"
      >
        <ArrowLeft className="h-3 w-3" /> Back
      </button>

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {isLoading && (
          <p className="text-center text-xs text-muted-foreground">Loading messages…</p>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            {/* Sender name */}
            <span className="text-[11px] font-semibold text-foreground">
              {msg.sender.name ?? "Unknown"}
            </span>

            {/* Message bubble */}
            <p className="text-sm bg-muted rounded-lg px-3 py-2 w-fit max-w-[90%]">
              {msg.content}
            </p>

            {/* Timestamp */}
            <span className="text-[10px] text-muted-foreground">
              {new Date(msg.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}

        {/* Invisible anchor — scrolled into view whenever messages change */}
        <div ref={bottomRef} />
      </div>

      {/* ── Send input ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()} // Enter to send
          placeholder="Type a message…"
          className="flex-1 text-sm bg-muted rounded-md px-3 py-2 outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()} // disable when input is empty
          className="text-primary hover:text-primary/80 disabled:opacity-40 transition-opacity"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

    </div>
  );
}
```

---

## Step 8 — Mount the Drawer in Layout

**📄 File to edit:** `src/components/Layout.tsx`

You only need to **add 2 lines** to the existing file.

**Find the top of the file** and add the import:
```tsx
// Add this import with the other imports at the top:
import { ChatDrawer } from "./chat/ChatDrawer";
```

**Find the closing of `<SidebarProvider>`** and add `<ChatDrawer />` before it closes:
```tsx
// BEFORE (existing code):
  <Toaster />
</SidebarProvider>

// AFTER (add the ChatDrawer line):
  <Toaster />
  <ChatDrawer />   {/* ← ADD THIS ONE LINE */}
</SidebarProvider>
```

> **Why here?** `<ChatDrawer>` uses `position: fixed` so it floats over all pages. Mounting it in `<Layout>` means it's available on every route automatically.

---

## Step 9 — Add Chat Button to Sidebar

**📄 File to edit:** `src/components/AppSidebar.tsx`

**Add these two imports** at the top of the file:
```tsx
import { useChatStore } from "@/store/useChatStore";
import { MessageSquare } from "lucide-react";
```

**Inside the component body**, get the `openChat` action:
```tsx
const { openChat } = useChatStore();
```

**Find where the sidebar nav items are rendered** and add this button:
```tsx
<button
  onClick={openChat}            // → sets isChatOpen: true in Zustand
  title="Open Chat"
  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/60 text-sm w-full"
>
  <MessageSquare className="h-4 w-4" />
  <span>Chat</span>
</button>
```

---

## ✅ How to Test (In Order)

Work through this list top to bottom. Each step builds on the previous one.

| # | Test | What you're verifying |
|---|------|-----------------------|
| 1 | Click Chat button in sidebar | Zustand + Drawer working |
| 2 | Channel list loads | `useChatChannels` hook + REST API working |
| 3 | Click a channel | `setActiveChannel` + `useReadChannel` working |
| 4 | Red dot disappears on click | `markAsRead` REST call + cache invalidation working |
| 5 | Type a message + Enter | `useSendMessage` socket emit working |
| 6 | Open a second browser tab, send from tab 1 | `receive_message` socket event + cache injection working |
| 7 | Sign out | Check server logs — socket should disconnect cleanly |
| 8 | Disconnect internet, reconnect | `connect` event fires, missed messages refetch |

---

## 🐛 Bugs You Might Hit & How to Fix Them

| Symptom | Cause | Fix |
|---------|-------|-----|
| Socket not connecting at all | `connectSocket()` not called | Make sure it's in `AuthContext` inside the `if (session)` block |
| Red dot never disappears | Cache not invalidating | `useReadChannel` `onSuccess` must invalidate `chatKeys.channels(workspaceId)` |
| My own message shows a red dot | Server not auto-reads sender | This is Dev-A's fix: server sets `last_read_at = NOW()` for the sender after saving |
| Messages appear twice | Both query refetch AND socket append | Make sure `staleTime: Infinity` is set in `useChatMessages` |
| Drawer doesn't appear | `<ChatDrawer />` in wrong place | Must be inside `<SidebarProvider>` in `Layout.tsx` |
| Clicking Back button crashes | `setActiveChannel("")` vs `null` | Make sure `useChatStore` accepts `string | null` and you pass `null` |
| All messages missing after reconnect | `connect` listener not set up | Verify `socket.on("connect", onReconnect)` is in `useChatSocketListeners` |

---

## 📁 Final Folder Structure

```
frontend/src/
│
├── store/
│   └── useChatStore.ts          ← 🆕 NEW — Zustand global state
│
├── lib/
│   └── socket.ts                ← 🆕 NEW — Singleton socket connection
│
├── hooks/api/
│   ├── useComments.ts           (existing, don't touch)
│   ├── useTasks.ts              (existing, don't touch)
│   └── useChat.ts               ← 🆕 NEW — All chat hooks + socket listeners
│
├── components/
│   ├── Layout.tsx               ← ✏️ EDIT — Add <ChatDrawer />
│   ├── AppSidebar.tsx           ← ✏️ EDIT — Add Chat nav button
│   └── chat/                   ← 🆕 NEW FOLDER
│       ├── ChatDrawer.tsx       — Slide-out container shell
│       ├── ChannelList.tsx      — List with unread badges
│       └── MessageView.tsx      — Messages + send input
│
└── contexts/
    └── AuthContext.tsx          ← ✏️ EDIT — Connect/disconnect socket on auth change
```

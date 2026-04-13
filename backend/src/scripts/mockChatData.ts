// src/data/mockChatData.ts
// Realistic startup-grade conversation samples for UI demo mode

export interface MockMessage {
  id: string;
  sender: { id: string; name: string; role?: string };
  content: string;
  created_at: string;
  type?: "text" | "file" | "voice" | "system" | "ai";
  attachment?: { name: string; kind: "image" | "file" | "code" };
  reactions?: Record<string, string[]>; // emoji → userIds
  threadCount?: number;
  isHighlighted?: boolean; // mention highlight
}

export interface MockChannel {
  id: string;
  name: string;
  description: string;
  emoji: string;
  messages: MockMessage[];
}

const t = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

// ── 1. Team Work Chat (Slack / Huly style) ─────────────────────────────────
const teamWorkChat: MockMessage[] = [
  { id: "tw1", sender: { id: "u1", name: "Ritik", role: "Founder" }, content: "Hey team, quick update on the chat module?", created_at: t(42), reactions: { "👀": ["u2", "u3"] } },
  { id: "tw2", sender: { id: "u2", name: "Ankit", role: "Frontend" }, content: "UI is 80% done. Need to fix message alignment + typing indicator.", created_at: t(40) },
  { id: "tw3", sender: { id: "u3", name: "Priya", role: "Backend" }, content: "API is ready but socket events are lagging sometimes.", created_at: t(38), reactions: { "🔥": ["u1"] } },
  { id: "tw4", sender: { id: "u1", name: "Ritik" }, content: "Lag from backend or frontend?", created_at: t(36) },
  { id: "tw5", sender: { id: "u3", name: "Priya" }, content: "Mostly backend event emission delay.", created_at: t(34) },
  { id: "tw6", sender: { id: "u2", name: "Ankit" }, content: "Yeah I noticed delay in real-time updates too.", created_at: t(32) },
  { id: "tw7", sender: { id: "u1", name: "Ritik" }, content: "Okay, let's fix real-time sync first. That's critical. @Priya can you create a task for this?", created_at: t(30), isHighlighted: true, threadCount: 3 },
  { id: "tw8", sender: { id: "u3", name: "Priya" }, content: "Done! Task created → `fix-socket-lag` assigned to me. Due Friday.", created_at: t(28), reactions: { "✅": ["u1", "u2"] } },
];

// ── 2. Startup Founder Style ───────────────────────────────────────────────
const founderChat: MockMessage[] = [
  { id: "fc1", sender: { id: "u1", name: "Ritik" }, content: "We're not building just a chat app. We're building a **collaboration engine**.", created_at: t(90) },
  { id: "fc2", sender: { id: "u4", name: "Saurabh", role: "Co-founder" }, content: "Then we need more than messaging.", created_at: t(88) },
  { id: "fc3", sender: { id: "u1", name: "Ritik" }, content: "Exactly. Add:\n- Threaded conversations\n- Reactions\n- Smart mentions\n- AI summaries", created_at: t(86), reactions: { "🔥": ["u4", "u3"], "💯": ["u2"] } },
  { id: "fc4", sender: { id: "u4", name: "Saurabh" }, content: "AI summaries will be 🔥 — that's our unfair advantage.", created_at: t(84) },
  { id: "fc5", sender: { id: "u1", name: "Ritik" }, content: "Exactly. Every team action logged → AI surfaces the context automatically.", created_at: t(82), threadCount: 5 },
  { id: "fc6", sender: { id: "u3", name: "Priya" }, content: "I'll start on the `/summarize` endpoint this afternoon.", created_at: t(80), reactions: { "👍": ["u1"] } },
];

// ── 3. Bug Discussion ──────────────────────────────────────────────────────
const bugChat: MockMessage[] = [
  { id: "bg1", sender: { id: "u2", name: "Ankit" }, content: "Messages are duplicating sometimes — saw it in prod 😬", created_at: t(25) },
  { id: "bg2", sender: { id: "u3", name: "Priya" }, content: "Socket emitting twice?", created_at: t(24) },
  { id: "bg3", sender: { id: "u2", name: "Ankit" }, content: "Maybe. Or frontend state issue. Let me check React Query cache.", created_at: t(23) },
  { id: "bg4", sender: { id: "u1", name: "Ritik" }, content: "Log events and check:\n```\nemit count: socket.on('receive_message', handler)\nlistener count: socket.listeners('receive_message').length\n```", created_at: t(22) },
  { id: "bg5", sender: { id: "u3", name: "Priya" }, content: "Good idea. I'll debug server logs now.", created_at: t(21), reactions: { "👍": ["u1", "u2"] } },
  { id: "bg6", sender: { id: "u2", name: "Ankit" }, content: "Found it — listener added on every re-render. Missing cleanup in useEffect 🤦", created_at: t(18), reactions: { "💀": ["u1"], "😂": ["u3"] } },
  { id: "bg7", sender: { id: "u1", name: "Ritik" }, content: "Classic. Always return the cleanup function! Fixed in `socket.ts` already.", created_at: t(16) },
];

// ── 4. AI Assistant Chat ───────────────────────────────────────────────────
const aiChat: MockMessage[] = [
  { id: "ai1", sender: { id: "u1", name: "Ritik" }, content: "Summarize this conversation", created_at: t(10), type: "text" },
  {
    id: "ai2",
    sender: { id: "bot", name: "Keil AI", role: "AI Assistant" },
    content: "📊 **Chat Summary**\n\nThis conversation is about fixing real-time chat delays caused by backend socket event emission lag. The team identified the root cause and created a tracking task.",
    created_at: t(9),
    type: "ai",
    reactions: { "👍": ["u1"] }
  },
  { id: "ai3", sender: { id: "u1", name: "Ritik" }, content: "Suggest improvements", created_at: t(8) },
  {
    id: "ai4",
    sender: { id: "bot", name: "Keil AI" },
    content: "💡 **Recommended improvements:**\n1. Optimize socket event emission with debounce\n2. Add message queue for reliable delivery\n3. Implement exponential backoff retry logic\n4. Use `socket.volatile.emit()` for typing indicators",
    created_at: t(7),
    type: "ai",
    reactions: { "🔥": ["u1", "u2"], "✅": ["u3"] }
  },
  { id: "ai5", sender: { id: "u1", name: "Ritik" }, content: "Convert suggestion #1 to a task", created_at: t(6) },
  {
    id: "ai6",
    sender: { id: "bot", name: "Keil AI" },
    content: "✅ **Task Created:** Optimize socket emission with debounce\n→ Priority: High · Assigned: Priya · Due: Friday",
    created_at: t(5),
    type: "ai"
  },
];

// ── 5. File Sharing Chat ───────────────────────────────────────────────────
const fileChat: MockMessage[] = [
  { id: "file1", sender: { id: "u2", name: "Ankit" }, content: "Uploading design files now...", created_at: t(60) },
  { id: "file2", sender: { id: "u2", name: "Ankit" }, content: "📎 design_v2.fig uploaded", created_at: t(59), type: "file", attachment: { name: "design_v2.fig", kind: "file" } },
  { id: "file3", sender: { id: "u4", name: "Saurabh" }, content: "Got it, reviewing now 👀", created_at: t(57), reactions: { "👍": ["u2"] } },
  { id: "file4", sender: { id: "u3", name: "Priya" }, content: "The sidebar design looks great! One thing — status dots are missing.", created_at: t(55) },
  { id: "file5", sender: { id: "u2", name: "Ankit" }, content: "📎 sidebar_v3_with_status.png uploaded", created_at: t(54), type: "file", attachment: { name: "sidebar_v3_with_status.png", kind: "image" } },
  { id: "file6", sender: { id: "u1", name: "Ritik" }, content: "That's it! Ship it 🚀", created_at: t(52), reactions: { "🚀": ["u2", "u3", "u4"], "🔥": ["u3"] } },
];

// ── 6. Voice + Casual Chat ─────────────────────────────────────────────────
const casualChat: MockMessage[] = [
  { id: "ca1", sender: { id: "u2", name: "Ankit" }, content: "Bro did you check the new feature?", created_at: t(15) },
  { id: "ca2", sender: { id: "u4", name: "Saurabh" }, content: "Which one?", created_at: t(14) },
  { id: "ca3", sender: { id: "u2", name: "Ankit" }, content: "Typing indicator + message reactions — feels like Discord now 😄", created_at: t(13), reactions: { "😂": ["u4"], "💯": ["u1"] } },
  { id: "ca4", sender: { id: "u4", name: "Saurabh" }, content: "🎤 Voice message (0:12)", created_at: t(12), type: "voice" },
  { id: "ca5", sender: { id: "u2", name: "Ankit" }, content: "Listening... lmao yes exactly 🤣", created_at: t(11) },
  { id: "ca6", sender: { id: "u1", name: "Ritik" }, content: "@Ankit @Saurabh focus guys, standup in 5 mins 😅", created_at: t(10), isHighlighted: true, reactions: { "😅": ["u2", "u4"] } },
];

// ── Export all channels ────────────────────────────────────────────────────
export const DEMO_CHANNELS: MockChannel[] = [
  {
    id: "demo-team",
    name: "# team-general",
    description: "Team work discussion",
    emoji: "💼",
    messages: teamWorkChat,
  },
  {
    id: "demo-founder",
    name: "# product-vision",
    description: "Startup founder level chat",
    emoji: "🚀",
    messages: founderChat,
  },
  {
    id: "demo-bugs",
    name: "# bug-reports",
    description: "Bug discussion thread",
    emoji: "🐛",
    messages: bugChat,
  },
  {
    id: "demo-ai",
    name: "# ai-assistant",
    description: "AI powered chat demo",
    emoji: "🤖",
    messages: aiChat,
  },
  {
    id: "demo-files",
    name: "# design-files",
    description: "File sharing demo",
    emoji: "📎",
    messages: fileChat,
  },
  {
    id: "demo-casual",
    name: "# casual",
    description: "Casual team chat",
    emoji: "😄",
    messages: casualChat,
  },
];

export const DEMO_MY_ID = "u1"; // Ritik = "You"

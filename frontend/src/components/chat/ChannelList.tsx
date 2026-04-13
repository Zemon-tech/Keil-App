// src/components/chat/ChannelList.tsx

import { useState } from "react";
import { useChatChannels, useReadChannel } from "@/hooks/api/useChat";
import { useChatStore } from "@/store/useChatStore";
import { MessageCircle, Search, Pin, PinOff, Globe, Lock, LockKeyhole } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Filter = "all" | "unread" | "mentions";

const FILTER_TABS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "mentions", label: "Mentions" },
];

export function ChannelList() {
  const { data: channels = [], isLoading } = useChatChannels();
  const { activeChannelId, setActiveChannel, pinnedChannelIds, togglePinChannel } = useChatStore();
  const readChannel = useReadChannel();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const handleOpenChannel = (channelId: string) => {
    setActiveChannel(channelId);
    readChannel.mutate(channelId);
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-hidden px-3 py-4 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-2 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Apply search filter
  const getDisplayName = (channel: (typeof channels)[0]) =>
    channel.type === "direct"
      ? (channel.members[0]?.name ?? "Unknown")
      : (channel.name ?? "Group");

  const searched = channels.filter((ch) =>
    getDisplayName(ch).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply tab filter
  const filtered = searched.filter((ch) => {
    if (filter === "unread") return ch.unread_count > 0;
    if (filter === "mentions") return ch.unread_count > 0; // placeholder: real mentions need backend
    return true;
  });

  const pinned = filtered.filter((ch) => pinnedChannelIds.includes(ch.id));
  const unpinned = filtered.filter((ch) => !pinnedChannelIds.includes(ch.id));

  const totalUnread = channels.reduce((sum, ch) => sum + ch.unread_count, 0);

  return (
    <>
      {/* ── Search bar ── */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-muted/60 border border-transparent focus:border-primary/30 focus:bg-background focus:ring-1 focus:ring-primary/20 outline-none rounded-xl py-2 pl-9 pr-4 text-sm transition-all"
          />
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex items-center gap-1 px-3 pb-2 shrink-0">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.key === "all" && totalUnread > 0 && filter !== "all" && (
              <span className="h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Lists ── */}
      {channels.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center text-muted-foreground text-sm p-6">
          <div className="p-4 bg-muted rounded-full">
            <MessageCircle className="h-6 w-6 opacity-60" />
          </div>
          <p className="font-medium">No conversations yet</p>
          <p className="text-xs opacity-70">Create a new chat to get started</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm p-6">
          <p>No results for &ldquo;<span className="text-foreground font-medium">{searchQuery || filter}</span>&rdquo;</p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">

          {/* Pinned section */}
          {pinned.length > 0 && (
            <>
              <li className="px-2 pt-2 pb-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                  <Pin className="w-2.5 h-2.5" /> Pinned
                </p>
              </li>
              {pinned.map((ch) => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  isActive={activeChannelId === ch.id}
                  isPinned
                  onOpen={() => handleOpenChannel(ch.id)}
                  onTogglePin={() => togglePinChannel(ch.id)}
                  displayName={getDisplayName(ch)}
                />
              ))}
              <li className="px-2 pt-2 pb-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  All Messages
                </p>
              </li>
            </>
          )}

          {/* Main list */}
          {unpinned.map((ch) => (
            <ChannelRow
              key={ch.id}
              channel={ch}
              isActive={activeChannelId === ch.id}
              isPinned={false}
              onOpen={() => handleOpenChannel(ch.id)}
              onTogglePin={() => togglePinChannel(ch.id)}
              displayName={getDisplayName(ch)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

// ── ChannelRow sub-component ──
interface RowProps {
  channel: {
    id: string;
    type: "direct" | "group";
    privacy: "public" | "private" | "secret";
    unread_count: number;
    last_message_at: string | null;
    members: { id: string; name: string }[];
    name: string | null;
  };
  displayName: string;
  isActive: boolean;
  isPinned: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
}

function ChannelRow({ channel, displayName, isActive, isPinned, onOpen, onTogglePin }: RowProps) {
  const [hovered, setHovered] = useState(false);
  // Deterministic color from name for visual variety
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500"];
  const color = colors[displayName.charCodeAt(0) % colors.length];

  return (
    <li
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={onOpen}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted/60 text-foreground"
        }`}
      >
        {/* Avatar with online dot */}
        <div className="relative shrink-0">
          <span className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white uppercase ${
            isActive ? "ring-2 ring-primary-foreground/40" : ""
          } ${color}`}>
            {displayName.charAt(0)}
          </span>
          {/* Static "online" pulse — in production this would come from presence data */}
          {channel.type === "direct" && (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background" />
          )}
        </div>

        {/* Name + preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 min-w-0">
              {/* Privacy icon for group channels */}
              {channel.type === "group" && (
                <span className={`shrink-0 ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {channel.privacy === "public"  && <Globe       className="w-3 h-3" />}
                  {channel.privacy === "private" && <Lock        className="w-3 h-3" />}
                  {channel.privacy === "secret"  && <LockKeyhole className="w-3 h-3" />}
                </span>
              )}
              <p className={`text-[14px] font-semibold truncate ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
                {displayName}
              </p>
            </div>
            {channel.last_message_at && (
              <p className={`text-[11px] font-medium shrink-0 ml-1 ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {new Date(channel.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          <p className={`text-[12px] truncate mt-0.5 ${
            channel.unread_count > 0
              ? isActive ? "text-primary-foreground/90 font-semibold" : "text-foreground font-semibold"
              : isActive ? "text-primary-foreground/60" : "text-muted-foreground"
          }`}>
            {channel.unread_count > 0 ? "New message" : channel.type === "direct" ? "Direct message" : `${channel.members.length} members`}
          </p>
        </div>

        {/* Unread badge */}
        {channel.unread_count > 0 && (
          <span className={`shrink-0 h-5 min-w-[20px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
            isActive ? "bg-background text-primary" : "bg-destructive text-destructive-foreground"
          }`}>
            {channel.unread_count > 9 ? "9+" : channel.unread_count}
          </span>
        )}
      </button>

      {/* Pin toggle — appears on hover */}
      {hovered && !isActive && (
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-amber-500 bg-background border border-border rounded-full shadow-sm transition-colors z-10"
          title={isPinned ? "Unpin" : "Pin to top"}
        >
          {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
        </button>
      )}
    </li>
  );
}

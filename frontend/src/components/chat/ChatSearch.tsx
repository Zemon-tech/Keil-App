// src/components/chat/ChatSearch.tsx
// Global search overlay — search messages & users (Slack-level feature)

import { useRef, useEffect } from "react";
import { Search, X, MessageCircle, User } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { useChatChannels, useChatMessages } from "@/hooks/api/useChat";

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary font-semibold rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function ChatSearch() {
  const { searchOpen, searchQuery, closeSearch, setSearchQuery, setActiveChannel } = useChatStore();
  const { data: channels = [] } = useChatChannels();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [searchOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSearch(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSearch]);

  if (!searchOpen) return null;

  const q = searchQuery.toLowerCase().trim();

  // Filter channels whose display name matches
  const matchedChannels = q
    ? channels.filter((ch) => {
        const name = ch.type === "direct"
          ? (ch.members[0]?.name ?? "")
          : (ch.name ?? "");
        return name.toLowerCase().includes(q);
      })
    : [];

  const openChannel = (id: string) => {
    setActiveChannel(id);
    closeSearch();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
        onClick={closeSearch}
      />

      {/* Modal panel */}
      <div className="fixed top-[12vh] left-1/2 -translate-x-1/2 z-[101] w-full max-w-xl px-4">
        <div className="bg-background rounded-2xl border border-border shadow-2xl overflow-hidden">

          {/* Search input row */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-5 h-5 text-primary shrink-0" />
            <input
              ref={inputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages, people, channels…"
              className="flex-1 text-base bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-1 text-muted-foreground hover:text-foreground rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {!q && (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                <Search className="w-8 h-8 opacity-30" />
                <p>Start typing to search…</p>
                <p className="text-xs opacity-70">Search across people and channels</p>
              </div>
            )}

            {q && matchedChannels.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found for &ldquo;<span className="text-foreground font-medium">{searchQuery}</span>&rdquo;
              </div>
            )}

            {matchedChannels.length > 0 && (
              <div className="p-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                  Conversations
                </p>
                {matchedChannels.map((ch) => {
                  const name = ch.type === "direct"
                    ? (ch.members[0]?.name ?? "Unknown")
                    : (ch.name ?? "Group");
                  return (
                    <button
                      key={ch.id}
                      onClick={() => openChannel(ch.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors text-left"
                    >
                      <span className="flex-shrink-0 h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary uppercase">
                        {name.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {highlight(name, searchQuery)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ch.type === "direct" ? "Direct Message" : "Group Channel"}
                        </p>
                      </div>
                      {ch.type === "direct" ? (
                        <User className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Enter</kbd> to open</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </>
  );
}

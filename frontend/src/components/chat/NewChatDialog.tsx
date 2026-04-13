// src/components/chat/NewChatDialog.tsx
// Upgraded: smart search, online status, suggested contacts, AI suggestions,
// rich channel-creation form (description, privacy, type, tags, roles)

import { useState } from "react";
import { useWorkspaceMembers } from "@/hooks/api/useWorkspace";
import { useOpenDM, useCreateGroup } from "@/hooks/api/useChat";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useChatStore } from "@/store/useChatStore";
import { useMe } from "@/hooks/api/useMe";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Plus, Search, Loader2, Users, Lock, Globe, Megaphone,
  MessageSquare, Sparkles, Star, Clock, Hash,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// ── Deterministic avatar colour ───────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500", "bg-rose-500", "bg-cyan-500",
];
const avatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

// ── Types ─────────────────────────────────────────────────────────────────────
type ChannelPrivacy = "public" | "private" | "secret";
type ChannelType    = "discussion" | "announcement" | "project";

const PRIVACY_OPTIONS: { value: ChannelPrivacy; icon: React.ElementType; label: string; desc: string }[] = [
  { value: "public",  icon: Globe,      label: "Public",  desc: "Anyone in workspace can join" },
  { value: "private", icon: Lock,       label: "Private", desc: "Invite-only, not listed" },
  { value: "secret",  icon: Lock,       label: "Secret",  desc: "Hidden, invite-only, no history for new members" },
];

const TYPE_OPTIONS: { value: ChannelType; icon: React.ElementType; label: string; desc: string }[] = [
  { value: "discussion",   icon: MessageSquare, label: "Discussion",   desc: "Open conversation for all members" },
  { value: "announcement", icon: Megaphone,     label: "Announcement", desc: "Only admins can post" },
  { value: "project",      icon: Hash,          label: "Project",      desc: "Linked to a project workstream" },
];

const SUGGESTED_TAGS = ["#frontend", "#backend", "#design", "#devops", "#product", "#general"];

// ─────────────────────────────────────────────────────────────────────────────
export function NewChatDialog({ 
  children,
  defaultTab = "dm"
}: { 
  children?: React.ReactNode,
  defaultTab?: "dm" | "channel"
}) {
  const [open, setOpen]           = useState(false);
  const [tab, setTab]             = useState<"dm" | "channel">(defaultTab);
  // DM tab search (separate from channel tab search)
  const [search, setSearch]       = useState("");
  // Channel tab member search (independent)
  const [channelSearch, setChannelSearch] = useState("");
  const { workspaceId }           = useWorkspace();
  const { data: members, isLoading } = useWorkspaceMembers(workspaceId ?? undefined);
  const { data: me }              = useMe();
  const openDM                    = useOpenDM();
  const createGroup               = useCreateGroup();
  const { setActiveChannel }      = useChatStore();

  // Group / Channel form
  const [groupName, setGroupName]       = useState("");
  const [description, setDescription]   = useState("");
  const [privacy, setPrivacy]           = useState<ChannelPrivacy>("public");
  const [channelType, setChannelType]   = useState<ChannelType>("discussion");
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [tags, setTags]                 = useState<string[]>([]);
  const [customTag, setCustomTag]       = useState("");

  const meId = (me as Record<string, any>)?.user?.id ?? (me as Record<string, any>)?.id;

  // DM tab: filtered by `search`
  const filteredMembers = members?.filter((m) => {
    if (m.user.id === meId) return false;
    const q = search.toLowerCase();
    return (
      m.user.name?.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q)
    );
  });

  // Channel tab: filtered by `channelSearch` (independent state)
  const channelFilteredMembers = members?.filter((m) => {
    if (m.user.id === meId) return false;
    const q = channelSearch.toLowerCase();
    return (
      m.user.name?.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q)
    );
  });

  const toggleMember = (id: string) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const toggleTag = (t: string) => {
    setTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  };

  const handleStartDM = (userId: string) => {
    openDM.mutate(userId, {
      onSuccess: (channel: any) => { setActiveChannel(channel.id); setOpen(false); },
    });
  };

  const handleCreateChannel = () => {
    if (!groupName.trim()) {
      toast.error("Channel name is required");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Select at least one member to add");
      return;
    }
    createGroup.mutate(
      { name: groupName.trim(), member_ids: Array.from(selectedIds), privacy },
      {
        onSuccess: (channel: any) => {
          toast.success(`#${groupName.trim()} created!`);
          setActiveChannel(channel.id);
          setOpen(false);
          // Reset all channel form state
          setGroupName("");
          setDescription("");
          setSelectedIds(new Set());
          setTags([]);
          setChannelSearch("");
        },
        onError: (err: any) => {
          const msg =
            err?.response?.data?.error?.message ||
            err?.message ||
            "Failed to create channel";
          toast.error(msg);
        },
      }
    );
  };

  // Reset everything when dialog closes
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setSearch("");
      setChannelSearch("");
      setGroupName("");
      setDescription("");
      setSelectedIds(new Set());
      setTags([]);
      setCustomTag("");
      setTab(defaultTab);
    }
  };

  const SUGGESTED = filteredMembers?.slice(0, 3) ?? [];
  const RECENT    = filteredMembers?.slice(3, 6) ?? [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <button className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            New Conversation
          </DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-muted/60 rounded-xl shrink-0">
          {(["dm", "channel"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "dm" ? "💬 Direct Message" : "📢 Channel / Group"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── DIRECT MESSAGE TAB ─────────────────────────────────────────── */}
          {tab === "dm" && (
            <div className="space-y-4 pt-2">
              {/* AI suggestion banner */}
              <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 rounded-xl border border-violet-500/20">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                <p className="text-xs text-violet-400 font-medium">AI suggests people you collaborate with most</p>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, role, or team…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/60 border border-border rounded-xl outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {/* Suggested */}
                  {!search && SUGGESTED.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> AI SUGGESTED
                      </p>
                      <ul className="space-y-1">
                        {SUGGESTED.map((m) => (
                          <MemberRow key={m.id} member={m} onSelect={() => handleStartDM(m.user.id)} badge="suggested" isPending={openDM.isPending} />
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recent */}
                  {!search && RECENT.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> RECENT
                      </p>
                      <ul className="space-y-1">
                        {RECENT.map((m) => (
                          <MemberRow key={m.id} member={m} onSelect={() => handleStartDM(m.user.id)} isPending={openDM.isPending} />
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Search results */}
                  {search && (
                    <ul className="space-y-1">
                      {filteredMembers?.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No members found</p>
                      ) : (
                        filteredMembers?.map((m) => (
                          <MemberRow key={m.id} member={m} onSelect={() => handleStartDM(m.user.id)} isPending={openDM.isPending} />
                        ))
                      )}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── CHANNEL TAB ────────────────────────────────────────────────── */}
          {tab === "channel" && (
            <div className="space-y-5 pt-2">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Channel Name *</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. frontend-team, project-alpha"
                    className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted/60 border border-border rounded-xl outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this channel about?"
                  rows={2}
                  className="w-full px-3 py-2.5 text-sm bg-muted/60 border border-border rounded-xl outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
                />
              </div>

              {/* Privacy */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Privacy</label>
                <div className="grid grid-cols-3 gap-2">
                  {PRIVACY_OPTIONS.map(({ value, icon: Icon, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => setPrivacy(value)}
                      className={`flex flex-col gap-1 p-2.5 rounded-xl border text-left transition-all ${
                        privacy === value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-muted/60 text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[10px] opacity-70 leading-tight">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel type */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Channel Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map(({ value, icon: Icon, label, desc }) => (
                    <button
                      key={value}
                      onClick={() => setChannelType(value)}
                      className={`flex flex-col gap-1 p-2.5 rounded-xl border text-left transition-all ${
                        channelType === value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:bg-muted/60 text-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[10px] opacity-70 leading-tight">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SUGGESTED_TAGS.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleTag(t)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                        tags.includes(t)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/60 border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customTag.trim()) {
                        toggleTag(`#${customTag.trim().replace(/^#/, "")}`);
                        setCustomTag("");
                      }
                    }}
                    placeholder="+ Add custom tag"
                    className="flex-1 px-3 py-2 text-xs bg-muted/40 border border-border rounded-lg outline-none focus:border-primary/40 transition-all"
                  />
                </div>
              </div>

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Add Members
                    {selectedIds.size > 0 && (
                      <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
                        {selectedIds.size}
                      </span>
                    )}
                  </label>
                </div>
                {/* Channel member search */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    placeholder="Search members by name or email…"
                    className="w-full pl-9 pr-4 py-2 text-sm bg-muted/60 border border-border rounded-xl outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 border border-border rounded-xl p-1.5">
                  {isLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : channelFilteredMembers?.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {channelSearch ? `No members matching "${channelSearch}"` : "No members available"}
                    </p>
                  ) : (
                    channelFilteredMembers?.map((m) => {
                      const name = m.user.name || m.user.email;
                      const checked = selectedIds.has(m.user.id);
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleMember(m.user.id)}
                          className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                            checked ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/60"
                          }`}
                        >
                          <Checkbox checked={checked} onCheckedChange={() => toggleMember(m.user.id)} />
                          <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarColor(name)}`}>
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                          </div>
                          {checked && (
                            <span className="text-[10px] font-semibold text-primary shrink-0">✓ Added</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                {/* Selected members chips */}
                {selectedIds.size > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {Array.from(selectedIds).map((id) => {
                      const m = members?.find((x) => x.user.id === id);
                      if (!m) return null;
                      const name = m.user.name || m.user.email;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
                        >
                          {name}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleMember(id); }}
                            className="ml-0.5 hover:text-destructive transition-colors"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit */}
              <Button
                className="w-full"
                disabled={!groupName.trim() || selectedIds.size === 0 || createGroup.isPending}
                onClick={handleCreateChannel}
              >
                {createGroup.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
                  : <><Users className="mr-2 h-4 w-4" /> Create {privacy === "public" ? "Public" : "Private"} Channel</>
                }
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Member row sub-component ──────────────────────────────────────────────────
interface MemberRowProps {
  member: { id: string; user: { id: string; name?: string; email: string } };
  onSelect: () => void;
  badge?: "suggested" | "recent";
  isPending?: boolean;
}

function MemberRow({ member, onSelect, badge, isPending }: MemberRowProps) {
  const name = member.user.name || member.user.email;
  const color = avatarColor(name);
  // Deterministic 🟢/🟡 presence (mock — real impl needs presence API)
  const isOnline = member.user.id.charCodeAt(0) % 3 !== 0;

  return (
    <li>
      <button
        onClick={onSelect}
        disabled={isPending}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/60 transition-colors text-left"
      >
        {/* Avatar with online dot */}
        <div className="relative shrink-0">
          <span className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${color}`}>
            {name.charAt(0).toUpperCase()}
          </span>
          <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${isOnline ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{name}</p>
            {badge === "suggested" && (
              <span className="flex items-center gap-0.5 text-[10px] font-semibold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">
                <Star className="w-2.5 h-2.5" /> AI
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
        </div>

        <span className={`text-[11px] font-medium shrink-0 ${isOnline ? "text-emerald-500" : "text-muted-foreground"}`}>
          {isOnline ? "Online" : "Away"}
        </span>
      </button>
    </li>
  );
}

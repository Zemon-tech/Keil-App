// src/components/chat/GroupSettingsDialog.tsx
// Upgraded to a full Channel Info Panel:
// Members + roles, pinned messages, insights, permissions, danger zone

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Settings, UserX, UserPlus, Loader2, Pin, BarChart2,
  Shield, Bell, BellOff, Trash2, Link, Users,
  Crown, ShieldCheck,
} from "lucide-react";
import {
  useChatChannels, useAddChannelMembers, useRemoveChannelMember,
} from "@/hooks/api/useChat";
import type { Channel } from "@/hooks/api/useChat";
import { useWorkspaceMembers } from "@/hooks/api/useWorkspace";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMe } from "@/hooks/api/useMe";

// Deterministic colour per name
const COLORS = ["bg-violet-500","bg-blue-500","bg-emerald-500","bg-amber-500","bg-rose-500","bg-cyan-500"];
const avatarColor = (name: string) => COLORS[name.charCodeAt(0) % COLORS.length];

// Role badges (visual only — real roles would come from backend)
type Role = "owner" | "admin" | "member";
const roleMeta: Record<Role, { icon: React.ElementType; label: string; color: string }> = {
  owner:  { icon: Crown,       label: "Owner",  color: "text-amber-500" },
  admin:  { icon: ShieldCheck, label: "Admin",  color: "text-blue-500" },
  member: { icon: Users,       label: "Member", color: "text-muted-foreground" },
};
const getRole = (idx: number): Role =>
  idx === 0 ? "owner" : idx <= 2 ? "admin" : "member";

type InfoTab = "members" | "pinned" | "insights" | "settings";

interface Props { channel: Channel; }

// ── Mock pinned messages ────────────────────────────────────────────────────
const MOCK_PINS = [
  { id: "p1", author: "Ritik", content: "Real-time sync fix is the top priority this sprint.", time: "2h ago" },
  { id: "p2", author: "Priya", content: "API is stable on staging — ready for QA.", time: "Yesterday" },
];

// ── Mock channel insights ────────────────────────────────────────────────────
const MOCK_INSIGHTS = {
  totalMessages: 248,
  activeMembers: 4,
  peakHour: "10–11am",
  topContributors: ["Ritik", "Ankit", "Priya"],
  weeklyTrend: [12, 18, 24, 15, 30, 22, 19], // msgs per day Mon–Sun
};

export function GroupSettingsDialog({ channel }: Props) {
  const [open, setOpen]         = useState(false);
  const [activeTab, setActiveTab] = useState<InfoTab>("members");
  const [showAdd, setShowAdd]   = useState(false);
  const [muted, setMuted]       = useState(false);

  const { workspaceId }         = useWorkspace();
  const { data: me }            = useMe();
  const { data: wsMembers }     = useWorkspaceMembers(workspaceId ?? undefined);

  const addMembers    = useAddChannelMembers();
  const removeMember  = useRemoveChannelMember();

  const meId = (me as Record<string, any>)?.user?.id ?? (me as Record<string, any>)?.id;

  const availableToAdd = wsMembers?.filter(
    (wm) => !channel.members.some((cm) => cm.id === wm.user.id)
  ) ?? [];

  const handleRemove = (userId: string) => {
    if (!confirm("Remove this member?")) return;
    removeMember.mutate({ channelId: channel.id, userId });
  };

  const handleAdd = (userId: string) => {
    addMembers.mutate({ channelId: channel.id, member_ids: [userId] }, {
      onSuccess: () => setShowAdd(false),
    });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/join/${channel.id}`);
  };

  const TABS: { key: InfoTab; label: string; icon: React.ElementType }[] = [
    { key: "members",  label: "Members",  icon: Users },
    { key: "pinned",   label: "Pinned",   icon: Pin },
    { key: "insights", label: "Insights", icon: BarChart2 },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
          title="Channel info"
        >
          <Settings className="w-4 h-4" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Hero */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-primary/10 to-primary/5 border-b border-border shrink-0">
          <div className="flex items-center gap-4">
            <span className="h-14 w-14 rounded-2xl bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary shadow-sm">
              {(channel.name ?? "G").charAt(0).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-lg text-foreground">{channel.name ?? "Group"}</h2>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="text-xs text-muted-foreground">{channel.members.length} members</p>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-semibold">Group Channel</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex border-b border-border shrink-0 px-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── MEMBERS ───────────────────────────────────────────────────── */}
          {activeTab === "members" && (
            <div className="p-4 space-y-4">
              {/* Add member */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Members ({channel.members.length})</p>
                <Button variant="outline" size="sm" onClick={() => setShowAdd(!showAdd)}>
                  <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                  Add Members
                </Button>
              </div>

              {showAdd && availableToAdd.length > 0 && (
                <div className="border border-border rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground">Add from workspace</p>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {availableToAdd.map((wm) => {
                      const name = wm.user.name || wm.user.email;
                      return (
                        <div key={wm.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/40 border-b border-border last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarColor(name)}`}>
                              {name.charAt(0)}
                            </span>
                            <p className="text-sm font-medium">{name}</p>
                          </div>
                          <Button size="sm" variant="ghost" className="h-7 text-primary" onClick={() => handleAdd(wm.user.id)} disabled={addMembers.isPending}>
                            + Add
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Invite link */}
              <button
                onClick={copyInviteLink}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border hover:bg-muted/40 text-left transition-colors"
              >
                <Link className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Copy Invite Link</span>
              </button>

              {/* Member list */}
              <div className="space-y-1">
                {channel.members.map((member, idx) => {
                  const role = getRole(idx);
                  const RoleIcon = roleMeta[role].icon;
                  const isMe = member.id === meId;

                  return (
                    <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 group transition-colors">
                      <div className="relative shrink-0">
                        <span className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${avatarColor(member.name)}`}>
                          {member.name.charAt(0)}
                        </span>
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-background" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{member.name}</p>
                          {isMe && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">You</span>}
                        </div>
                        <div className={`flex items-center gap-1 ${roleMeta[role].color}`}>
                          <RoleIcon className="w-3 h-3" />
                          <span className="text-[11px] font-medium">{roleMeta[role].label}</span>
                        </div>
                      </div>
                      {!isMe && (
                        <button
                          onClick={() => handleRemove(member.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-destructive hover:bg-destructive/10 rounded-full transition-all"
                          title="Remove"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── PINNED MESSAGES ───────────────────────────────────────────── */}
          {activeTab === "pinned" && (
            <div className="p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Pinned Messages ({MOCK_PINS.length})</p>
              {MOCK_PINS.map((pin) => (
                <div key={pin.id} className="flex gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                  <Pin className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-primary">{pin.author}</p>
                      <p className="text-[11px] text-muted-foreground">{pin.time}</p>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{pin.content}</p>
                  </div>
                </div>
              ))}
              {MOCK_PINS.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Pin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No pinned messages yet. Hover a message and click 📌 to pin it.
                </div>
              )}
            </div>
          )}

          {/* ── INSIGHTS ──────────────────────────────────────────────────── */}
          {activeTab === "insights" && (
            <div className="p-4 space-y-4">
              <p className="text-sm font-semibold text-foreground">Channel Insights</p>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Total Messages", value: MOCK_INSIGHTS.totalMessages },
                  { label: "Active Members", value: MOCK_INSIGHTS.activeMembers },
                  { label: "Peak Hour",      value: MOCK_INSIGHTS.peakHour },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5 p-3 bg-muted/40 rounded-xl border border-border">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="text-base font-bold text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              {/* Weekly activity bar chart */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Weekly Activity</p>
                <div className="flex items-end gap-1 h-16">
                  {MOCK_INSIGHTS.weeklyTrend.map((v, i) => {
                    const max = Math.max(...MOCK_INSIGHTS.weeklyTrend);
                    const pct = (v / max) * 100;
                    const days = ["M", "T", "W", "T", "F", "S", "S"];
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t-sm bg-primary/60 transition-all"
                          style={{ height: `${pct}%` }}
                        />
                        <span className="text-[9px] text-muted-foreground">{days[i]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Top contributors */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Top Contributors</p>
                <div className="space-y-2">
                  {MOCK_INSIGHTS.topContributors.map((name, i) => {
                    const pct = 100 - i * 25;
                    return (
                      <div key={name} className="flex items-center gap-3">
                        <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${avatarColor(name)}`}>
                          {name.charAt(0)}
                        </span>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-0.5">
                            <span className="font-medium text-foreground">{name}</span>
                            <span className="text-muted-foreground">{pct}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS ──────────────────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="p-4 space-y-4">
              {/* Notification toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  {muted ? <BellOff className="w-4 h-4 text-muted-foreground" /> : <Bell className="w-4 h-4 text-primary" />}
                  <div>
                    <p className="text-sm font-semibold text-foreground">Notifications</p>
                    <p className="text-xs text-muted-foreground">{muted ? "Muted" : "Active"}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMuted((m) => !m)}
                  className={`w-10 h-6 rounded-full transition-colors ${muted ? "bg-muted" : "bg-primary"}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${muted ? "translate-x-0" : "translate-x-4"}`} />
                </button>
              </div>

              {/* Permissions section */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Permissions
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Who can send messages", value: "All members" },
                    { label: "Who can add members",   value: "Admins only" },
                    { label: "Who can pin messages",  value: "Admins only" },
                    { label: "Who can edit channel",  value: "Owner only" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-xs font-semibold text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger zone */}
              <div>
                <p className="text-xs font-bold text-destructive uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Danger Zone
                </p>
                <button className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors text-sm font-medium">
                  <Trash2 className="w-4 h-4" />
                  Delete Channel
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

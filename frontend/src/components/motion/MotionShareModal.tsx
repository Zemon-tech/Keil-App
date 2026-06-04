import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  Building2,
  Loader2,
  Lock,
  Link as LinkIcon,
  HelpCircle,
  Info,
  Search,
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { type Organisation } from "@/hooks/api/useOrganisations";
import { type Space } from "@/hooks/api/useSpaces";
import {
  useMotionPage,
  useMotionPageShares,
  useCreateMotionPageShare,
  useRevokeMotionPageShare,
  useUpdateMotionPageShare,
  type MotionPermission,
} from "@/hooks/api/useMotionPages";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import api from "@/lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MotionSharePanelProps {
  pageId: string;
  pageTitle: string;
  orgId: string;
  spaceId: string;
}

interface MockUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
}

// ─── Mock KeilHQ Users ────────────────────────────────────────────────────────

const MOCK_KEILHQ_USERS: MockUser[] = [
  { id: "u1", name: "Satyajit Jena", username: "satyajit", email: "jenasatyajit.sj@gmail.com", role: "member" },
  { id: "u2", name: "Shivang Kandoi", username: "shivang", email: "shivang.k006@gmail.com", role: "admin" },
  { id: "u3", name: "John Doe", username: "johndoe", email: "john.doe@keilhq.com", role: "member" },
  { id: "u4", name: "Alice Smith", username: "alice", email: "alice.smith@keilhq.com", role: "member" },
  { id: "u5", name: "Bob Johnson", username: "bobjohnson", email: "bob.johnson@keilhq.com", role: "member" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts a page title to a URL-friendly slug */
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

/** Builds the clean public URL: /motion/page-slug/pageId */
function buildPublicUrl(pageTitle: string, pageId: string): string {
  return `${window.location.origin}/motion/${toSlug(pageTitle)}/${pageId}`;
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    return name.charAt(0).toUpperCase();
  }
  return email.charAt(0).toUpperCase();
}

function getAvatarBg(input: string): string {
  const colors = [
    "bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20",
    "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20",
    "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20",
    "bg-violet-500/10 text-violet-500 dark:text-violet-400 border border-violet-500/20",
    "bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-500/20",
    "bg-pink-500/10 text-pink-500 dark:text-pink-400 border border-pink-500/20",
    "bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20",
    "bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20",
  ];
  let sum = 0;
  const str = input || "user";
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i);
  }
  return colors[sum % colors.length];
}

// ─── Browser Page Preview Component ───────────────────────────────────────────

function BrowserPagePreview({
  pageTitle,
  coverImage,
}: {
  pageTitle: string;
  coverImage: string | null;
}) {
  return (
    <div className="border border-border/80 rounded-xl overflow-hidden bg-background shadow-lg w-full font-sans select-none pointer-events-none">
      {/* Browser tab bar */}
      <div className="bg-muted/80 px-3 py-2.5 flex items-center gap-1.5 border-b border-border/60">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-destructive/80 shrink-0" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shrink-0" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shrink-0" />
        </div>
      </div>
      
      {/* Page preview content */}
      <div className="bg-background text-foreground flex flex-col min-h-[160px]">
        {/* Navigation Mock */}
        <div className="h-9 px-3 border-b border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-semibold bg-background">
          <span className="truncate max-w-[150px]">{pageTitle || "Untitled"}</span>
          <div className="flex items-center gap-2">
            <Search className="size-3 text-muted-foreground" />
            <span className="text-[12px] opacity-75 leading-none font-bold">•••</span>
            <span className="px-1.5 py-0.5 rounded border border-border bg-muted/50 text-[8px] font-bold text-foreground">
              Get KeilHQ free
            </span>
          </div>
        </div>
        
        {/* Page Cover Mock */}
        <div className="h-14 w-full bg-muted/40 overflow-hidden relative shrink-0">
          {coverImage ? (
            <img src={coverImage} alt="Cover preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-blue-500/5 to-indigo-500/5" />
          )}
        </div>
        
        {/* Page Header Mock */}
        <div className="p-3.5 space-y-2 flex-1">
          <h2 className="text-sm font-bold text-foreground truncate">{pageTitle || "Untitled"}</h2>
          <div className="space-y-1.5">
            <div className="h-1 bg-muted-foreground/15 rounded w-5/6" />
            <div className="h-1 bg-muted-foreground/15 rounded w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MotionSharePanel ─────────────────────────────────────────────────────────

export function MotionSharePanel({
  open,
  pageId,
  pageTitle,
  orgId,
  spaceId,
}: MotionSharePanelProps & { open: boolean }) {
  // Fetch detailed page context (covers, titles)
  const { data: pageDetail } = useMotionPage(orgId, spaceId, open ? pageId : null);
  
  const { data: shares = [], isLoading } = useMotionPageShares(
    orgId,
    spaceId,
    open ? pageId : null
  );

  const { organisations } = useAppContext();
  const { user } = useAuth();

  const createShare = useCreateMotionPageShare(orgId, spaceId, pageId);
  const revokeShare = useRevokeMotionPageShare(orgId, spaceId, pageId);
  const updateShare = useUpdateMotionPageShare(orgId, spaceId, pageId);

  const [activeTab, setActiveTab] = useState<"share" | "publish">("share");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{
    type: "org" | "user";
    id: string;
    name: string;
    email?: string;
    username?: string;
  } | null>(null);

  // Invited users local session state list
  const [invitedUsers, setInvitedUsers] = useState<any[]>([]);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const publicShares = shares.filter((s) => s.share_type === "public_link");
  const isPublicEnabled = publicShares.length > 0;
  const publicUrl = buildPublicUrl(pageTitle, pageId);

  // Close suggestions overlay when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleGeneralAccessChange = (val: string) => {
    if (val === "public") {
      createShare.mutate({ share_type: "public_link", permission: "view" });
      toast.success("Page sharing set to public link");
    } else {
      publicShares.forEach((s) => revokeShare.mutate(s.id));
      toast.success("Page sharing restricted to invited people");
    }
  };

  const handleSelectWorkspaceSuggestion = (org: Organisation) => {
    setSelectedTarget({
      type: "org",
      id: org.id,
      name: org.name,
    });
    setSearchQuery(org.name);
    setShowSuggestions(false);
  };

  const handleSelectUserSuggestion = (u: MockUser) => {
    setSelectedTarget({
      type: "user",
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username,
    });
    setSearchQuery(u.name);
    setShowSuggestions(false);
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = searchQuery.trim();
    if (!input) return;

    if (selectedTarget) {
      if (selectedTarget.type === "org") {
        // Share with workspace (share with the workspace's first space)
        try {
          const res = await api.get<{ data: { spaces: Space[] } }>(`v1/orgs/${selectedTarget.id}/spaces`);
          const targetSpace = res.data.data.spaces?.[0];
          if (targetSpace) {
            createShare.mutate({
              share_type: "space",
              permission: "view_all",
              target_org_id: selectedTarget.id,
              target_space_id: targetSpace.id,
            });
            toast.success(`Shared with workspace "${selectedTarget.name}" successfully`);
          } else {
            toast.error(`Workspace "${selectedTarget.name}" has no spaces to share with`);
          }
        } catch {
          toast.error("Failed to share with workspace");
        }
      } else {
        // Share with individual user
        const alreadyInvited = invitedUsers.some(u => u.email === selectedTarget.email);
        if (!alreadyInvited) {
          setInvitedUsers(prev => [
            ...prev,
            {
              id: selectedTarget.id,
              name: selectedTarget.name,
              email: selectedTarget.email!,
              username: selectedTarget.username!,
              permission: "view",
              role: "member",
            }
          ]);
          toast.success(`Shared with user "${selectedTarget.name}" successfully`);
        } else {
          toast.error("User is already invited");
        }
      }
    } else {
      // Freeform typing fallback
      const isEmail = input.includes("@");
      const matchedUser = MOCK_KEILHQ_USERS.find(
        u => u.email.toLowerCase() === input.toLowerCase() || u.username.toLowerCase() === input.toLowerCase()
      );

      if (matchedUser) {
        const alreadyInvited = invitedUsers.some(u => u.email === matchedUser.email);
        if (!alreadyInvited) {
          setInvitedUsers(prev => [
            ...prev,
            {
              id: matchedUser.id,
              name: matchedUser.name,
              email: matchedUser.email,
              username: matchedUser.username,
              permission: "view",
              role: "member",
            }
          ]);
          toast.success(`Shared with user "${matchedUser.name}" successfully`);
        } else {
          toast.error("User is already invited");
        }
      } else {
        // Invite as external guest email
        const newGuest = {
          id: `invited-${Date.now()}`,
          name: isEmail ? input.split("@")[0] : input,
          email: isEmail ? input : `${input}@keilhq.com`,
          username: isEmail ? input.split("@")[0] : input,
          permission: "view",
          role: "member",
        };
        setInvitedUsers(prev => [...prev, newGuest]);
        toast.success(`Shared with user "${newGuest.name}" successfully`);
      }
    }

    setSearchQuery("");
    setSelectedTarget(null);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(isPublicEnabled ? publicUrl : window.location.href);
    toast.success("Link copied to clipboard");
  };

  // Autocomplete Suggestions Matching
  const filteredOrgs = organisations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      org.id !== orgId &&
      searchQuery.trim() !== ""
  );

  const filteredUsers = MOCK_KEILHQ_USERS.filter(
    (u) =>
      (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
      u.email !== user?.email &&
      searchQuery.trim() !== ""
  );

  const currentUserName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Shivang Kandoi";
  const currentUserEmail = user?.email || "shivang.k006@gmail.com";

  return (
    <div className="w-[480px] bg-popover border border-border text-popover-foreground rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans transition-colors">
      {/* Tabs Header */}
      <div className="px-4 pt-3 flex flex-col shrink-0 bg-popover border-b border-border/40">
        <div className="flex gap-5 text-sm font-semibold relative">
          <button
            onClick={() => setActiveTab("share")}
            className={`pb-2.5 transition-colors relative focus:outline-none cursor-pointer ${
              activeTab === "share" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Share
            {activeTab === "share" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("publish")}
            className={`pb-2.5 transition-colors relative focus:outline-none cursor-pointer ${
              activeTab === "publish" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Publish
            {activeTab === "publish" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground rounded-full" />
            )}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 bg-popover">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="p-4 flex-1 flex flex-col min-h-0 space-y-4 bg-popover">
          {activeTab === "share" ? (
            <>
              {/* Autocomplete share invite input */}
              <div className="relative">
                <form onSubmit={handleShareSubmit} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Search workspaces or type email/username..."
                    value={searchQuery}
                    onFocus={() => setShowSuggestions(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                      if (selectedTarget && e.target.value !== selectedTarget.name) {
                        setSelectedTarget(null);
                      }
                    }}
                    className="flex-1 bg-background border border-input rounded-lg px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold px-4 cursor-pointer"
                  >
                    Share
                  </Button>
                </form>

                {/* Suggestions Overlay Dropdown */}
                {showSuggestions && searchQuery.trim() !== "" && (filteredOrgs.length > 0 || filteredUsers.length > 0) && (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-xl z-50 max-h-[220px] overflow-y-auto p-1 font-sans text-xs"
                  >
                    {filteredOrgs.length > 0 && (
                      <div className="p-1">
                        <div className="text-[10px] text-muted-foreground font-semibold px-2 py-1 uppercase tracking-wider">Workspaces</div>
                        {filteredOrgs.map((org) => (
                          <button
                            key={org.id}
                            type="button"
                            onMouseDown={() => handleSelectWorkspaceSuggestion(org)}
                            className="w-full text-left px-2 py-1.5 hover:bg-muted rounded-md flex items-center gap-2 cursor-pointer text-popover-foreground transition-colors font-medium"
                          >
                            <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{org.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {filteredUsers.length > 0 && (
                      <div className="p-1 border-t border-border/30 mt-1">
                        <div className="text-[10px] text-muted-foreground font-semibold px-2 py-1 uppercase tracking-wider">People</div>
                        {filteredUsers.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onMouseDown={() => handleSelectUserSuggestion(u)}
                            className="w-full text-left px-2 py-1.5 hover:bg-muted rounded-md flex items-center gap-2 cursor-pointer text-popover-foreground transition-colors"
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${getAvatarBg(u.email)}`}>
                              {getInitials(u.name, u.email)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold truncate text-foreground">{u.name} (@{u.username})</span>
                              <span className="text-[9px] text-muted-foreground truncate">{u.email}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Listings of Workspaces and Invited Users */}
              <div className="space-y-3.5 max-h-[190px] overflow-y-auto pr-0.5 custom-scrollbar">
                {/* Current User Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarBg(currentUserEmail)}`}>
                      {getInitials(currentUserName, currentUserEmail)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                        {currentUserName} <span className="text-muted-foreground font-normal">(You)</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">{currentUserEmail}</span>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground pr-2 select-none">Full access</span>
                </div>

                {/* Workspaces in which I am added */}
                {organisations.map((org) => {
                  const isActive = org.id === orgId;
                  const orgShare = shares.find((s) => s.target_org_id === org.id);
                  let accessValue = "none";
                  if (isActive) {
                    accessValue = "full";
                  } else if (orgShare) {
                    accessValue = orgShare.permission.startsWith("edit_") ? "edit" : "view";
                  }

                  const handleOrgAccessChange = async (val: string) => {
                    if (isActive) return;

                    if (val === "none" || val === "remove") {
                      if (orgShare) {
                        revokeShare.mutate(orgShare.id);
                        toast.success(`Removed workspace "${org.name}" access`);
                      }
                    } else {
                      const permission = (val === "edit" ? "edit_all" : "view_all") as MotionPermission;
                      if (orgShare) {
                        updateShare.mutate({ shareId: orgShare.id, permission });
                        toast.success(`Updated workspace "${org.name}" access to ${val === "edit" ? "edit" : "view"}`);
                      } else {
                        try {
                          const res = await api.get<{ data: { spaces: Space[] } }>(`v1/orgs/${org.id}/spaces`);
                          const targetSpace = res.data.data.spaces?.[0];
                          if (targetSpace) {
                            createShare.mutate({
                              share_type: "space",
                              permission,
                              target_org_id: org.id,
                              target_space_id: targetSpace.id,
                            });
                            toast.success(`Shared with workspace "${org.name}" successfully`);
                          } else {
                            toast.error(`Workspace "${org.name}" has no spaces to share with`);
                          }
                        } catch {
                          toast.error("Failed to share with workspace");
                        }
                      }
                    }
                  };

                  return (
                    <div key={org.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarBg(org.name)}`}>
                          {getInitials(org.name, "")}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">{org.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {isActive ? "Active workspace" : "Workspace"}
                          </span>
                        </div>
                      </div>

                      {isActive ? (
                        <span className="text-xs font-medium text-muted-foreground pr-2 select-none">Full access</span>
                      ) : (
                        <Select value={accessValue} onValueChange={handleOrgAccessChange}>
                          <SelectTrigger className="border-none bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1.5 h-auto text-xs gap-1 font-semibold transition-all cursor-pointer focus:ring-0 focus:ring-offset-0 focus-visible:outline-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border text-popover-foreground text-xs">
                            <SelectItem value="none">No access</SelectItem>
                            <SelectItem value="view">Can view</SelectItem>
                            <SelectItem value="edit">Can edit</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}

                {/* Invited Users list */}
                {invitedUsers.map((userItem) => (
                  <div key={userItem.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarBg(userItem.email)}`}>
                        {getInitials(userItem.name, userItem.email)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                          {userItem.name}
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide">
                            Guest
                          </span>
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">{userItem.email}</span>
                      </div>
                    </div>

                    <Select
                      value={userItem.permission}
                      onValueChange={(val) => {
                        if (val === "remove") {
                          setInvitedUsers(prev => prev.filter(u => u.id !== userItem.id));
                          toast.success(`Removed user "${userItem.name}" access`);
                        } else {
                          setInvitedUsers(prev => prev.map(u => u.id === userItem.id ? { ...u, permission: val } : u));
                          toast.success(`Updated user "${userItem.name}" access to ${val}`);
                        }
                      }}
                    >
                      <SelectTrigger className="border-none bg-transparent hover:bg-muted text-muted-foreground hover:text-foreground px-2.5 py-1.5 h-auto text-xs gap-1 font-semibold transition-all cursor-pointer focus:ring-0 focus:ring-offset-0 focus-visible:outline-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground text-xs">
                        <SelectItem value="view">Can view</SelectItem>
                        <SelectItem value="edit">Can edit</SelectItem>
                        <SelectItem value="remove" className="text-red-400 focus:text-red-400">Remove access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* General Access */}
              <div className="space-y-2 pt-2 border-t border-border/80 bg-popover">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-0.5">General access</span>
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border/40">
                    {isPublicEnabled ? <Globe className="size-4" /> : <Lock className="size-4" />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <Select
                      value={isPublicEnabled ? "public" : "invited"}
                      onValueChange={handleGeneralAccessChange}
                    >
                      <SelectTrigger className="border-none p-0 bg-transparent hover:bg-muted/40 text-foreground h-auto text-xs gap-1 font-semibold transition-all cursor-pointer focus:ring-0 focus:ring-offset-0 focus-visible:outline-none max-w-fit">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground text-xs">
                        <SelectItem value="invited">Only people invited</SelectItem>
                        <SelectItem value="public">Anyone with the link</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {isPublicEnabled ? "Anyone on the internet with this link can view" : "Only people added can open with this link"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-border/80 flex items-center justify-between shrink-0 bg-popover">
                <a
                  href="https://google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors font-medium"
                >
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                  Learn about sharing
                </a>
                <Button
                  onClick={handleCopyLink}
                  className="h-8 border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold px-4 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <LinkIcon className="size-3.5" />
                  Copy link
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Publish to Web Tab (Redesigned like Notion Publish) */}
              <div className="flex flex-col items-center text-center space-y-4 pt-1 flex-1">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Publish to web</h3>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                    Create a website with KeilHQ
                    <HelpCircle className="size-3 text-muted-foreground/60 cursor-help" />
                  </p>
                </div>

                {/* Page Preview Component */}
                <div className="w-[380px]">
                  <BrowserPagePreview
                    pageTitle={pageDetail?.title || pageTitle}
                    coverImage={pageDetail?.cover_image || null}
                  />
                </div>

                {/* Publish Action Button */}
                <div className="w-[380px] space-y-3">
                  <Button
                    onClick={() => handleGeneralAccessChange(isPublicEnabled ? "invited" : "public")}
                    className={`w-full py-2 h-9 rounded-lg font-semibold text-xs cursor-pointer shadow-sm transition-all ${
                      isPublicEnabled
                        ? "bg-muted border border-border text-foreground hover:bg-muted/80"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {createShare.isPending || revokeShare.isPending ? (
                      <Loader2 className="size-3.5 animate-spin mx-auto text-current" />
                    ) : isPublicEnabled ? (
                      "Unpublish"
                    ) : (
                      "Publish"
                    )}
                  </Button>

                  {/* Public Link Display when Published */}
                  {isPublicEnabled && (
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-left space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-mono text-muted-foreground truncate flex-1">
                          {publicUrl}
                        </p>
                        <Button
                          onClick={handleCopyLink}
                          size="sm"
                          className="h-7 text-[9px] bg-background hover:bg-muted text-foreground border border-border px-2.5 font-semibold shrink-0 cursor-pointer"
                        >
                          Copy Link
                        </Button>
                      </div>
                      {publicShares[0]?.created_at && (
                        <p className="text-[8.5px] text-muted-foreground/70">
                          Published {formatDistanceToNow(new Date(publicShares[0].created_at), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Notice */}
                <div className="w-full text-[11px] text-muted-foreground leading-relaxed flex gap-2.5 items-start bg-muted/40 p-3 rounded-lg border border-border/30 text-left">
                  <Info className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span>
                    When published to web, anyone with the link can view this page's content and see contributor names and emails.
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── MotionShareModal (kept for backward compatibility) ───────────────────────
export { MotionSharePanel as MotionShareModal };

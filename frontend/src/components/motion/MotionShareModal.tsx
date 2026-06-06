import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Globe,
  Building2,
  Loader2,
  Lock,
  Link as LinkIcon,
  HelpCircle,
  Info,
  Search,
  Check,
  Trash2,
  ArrowLeft,
  ChevronDown,
  Users,
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
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
import { cn } from "@/lib/utils";

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

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "untitled";
}

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

function formatGuestName(input: string): string {
  const parts = input.split(/[._-]/);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

// ─── SVGs for Brand Logos ─────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function SlackLogo() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zM6.302 15.165a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H8.822a2.528 2.528 0 0 1-2.52-2.52v-5.043z" fill="#e01e5a"/>
      <path d="M8.822 5.043a2.528 2.528 0 0 1-2.52-2.52A2.528 2.528 0 0 1 8.822 0a2.528 2.528 0 0 1 2.52 2.522v2.52h-2.52zM8.822 6.302a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.522H3.778a2.528 2.528 0 0 1-2.522-2.522V8.822a2.528 2.528 0 0 1 2.522-2.52h5.043z" fill="#36c5f0"/>
      <path d="M18.958 8.822a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52 2.528 2.528 0 0 1-2.522 2.52h-2.52v-2.52zM17.698 8.822a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.522-2.52V3.778a2.528 2.528 0 0 1 2.522-2.522h5.043a2.528 2.528 0 0 1 2.52 2.522v5.044z" fill="#2eb67d"/>
      <path d="M15.178 18.958a2.528 2.528 0 0 1 2.52 2.52 2.528 2.528 0 0 1-2.52 2.522 2.528 2.528 0 0 1-2.522-2.522v-2.52h2.52zM15.178 17.698a2.528 2.528 0 0 1-2.52-2.52v-5.043a2.528 2.528 0 0 1 2.52-2.522h5.044a2.528 2.528 0 0 1 2.522 2.522v5.043a2.528 2.528 0 0 1-2.522 2.52h-5.044z" fill="#ecb22e"/>
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg className="size-3.5 shrink-0" viewBox="0 0 23 23" fill="none">
      <path d="M0 0h11v11H0z" fill="#f25022"/>
      <path d="M12 0h11v11H12z" fill="#7fba00"/>
      <path d="M0 12h11v11H0z" fill="#00a4ef"/>
      <path d="M12 12h11v11H12z" fill="#ffb900"/>
    </svg>
  );
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

// ─── Custom Notion-Style Role Selector Dropdown ───────────────────────────────

interface RolePopoverProps {
  value: "full" | "edit" | "comment" | "view";
  onValueChange: (val: "full" | "edit" | "comment" | "view" | "remove") => void;
  spaceName?: string;
  isOwner?: boolean;
}

function RolePopover({ value, onValueChange, spaceName, isOwner }: RolePopoverProps) {
  const [open, setOpen] = useState(false);

  const getLabel = (val: string) => {
    if (val === "full") return "Full access";
    if (val === "edit") return "Can edit";
    if (val === "comment") return "Can comment";
    return "Can view";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto text-xs gap-1 font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:ring-0 focus-visible:ring-0 cursor-pointer pr-1"
        >
          {getLabel(value)}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[260px] p-1 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl"
      >
        <div className="flex flex-col text-xs font-sans text-foreground">
          {/* Current Access */}
          <div className="px-2.5 py-1.5 text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
            Current access
          </div>
          <div className="px-2.5 pb-2 text-xs font-medium text-foreground flex items-center justify-between">
            <span>{getLabel(value)}</span>
            <span className="text-[9px] text-muted-foreground font-normal">
              {spaceName ? `via space access on ${spaceName}` : "direct access"}
            </span>
          </div>

          <div className="h-px bg-border/60 my-1" />

          {/* User Access */}
          <div className="px-2.5 py-1.5 text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
            User access
          </div>

          {/* Options */}
          {[
            { key: "full", label: "Full access", desc: "Edit, suggest, comment, and share" },
            { key: "edit", label: "Can edit", desc: "Edit, suggest, and comment", badge: "Plus" },
            { key: "comment", label: "Can comment", desc: "Suggest and comment" },
            { key: "view", label: "Can view", desc: "View only" }
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onValueChange(opt.key as any);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-2.5 py-2 rounded hover:bg-muted flex items-start gap-2 cursor-pointer transition-colors",
                value === opt.key && "bg-muted/40 font-semibold"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{opt.label}</span>
                  {opt.badge && (
                    <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[8px] font-extrabold px-1 py-0.5 rounded flex items-center gap-0.5 uppercase tracking-wide">
                      ↑ {opt.badge}
                    </span>
                  )}
                </div>
                {opt.desc && (
                  <div className="text-[9px] text-muted-foreground mt-0.5 leading-normal font-normal break-words">
                    {opt.desc}
                  </div>
                )}
              </div>
              {value === opt.key && (
                <Check className="size-3.5 text-foreground shrink-0 mt-0.5" />
              )}
            </button>
          ))}

          {/* Remove option */}
          {!isOwner && (
            <>
              <div className="h-px bg-border/60 my-1" />
              <button
                onClick={() => {
                  onValueChange("remove");
                  setOpen(false);
                }}
                className="w-full text-left px-2.5 py-2.5 rounded hover:bg-red-500/10 text-red-500 dark:text-red-400 flex items-center gap-2 cursor-pointer transition-colors font-semibold"
              >
                <Trash2 className="size-3.5 shrink-0" />
                <span>Remove access</span>
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
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
  // Fetch detailed page context
  const { data: pageDetail } = useMotionPage(orgId, spaceId, open ? pageId : null);

  const { data: shares = [], isLoading } = useMotionPageShares(
    orgId,
    spaceId,
    open ? pageId : null
  );

  const { organisations, spaces } = useAppContext();
  const { user } = useAuth();

  const createShare = useCreateMotionPageShare(orgId, spaceId, pageId);
  const revokeShare = useRevokeMotionPageShare(orgId, spaceId, pageId);
  const updateShare = useUpdateMotionPageShare(orgId, spaceId, pageId);

  const [activeTab, setActiveTab] = useState<"share" | "publish">("share");
  
  // Search View states
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  // Contact Import popover states
  const [importPopoverOpen, setImportPopoverOpen] = useState(false);
  const [importedSource, setImportedSource] = useState<"Slack" | "Google" | "Microsoft" | "None">("None");

  // Invited users local session state list
  const [invitedUsers, setInvitedUsers] = useState<any[]>([]);

  const publicShares = shares.filter((s) => s.share_type === "public_link");
  const isPublicEnabled = publicShares.length > 0;
  const publicUrl = buildPublicUrl(pageTitle, pageId);

  const [orgSpaces, setOrgSpaces] = useState<Record<string, Space[]>>({});
  const spaceShares = shares.filter((s) => s.share_type === "space" && s.target_org_id && s.target_space_id);

  // Active space object and name
  const activeSpaceObj = spaces.find((s) => s.id === spaceId);
  const activeSpaceName = activeSpaceObj?.name || "General";

  // Active space share (toggled via "Everyone in [SpaceName] space")
  const activeSpaceShare = shares.find(
    (s) => s.share_type === "space" && s.target_space_id === spaceId
  );
  const isSpaceShared = !!activeSpaceShare;

  // Cache all spaces for autocomplete suggestions (across all orgs)
  const [allSpaces, setAllSpaces] = useState<{ space: Space; orgName: string }[]>([]);

  useEffect(() => {
    const fetchAllSpaces = async () => {
      const results: { space: Space; orgName: string }[] = [];
      for (const org of organisations) {
        try {
          const res = await api.get<{ data: { spaces: Space[] } }>(`v1/orgs/${org.id}/spaces`);
          const spacesList = res.data.data.spaces || [];
          spacesList.forEach((s) => {
            // Include active space in general list so we can lookup names, but we filter suggestions later
            results.push({ space: s, orgName: org.name });
          });
        } catch (err) {
          console.error("Failed to load spaces for org", org.id, err);
        }
      }
      setAllSpaces(results);
    };

    if (open && organisations.length > 0) {
      fetchAllSpaces();
    }
  }, [organisations, open, orgId, spaceId]);

  useEffect(() => {
    const fetchSharedSpaces = async () => {
      const sharedOrgIds = shares
        .filter((s) => s.share_type === "space" && s.target_org_id)
        .map((s) => s.target_org_id!);
      
      const uniqueOrgIds = Array.from(new Set(sharedOrgIds));
      
      for (const targetId of uniqueOrgIds) {
        if (!orgSpaces[targetId]) {
          try {
            const res = await api.get<{ data: { spaces: Space[] } }>(`v1/orgs/${targetId}/spaces`);
            setOrgSpaces((prev) => ({
              ...prev,
              [targetId]: res.data.data.spaces || [],
            }));
          } catch (err) {
            console.error("Failed to fetch spaces for org", targetId, err);
          }
        }
      }
    };

    if (open && shares.length > 0) {
      fetchSharedSpaces();
    }
  }, [shares, open]);

  const handleGeneralAccessChange = (val: "invited" | "space" | "public") => {
    if (val === "public") {
      // Revoke space access if active
      if (activeSpaceShare) {
        revokeShare.mutate(activeSpaceShare.id);
      }
      // Create public share
      if (!isPublicEnabled) {
        createShare.mutate({ share_type: "public_link", permission: "view" });
        toast.success("Page sharing set to public link");
      }
    } else if (val === "space") {
      // Revoke public links
      publicShares.forEach((s) => revokeShare.mutate(s.id));
      // Create space share
      if (!isSpaceShared) {
        createShare.mutate({
          share_type: "space",
          permission: "view_all",
          target_org_id: orgId,
          target_space_id: spaceId,
        });
        toast.success(`Page shared with everyone in ${activeSpaceName} space`);
      }
    } else {
      // Restricted / invited only
      publicShares.forEach((s) => revokeShare.mutate(s.id));
      if (activeSpaceShare) {
        revokeShare.mutate(activeSpaceShare.id);
      }
      toast.success("Page sharing restricted to invited people");
    }
  };

  // Suggestions filter matching logic
  // Exclude current space of current page from search suggestions since it's managed via General Access
  const filteredSpaces = allSpaces.filter(
    ({ space }) =>
      !(space.org_id === orgId && space.id === spaceId) &&
      (searchQuery.trim() === "" ||
        space.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredUsers = MOCK_KEILHQ_USERS.filter(
    (u) =>
      u.email !== user?.email &&
      (searchQuery.trim() === "" ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Suggestions toggling
  const toggleSuggestion = (key: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleShareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedSuggestions.size > 0) {
      selectedSuggestions.forEach((itemKey) => {
        if (itemKey.startsWith("space-")) {
          const sId = itemKey.replace("space-", "");
          const matchedSpace = allSpaces.find((s) => s.space.id === sId);
          if (matchedSpace) {
            createShare.mutate({
              share_type: "space",
              permission: "view_all",
              target_org_id: matchedSpace.space.org_id,
              target_space_id: matchedSpace.space.id,
            });
            toast.success(`Shared with space "${matchedSpace.space.name}" successfully`);
          }
        } else if (itemKey.startsWith("user-")) {
          const uId = itemKey.replace("user-", "");
          const matchedUser = MOCK_KEILHQ_USERS.find((u) => u.id === uId);
          if (matchedUser) {
            const alreadyInvited = invitedUsers.some((u) => u.email === matchedUser.email);
            if (!alreadyInvited) {
              setInvitedUsers((prev) => [
                ...prev,
                {
                  id: matchedUser.id,
                  name: matchedUser.name,
                  email: matchedUser.email,
                  username: matchedUser.username,
                  permission: "view",
                  role: "member",
                },
              ]);
              toast.success(`Shared with user "${matchedUser.name}" successfully`);
            }
          }
        }
      });
      setSelectedSuggestions(new Set());
      setSearchQuery("");
      setIsSearching(false);
    } else {
      const input = searchQuery.trim();
      if (!input) return;

      const isEmail = input.includes("@");
      const matchedSpace = allSpaces.find(
        ({ space }) => space.name.toLowerCase() === input.toLowerCase()
      );

      if (matchedSpace) {
        createShare.mutate({
          share_type: "space",
          permission: "view_all",
          target_org_id: matchedSpace.space.org_id,
          target_space_id: matchedSpace.space.id,
        });
        toast.success(`Shared with space "${matchedSpace.space.name}" successfully`);
      } else {
        const matchedUser = MOCK_KEILHQ_USERS.find(
          (u) =>
            u.email.toLowerCase() === input.toLowerCase() ||
            u.username.toLowerCase() === input.toLowerCase()
        );

        if (matchedUser) {
          const alreadyInvited = invitedUsers.some((u) => u.email === matchedUser.email);
          if (!alreadyInvited) {
            setInvitedUsers((prev) => [
              ...prev,
              {
                id: matchedUser.id,
                name: matchedUser.name,
                email: matchedUser.email,
                username: matchedUser.username,
                permission: "view",
                role: "member",
              },
            ]);
            toast.success(`Shared with user "${matchedUser.name}" successfully`);
          } else {
            toast.error("User is already invited");
          }
        } else {
          const guestName = isEmail ? formatGuestName(input.split("@")[0]) : formatGuestName(input);
          const newGuest = {
            id: `invited-${Date.now()}`,
            name: guestName,
            email: isEmail ? input : `${input}@keilhq.com`,
            username: isEmail ? input.split("@")[0] : input,
            permission: "view",
            role: "member",
          };
          setInvitedUsers((prev) => [...prev, newGuest]);
          toast.success(`Shared with user "${newGuest.name}" successfully`);
        }
      }
      setSearchQuery("");
      setIsSearching(false);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(isPublicEnabled ? publicUrl : window.location.href);
    toast.success("Link copied to clipboard");
  };

  const currentUserName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Shivang Kandoi";
  const currentUserEmail = user?.email || "shivang.k006@gmail.com";

  // General Access State Option
  const generalAccessVal = isPublicEnabled ? "public" : isSpaceShared ? "space" : "invited";

  return (
    <div className="w-[480px] h-[440px] bg-popover border border-border text-popover-foreground rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans transition-all duration-200">
      {/* Dynamic Header */}
      <div className="px-4 py-3.5 flex items-center justify-between shrink-0 bg-popover border-b border-border/40 min-h-[50px]">
        {isSearching ? (
          <button
            onClick={() => {
              setIsSearching(false);
              setSearchQuery("");
              setSelectedSuggestions(new Set());
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-bold cursor-pointer"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Share
          </button>
        ) : (
          <div className="flex gap-5 text-sm font-semibold relative w-full">
            <button
              onClick={() => setActiveTab("share")}
              className={cn(
                "pb-1 transition-colors relative focus:outline-none cursor-pointer",
                activeTab === "share" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Share
              {activeTab === "share" && (
                <span className="absolute bottom-[-14px] left-0 right-0 h-0.5 bg-foreground rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("publish")}
              className={cn(
                "pb-1 transition-colors relative focus:outline-none cursor-pointer",
                activeTab === "publish" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Publish
              {activeTab === "publish" && (
                <span className="absolute bottom-[-14px] left-0 right-0 h-0.5 bg-foreground rounded-full" />
              )}
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 bg-popover">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="p-4 flex-1 flex flex-col min-h-0 bg-popover">
          {isSearching ? (
            /* ─── Search View Mode ─── */
            <div className="space-y-4 flex flex-col flex-1 min-h-0">
              <form onSubmit={handleShareSubmit} className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Email or group, separated by commas"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-colors shadow-inner"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold px-4 cursor-pointer"
                >
                  Share
                </Button>
              </form>

              {/* Import contacts Section */}
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-lg bg-muted flex items-center justify-center border border-border/50 shrink-0">
                    <div className="flex items-center gap-0.5 -space-x-1">
                      <div className="z-10 rounded-full border border-background bg-background overflow-hidden p-0.5">
                        <GoogleLogo />
                      </div>
                      <div className="z-20 rounded-full border border-background bg-background overflow-hidden p-0.5">
                        <SlackLogo />
                      </div>
                      <div className="z-30 rounded-full border border-background bg-background overflow-hidden p-0.5">
                        <MicrosoftLogo />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-foreground">Import contacts</span>
                    <span className="text-[10px] text-muted-foreground leading-normal">
                      Add contacts from Google, Slack, or Microsoft
                    </span>
                  </div>
                </div>

                <Popover open={importPopoverOpen} onOpenChange={setImportPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto text-xs text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/80 rounded-md px-2.5 py-1.5 font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {importedSource === "None" ? "None" : importedSource}
                      <ChevronDown className="size-3.5 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    sideOffset={6}
                    className="w-[180px] p-1 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl"
                  >
                    <div className="flex flex-col text-xs font-sans">
                      <div className="px-2.5 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        Import from
                      </div>
                      {[
                        { name: "Slack", icon: <SlackLogo /> },
                        { name: "Google", icon: <GoogleLogo /> },
                        { name: "Microsoft", icon: <MicrosoftLogo /> }
                      ].map((item) => (
                        <button
                          key={item.name}
                          onClick={() => {
                            setImportedSource(item.name as any);
                            setImportPopoverOpen(false);
                            toast.success(`Importing contacts from ${item.name} coming soon!`);
                          }}
                          className="w-full text-left px-2.5 py-2 hover:bg-muted rounded flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          {item.icon}
                          <span className="font-semibold text-foreground">{item.name}</span>
                        </button>
                      ))}
                      <div className="h-px bg-border/60 my-1" />
                      <a
                        href="https://google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-2 hover:bg-muted rounded flex items-center gap-1.5 text-muted-foreground hover:text-foreground font-semibold"
                      >
                        <HelpCircle className="size-3.5 shrink-0" />
                        <span>Learn more</span>
                      </a>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Suggestions Container */}
              <div className="flex-1 overflow-y-auto min-h-0 pr-0.5 custom-scrollbar space-y-4">
                <div>
                  <div className="text-[10px] text-muted-foreground font-bold px-1.5 py-1 uppercase tracking-wider">
                    Suggested
                  </div>

                  <div className="mt-1 space-y-1">
                    {/* Spaces Suggestions */}
                    {filteredSpaces.map(({ space, orgName }) => {
                      const itemKey = `space-${space.id}`;
                      const isSelected = selectedSuggestions.has(itemKey);
                      return (
                        <div
                          key={space.id}
                          onClick={() => toggleSuggestion(itemKey)}
                          className="w-full text-left px-2.5 py-2 hover:bg-muted rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded-md flex items-center justify-center shrink-0">
                              <Building2 className="size-3.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-foreground truncate">{space.name}</span>
                              <span className="text-[9px] text-muted-foreground truncate">
                                Space in {orgName}
                              </span>
                            </div>
                          </div>

                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0",
                              isSelected
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-border"
                            )}
                          >
                            {isSelected && <Check className="size-2.5 stroke-[3.5]" />}
                          </div>
                        </div>
                      );
                    })}

                    {/* Users Suggestions */}
                    {filteredUsers.map((u) => {
                      const itemKey = `user-${u.id}`;
                      const isSelected = selectedSuggestions.has(itemKey);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleSuggestion(itemKey)}
                          className="w-full text-left px-2.5 py-2 hover:bg-muted rounded-lg flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                              getAvatarBg(u.email)
                            )}>
                              {getInitials(u.name, u.email)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground truncate">{u.name}</span>
                                <span className="bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider scale-95 shrink-0">
                                  Guest
                                </span>
                              </div>
                              <span className="text-[9px] text-muted-foreground truncate">
                                {u.email}
                              </span>
                            </div>
                          </div>

                          <div
                            className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0",
                              isSelected
                                ? "bg-blue-600 border-blue-600 text-white"
                                : "border-border"
                            )}
                          >
                            {isSelected && <Check className="size-2.5 stroke-[3.5]" />}
                          </div>
                        </div>
                      );
                    })}

                    {filteredSpaces.length === 0 && filteredUsers.length === 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground">
                        No results found
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === "share" ? (
            /* ─── Share Tab Mode ─── */
            <>
              {/* Trigger Input box */}
              <div
                onClick={() => setIsSearching(true)}
                className="bg-background border border-input rounded-lg px-3 py-2 text-xs text-muted-foreground hover:border-muted-foreground/45 transition-colors cursor-text shadow-sm flex items-center"
              >
                Search spaces or type email/username...
              </div>

              {/* Shared List */}
              <div className="space-y-3.5 overflow-y-auto pr-0.5 custom-scrollbar flex-1 min-h-0 mt-4">
                {/* Current User Owner Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                      getAvatarBg(currentUserEmail)
                    )}>
                      {getInitials(currentUserName, currentUserEmail)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                        {currentUserName} <span className="text-muted-foreground font-normal">(You)</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">{currentUserEmail}</span>
                    </div>
                  </div>
                  <RolePopover
                    value="full"
                    onValueChange={() => {}}
                    isOwner={true}
                  />
                </div>

                {/* Shared Spaces */}
                {spaceShares.map((share) => {
                  const org = organisations.find((o) => o.id === share.target_org_id);
                  const spacesList = share.target_org_id ? orgSpaces[share.target_org_id] : [];
                  const space = spacesList?.find((s) => s.id === share.target_space_id);

                  const spaceName = space?.name || "General";
                  const orgName = org?.name || "Workspace";
                  const accessValue = share.permission.startsWith("edit_") ? "edit" : "view";

                  const handleAccessChange = (val: string) => {
                    if (val === "remove") {
                      revokeShare.mutate(share.id);
                      toast.success(`Removed space "${spaceName}" access`);
                    } else {
                      const permission = (val === "edit" ? "edit_all" : "view_all") as MotionPermission;
                      updateShare.mutate({ shareId: share.id, permission });
                      toast.success(`Updated space "${spaceName}" access to ${val}`);
                    }
                  };

                  return (
                    <div key={share.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                          getAvatarBg(spaceName)
                        )}>
                          {getInitials(spaceName, "")}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-foreground truncate">{spaceName}</span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            Space in {orgName}
                          </span>
                        </div>
                      </div>

                      <RolePopover
                        value={accessValue}
                        onValueChange={handleAccessChange as any}
                        spaceName={spaceName}
                      />
                    </div>
                  );
                })}

                {/* Invited Users (Guests) */}
                {invitedUsers.map((userItem) => (
                  <div key={userItem.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                        getAvatarBg(userItem.email)
                      )}>
                        {getInitials(userItem.name, userItem.email)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                          {userItem.name}
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide shrink-0">
                            Guest
                          </span>
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">{userItem.email}</span>
                      </div>
                    </div>

                    <RolePopover
                      value={userItem.permission}
                      onValueChange={(val) => {
                        if (val === "remove") {
                          setInvitedUsers((prev) => prev.filter((u) => u.id !== userItem.id));
                          toast.success(`Removed user "${userItem.name}" access`);
                        } else {
                          setInvitedUsers((prev) =>
                            prev.map((u) => (u.id === userItem.id ? { ...u, permission: val } : u))
                          );
                          toast.success(`Updated user "${userItem.name}" access to ${val}`);
                        }
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* General Access Section */}
              <div className="space-y-2 pt-2.5 border-t border-border/80 bg-popover mt-4">
                <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider pl-0.5">
                  General access
                </span>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border/40">
                      {generalAccessVal === "public" ? (
                        <Globe className="size-4 text-foreground" />
                      ) : generalAccessVal === "space" ? (
                        <Users className="size-4 text-foreground" />
                      ) : (
                        <Lock className="size-4 text-foreground" />
                      )}
                    </div>

                    <div className="flex flex-col text-left">
                      <span className="text-xs font-semibold text-foreground">
                        {generalAccessVal === "public"
                          ? "Anyone on the web with link"
                          : generalAccessVal === "space"
                          ? `Everyone in ${activeSpaceName} space`
                          : "Only people invited"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {generalAccessVal === "public"
                          ? "Anyone with the link can view"
                          : generalAccessVal === "space"
                          ? "Members of this space can access"
                          : "Only invited members have access"}
                      </span>
                    </div>
                  </div>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors rounded-md pr-1 font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <ChevronDown className="size-3.5 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      sideOffset={6}
                      className="w-[280px] p-1 bg-popover border border-border text-popover-foreground rounded-lg shadow-xl"
                    >
                      <div className="flex flex-col text-xs font-sans">
                        <button
                          onClick={() => handleGeneralAccessChange("invited")}
                          className={cn(
                            "w-full text-left px-2.5 py-2.5 hover:bg-muted rounded flex items-center gap-3 cursor-pointer transition-colors",
                            generalAccessVal === "invited" && "bg-muted/40 font-semibold"
                          )}
                        >
                          <Lock className="size-4 text-muted-foreground shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground">Only people invited</span>
                            <span className="text-[9px] text-muted-foreground font-normal mt-0.5">
                              Restrict access to explicit invitations
                            </span>
                          </div>
                          {generalAccessVal === "invited" && (
                            <Check className="size-3.5 text-foreground shrink-0 ml-auto" />
                          )}
                        </button>

                        <button
                          onClick={() => handleGeneralAccessChange("space")}
                          className={cn(
                            "w-full text-left px-2.5 py-2.5 hover:bg-muted rounded flex items-center gap-3 cursor-pointer transition-colors",
                            generalAccessVal === "space" && "bg-muted/40 font-semibold"
                          )}
                        >
                          <Users className="size-4 text-muted-foreground shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground">
                              Everyone in {activeSpaceName} space
                            </span>
                            <span className="text-[9px] text-muted-foreground font-normal mt-0.5">
                              Allow members of {activeSpaceName} to access
                            </span>
                          </div>
                          {generalAccessVal === "space" && (
                            <Check className="size-3.5 text-foreground shrink-0 ml-auto" />
                          )}
                        </button>

                        <button
                          onClick={() => handleGeneralAccessChange("public")}
                          className={cn(
                            "w-full text-left px-2.5 py-2.5 hover:bg-muted rounded flex items-center gap-3 cursor-pointer transition-colors",
                            generalAccessVal === "public" && "bg-muted/40 font-semibold"
                          )}
                        >
                          <Globe className="size-4 text-muted-foreground shrink-0" />
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-foreground">Anyone on the web with link</span>
                            <span className="text-[9px] text-muted-foreground font-normal mt-0.5">
                              Publish to web so anyone can view
                            </span>
                          </div>
                          {generalAccessVal === "public" && (
                            <Check className="size-3.5 text-foreground shrink-0 ml-auto" />
                          )}
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-border/80 flex items-center justify-between shrink-0 bg-popover mt-4">
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
            /* ─── Publish Tab Mode ─── */
            <>
              <div className="flex flex-col items-center text-center space-y-4 pt-1 flex-1 overflow-y-auto pr-0.5 custom-scrollbar min-h-0">
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
                    className={cn(
                      "w-full py-2 h-9 rounded-lg font-semibold text-xs cursor-pointer shadow-sm transition-all",
                      isPublicEnabled
                        ? "bg-muted border border-border text-foreground hover:bg-muted/80"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    )}
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

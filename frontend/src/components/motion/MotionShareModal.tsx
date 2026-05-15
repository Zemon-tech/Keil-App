import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Link2,
  Copy,
  Check,
  Trash2,
  Globe,
  Building2,
  Loader2,
  X,
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { useSpaces } from "@/hooks/api/useSpaces";
import {
  useMotionPageShares,
  useCreateMotionPageShare,
  useRevokeMotionPageShare,
  type MotionPageShareDTO,
  type MotionPermission,
} from "@/hooks/api/useMotionPages";
import { formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MotionShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  pageTitle: string;
  orgId: string;
  spaceId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPublicUrl(token: string): string {
  return `${window.location.origin}/notes/public/${token}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 text-xs shrink-0"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <Check className="size-3" />
          Copied
        </>
      ) : (
        <>
          <Copy className="size-3" />
          Copy link
        </>
      )}
    </Button>
  );
}

// ─── PublicLinkSection ────────────────────────────────────────────────────────

function PublicLinkSection({
  shares,
  pageId,
  orgId,
  spaceId,
}: {
  shares: MotionPageShareDTO[];
  pageId: string;
  orgId: string;
  spaceId: string;
}) {
  const publicShares = shares.filter((s) => s.share_type === "public_link");
  const createShare = useCreateMotionPageShare(orgId, spaceId, pageId);
  const revokeShare = useRevokeMotionPageShare(orgId, spaceId, pageId);
  const [permission, setPermission] = useState<MotionPermission>("view");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="size-4 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Public link</p>
          <p className="text-xs text-muted-foreground">
            Anyone with the link can access this page
          </p>
        </div>
      </div>

      {publicShares.length === 0 ? (
        <div className="flex items-center gap-2 pl-6">
          <Select
            value={permission}
            onValueChange={(v) => setPermission(v as MotionPermission)}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view">Can view</SelectItem>
              <SelectItem value="edit">Can edit</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            disabled={createShare.isPending}
            onClick={() =>
              createShare.mutate({ share_type: "public_link", permission })
            }
          >
            {createShare.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Link2 className="size-3" />
            )}
            Create link
          </Button>
        </div>
      ) : (
        <div className="space-y-2 pl-6">
          {publicShares.map((share) => (
            <div
              key={share.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-muted-foreground truncate">
                  {buildPublicUrl(share.share_token!)}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                  {share.permission === "edit" ? "Can edit" : "Can view"} ·
                  Created{" "}
                  {formatDistanceToNow(new Date(share.created_at), {
                    addSuffix: true,
                  })}
                  {share.expires_at && (
                    <span className="text-amber-500/80">
                      {" "}
                      · Expires{" "}
                      {formatDistanceToNow(new Date(share.expires_at), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </p>
              </div>
              <CopyButton text={buildPublicUrl(share.share_token!)} />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                disabled={revokeShare.isPending}
                onClick={() => revokeShare.mutate(share.id)}
                title="Revoke link"
              >
                {revokeShare.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SpaceShareSection ────────────────────────────────────────────────────────

function SpaceShareSection({
  shares,
  pageId,
  orgId,
  spaceId,
}: {
  shares: MotionPageShareDTO[];
  pageId: string;
  orgId: string;
  spaceId: string;
}) {
  const spaceShares = shares.filter((s) => s.share_type === "space");
  const createShare = useCreateMotionPageShare(orgId, spaceId, pageId);
  const revokeShare = useRevokeMotionPageShare(orgId, spaceId, pageId);

  const { organisations } = useAppContext();
  const [targetOrgId, setTargetOrgId] = useState<string>(
    organisations[0]?.id ?? ""
  );
  const [targetSpaceId, setTargetSpaceId] = useState<string>("");
  const [permission, setPermission] = useState<MotionPermission>("view");

  const { data: targetSpaces = [], isLoading: spacesLoading } = useSpaces(
    targetOrgId || null
  );

  // Filter out the current space from the target options
  const availableSpaces = targetSpaces.filter(
    (s) => !(s.org_id === orgId && s.id === spaceId)
  );

  const handleShare = () => {
    if (!targetOrgId || !targetSpaceId) return;
    createShare.mutate({
      share_type: "space",
      permission,
      target_org_id: targetOrgId,
      target_space_id: targetSpaceId,
    });
    setTargetSpaceId("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Building2 className="size-4 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Share with a space</p>
          <p className="text-xs text-muted-foreground">
            Members of the selected space can access this page
          </p>
        </div>
      </div>

      {/* Share form */}
      <div className="pl-6 space-y-2">
        <div className="flex flex-wrap gap-2">
          {/* Org selector */}
          <Select value={targetOrgId} onValueChange={(v) => { setTargetOrgId(v); setTargetSpaceId(""); }}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Organisation" />
            </SelectTrigger>
            <SelectContent>
              {organisations.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Space selector */}
          <Select
            value={targetSpaceId}
            onValueChange={setTargetSpaceId}
            disabled={!targetOrgId || spacesLoading}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue
                placeholder={spacesLoading ? "Loading…" : "Space"}
              />
            </SelectTrigger>
            <SelectContent>
              {availableSpaces.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
              {availableSpaces.length === 0 && !spacesLoading && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No spaces available
                </div>
              )}
            </SelectContent>
          </Select>

          {/* Permission */}
          <Select
            value={permission}
            onValueChange={(v) => setPermission(v as MotionPermission)}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view">Can view</SelectItem>
              <SelectItem value="edit">Can edit</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!targetOrgId || !targetSpaceId || createShare.isPending}
            onClick={handleShare}
          >
            {createShare.isPending ? (
              <Loader2 className="size-3 animate-spin mr-1" />
            ) : null}
            Share
          </Button>
        </div>
      </div>

      {/* Existing space shares */}
      {spaceShares.length > 0 && (
        <div className="pl-6 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Shared with
          </p>
          {spaceShares.map((share) => {
            const org = organisations.find(
              (o) => o.id === share.target_org_id
            );
            return (
              <div
                key={share.id}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
              >
                <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {(org?.name ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {org?.name ?? share.target_org_id}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {share.permission === "edit" ? "Can edit" : "Can view"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                  disabled={revokeShare.isPending}
                  onClick={() => revokeShare.mutate(share.id)}
                  title="Revoke"
                >
                  <X className="size-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── MotionShareModal ─────────────────────────────────────────────────────────

export function MotionShareModal({
  open,
  onOpenChange,
  pageId,
  pageTitle,
  orgId,
  spaceId,
}: MotionShareModalProps) {
  const { data: shares = [], isLoading } = useMotionPageShares(
    orgId,
    spaceId,
    open ? pageId : null // only fetch when modal is open
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold truncate pr-6">
            Share "{pageTitle}"
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            <PublicLinkSection
              shares={shares}
              pageId={pageId}
              orgId={orgId}
              spaceId={spaceId}
            />

            <div className="border-t border-border/50" />

            <SpaceShareSection
              shares={shares}
              pageId={pageId}
              orgId={orgId}
              spaceId={spaceId}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useJoinOrganisation } from "@/hooks/api/useOrganisations";
import { useAppContext } from "@/contexts/AppContext";
import { useLocation, useNavigate } from "react-router-dom";

interface JoinOrganisationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinOrganisationDialog({
  open,
  onOpenChange,
}: JoinOrganisationDialogProps) {
  const [token, setToken] = useState("");
  const joinOrg = useJoinOrganisation();
  const { setActiveOrganisation } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  const handleJoin = () => {
    const trimmed = token.trim();
    if (!trimmed) return;

    joinOrg.mutate(trimmed, {
      onSuccess: ({ orgId, spaceId }) => {
        // Switch the app to the joined org + its default space
        setActiveOrganisation(orgId, spaceId);

        // If on a detail page, reset to the new workspace's tasks list
        if (/^\/(tasks|events)\/[^\/]+/.test(location.pathname)) {
          navigate("/tasks");
        }

        onOpenChange(false);
        setToken("");
      },
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setToken("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join Organisation</DialogTitle>
          <DialogDescription>
            Paste an invitation token to join an existing organisation. You'll
            be added to the organisation and its default space.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Invitation token"
            autoFocus
          />
          {joinOrg.isError && (
            <p className="mt-2 text-xs text-destructive">
              {(joinOrg.error as any)?.response?.data?.message ??
                "Invalid or expired invite token. Please try again."}
            </p>
          )}
        </div>

        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleJoin}
            disabled={!token.trim() || joinOrg.isPending}
          >
            {joinOrg.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Join
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

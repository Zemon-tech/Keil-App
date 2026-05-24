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
import { Loader2 } from "lucide-react";
import { useCreateOrganisation } from "@/hooks/api/useOrganisations";
import { useAppContext } from "@/contexts/AppContext";
import { useLocation, useNavigate } from "react-router-dom";

interface CreateOrganisationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganisationDialog({
  open,
  onOpenChange,
}: CreateOrganisationDialogProps) {
  const [name, setName] = useState("");
  const createOrg = useCreateOrganisation();
  const { setActiveOrganisation } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    createOrg.mutate(trimmed, {
      onSuccess: ({ org, space }) => {
        // Switch the app to the new org + its default "General" space
        setActiveOrganisation(org.id, space.id);

        // If on a detail page, reset to the new workspace's tasks list
        if (/^\/(tasks|events)\/[^\/]+/.test(location.pathname)) {
          navigate("/tasks");
        }

        onOpenChange(false);
        setName("");
      },
    });
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setName("");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Organisation</DialogTitle>
          <DialogDescription>
            Give your organisation a name. A default General space will be
            created for you automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Acme Corp, Engineering Team"
            autoFocus
            className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createOrg.isPending}
          >
            {createOrg.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Create Organisation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

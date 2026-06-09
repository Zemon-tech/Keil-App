import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJoinOrganisation } from "@/hooks/api/useOrganisations";
import { useAppContext } from "@/contexts/AppContext";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket";
import { toast } from "sonner";

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const joinOrg = useJoinOrganisation();
  const { setActiveOrganisation } = useAppContext();

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    joinOrg.mutate(token, {
      onSuccess: ({ org, space }) => {
        toast.success(`Joined ${org.name} successfully!`);
        setActiveOrganisation(org.id, space.id);
        
        const socket = getSocket();
        if (socket) {
          socket.emit("join_org_rooms", { orgId: org.id });
        }

        navigate("/");
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || "Failed to join organisation");
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (joinOrg.isPending) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="size-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold">Joining Organisation...</h2>
        <p className="text-muted-foreground mt-2">Validating your invitation token.</p>
      </div>
    );
  }

  if (joinOrg.isError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground bg-red-50/10 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="size-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-destructive mb-2">
            Invalid or Expired Invite
          </h2>
          <p className="text-muted-foreground mb-6">
            {(joinOrg.error as any)?.response?.data?.message ||
              "This invitation link could not be processed. It may have expired or you might already be a member of this organisation."}
          </p>
          <Button onClick={() => navigate("/")} size="lg">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

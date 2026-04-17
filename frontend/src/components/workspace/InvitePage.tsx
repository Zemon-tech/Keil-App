import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useJoinWorkspace } from "@/hooks/api/useWorkspace";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const joinWorkspace = useJoinWorkspace();
  const { setActiveWorkspace } = useWorkspace();

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    joinWorkspace.mutate(token, {
      onSuccess: (data) => {
        // Update active workspace and navigate to dashboard
        if (data?.data?.workspaceId) {
          setActiveWorkspace(data.data.workspaceId);
        }
        navigate("/");
      },
      onError: (_err) => {
        // Optional tracking if needed, error is rendered below
      }
    });
  }, [token]);

  if (joinWorkspace.isPending) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <h2 className="text-xl font-semibold">Joining Workspace...</h2>
        <p className="text-muted-foreground mt-2">Validating your invitation token.</p>
      </div>
    );
  }

  if (joinWorkspace.isError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground bg-red-50/10 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-destructive mb-2">Invalid or Expired Invite</h2>
          <p className="text-muted-foreground mb-6">
            {(joinWorkspace.error as any)?.response?.data?.error?.message || "This invitation link could not be processed. It may have expired or you might already be a member of this workspace."}
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

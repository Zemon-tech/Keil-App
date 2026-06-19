import { useCreateCheckout } from "@/hooks/api/useBilling";
import { Zap, X } from "lucide-react";

interface UpgradePromptProps {
  /** The resource that was limited */
  resource: "ai_chats_daily" | "ai_chats_hourly" | "recordings_monthly";
  /** Current limit value */
  limit: number;
  /** Callback to dismiss the prompt */
  onDismiss: () => void;
}

const RESOURCE_LABELS: Record<string, { title: string; description: string }> = {
  ai_chats_daily: {
    title: "Daily AI Chat Limit Reached",
    description: "You've used all your AI chats for today. Upgrade to Pro for 100 chats/day.",
  },
  ai_chats_hourly: {
    title: "Hourly AI Chat Limit Reached",
    description: "You've hit the hourly limit. Wait a bit or upgrade for higher limits.",
  },
  recordings_monthly: {
    title: "Monthly Recording Limit Reached",
    description: "You've used all your recording slots this month. Upgrade for unlimited recordings.",
  },
};

/**
 * Modal prompt shown when a usage limit is hit.
 * Offers upgrade CTA and dismiss option.
 */
export function UpgradePrompt({ resource, limit: _limit, onDismiss }: UpgradePromptProps) {
  const checkout = useCreateCheckout();
  const info = RESOURCE_LABELS[resource] || RESOURCE_LABELS.ai_chats_daily;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-w-sm w-full mx-4 rounded-xl border bg-card p-6 shadow-lg space-y-4">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 rounded-md hover:bg-accent text-muted-foreground"
        >
          <X className="size-4" />
        </button>

        {/* Icon */}
        <div className="mx-auto size-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Zap className="size-6 text-amber-500" />
        </div>

        {/* Content */}
        <div className="text-center space-y-1">
          <h2 className="font-semibold text-lg">{info.title}</h2>
          <p className="text-sm text-muted-foreground">{info.description}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => checkout.mutate()}
            disabled={checkout.isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Zap className="size-4" />
            {checkout.isPending ? "Redirecting..." : "Upgrade to Pro"}
          </button>
          <button
            onClick={onDismiss}
            className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-accent"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}

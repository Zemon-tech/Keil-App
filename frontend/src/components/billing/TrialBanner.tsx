import { useSubscription } from "@/contexts/SubscriptionContext";
import { useCreateCheckout } from "@/hooks/api/useBilling";
import { Clock, Zap } from "lucide-react";

/**
 * Slim banner displayed at the top of the layout when the user is on a trial.
 * Shows remaining days and a quick upgrade CTA.
 * Only renders when status === 'trialing' and days remaining <= 10.
 */
export function TrialBanner() {
  const { status, trialDaysRemaining } = useSubscription();
  const checkout = useCreateCheckout();

  // Only show when trialing and within the last 10 days
  if (status !== "trialing" || trialDaysRemaining === null || trialDaysRemaining > 10) {
    return null;
  }

  const isUrgent = trialDaysRemaining <= 3;

  return (
    <div
      className={`flex items-center justify-center gap-3 px-4 py-2 text-sm ${
        isUrgent
          ? "bg-red-500/10 text-red-600 dark:text-red-400"
          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
      }`}
    >
      <Clock className="size-3.5 shrink-0" />
      <span>
        {trialDaysRemaining === 0
          ? "Your trial expires today"
          : `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""} left in your trial`}
      </span>
      <button
        onClick={() => checkout.mutate()}
        disabled={checkout.isPending}
        className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${
          isUrgent
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-blue-500 text-white hover:bg-blue-600"
        } disabled:opacity-50`}
      >
        <Zap className="size-3" />
        {checkout.isPending ? "..." : "Upgrade"}
      </button>
    </div>
  );
}

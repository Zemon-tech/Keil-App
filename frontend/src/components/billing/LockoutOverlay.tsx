import { useSubscription } from "@/contexts/SubscriptionContext";
import { useCreateCheckout } from "@/hooks/api/useBilling";
import { Lock, Download, Zap } from "lucide-react";

/**
 * Full-screen overlay displayed when a user's subscription is locked or expired.
 * Blocks all interaction with the app. Provides Export Data + Subscribe actions.
 */
export function LockoutOverlay() {
  const { isLocked, isExpired, status } = useSubscription();
  const checkout = useCreateCheckout();

  if (!isLocked && !isExpired) return null;

  const isFullLock = isLocked;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto size-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <Lock className="size-8 text-red-500" />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {isFullLock ? "Account Locked" : "Trial Expired"}
          </h1>
          <p className="text-muted-foreground">
            {isFullLock
              ? "Your account has been locked due to an expired subscription. Subscribe to regain full access to KeilHQ."
              : "Your 30-day free trial has ended. Subscribe to continue using KeilHQ with all your data intact."}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => checkout.mutate()}
            disabled={checkout.isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Zap className="size-4" />
            {checkout.isPending ? "Redirecting to checkout..." : "Subscribe — $25/mo"}
          </button>

          <a
            href="/api/v1/billing/export"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium hover:bg-accent"
          >
            <Download className="size-4" />
            Export My Data
          </a>
        </div>

        {/* Fine print */}
        <p className="text-xs text-muted-foreground">
          Your data is safe. Export it anytime, or subscribe to pick up right where you left off.
        </p>
      </div>
    </div>
  );
}

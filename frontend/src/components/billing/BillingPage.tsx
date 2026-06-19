import { useSubscription } from "@/contexts/SubscriptionContext";
import { useCreateCheckout, usePortalUrl } from "@/hooks/api/useBilling";
import { PLAN_DISPLAY, STATUS_DISPLAY } from "@/types/billing";
import { CreditCard, ExternalLink, Zap, Clock, Mic, Shield } from "lucide-react";

export function BillingPage() {
  const { planData, plan, status, limits, usage, trialDaysRemaining, isPaid, isLoading } =
    useSubscription();
  const checkout = useCreateCheckout();
  const portal = usePortalUrl();

  if (isLoading || !planData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-muted-foreground">Loading billing information...</div>
      </div>
    );
  }

  const planInfo = plan ? PLAN_DISPLAY[plan] : null;
  const statusInfo = status ? STATUS_DISPLAY[status] : null;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-1">
          Manage your plan, usage, and payment method.
        </p>
      </div>

      {/* Current Plan Card */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{planInfo?.name || "Unknown Plan"}</h2>
              <p className="text-sm text-muted-foreground">{planInfo?.price}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${statusInfo?.color || ""}`}>
              {statusInfo?.label}
            </span>
          </div>
        </div>

        {/* Trial countdown */}
        {status === "trialing" && trialDaysRemaining !== null && (
          <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg px-3 py-2">
            <Clock className="size-4" />
            <span>
              {trialDaysRemaining} day{trialDaysRemaining !== 1 ? "s" : ""} remaining in your trial
            </span>
          </div>
        )}

        {/* Past due warning */}
        {status === "past_due" && (
          <div className="flex items-center gap-2 text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg px-3 py-2">
            <Shield className="size-4" />
            <span>Payment failed. Please update your payment method to avoid losing access.</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          {!isPaid && (
            <button
              onClick={() => checkout.mutate()}
              disabled={checkout.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Zap className="size-4" />
              {checkout.isPending ? "Redirecting..." : "Upgrade to Pro — $25/mo"}
            </button>
          )}
          {isPaid && (
            <button
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <ExternalLink className="size-4" />
              {portal.isPending ? "Loading..." : "Manage Subscription"}
            </button>
          )}
        </div>
      </div>

      {/* Usage Section */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <h3 className="font-semibold">Usage This Period</h3>

        {/* AI Chats - Daily */}
        <UsageBar
          label="AI Chats Today"
          icon={<Zap className="size-4" />}
          used={usage?.ai_chats_today || 0}
          limit={limits?.ai_chats_daily ?? null}
        />

        {/* AI Chats - Hourly */}
        {limits?.ai_chats_hourly && (
          <UsageBar
            label="AI Chats This Hour"
            icon={<Zap className="size-4" />}
            used={usage?.ai_chats_this_hour || 0}
            limit={limits.ai_chats_hourly}
          />
        )}

        {/* Recordings */}
        <UsageBar
          label="Recordings This Month"
          icon={<Mic className="size-4" />}
          used={usage?.recordings_this_month || 0}
          limit={limits?.recordings_monthly ?? null}
        />
      </div>

      {/* Plan Features */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold">Plan Features</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <FeatureItem
            label="Transcription Diarization"
            enabled={limits?.transcription_diarization || false}
          />
          <FeatureItem
            label="Data Privacy (no model training)"
            enabled={!limits?.data_used_for_training}
          />
          <FeatureItem label="SSO / SAML" enabled={limits?.sso || false} />
          <FeatureItem label="Audit Logs" enabled={limits?.audit_logs || false} />
          <FeatureItem
            label="Centralized Billing"
            enabled={limits?.centralized_billing || false}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UsageBar({
  label,
  icon,
  used,
  limit,
}: {
  label: string;
  icon: React.ReactNode;
  used: number;
  limit: number | null;
}) {
  const isUnlimited = limit === null;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isWarning = !isUnlimited && percentage >= 80;
  const isExhausted = !isUnlimited && percentage >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-medium">
          {used} / {isUnlimited ? "Unlimited" : limit}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isExhausted
                ? "bg-red-500"
                : isWarning
                  ? "bg-amber-500"
                  : "bg-primary"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FeatureItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`size-4 rounded-full flex items-center justify-center text-xs ${
          enabled
            ? "bg-green-500/10 text-green-600"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {enabled ? "✓" : "—"}
      </div>
      <span className={enabled ? "" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

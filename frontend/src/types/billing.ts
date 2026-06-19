// =============================================================================
// Frontend Billing Types (mirrors backend DTOs)
// =============================================================================

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired"
  | "locked";

export type SubscriptionPlan =
  | "pro_trial"
  | "pro_paid"
  | "teams"
  | "enterprise";

export interface PlanLimits {
  ai_chats_daily: number | null;
  ai_chats_hourly: number | null;
  recordings_monthly: number | null;
  transcription_diarization: boolean;
  data_used_for_training: boolean;
  sso: boolean;
  audit_logs: boolean;
  centralized_billing: boolean;
}

export interface UsageDTO {
  ai_chats_today: number;
  ai_chats_daily_limit: number | null;
  ai_chats_this_hour: number;
  ai_chats_hourly_limit: number | null;
  recordings_this_month: number;
  recordings_monthly_limit: number | null;
}

export interface UserPlanDTO {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  trial_days_remaining: number | null;
  current_period_end: string | null;
  limits: PlanLimits;
  usage: UsageDTO;
  portal_url: string | null;
}

export interface OrgPlanDTO {
  org_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  seats_purchased: number;
  seats_used: number;
  seats_available: number;
  current_period_end: string | null;
  portal_url: string | null;
}

export interface CheckoutResponse {
  success: boolean;
  checkout_url: string;
}

// Plan display names and metadata
export const PLAN_DISPLAY: Record<SubscriptionPlan, { name: string; price: string; description: string }> = {
  pro_trial: {
    name: "Pro Trial",
    price: "Free for 30 days",
    description: "Full access to evaluate KeilHQ",
  },
  pro_paid: {
    name: "Pro",
    price: "$25/mo",
    description: "For power users & professionals",
  },
  teams: {
    name: "Teams",
    price: "$50/user/mo",
    description: "For growing squads needing SSO & shared billing",
  },
  enterprise: {
    name: "Enterprise",
    price: "Contact Sales",
    description: "Custom contracts for large-scale orgs",
  },
};

export const STATUS_DISPLAY: Record<SubscriptionStatus, { label: string; color: string }> = {
  trialing: { label: "Trial", color: "text-blue-500" },
  active: { label: "Active", color: "text-green-500" },
  past_due: { label: "Past Due", color: "text-amber-500" },
  cancelled: { label: "Cancelled", color: "text-orange-500" },
  expired: { label: "Expired", color: "text-red-500" },
  locked: { label: "Locked", color: "text-red-600" },
};

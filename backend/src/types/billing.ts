// =============================================================================
// Billing & Subscription Types (Dodo Payments Integration)
// =============================================================================

// ── Enums ────────────────────────────────────────────────────────────────────

export enum SubscriptionStatus {
  TRIALING = "trialing",
  ACTIVE = "active",
  PAST_DUE = "past_due",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
  LOCKED = "locked",
}

export enum SubscriptionPlan {
  PRO_TRIAL = "pro_trial",
  PRO_PAID = "pro_paid",
  TEAMS = "teams",
  ENTERPRISE = "enterprise",
}

// ── Database Entities ────────────────────────────────────────────────────────

export interface UserSubscription {
  id: string;
  user_id: string;
  dodo_customer_id: string | null;
  dodo_subscription_id: string | null;
  dodo_product_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trial_starts_at: Date;
  trial_ends_at: Date;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancelled_at: Date | null;
  locked_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrgSubscription {
  id: string;
  org_id: string;
  dodo_customer_id: string | null;
  dodo_subscription_id: string | null;
  dodo_product_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  seats_purchased: number;
  seats_used: number;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  ai_chats_today: number;
  ai_chats_this_hour: number;
  ai_hour_window: Date;
  ai_day_window: Date;
  recordings_this_month: number;
  recording_month: Date;
  updated_at: Date;
}

export interface DodoWebhookEvent {
  id: string;
  event_id: string;
  event_type: string;
  payload: Record<string, any>;
  processed_at: Date;
}

// ── Plan Limits ──────────────────────────────────────────────────────────────

export interface PlanLimits {
  ai_chats_daily: number | null;       // null = unlimited
  ai_chats_hourly: number | null;      // null = no hourly limit
  recordings_monthly: number | null;   // null = unlimited
  transcription_diarization: boolean;
  data_used_for_training: boolean;
  sso: boolean;
  audit_logs: boolean;
  centralized_billing: boolean;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  [SubscriptionPlan.PRO_TRIAL]: {
    ai_chats_daily: 25,
    ai_chats_hourly: null,
    recordings_monthly: 3,
    transcription_diarization: false,
    data_used_for_training: true,
    sso: false,
    audit_logs: false,
    centralized_billing: false,
  },
  [SubscriptionPlan.PRO_PAID]: {
    ai_chats_daily: 100,
    ai_chats_hourly: 20,
    recordings_monthly: null,
    transcription_diarization: true,
    data_used_for_training: false,
    sso: false,
    audit_logs: false,
    centralized_billing: false,
  },
  [SubscriptionPlan.TEAMS]: {
    ai_chats_daily: 100,
    ai_chats_hourly: 20,
    recordings_monthly: null,
    transcription_diarization: true,
    data_used_for_training: false,
    sso: true,
    audit_logs: true,
    centralized_billing: true,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    ai_chats_daily: null,
    ai_chats_hourly: null,
    recordings_monthly: null,
    transcription_diarization: true,
    data_used_for_training: false,
    sso: true,
    audit_logs: true,
    centralized_billing: true,
  },
};

// ── DTOs (API Responses) ─────────────────────────────────────────────────────

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

export interface UsageDTO {
  ai_chats_today: number;
  ai_chats_daily_limit: number | null;
  ai_chats_this_hour: number;
  ai_chats_hourly_limit: number | null;
  recordings_this_month: number;
  recordings_monthly_limit: number | null;
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

export interface CheckoutRequestDTO {
  plan: "pro_paid" | "teams";
  org_id?: string;       // Required when plan === "teams"
  seats?: number;        // Required when plan === "teams"
}

export interface CheckoutResponseDTO {
  success: boolean;
  checkout_url: string;
}

// ── Usage Check Result ───────────────────────────────────────────────────────

export interface UsageCheckResult {
  allowed: boolean;
  warning: boolean;         // true when usage >= 80% of limit
  remaining: number | null; // null = unlimited
  limit: number | null;
  resource: "ai_chats_daily" | "ai_chats_hourly" | "recordings_monthly";
}

// ── Webhook Payload Types ────────────────────────────────────────────────────

export interface DodoWebhookPayload {
  event_id: string;
  event_type: string;
  data: {
    subscription_id?: string;
    customer_id?: string;
    product_id?: string;
    status?: string;
    quantity?: number;
    current_period_start?: string;
    current_period_end?: string;
    metadata?: Record<string, string>;
    [key: string]: any;
  };
}

import {
  SubscriptionStatus,
  SubscriptionPlan,
  PLAN_LIMITS,
  PlanLimits,
  UserPlanDTO,
  OrgPlanDTO,
  UsageDTO,
  UsageCheckResult,
} from "../types/billing";
import { userSubscriptionRepository, orgSubscriptionRepository, usageTrackingRepository } from "../repositories";
import { ApiError } from "../utils/ApiError";
import logger from "../lib/logger";

// =============================================================================
// PLAN RESOLUTION
// =============================================================================

/**
 * Resolves the effective plan for a user. A user's effective plan is the highest
 * of their personal subscription OR any Teams org they belong to.
 * For limit purposes, we use the user's own subscription plan.
 */
export const getUserPlan = async (userId: string): Promise<UserPlanDTO> => {
  const sub = await userSubscriptionRepository.findByUserId(userId);

  if (!sub) {
    // No subscription row — this shouldn't happen (trigger creates one on signup)
    // but handle gracefully by treating as expired trial
    return buildLockedPlanDTO();
  }

  const limits = PLAN_LIMITS[sub.plan];
  const usage = await getUsageDTO(userId, limits);
  const trialDaysRemaining = getTrialDaysRemaining(sub.status, sub.trial_ends_at);

  return {
    plan: sub.plan,
    status: sub.status,
    trial_ends_at: sub.status === SubscriptionStatus.TRIALING
      ? sub.trial_ends_at.toISOString()
      : null,
    trial_days_remaining: trialDaysRemaining,
    current_period_end: sub.current_period_end
      ? sub.current_period_end.toISOString()
      : null,
    limits,
    usage,
    portal_url: null, // Populated by billing controller with Dodo portal URL
  };
};

/**
 * Get the org-level subscription status (Teams plan).
 */
export const getOrgPlan = async (orgId: string): Promise<OrgPlanDTO | null> => {
  const sub = await orgSubscriptionRepository.findByOrgId(orgId);
  if (!sub) return null;

  return {
    org_id: sub.org_id,
    plan: sub.plan,
    status: sub.status,
    seats_purchased: sub.seats_purchased,
    seats_used: sub.seats_used,
    seats_available: Math.max(0, sub.seats_purchased - sub.seats_used),
    current_period_end: sub.current_period_end
      ? sub.current_period_end.toISOString()
      : null,
    portal_url: null, // Populated by billing controller
  };
};

// =============================================================================
// ACCESS CHECKS
// =============================================================================

/**
 * Check if user has active access (not locked/expired).
 * Returns true if user can use the app.
 */
export const hasActiveAccess = async (userId: string): Promise<boolean> => {
  const sub = await userSubscriptionRepository.findByUserId(userId);
  if (!sub) return false;

  return (
    sub.status === SubscriptionStatus.TRIALING ||
    sub.status === SubscriptionStatus.ACTIVE ||
    sub.status === SubscriptionStatus.PAST_DUE ||
    sub.status === SubscriptionStatus.CANCELLED
  );
};

/**
 * Get the subscription status for quick middleware checks.
 * Returns null if no subscription exists.
 */
export const getSubscriptionStatus = async (userId: string): Promise<SubscriptionStatus | null> => {
  const sub = await userSubscriptionRepository.findByUserId(userId);
  return sub?.status ?? null;
};

/**
 * Check if a feature is available for the user's plan.
 */
export const hasFeature = async (
  userId: string,
  feature: keyof Pick<PlanLimits, "sso" | "audit_logs" | "centralized_billing" | "transcription_diarization">
): Promise<boolean> => {
  const sub = await userSubscriptionRepository.findByUserId(userId);
  if (!sub) return false;
  return PLAN_LIMITS[sub.plan][feature];
};

// =============================================================================
// USAGE CHECKS
// =============================================================================

/**
 * Check if user can send an AI chat (daily + hourly limits).
 */
export const checkAiChatUsage = async (userId: string): Promise<UsageCheckResult> => {
  const sub = await userSubscriptionRepository.findByUserId(userId);
  if (!sub) {
    return { allowed: false, warning: false, remaining: 0, limit: 0, resource: "ai_chats_daily" };
  }

  const limits = PLAN_LIMITS[sub.plan];
  const usage = await usageTrackingRepository.getEffectiveUsage(userId);

  // Check hourly limit first (stricter)
  if (limits.ai_chats_hourly !== null) {
    const remaining = limits.ai_chats_hourly - usage.ai_chats_this_hour;
    if (remaining <= 0) {
      return {
        allowed: false,
        warning: false,
        remaining: 0,
        limit: limits.ai_chats_hourly,
        resource: "ai_chats_hourly",
      };
    }
    const warningThreshold = Math.floor(limits.ai_chats_hourly * 0.8);
    if (usage.ai_chats_this_hour >= warningThreshold) {
      return {
        allowed: true,
        warning: true,
        remaining,
        limit: limits.ai_chats_hourly,
        resource: "ai_chats_hourly",
      };
    }
  }

  // Check daily limit
  if (limits.ai_chats_daily !== null) {
    const remaining = limits.ai_chats_daily - usage.ai_chats_today;
    if (remaining <= 0) {
      return {
        allowed: false,
        warning: false,
        remaining: 0,
        limit: limits.ai_chats_daily,
        resource: "ai_chats_daily",
      };
    }
    const warningThreshold = Math.floor(limits.ai_chats_daily * 0.8);
    if (usage.ai_chats_today >= warningThreshold) {
      return {
        allowed: true,
        warning: true,
        remaining,
        limit: limits.ai_chats_daily,
        resource: "ai_chats_daily",
      };
    }
  }

  // No limits hit
  return {
    allowed: true,
    warning: false,
    remaining: limits.ai_chats_daily !== null
      ? limits.ai_chats_daily - usage.ai_chats_today
      : null,
    limit: limits.ai_chats_daily,
    resource: "ai_chats_daily",
  };
};

/**
 * Check if user can create a recording (monthly limit).
 */
export const checkRecordingUsage = async (userId: string): Promise<UsageCheckResult> => {
  const sub = await userSubscriptionRepository.findByUserId(userId);
  if (!sub) {
    return { allowed: false, warning: false, remaining: 0, limit: 0, resource: "recordings_monthly" };
  }

  const limits = PLAN_LIMITS[sub.plan];
  if (limits.recordings_monthly === null) {
    return { allowed: true, warning: false, remaining: null, limit: null, resource: "recordings_monthly" };
  }

  const usage = await usageTrackingRepository.getEffectiveUsage(userId);
  const remaining = limits.recordings_monthly - usage.recordings_this_month;

  if (remaining <= 0) {
    return {
      allowed: false,
      warning: false,
      remaining: 0,
      limit: limits.recordings_monthly,
      resource: "recordings_monthly",
    };
  }

  const warningThreshold = Math.floor(limits.recordings_monthly * 0.8);
  return {
    allowed: true,
    warning: usage.recordings_this_month >= warningThreshold,
    remaining,
    limit: limits.recordings_monthly,
    resource: "recordings_monthly",
  };
};

/**
 * Record an AI chat usage event (increment counter).
 */
export const recordAiChatUsage = async (userId: string): Promise<void> => {
  await usageTrackingRepository.incrementAiChat(userId);
};

/**
 * Record a recording usage event (increment counter).
 */
export const recordRecordingUsage = async (userId: string): Promise<void> => {
  await usageTrackingRepository.incrementRecording(userId);
};

// =============================================================================
// SEAT MANAGEMENT
// =============================================================================

/**
 * Check if an org has available seats for a new member.
 * Returns true if no Teams subscription exists (no seat restriction) or seats are available.
 */
export const canAddOrgMember = async (orgId: string): Promise<boolean> => {
  return orgSubscriptionRepository.hasAvailableSeats(orgId);
};

// =============================================================================
// TRIAL EXPIRY (called by cron job)
// =============================================================================

/**
 * Expire trials that have passed their trial_ends_at date.
 * Sets status from 'trialing' → 'expired'.
 */
export const expireTrials = async (): Promise<number> => {
  const expired = await userSubscriptionRepository.findExpiredTrials();
  if (expired.length === 0) return 0;

  const userIds = expired.map((s) => s.user_id);
  const count = await userSubscriptionRepository.bulkUpdateStatus(
    userIds,
    SubscriptionStatus.EXPIRED
  );

  logger.info({ count, userIds }, "Expired trial subscriptions");
  return count;
};

/**
 * Lock accounts that have been expired past the 7-day grace period.
 * Sets status from 'expired' → 'locked'.
 */
export const lockExpiredAccounts = async (): Promise<number> => {
  const lockable = await userSubscriptionRepository.findLockable();
  if (lockable.length === 0) return 0;

  const userIds = lockable.map((s) => s.user_id);
  const count = await userSubscriptionRepository.bulkUpdateStatus(
    userIds,
    SubscriptionStatus.LOCKED,
    "locked_at = NOW()"
  );

  logger.info({ count, userIds }, "Locked expired accounts past grace period");
  return count;
};

// =============================================================================
// HELPERS
// =============================================================================

function getTrialDaysRemaining(status: SubscriptionStatus, trialEndsAt: Date): number | null {
  if (status !== SubscriptionStatus.TRIALING) return null;
  const now = new Date();
  const diff = trialEndsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

async function getUsageDTO(userId: string, limits: PlanLimits): Promise<UsageDTO> {
  const usage = await usageTrackingRepository.getEffectiveUsage(userId);
  return {
    ai_chats_today: usage.ai_chats_today,
    ai_chats_daily_limit: limits.ai_chats_daily,
    ai_chats_this_hour: usage.ai_chats_this_hour,
    ai_chats_hourly_limit: limits.ai_chats_hourly,
    recordings_this_month: usage.recordings_this_month,
    recordings_monthly_limit: limits.recordings_monthly,
  };
}

function buildLockedPlanDTO(): UserPlanDTO {
  return {
    plan: SubscriptionPlan.PRO_TRIAL,
    status: SubscriptionStatus.LOCKED,
    trial_ends_at: null,
    trial_days_remaining: null,
    current_period_end: null,
    limits: PLAN_LIMITS[SubscriptionPlan.PRO_TRIAL],
    usage: {
      ai_chats_today: 0,
      ai_chats_daily_limit: 0,
      ai_chats_this_hour: 0,
      ai_chats_hourly_limit: null,
      recordings_this_month: 0,
      recordings_monthly_limit: 0,
    },
    portal_url: null,
  };
}

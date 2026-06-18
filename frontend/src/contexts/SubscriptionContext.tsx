import React, { createContext, useContext } from "react";
import { useUserPlan } from "@/hooks/api/useBilling";
import type { UserPlanDTO, SubscriptionPlan, SubscriptionStatus, PlanLimits, UsageDTO } from "@/types/billing";

// =============================================================================
// Context Type
// =============================================================================

interface SubscriptionContextType {
  /** The full plan data from the API */
  planData: UserPlanDTO | null;
  /** Current plan identifier */
  plan: SubscriptionPlan | null;
  /** Current subscription status */
  status: SubscriptionStatus | null;
  /** Plan limits for the current plan */
  limits: PlanLimits | null;
  /** Current usage counters */
  usage: UsageDTO | null;
  /** Days remaining in trial (null if not trialing) */
  trialDaysRemaining: number | null;
  /** Whether the user is locked out */
  isLocked: boolean;
  /** Whether the user's trial has expired (7-day grace window) */
  isExpired: boolean;
  /** Whether the user has an active paid subscription */
  isPaid: boolean;
  /** Whether data is still loading */
  isLoading: boolean;
  /** Refetch plan data */
  refetch: () => void;
}

// =============================================================================
// Context
// =============================================================================

const SubscriptionContext = createContext<SubscriptionContextType>({
  planData: null,
  plan: null,
  status: null,
  limits: null,
  usage: null,
  trialDaysRemaining: null,
  isLocked: false,
  isExpired: false,
  isPaid: false,
  isLoading: true,
  refetch: () => {},
});

// =============================================================================
// Provider
// =============================================================================

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: planData, isLoading, refetch } = useUserPlan();

  const value: SubscriptionContextType = {
    planData: planData || null,
    plan: planData?.plan || null,
    status: planData?.status || null,
    limits: planData?.limits || null,
    usage: planData?.usage || null,
    trialDaysRemaining: planData?.trial_days_remaining ?? null,
    isLocked: planData?.status === "locked",
    isExpired: planData?.status === "expired",
    isPaid: planData?.status === "active" && planData?.plan !== "pro_trial",
    isLoading,
    refetch,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// =============================================================================
// Hook
// =============================================================================

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}

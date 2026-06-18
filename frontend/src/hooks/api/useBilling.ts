import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { UserPlanDTO, OrgPlanDTO, CheckoutResponse } from "@/types/billing";

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const billingKeys = {
  all: ["billing"] as const,
  plan: () => [...billingKeys.all, "plan"] as const,
  orgPlan: (orgId: string) => [...billingKeys.all, "org", orgId, "plan"] as const,
};

// ─── useUserPlan ──────────────────────────────────────────────────────────────

/**
 * Fetches the current user's subscription plan, status, usage, and limits.
 */
export function useUserPlan() {
  return useQuery<UserPlanDTO>({
    queryKey: billingKeys.plan(),
    queryFn: async () => {
      const { data } = await api.get("v1/billing/plan");
      return data.data;
    },
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
  });
}

// ─── useOrgPlan ───────────────────────────────────────────────────────────────

/**
 * Fetches an organisation's Teams subscription plan.
 */
export function useOrgPlan(orgId: string | null) {
  return useQuery<OrgPlanDTO | null>({
    queryKey: billingKeys.orgPlan(orgId || ""),
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await api.get(`v1/billing/org/${orgId}/plan`);
      return data.data?.plan ? data.data : null;
    },
    enabled: !!orgId,
    staleTime: 60 * 1000,
  });
}

// ─── useCreateCheckout ────────────────────────────────────────────────────────

/**
 * Creates a checkout session for the Pro plan.
 * On success, redirects the user to the Dodo hosted checkout.
 */
export function useCreateCheckout() {
  const queryClient = useQueryClient();

  return useMutation<CheckoutResponse, Error>({
    mutationFn: async () => {
      const { data } = await api.post("v1/billing/checkout");
      return data;
    },
    onSuccess: (data) => {
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
  });
}

// ─── useCreateOrgCheckout ─────────────────────────────────────────────────────

/**
 * Creates a checkout session for the Teams plan (org-level).
 */
export function useCreateOrgCheckout() {
  return useMutation<CheckoutResponse, Error, { orgId: string; seats: number }>({
    mutationFn: async ({ orgId, seats }) => {
      const { data } = await api.post(`v1/billing/org/${orgId}/checkout`, { seats });
      return data;
    },
    onSuccess: (data) => {
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    },
  });
}

// ─── usePortalUrl ─────────────────────────────────────────────────────────────

/**
 * Fetches the Dodo Customer Portal URL for managing the subscription.
 */
export function usePortalUrl() {
  return useMutation<string, Error>({
    mutationFn: async () => {
      const { data } = await api.get("v1/billing/portal");
      return data.portal_url;
    },
  });
}

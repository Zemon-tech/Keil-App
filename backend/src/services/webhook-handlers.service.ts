import DodoPayments from "dodopayments";
import { SubscriptionStatus, SubscriptionPlan } from "../types/billing";
import { userSubscriptionRepository, orgSubscriptionRepository } from "../repositories";
import { dodoWebhookEventRepository } from "../repositories";
import logger from "../lib/logger";
import pool from "../config/pg";
import { config } from "../config";

type WebhookEvent = DodoPayments.Webhooks.UnwrapWebhookEvent;

// =============================================================================
// MAIN DISPATCHER
// =============================================================================

/**
 * Process a verified Dodo webhook event. Routes to the correct handler by type.
 * Handles idempotency internally — safe to call multiple times for the same event.
 */
export async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  // Generate a deterministic event ID from type + timestamp + subscription_id
  const eventId = deriveEventId(event);

  // Idempotency check
  const alreadyProcessed = await dodoWebhookEventRepository.existsByEventId(eventId);
  if (alreadyProcessed) {
    logger.debug({ eventId, type: event.type }, "Webhook event already processed, skipping");
    return;
  }

  logger.info({ eventId, type: event.type }, "Processing Dodo webhook event");

  switch (event.type) {
    case "subscription.active":
      await handleSubscriptionActive(event);
      break;
    case "subscription.renewed":
      await handleSubscriptionRenewed(event);
      break;
    case "subscription.cancelled":
      await handleSubscriptionCancelled(event);
      break;
    case "subscription.expired":
      await handleSubscriptionExpired(event);
      break;
    case "subscription.failed":
      await handleSubscriptionFailed(event);
      break;
    case "subscription.on_hold":
      await handleSubscriptionOnHold(event);
      break;
    case "payment.succeeded":
      await handlePaymentSucceeded(event);
      break;
    case "payment.failed":
      await handlePaymentFailed(event);
      break;
    default:
      logger.debug({ type: event.type }, "Unhandled webhook event type, ignoring");
  }

  // Record event for idempotency
  await dodoWebhookEventRepository.record(eventId, event.type, event as any);
}

// =============================================================================
// SUBSCRIPTION HANDLERS
// =============================================================================

/**
 * subscription.active — Subscription is now active (after trial or payment).
 * Provisions the user or org with their plan.
 */
async function handleSubscriptionActive(
  event: DodoPayments.Webhooks.SubscriptionActiveWebhookEvent
): Promise<void> {
  const sub = event.data;
  const customerId = sub.customer.customer_id;
  const productId = sub.product_id;
  const subscriptionId = sub.subscription_id;

  const periodStart = new Date(sub.previous_billing_date);
  const periodEnd = new Date(sub.next_billing_date);
  const metadata = sub.metadata || {};

  // Determine if this is a user-level (Pro) or org-level (Teams) subscription
  if (productId === config.dodoProductTeams && metadata.org_id) {
    // Teams plan — org-level
    await orgSubscriptionRepository.createForOrg(metadata.org_id, {
      dodo_customer_id: customerId,
      dodo_subscription_id: subscriptionId,
      dodo_product_id: productId,
      seats_purchased: sub.quantity || 1,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });
    logger.info({ orgId: metadata.org_id, subscriptionId }, "Org Teams subscription activated");
  } else if (metadata.user_id) {
    // Pro plan — user-level
    await userSubscriptionRepository.activate(metadata.user_id, {
      dodo_customer_id: customerId,
      dodo_subscription_id: subscriptionId,
      dodo_product_id: productId,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });
    logger.info({ userId: metadata.user_id, subscriptionId }, "User Pro subscription activated");
  } else {
    // Fallback: try to match by Dodo customer ID
    const userSub = await userSubscriptionRepository.findByDodoCustomerId(customerId);
    if (userSub) {
      await userSubscriptionRepository.activate(userSub.user_id, {
        dodo_customer_id: customerId,
        dodo_subscription_id: subscriptionId,
        dodo_product_id: productId,
        current_period_start: periodStart,
        current_period_end: periodEnd,
      });
      logger.info({ userId: userSub.user_id, subscriptionId }, "User subscription activated via customer ID match");
    } else {
      logger.warn({ customerId, subscriptionId, productId }, "Could not match subscription.active to user or org");
    }
  }
}

/**
 * subscription.renewed — Recurring payment succeeded, period extended.
 */
async function handleSubscriptionRenewed(
  event: DodoPayments.Webhooks.SubscriptionRenewedWebhookEvent
): Promise<void> {
  const sub = event.data;
  const subscriptionId = sub.subscription_id;
  const periodStart = new Date(sub.previous_billing_date);
  const periodEnd = new Date(sub.next_billing_date);

  // Try user subscription first
  const userSub = await userSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (userSub) {
    await userSubscriptionRepository.updateStatus(userSub.user_id, SubscriptionStatus.ACTIVE, {
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });
    logger.info({ userId: userSub.user_id, subscriptionId }, "User subscription renewed");
    return;
  }

  // Try org subscription
  const orgSub = await orgSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (orgSub) {
    await orgSubscriptionRepository.updateStatus(orgSub.org_id, SubscriptionStatus.ACTIVE, {
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });
    logger.info({ orgId: orgSub.org_id, subscriptionId }, "Org subscription renewed");
    return;
  }

  logger.warn({ subscriptionId }, "subscription.renewed: no matching subscription found");
}

/**
 * subscription.cancelled — User cancelled their subscription.
 * Access continues until current_period_end.
 */
async function handleSubscriptionCancelled(
  event: DodoPayments.Webhooks.SubscriptionCancelledWebhookEvent
): Promise<void> {
  const sub = event.data;
  const subscriptionId = sub.subscription_id;
  const cancelledAt = sub.cancelled_at ? new Date(sub.cancelled_at) : new Date();

  const userSub = await userSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (userSub) {
    await userSubscriptionRepository.updateStatus(userSub.user_id, SubscriptionStatus.CANCELLED, {
      cancelled_at: cancelledAt,
    });
    logger.info({ userId: userSub.user_id, subscriptionId }, "User subscription cancelled");
    return;
  }

  const orgSub = await orgSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (orgSub) {
    await orgSubscriptionRepository.updateStatus(orgSub.org_id, SubscriptionStatus.CANCELLED, {
      cancelled_at: cancelledAt,
    });
    logger.info({ orgId: orgSub.org_id, subscriptionId }, "Org subscription cancelled");
    return;
  }

  logger.warn({ subscriptionId }, "subscription.cancelled: no matching subscription found");
}

/**
 * subscription.expired — Subscription has fully expired (no more access).
 */
async function handleSubscriptionExpired(
  event: DodoPayments.Webhooks.SubscriptionExpiredWebhookEvent
): Promise<void> {
  const sub = event.data;
  const subscriptionId = sub.subscription_id;

  const userSub = await userSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (userSub) {
    await userSubscriptionRepository.updateStatus(userSub.user_id, SubscriptionStatus.EXPIRED);
    logger.info({ userId: userSub.user_id, subscriptionId }, "User subscription expired");
    return;
  }

  const orgSub = await orgSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (orgSub) {
    await orgSubscriptionRepository.updateStatus(orgSub.org_id, SubscriptionStatus.EXPIRED);
    logger.info({ orgId: orgSub.org_id, subscriptionId }, "Org subscription expired");
    return;
  }

  logger.warn({ subscriptionId }, "subscription.expired: no matching subscription found");
}

/**
 * subscription.failed — Payment for subscription failed.
 * Sets status to past_due (soft warning, not immediate lockout).
 */
async function handleSubscriptionFailed(
  event: DodoPayments.Webhooks.SubscriptionFailedWebhookEvent
): Promise<void> {
  const sub = event.data;
  const subscriptionId = sub.subscription_id;

  const userSub = await userSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (userSub) {
    await userSubscriptionRepository.updateStatus(userSub.user_id, SubscriptionStatus.PAST_DUE);
    logger.warn({ userId: userSub.user_id, subscriptionId }, "User subscription payment failed — past_due");
    return;
  }

  const orgSub = await orgSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (orgSub) {
    await orgSubscriptionRepository.updateStatus(orgSub.org_id, SubscriptionStatus.PAST_DUE);
    logger.warn({ orgId: orgSub.org_id, subscriptionId }, "Org subscription payment failed — past_due");
    return;
  }

  logger.warn({ subscriptionId }, "subscription.failed: no matching subscription found");
}

/**
 * subscription.on_hold — Subscription put on hold (e.g., dunning).
 */
async function handleSubscriptionOnHold(
  event: DodoPayments.Webhooks.SubscriptionOnHoldWebhookEvent
): Promise<void> {
  const sub = event.data;
  const subscriptionId = sub.subscription_id;

  const userSub = await userSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (userSub) {
    await userSubscriptionRepository.updateStatus(userSub.user_id, SubscriptionStatus.PAST_DUE);
    logger.warn({ userId: userSub.user_id, subscriptionId }, "User subscription on hold");
    return;
  }

  const orgSub = await orgSubscriptionRepository.findByDodoSubscriptionId(subscriptionId);
  if (orgSub) {
    await orgSubscriptionRepository.updateStatus(orgSub.org_id, SubscriptionStatus.PAST_DUE);
    logger.warn({ orgId: orgSub.org_id, subscriptionId }, "Org subscription on hold");
    return;
  }

  logger.warn({ subscriptionId }, "subscription.on_hold: no matching subscription found");
}

// =============================================================================
// PAYMENT HANDLERS
// =============================================================================

async function handlePaymentSucceeded(event: DodoPayments.Webhooks.PaymentSucceededWebhookEvent): Promise<void> {
  logger.info({ paymentId: event.data.payment_id }, "Payment succeeded (logged for audit)");
  // Payment success is handled implicitly by subscription.active / subscription.renewed
  // This handler exists for audit logging only
}

async function handlePaymentFailed(event: DodoPayments.Webhooks.PaymentFailedWebhookEvent): Promise<void> {
  logger.warn({ paymentId: event.data.payment_id }, "Payment failed (logged for audit)");
  // Payment failure is handled by subscription.failed
  // This handler exists for audit logging only
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Derive a deterministic event ID from the webhook event.
 * Dodo doesn't provide a unique event_id in the payload, so we construct one
 * from type + timestamp + subscription/payment ID.
 */
function deriveEventId(event: WebhookEvent): string {
  const timestamp = (event as any).timestamp || new Date().toISOString();
  const data = (event as any).data || {};
  const entityId = data.subscription_id || data.payment_id || "unknown";
  return `${event.type}:${entityId}:${timestamp}`;
}

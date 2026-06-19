import DodoPayments from "dodopayments";
import { config } from "../config";
import logger from "../lib/logger";

// =============================================================================
// Dodo Payments SDK Client — Singleton
// =============================================================================

let _client: DodoPayments | null = null;

/**
 * Returns the Dodo Payments SDK client singleton.
 * Lazily initialized on first call.
 */
export function getDodoClient(): DodoPayments {
  if (!_client) {
    if (!config.dodoPaymentsApiKey) {
      throw new Error("DODO_PAYMENTS_API_KEY is not configured");
    }
    _client = new DodoPayments({
      bearerToken: config.dodoPaymentsApiKey,
      webhookKey: config.dodoPaymentsWebhookKey || null,
      environment: config.dodoPaymentsEnvironment,
    });
    logger.info(
      { environment: config.dodoPaymentsEnvironment },
      "Dodo Payments client initialized"
    );
  }
  return _client;
}

// =============================================================================
// Checkout Session Creation
// =============================================================================

export interface CreateCheckoutOptions {
  productId: string;
  customerEmail: string;
  customerName?: string;
  quantity?: number;
  metadata?: Record<string, string>;
  trialPeriodDays?: number;
}

/**
 * Creates a Dodo Payments checkout session for subscription products.
 * Returns the checkout URL to redirect the user to.
 */
export async function createCheckoutSession(
  options: CreateCheckoutOptions
): Promise<{ checkoutUrl: string; sessionId: string }> {
  const client = getDodoClient();

  const response = await client.checkoutSessions.create({
    product_cart: [
      {
        product_id: options.productId,
        quantity: options.quantity ?? 1,
      },
    ],
    customer: {
      email: options.customerEmail,
      name: options.customerName || options.customerEmail.split("@")[0],
    },
    metadata: options.metadata || {},
    return_url: config.dodoPaymentsReturnUrl,
    subscription_data: options.trialPeriodDays
      ? { trial_period_days: options.trialPeriodDays }
      : undefined,
  });

  if (!response.checkout_url) {
    throw new Error("Dodo Payments did not return a checkout URL");
  }

  return {
    checkoutUrl: response.checkout_url,
    sessionId: response.session_id,
  };
}

// =============================================================================
// Customer Portal
// =============================================================================

/**
 * Creates a customer portal session link.
 * The portal allows users to manage their subscription, update payment methods, etc.
 */
export async function createPortalSession(
  dodoCustomerId: string
): Promise<string> {
  const client = getDodoClient();

  const session = await client.customers.customerPortal.create(dodoCustomerId, {
    return_url: config.dodoPaymentsReturnUrl,
  });

  return session.link;
}

// =============================================================================
// Webhook Verification
// =============================================================================

/**
 * Verify and unwrap a Dodo Payments webhook event.
 * Uses the SDK's built-in signature verification.
 * Throws if the signature is invalid.
 */
export function verifyAndUnwrapWebhook(
  rawBody: string,
  headers: Record<string, string>
): DodoPayments.Webhooks.UnwrapWebhookEvent {
  const client = getDodoClient();
  return client.webhooks.unwrap(rawBody, { headers });
}

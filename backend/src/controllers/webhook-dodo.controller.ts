import { Request, Response } from "express";
import { verifyAndUnwrapWebhook } from "../services/dodo.client";
import { processWebhookEvent } from "../services/webhook-handlers.service";
import logger from "../lib/logger";

/**
 * POST /api/webhooks/dodo-payments
 *
 * Receives Dodo Payments webhook events.
 * - No auth middleware (public endpoint)
 * - Signature verified via Dodo SDK
 * - Request body must be raw text (not parsed JSON) for signature verification
 */
export const handleDodoWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // The raw body is available as a string (configured in route with express.raw)
    const rawBody = typeof req.body === "string"
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body.toString("utf8")
        : JSON.stringify(req.body);

    // Extract headers as a flat record
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        headers[key] = value;
      } else if (Array.isArray(value)) {
        headers[key] = value[0];
      }
    }

    // Verify signature and unwrap the event
    let event;
    try {
      event = verifyAndUnwrapWebhook(rawBody, headers);
    } catch (err) {
      logger.warn({ err }, "Dodo webhook signature verification failed");
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    // Process the event asynchronously (don't block the response)
    // We respond 200 immediately to Dodo, then process in background
    res.status(200).json({ received: true });

    // Process after responding (prevents Dodo timeouts)
    setImmediate(async () => {
      try {
        await processWebhookEvent(event);
      } catch (err) {
        logger.error({ err, type: event.type }, "Error processing Dodo webhook event");
      }
    });
  } catch (err) {
    logger.error({ err }, "Unexpected error in Dodo webhook handler");
    res.status(500).json({ error: "Internal server error" });
  }
};

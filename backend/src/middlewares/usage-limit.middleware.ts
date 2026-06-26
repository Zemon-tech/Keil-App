import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import * as subscriptionService from "../services/subscription.service";
import logger from "../lib/logger";

interface RecordingQuotaOptions {
  /** When true, increments the monthly recording counter after the check passes. */
  record?: boolean;
}

async function enforceRecordingQuota(
  req: Request,
  res: Response,
  next: NextFunction,
  options: RecordingQuotaOptions
): Promise<void> {
  if (config.bypassUsageLimits) {
    next();
    return;
  }

  const userId = (req as any).user?.id as string;
  if (!userId) {
    next();
    return;
  }

  try {
    const check = await subscriptionService.checkRecordingUsage(userId);

    if (!check.allowed) {
      res.status(429).json({
        success: false,
        code: "LIMIT_REACHED",
        resource: check.resource,
        limit: check.limit,
        message: `Monthly recording limit of ${check.limit} reached. Upgrade your plan for unlimited recordings.`,
      });
      return;
    }

    if (check.warning) {
      res.setHeader(
        "x-plan-warning",
        `recordings_monthly_${Math.round(((check.limit! - check.remaining!) / check.limit!) * 100)}`
      );
    }

    if (options.record) {
      await subscriptionService.recordRecordingUsage(userId);
    }

    next();
  } catch (err) {
    // Fail open on billing errors
    logger.error({ err, userId }, "Recording usage check failed — allowing request");
    next();
  }
}

/**
 * Checks monthly recording quota before issuing an upload URL.
 * Does not increment usage — quota is charged when transcription starts.
 */
export const requireRecordingQuota = (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => enforceRecordingQuota(req, res, next, { record: false });

/**
 * Checks and records monthly recording usage when transcription is initiated.
 */
export const recordRecordingQuota = (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => enforceRecordingQuota(req, res, next, { record: true });

/**
 * Checks AI chat usage for the current user.
 * This is NOT a middleware (Mastra chat is not Express) — it's a function
 * called directly from the Mastra chat handler.
 *
 * Returns: { allowed, warning, warningMessage, errorMessage }
 */
export async function checkAiChatLimit(userId: string): Promise<{
  allowed: boolean;
  warning: boolean;
  warningHeader: string | null;
  errorMessage: string | null;
  errorCode: string | null;
}> {
  if (config.bypassUsageLimits) {
    return { allowed: true, warning: false, warningHeader: null, errorMessage: null, errorCode: null };
  }

  try {
    const check = await subscriptionService.checkAiChatUsage(userId);

    if (!check.allowed) {
      const msg = check.resource === "ai_chats_hourly"
        ? `Hourly AI chat limit of ${check.limit} reached. Please wait before trying again.`
        : `Daily AI chat limit of ${check.limit} reached. Please try again tomorrow.`;

      return {
        allowed: false,
        warning: false,
        warningHeader: null,
        errorMessage: msg,
        errorCode: "LIMIT_REACHED",
      };
    }

    let warningHeader: string | null = null;
    if (check.warning) {
      warningHeader = `${check.resource}_${Math.round(((check.limit! - check.remaining!) / check.limit!) * 100)}`;
    }

    // Increment usage counter
    await subscriptionService.recordAiChatUsage(userId);

    return {
      allowed: true,
      warning: check.warning,
      warningHeader,
      errorMessage: null,
      errorCode: null,
    };
  } catch (err) {
    // Fail open on billing errors
    logger.error({ err, userId }, "AI chat usage check failed — allowing request");
    return { allowed: true, warning: false, warningHeader: null, errorMessage: null, errorCode: null };
  }
}

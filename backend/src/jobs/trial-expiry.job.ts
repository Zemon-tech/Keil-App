import * as subscriptionService from "../services/subscription.service";
import logger from "../lib/logger";

const ONE_HOUR_MS = 60 * 60 * 1000;

let intervalId: NodeJS.Timeout | null = null;

/**
 * Trial Expiry Job
 *
 * Runs every hour and performs two operations:
 * 1. Expire trials: trialing → expired (trial_ends_at has passed)
 * 2. Lock accounts: expired → locked (7-day grace period has passed)
 *
 * This is a simple setInterval-based job. For production at scale,
 * consider replacing with a proper job queue (Bull, pg-boss, etc).
 */
async function runTrialExpiryJob(): Promise<void> {
  const startTime = Date.now();
  logger.info("Trial expiry job started");

  try {
    // Step 1: Expire trials that have passed their end date
    const expiredCount = await subscriptionService.expireTrials();

    // Step 2: Lock accounts past the 7-day grace period
    const lockedCount = await subscriptionService.lockExpiredAccounts();

    const duration = Date.now() - startTime;
    logger.info(
      { expiredCount, lockedCount, durationMs: duration },
      "Trial expiry job completed"
    );
  } catch (err) {
    logger.error({ err }, "Trial expiry job failed");
  }
}

/**
 * Start the trial expiry cron job.
 * Runs immediately on first call, then repeats every hour.
 */
export function startTrialExpiryJob(): void {
  if (intervalId) {
    logger.warn("Trial expiry job already running, skipping duplicate start");
    return;
  }

  logger.info("Scheduling trial expiry job (runs every hour)");

  // Run once immediately on startup (after a short delay to let DB connections settle)
  setTimeout(() => {
    runTrialExpiryJob();
  }, 5000);

  // Then repeat every hour
  intervalId = setInterval(runTrialExpiryJob, ONE_HOUR_MS);
}

/**
 * Stop the trial expiry cron job (for graceful shutdown).
 */
export function stopTrialExpiryJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("Trial expiry job stopped");
  }
}

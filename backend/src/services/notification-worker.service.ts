import { notificationOutboxRepository, notificationRepository, userNotificationPreferenceRepository } from "../repositories";
import { UserNotificationPreference } from "../types/entities";
import { io } from "../socket";
import { PoolClient } from "pg";
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("notification-worker");

const PREFERENCE_KEYS: Record<string, keyof UserNotificationPreference> = {
  'task_assigned': 'notify_task_assigned',
  'someone_messaged': 'notify_message',
  'motion_shared': 'notify_motion_shared',
  'task_status_changed': 'notify_status_changed',
  'membership_updates': 'notify_membership_updated',
  'mention_in_comment': 'notify_comment_mention'
};

export class NotificationWorkerService {
  private static intervalId: NodeJS.Timeout | null = null;
  private static isRunning: boolean = false;
  private static pollingIntervalMs: number = 2000; // 2 seconds

  /**
   * Start the background outbox processing loop
   */
  static start() {
    if (this.intervalId) {
      log.warn("Already running");
      return;
    }

    log.info("Starting background notification worker...");
    this.intervalId = setInterval(() => this.processQueue(), this.pollingIntervalMs);
  }

  /**
   * Stop the background outbox processing loop
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info("Stopped background notification worker");
    }
  }

  /**
   * Process a batch of pending outbox notifications
   */
  private static async processQueue() {
    if (this.isRunning) return; // Prevent concurrent overlaps of the loop
    this.isRunning = true;

    try {
      await notificationOutboxRepository.executeInTransaction(async (client: PoolClient) => {
        // 1. Claim next pending batch atomically
        const batch = await notificationOutboxRepository.claimPendingBatch(10, client);
        
        if (batch.length === 0) {
          return;
        }

        log.info({ batchSize: batch.length }, "Claimed batch of notification outbox jobs");

        for (const job of batch) {
          try {
            const recipientIds: string[] = job.payload.recipient_ids || [];
            const actorId = job.sender_id;
            const prefKey = PREFERENCE_KEYS[job.event_type];

            log.debug({
              jobId: job.id,
              eventType: job.event_type,
              spaceId: job.space_id,
              actorId,
              recipientIds,
              prefKey: prefKey || '(none — always deliver)',
              payload: job.payload
            }, "[worker] Processing outbox job");

            // Filter out actor and get unique active recipient IDs
            const targets = Array.from(new Set(recipientIds)).filter(id => id !== actorId);

            if (targets.length === 0) {
              log.warn({ jobId: job.id, recipientIds, actorId }, "[worker] No valid targets after filtering — deleting job");
              // No valid recipients, delete and continue
              await notificationOutboxRepository.delete(job.id, client);
              continue;
            }

            log.debug({ jobId: job.id, targets }, "[worker] Delivering to targets");

            // Query sender info if present
            let senderInfo: { name: string | null; email: string | null; avatar_url: string | null } | null = null;
            if (actorId) {
              const senderRes = await client.query(
                `SELECT name, email, avatar_url FROM public.users WHERE id = $1`,
                [actorId]
              );
              if (senderRes.rows.length > 0) {
                senderInfo = senderRes.rows[0];
              }
            }

            for (const recipientId of targets) {
              // Fetch user preferences
              const prefs = await userNotificationPreferenceRepository.findByUserId(recipientId, client);
              
              // If preference key doesn't match or is enabled, distribute notification
              const isOptedIn = !prefKey || (prefs as any)[prefKey] === true;

              log.debug({ recipientId, prefKey, isOptedIn, hasPrefs: !!prefs }, "[worker] Preference check");

              if (isOptedIn) {
                // Insert into system notifications feed
                const notification = await notificationRepository.create({
                  org_id: job.org_id,
                  space_id: job.space_id,
                  recipient_id: recipientId,
                  sender_id: actorId,
                  event_type: job.event_type,
                  entity_type: job.entity_type,
                  entity_id: job.entity_id,
                  payload: job.payload
                }, client);

                log.info({
                  notificationId: notification.id,
                  recipientId,
                  eventType: job.event_type,
                  spaceId: job.space_id
                }, "[worker] Notification created in DB");

                // Push real-time event via WebSocket
                if (io) {
                  io.to(`user:${recipientId}`).emit("new_notification", {
                    ...notification,
                    created_at: notification.created_at.toISOString(),
                    read_at: null,
                    sender_name: senderInfo?.name || null,
                    sender_email: senderInfo?.email || null,
                    sender_avatar: senderInfo?.avatar_url || null
                  });
                  log.debug({ recipientId }, "[worker] WebSocket event emitted");
                }
              } else {
                log.debug({ recipientId, prefKey }, "[worker] Recipient opted out — skipping");
              }
            }

            // Delete outbox job on successful processing
            await notificationOutboxRepository.delete(job.id, client);
            log.debug({ jobId: job.id }, "[worker] Outbox job deleted after successful processing");
          } catch (err: any) {
            log.error({ err, jobId: job.id }, "Error processing outbox job");
            
            // If job has failed more than 3 times, mark status as failed
            if (job.attempts >= 3) {
              await notificationOutboxRepository.update(job.id, { status: 'failed' }, client);
            } else {
              // Set status back to pending so it retries
              await notificationOutboxRepository.update(job.id, { status: 'pending' }, client);
            }
          }
        }
      });
    } catch (err: any) {
      log.error({ err }, "Queue processing transaction failed");
    } finally {
      this.isRunning = false;
    }
  }
}

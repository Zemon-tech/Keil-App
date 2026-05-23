import { notificationOutboxRepository, notificationRepository, userNotificationPreferenceRepository } from "../repositories";
import { UserNotificationPreference } from "../types/entities";
import { io } from "../socket";
import { PoolClient } from "pg";

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
      console.log("⏰ [notification-worker]: Already running.");
      return;
    }

    console.log("🚀 [notification-worker]: Starting background notification worker...");
    this.intervalId = setInterval(() => this.processQueue(), this.pollingIntervalMs);
  }

  /**
   * Stop the background outbox processing loop
   */
  static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("🛑 [notification-worker]: Stopped background notification worker.");
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

        console.log(`📦 [notification-worker]: Claimed batch of ${batch.length} notification outbox jobs.`);

        for (const job of batch) {
          try {
            const recipientIds: string[] = job.payload.recipient_ids || [];
            const actorId = job.sender_id;
            const prefKey = PREFERENCE_KEYS[job.event_type];

            // Filter out actor and get unique active recipient IDs
            const targets = Array.from(new Set(recipientIds)).filter(id => id !== actorId);

            if (targets.length === 0) {
              // No valid recipients, delete and continue
              await notificationOutboxRepository.delete(job.id, client);
              continue;
            }

            for (const recipientId of targets) {
              // Fetch user preferences
              const prefs = await userNotificationPreferenceRepository.findByUserId(recipientId, client);
              
              // If preference key doesn't match or is enabled, distribute notification
              const isOptedIn = !prefKey || (prefs as any)[prefKey] === true;

              if (isOptedIn) {
                // Insert into system notifications feed
                const notification = await notificationRepository.create({
                  workspace_id: job.workspace_id,
                  org_id: job.org_id,
                  space_id: job.space_id,
                  recipient_id: recipientId,
                  sender_id: actorId,
                  event_type: job.event_type,
                  entity_type: job.entity_type,
                  entity_id: job.entity_id,
                  payload: job.payload
                }, client);

                // Push real-time event via WebSocket
                if (io) {
                  io.to(`user:${recipientId}`).emit("new_notification", {
                    ...notification,
                    created_at: notification.created_at.toISOString(),
                    read_at: null
                  });
                }
              }
            }

            // Delete outbox job on successful processing
            await notificationOutboxRepository.delete(job.id, client);
          } catch (err: any) {
            console.error(`❌ [notification-worker]: Error processing outbox job ${job.id}:`, err);
            
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
      console.error("❌ [notification-worker]: Queue processing transaction failed:", err);
    } finally {
      this.isRunning = false;
    }
  }
}

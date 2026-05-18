import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { calendar_v3 } from 'googleapis';
import * as crypto from 'crypto';
import pool from '../config/pg';
import { config } from '../config';
import { integrationRepository } from '../repositories';
import { personalTaskRepository } from '../repositories';
import { TaskStatus, TaskPriority } from '../types/enums';

// Lazy import to avoid circular dependency with socket.ts
function getIO() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { io } = require('../socket');
    return io;
  } catch {
    return null;
  }
}

/**
 * Look up the user's default org and space (the one auto-created on login).
 * Returns null if the user has no org/space yet.
 */
async function getUserDefaultOrgSpace(
  userId: string
): Promise<{ orgId: string; spaceId: string; workspaceId: string | null } | null> {
  // Find the org where the user is the owner (their default org created on signup)
  const result = await pool.query(
    `SELECT o.id as org_id, s.id as space_id, s.workspace_id
     FROM public.organisations o
     INNER JOIN public.spaces s ON s.org_id = o.id AND s.deleted_at IS NULL
     WHERE o.owner_user_id = $1
       AND o.deleted_at IS NULL
     ORDER BY o.created_at ASC, s.created_at ASC
     LIMIT 1`,
    [userId]
  );
  if (result.rows.length === 0) return null;
  return {
    orgId: result.rows[0].org_id,
    spaceId: result.rows[0].space_id,
    workspaceId: result.rows[0].workspace_id,
  };
}

const PROVIDER = 'google_calendar';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Minimal task shape needed for Google Calendar sync.
 * Both workspace tasks and personal tasks are mapped to this before calling sync.
 */
export interface SyncableTask {
  id: string;
  title: string;
  description?: string | null;
  start_date?: Date | null;
  due_date?: Date | null;
  is_all_day?: boolean;
  location?: string | null;
  status?: string | null;
  google_event_id?: string | null;
  /** Which table to write google_event_id back to after creation */
  source: 'tasks' | 'personal_tasks';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createOAuth2Client(): OAuth2Client {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );
}

/**
 * Sign a state string with HMAC-SHA256 using the configured state secret.
 * Format: "<payload>.<signature>"
 */
function signState(payload: string): string {
  const sig = crypto
    .createHmac('sha256', config.googleOAuthStateSecret)
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

/**
 * Verify and decode a signed state string.
 * Returns the decoded payload or throws if invalid/tampered.
 */
function verifyState(signedState: string): { userId: string; ts: number } {
  const lastDot = signedState.lastIndexOf('.');
  if (lastDot === -1) throw new Error('Invalid state format');

  const payload = signedState.substring(0, lastDot);
  const receivedSig = signedState.substring(lastDot + 1);

  const expectedSig = crypto
    .createHmac('sha256', config.googleOAuthStateSecret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(receivedSig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    throw new Error('State signature mismatch — possible CSRF attempt');
  }

  return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
}

/**
 * Map a task status string to a Google Calendar event status.
 * Google accepts: 'confirmed' | 'tentative' | 'cancelled'
 */
function mapStatusToGoogle(status?: string | null): 'confirmed' | 'tentative' | 'cancelled' {
  if (status === 'tentative') return 'tentative';
  if (status === 'cancelled') return 'cancelled';
  return 'confirmed'; // default for all task statuses (backlog, todo, in-progress, done, etc.)
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate the Google OAuth consent URL for a given user.
 * The state param is a signed, base64-encoded JSON blob containing the userId.
 */
export function getAuthUrl(userId: string): string {
  const oauth2Client = createOAuth2Client();

  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64');
  const state = signState(payload);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // always request refresh token
    scope: [CALENDAR_SCOPE],
    state,
  });
}

/**
 * Handle the OAuth callback from Google.
 * Exchanges the auth code for tokens and persists them.
 * Returns the userId so the controller can fire registerWatch() after redirect.
 */
export async function handleCallback(code: string, state: string): Promise<{ userId: string }> {
  // Verify state to prevent CSRF
  const { userId } = verifyState(state);

  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    // This can happen if the user has already granted access before and
    // Google doesn't re-issue a refresh token. Force re-consent via getAuthUrl.
    throw new Error(
      'No refresh token returned. User may need to revoke access and reconnect.'
    );
  }

  const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  await integrationRepository.upsert(userId, PROVIDER, {
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token,
    token_expiry: expiry,
  });

  return { userId };
}

/**
 * Build an authorized OAuth2 client for a user.
 * Automatically refreshes the access token if it is expired or close to expiry.
 * Returns null if the user has not connected Google Calendar.
 */
export async function getAuthorizedClient(userId: string): Promise<OAuth2Client | null> {
  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration) return null;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
    expiry_date: integration.token_expiry ? integration.token_expiry.getTime() : undefined,
  });

  // Refresh if expired or expiring within 5 minutes
  const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
  const isExpired =
    !integration.token_expiry ||
    integration.token_expiry.getTime() < fiveMinutesFromNow;

  if (isExpired) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token && credentials.expiry_date) {
        await integrationRepository.updateTokens(
          userId,
          PROVIDER,
          credentials.access_token,
          new Date(credentials.expiry_date)
        );
        oauth2Client.setCredentials(credentials);
      }
    } catch (err) {
      // Refresh failed — token may have been revoked by the user in Google settings.
      // Log and return null so sync is silently skipped rather than crashing.
      console.error(`[gcal] Token refresh failed for user ${userId}:`, (err as Error).message);
      return null;
    }
  }

  return oauth2Client;
}

/**
 * Sync a task to the user's Google Calendar.
 *
 * Behaviour:
 * - options.skipGoogleSync = true → return immediately (called from inbound sync to prevent echo loops)
 * - No start_date → delete existing Google event (if any) and clear google_event_id
 * - Has start_date + existing google_event_id → update the Google event
 * - Has start_date + no google_event_id → create a new Google event, write ID back to DB
 * - User not connected → silent no-op
 *
 * This function MUST be called fire-and-forget (do not await at call site).
 * It never throws — all errors are caught and logged.
 *
 * The optional `options` parameter is backward-compatible — all existing callers
 * that omit it continue working exactly as before.
 */
export async function syncTaskToCalendar(
  userId: string,
  task: SyncableTask,
  options?: { skipGoogleSync?: boolean }
): Promise<void> {
  // --- INBOUND SYNC LOOP RETRIGGER SUPPRESSION ---
  // When processIncomingGoogleEvent() updates a task, it passes skipGoogleSync: true
  // to prevent the update from being echoed back to Google Calendar.
  if (options?.skipGoogleSync) {
    console.log(`[gcal] Suppressing outbound sync for task ${task.id} — update originated from Google.`);
    return;
  }

  // If no start_date, the task is not scheduled — remove any existing Google event
  if (!task.start_date) {
    if (task.google_event_id) {
      await deleteCalendarEvent(userId, task.google_event_id);
      await clearGoogleEventId(task.id, task.source);
    }
    return;
  }

  const authClient = await getAuthorizedClient(userId);
  if (!authClient) return; // user not connected or token revoked — silent skip

  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration) return;

  const calendarId = integration.calendar_id || 'primary';

  const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

  // Build the event body (includes extendedProperties tagging for loop prevention)
  const eventBody = buildEventBody(task);

  try {
    if (task.google_event_id) {
      // Update existing event
      await calendar.events.update({
        calendarId,
        eventId: task.google_event_id,
        requestBody: eventBody,
      });
    } else {
      // Create new event
      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventBody,
      });

      const newEventId = response.data.id;
      if (newEventId) {
        await writeGoogleEventId(task.id, task.source, newEventId);
      }
    }
  } catch (err: any) {
    // If the event was deleted directly in Google Calendar, the ID is stale.
    // Clear it so the next sync creates a fresh event.
    if (err?.code === 404 || err?.code === 410) {
      await clearGoogleEventId(task.id, task.source);
    } else {
      // Re-throw so the fire-and-forget caller can log it
      throw err;
    }
  }
}

/**
 * Delete a Google Calendar event.
 * Silently ignores 404/410 (already deleted in Google).
 */
export async function deleteCalendarEvent(
  userId: string,
  googleEventId: string
): Promise<void> {
  const authClient = await getAuthorizedClient(userId);
  if (!authClient) return;

  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration) return;

  const calendarId = integration.calendar_id || 'primary';
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  try {
    await calendar.events.delete({ calendarId, eventId: googleEventId });
  } catch (err: any) {
    if (err?.code === 404 || err?.code === 410) return; // already gone — fine
    throw err;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Build the Google Calendar event request body from a SyncableTask.
 * Includes extendedProperties tagging so the inbound sync processor can
 * identify events created/updated by KeilHQ and skip them (loop prevention).
 */
function buildEventBody(task: SyncableTask): object {
  const startDate = task.start_date!; // guaranteed non-null by caller
  // Fallback: if no due_date, default to start + 1 hour
  const endDate = task.due_date ?? new Date(startDate.getTime() + 60 * 60 * 1000);

  // extendedProperties.private.source = 'keilhq' is the primary loop-prevention tag.
  // The inbound processIncomingGoogleEvent() checks this and skips the event.
  const extendedProperties = {
    private: {
      source: 'keilhq',
      taskId: task.id,
    },
  };

  if (task.is_all_day) {
    // All-day events use date strings (YYYY-MM-DD), not dateTime
    return {
      summary: task.title,
      description: task.description ?? undefined,
      location: task.location ?? undefined,
      status: mapStatusToGoogle(task.status),
      start: { date: formatDate(startDate) },
      end: { date: formatDate(endDate) },
      extendedProperties,
    };
  }

  return {
    summary: task.title,
    description: task.description ?? undefined,
    location: task.location ?? undefined,
    status: mapStatusToGoogle(task.status),
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
    extendedProperties,
  };
}

/** Format a Date as YYYY-MM-DD for all-day Google Calendar events */
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Write google_event_id back to the correct task table */
async function writeGoogleEventId(
  taskId: string,
  source: 'tasks' | 'personal_tasks',
  googleEventId: string
): Promise<void> {
  await pool.query(
    `UPDATE public.${source} SET google_event_id = $1 WHERE id = $2`,
    [googleEventId, taskId]
  );
}

/** Clear google_event_id on the task row (event was deleted or unscheduled) */
async function clearGoogleEventId(
  taskId: string,
  source: 'tasks' | 'personal_tasks'
): Promise<void> {
  await pool.query(
    `UPDATE public.${source} SET google_event_id = NULL WHERE id = $1`,
    [taskId]
  );
}

// =============================================================================
// 2-WAY SYNC — NEW FUNCTIONS (Phase 3–5)
// All functions below are additive. Existing functions above are unchanged.
// =============================================================================

// ─── Helper: find a task by google_event_id OR stable ical_uid ───────────────

interface MatchedTask {
  id: string;
  source: 'tasks' | 'personal_tasks';
  title: string;
  updated_at: Date;
  start_date: Date | null;
  due_date: Date | null;
  owner_user_id?: string;
  created_by?: string;
}

async function findTaskByGoogleEventIdOrIcalUid(
  googleEventId: string,
  icalUid?: string | null
): Promise<MatchedTask | null> {
  // 1. Search personal_tasks first
  const personalResult = await pool.query(
    `SELECT id, title, updated_at, start_date, due_date, owner_user_id
     FROM public.personal_tasks
     WHERE deleted_at IS NULL
       AND (google_event_id = $1 OR (ical_uid IS NOT NULL AND ical_uid = $2))
     LIMIT 1`,
    [googleEventId, icalUid ?? null]
  );
  if (personalResult.rows.length > 0) {
    return { ...personalResult.rows[0], source: 'personal_tasks' as const };
  }

  // 2. Fall back to org tasks
  const orgResult = await pool.query(
    `SELECT id, title, updated_at, start_date, due_date, created_by
     FROM public.tasks
     WHERE deleted_at IS NULL
       AND (google_event_id = $1 OR (ical_uid IS NOT NULL AND ical_uid = $2))
     LIMIT 1`,
    [googleEventId, icalUid ?? null]
  );
  if (orgResult.rows.length > 0) {
    return { ...orgResult.rows[0], source: 'tasks' as const };
  }

  return null;
}

// ─── Helper: soft-delete a task from Google cancellation ─────────────────────

async function softDeleteTaskFromGoogle(
  id: string,
  source: 'tasks' | 'personal_tasks'
): Promise<void> {
  const table = source === 'tasks' ? 'public.tasks' : 'public.personal_tasks';
  await pool.query(
    `UPDATE ${table} SET deleted_at = NOW(), google_event_id = NULL WHERE id = $1`,
    [id]
  );
  console.log(`[gcal] Soft-deleted task ${id} (source: ${source}) — Google event was cancelled.`);
}// ─── processIncomingGoogleEvent ───────────────────────────────────────────────

/**
 * Apply a single incoming Google Calendar event to the KeilHQ task store.
 * Called by both doFullSync() and doIncrementalSync() for each changed event.
 *
 * Decision tree:
 * 1. Skip if event was created by KeilHQ (extendedProperties.private.source = 'keilhq')
 * 2. Skip if event is outside the 30-day sync window
 * 3. If cancelled → soft-delete matching task
 * 4. If no matching task → create new personal task
 * 5. If matching task + Google is newer by >5s → update task (skipGoogleSync=true)
 * 6. If values identical → skip (no-op)
 */
export async function processIncomingGoogleEvent(
  userId: string,
  event: calendar_v3.Schema$Event
): Promise<void> {
  // --- SYNC LOOP PREVENTION ---
  const source = event.extendedProperties?.private?.['source'];
  if (source === 'keilhq') {
    console.log(`[gcal] Skipping event ${event.id} — originated from KeilHQ (loop prevention).`);
    return;
  }

  const googleEventId = event.id;
  const icalUid = event.iCalUID ?? null;
  if (!googleEventId) return;

  // --- SYNC WINDOW FILTER ---
  // For cancelled events, skip the window check — we always want to soft-delete
  if (event.status !== 'cancelled') {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const isAllDay = !!event.start?.date;
    const startRaw = isAllDay ? event.start?.date : event.start?.dateTime;
    if (!startRaw) {
      console.log(`[gcal] Skipping event ${googleEventId} — no start date.`);
      return;
    }
    const startDate = new Date(startRaw);

    // Block past events — match KeilHQ's create dialog behavior:
    // All-day: block if strictly before today
    // Timed: block if even one minute in the past
    if (isAllDay) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDate < today) {
        console.log(`[gcal] Skipping event ${googleEventId} — all-day event is in the past.`);
        return;
      }
    } else {
      if (startDate < now) {
        console.log(`[gcal] Skipping event ${googleEventId} — timed event is in the past.`);
        return;
      }
    }

    if (startDate > thirtyDaysFromNow) {
      console.log(`[gcal] Skipping event ${googleEventId} — outside 30-day sync window.`);
      return;
    }
  }

  // --- FIND MATCHING TASK ---
  const matchingTask = await findTaskByGoogleEventIdOrIcalUid(googleEventId, icalUid);

  // --- CANCELLED EVENT: soft-delete ---
  if (event.status === 'cancelled') {
    if (matchingTask) {
      await softDeleteTaskFromGoogle(matchingTask.id, matchingTask.source);
      // Notify frontend to refresh tasks
      const io = getIO();
      if (io) io.to(`user:${userId}`).emit('gcal_tasks_updated', { userId });
    }
    return;
  }

  // Parse dates for create/update paths
  const isAllDay = !!event.start?.date;
  const startDate = isAllDay
    ? new Date(event.start!.date!)
    : new Date(event.start!.dateTime!);
  const dueDate = isAllDay
    ? new Date(event.end!.date!)
    : new Date(event.end!.dateTime!);

  // --- NO MATCHING TASK: create new org task in user's default workspace ---
  if (!matchingTask) {
    try {
      // Look up the user's default org and space
      const defaultOrgSpace = await getUserDefaultOrgSpace(userId);

      if (defaultOrgSpace) {
        // Create as org task in the user's default workspace (General space)
        await pool.query(
          `INSERT INTO public.tasks
             (org_id, space_id, workspace_id, title, start_date, due_date,
              google_event_id, ical_uid, status, priority, created_by, type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'task')`,
          [
            defaultOrgSpace.orgId,
            defaultOrgSpace.spaceId,
            defaultOrgSpace.workspaceId,
            event.summary || 'Untitled Google Event',
            startDate,
            dueDate,
            googleEventId,
            icalUid,
            TaskStatus.TODO,
            TaskPriority.MEDIUM,
            userId,
          ]
        );
        console.log(`[gcal] Created org task from Google event ${googleEventId} for user ${userId} in space ${defaultOrgSpace.spaceId}.`);
      } else {
        // Fallback to personal task if no org/space found
        await personalTaskRepository.create({
          owner_user_id: userId,
          title: event.summary || 'Untitled Google Event',
          start_date: startDate,
          due_date: dueDate,
          google_event_id: googleEventId,
          ical_uid: icalUid,
          status: TaskStatus.TODO,
          priority: TaskPriority.MEDIUM,
        });
        console.log(`[gcal] Created personal task (fallback) from Google event ${googleEventId} for user ${userId}.`);
      }

      // Notify frontend to refresh tasks
      const io = getIO();
      if (io) io.to(`user:${userId}`).emit('gcal_tasks_updated', { userId });

    } catch (err: any) {
      if (err.code === '23505') {
        // Duplicate key — another concurrent worker already created this task
        console.warn(`[gcal] Duplicate task for googleEventId ${googleEventId} — treating as idempotent success.`);
        return;
      }
      throw err;
    }
    return;
  }

  // --- MATCHING TASK EXISTS ---

  const newTitle = event.summary ?? matchingTask.title;

  // Skip if values are identical (prevent pointless writes and timestamp update wars)
  const sameDates = (d1: Date | string | null, d2: Date | null) => {
    if (!d1 && !d2) return true;
    if (!d1 || !d2) return false;
    return new Date(d1).getTime() === new Date(d2).getTime();
  };
  if (
    matchingTask.title === newTitle &&
    sameDates(matchingTask.start_date, startDate) &&
    sameDates(matchingTask.due_date, dueDate)
  ) {
    console.log(`[gcal] Task ${matchingTask.id} is already up-to-date — skipping write.`);
    return;
  }

  // Conflict resolution: last write wins with 5-second tolerance window
  const googleUpdatedAt = event.updated ? new Date(event.updated) : new Date();
  const ourUpdatedAt = new Date(matchingTask.updated_at);
  const timeDiffMs = Math.abs(googleUpdatedAt.getTime() - ourUpdatedAt.getTime());

  if (googleUpdatedAt <= ourUpdatedAt || timeDiffMs < 5000) {
    console.log(`[gcal] Skipping update for task ${matchingTask.id} — KeilHQ version is newer or within 5s tolerance (diff: ${timeDiffMs}ms).`);
    return;
  }

  // Google is newer — update the task with skipGoogleSync to prevent echo loop
  console.log(`[gcal] Updating task ${matchingTask.id} from Google event ${googleEventId} (Google is ${timeDiffMs}ms newer).`);

  if (matchingTask.source === 'personal_tasks') {
    // Update directly via repository to avoid circular import with personal-task.service.
    // skipGoogleSync is implicit here — we never call syncTaskToCalendar from this path.
    await personalTaskRepository.update(matchingTask.id, {
      title: newTitle,
      start_date: startDate,
      due_date: dueDate,
    });
  } else {
    // Update org task directly via pool query to avoid circular import with task.service.
    await pool.query(
      `UPDATE public.tasks
       SET title = $1, start_date = $2, due_date = $3
       WHERE id = $4 AND deleted_at IS NULL`,
      [newTitle, startDate, dueDate, matchingTask.id]
    );
  }

  // Notify frontend to refresh tasks
  const io = getIO();
  if (io) io.to(`user:${userId}`).emit('gcal_tasks_updated', { userId });
}

// ─── doFullSync ───────────────────────────────────────────────────────────────

/**
 * Fetch all events in the 30-day window and process them.
 * Called once when a watch is first registered, or when a syncToken expires (410).
 * Returns the nextSyncToken for storage.
 */
export async function doFullSync(
  userId: string,
  calendarId: string,
  authClient: OAuth2Client
): Promise<string | undefined> {
  const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  let pageToken: string | undefined;
  let syncToken: string | undefined;
  let totalProcessed = 0;

  console.log(`[gcal] Starting full sync for user ${userId} on calendar ${calendarId}.`);

  do {
    const response = await calendar.events.list({
      calendarId,
      singleEvents: true,
      timeMin: now.toISOString(),
      timeMax: thirtyDaysFromNow.toISOString(),
      pageToken,
    });

    const items = response.data.items ?? [];
    for (const event of items) {
      await processIncomingGoogleEvent(userId, event);
      totalProcessed++;
    }

    pageToken = response.data.nextPageToken ?? undefined;
    syncToken = response.data.nextSyncToken ?? undefined;
  } while (pageToken);

  console.log(`[gcal] Full sync complete for user ${userId} — processed ${totalProcessed} events. syncToken: ${syncToken ? 'obtained' : 'none'}.`);
  return syncToken;
}

// ─── stopWatch ────────────────────────────────────────────────────────────────

/**
 * Stop an existing Google Calendar watch channel.
 * Called when a user disconnects Google Calendar.
 * Errors are swallowed — the channel may already be expired.
 */
export async function stopWatch(userId: string): Promise<void> {
  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration?.watch_channel_id || !integration?.watch_resource_id) {
    // No active watch channel — nothing to stop
    return;
  }

  const authClient = await getAuthorizedClient(userId);
  if (!authClient) {
    // Token revoked — just clear the DB fields
    await integrationRepository.clearWatchChannel(userId, PROVIDER);
    return;
  }

  const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

  try {
    await calendar.channels.stop({
      requestBody: {
        id: integration.watch_channel_id,
        resourceId: integration.watch_resource_id,
      },
    });
    console.log(`[gcal] Stopped watch channel ${integration.watch_channel_id} for user ${userId}.`);
  } catch (err: any) {
    // Channel may already be expired or unknown to Google — log and continue
    console.warn(`[gcal] Failed to stop watch channel ${integration.watch_channel_id} for user ${userId}:`, err.message);
  }

  await integrationRepository.clearWatchChannel(userId, PROVIDER);
}

// ─── registerWatch ────────────────────────────────────────────────────────────

/**
 * Register a Google Calendar push notification channel for a user.
 * Called fire-and-forget after OAuth callback and by the renewal cron.
 *
 * Flow:
 * 1. Acquire advisory lock (prevent concurrent registrations for same user)
 * 2. Stop any existing channel
 * 3. Register new watch via calendar.events.watch()
 * 4. Run doFullSync() to get initial syncToken
 * 5. Atomically persist all watch data + set watch_status = 'active'
 * 6. On failure: set watch_status = 'degraded', log error, do NOT throw
 */
export async function registerWatch(userId: string): Promise<void> {
  const authClient = await getAuthorizedClient(userId);
  if (!authClient) {
    console.warn(`[gcal] registerWatch: no auth client for user ${userId} — skipping.`);
    return;
  }

  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration) return;

  // Acquire advisory lock to prevent concurrent registrations
  const watchLockKey = `gcal-watch:${userId}`;
  const lockClient = await pool.connect();

  try {
    const lockRes = await lockClient.query(
      'SELECT pg_try_advisory_lock(hashtext($1))',
      [watchLockKey]
    );
    if (!lockRes.rows[0].pg_try_advisory_lock) {
      console.log(`[gcal] Watch registration already in progress for user ${userId} — skipping.`);
      lockClient.release();
      return;
    }

    // Stop any existing channel before registering a new one
    await stopWatch(userId);

    const channelId = crypto.randomUUID();
    const ttlMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const expiresAt = new Date(Date.now() + ttlMs);

    const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

    // Register the watch channel with Google
    const watchResponse = await calendar.events.watch({
      calendarId: integration.calendar_id || 'primary',
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: `${config.backendUrl}/api/v1/integrations/google/webhook`,
        expiration: String(Date.now() + ttlMs),
      },
    });

    const resourceId = watchResponse.data.resourceId;
    if (!resourceId) {
      throw new Error('Google did not return a resourceId for the watch channel.');
    }

    // Run full sync to get the initial syncToken
    const initialSyncToken = await doFullSync(
      userId,
      integration.calendar_id || 'primary',
      authClient
    );

    // Atomically persist watch metadata and transition to 'active'
    await integrationRepository.saveWatchChannel(userId, PROVIDER, {
      channelId,
      resourceId,
      expiresAt,
      syncToken: initialSyncToken,
    });

    console.log(`[gcal] Watch registered for user ${userId} — channelId: ${channelId}, expires: ${expiresAt.toISOString()}.`);

  } catch (err: any) {
    console.error(`[gcal] registerWatch failed for user ${userId}:`, err.message);

    // Mark as degraded so the self-healing cron can retry
    try {
      await pool.query(
        `UPDATE public.user_integrations
         SET watch_status = 'degraded'::public.gcal_watch_status
         WHERE user_id = $1`,
        [userId]
      );
    } catch (dbErr: any) {
      console.error(`[gcal] Failed to set degraded status for user ${userId}:`, dbErr.message);
    }
    // Do NOT rethrow — registerWatch is always called fire-and-forget
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [watchLockKey]);
    lockClient.release();
  }
}

// ─── doIncrementalSync ────────────────────────────────────────────────────────

/**
 * Fetch changed events using the stored syncToken and apply them to KeilHQ.
 * Called from the webhook handler via process.nextTick (fire-and-forget).
 *
 * Uses a PostgreSQL advisory lock to prevent concurrent runs for the same user.
 */
export async function doIncrementalSync(userId: string): Promise<void> {
  // Check out a dedicated connection for the advisory lock
  const lockClient = await pool.connect();

  try {
    // Acquire non-blocking advisory lock
    const lockResult = await lockClient.query(
      'SELECT pg_try_advisory_lock(hashtext($1))',
      [userId]
    );
    const acquired = lockResult.rows[0].pg_try_advisory_lock;
    if (!acquired) {
      console.log(`[gcal] Incremental sync already in progress for user ${userId} — skipping.`);
      lockClient.release();
      return;
    }

    const authClient = await getAuthorizedClient(userId);
    if (!authClient) {
      console.warn(`[gcal] doIncrementalSync: no auth client for user ${userId} — skipping.`);
      return;
    }

    const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
    if (!integration || integration.watch_status !== 'active' || !integration.gcal_sync_token) {
      console.log(`[gcal] Skipping incremental sync for user ${userId} — watch_status: ${integration?.watch_status}, syncToken: ${integration?.gcal_sync_token ? 'present' : 'missing'}.`);
      return;
    }

    // Mark sync as in-progress
    await pool.query(
      `UPDATE public.user_integrations
       SET sync_in_progress = TRUE, last_sync_error = NULL
       WHERE user_id = $1`,
      [userId]
    );

    const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

    console.log(`[gcal] Starting incremental sync for user ${userId}.`);

    try {
      const response = await calendar.events.list({
        calendarId: integration.calendar_id || 'primary',
        syncToken: integration.gcal_sync_token,
      });

      const items = response.data.items ?? [];
      console.log(`[gcal] Incremental sync: ${items.length} changed event(s) for user ${userId}.`);

      for (const event of items) {
        await processIncomingGoogleEvent(userId, event);
      }

      // Save the new syncToken
      if (response.data.nextSyncToken) {
        await integrationRepository.saveSyncToken(userId, PROVIDER, response.data.nextSyncToken);
      }

      // Mark sync as successful — also reset last_sync_at so next webhook isn't debounced
      await pool.query(
        `UPDATE public.user_integrations
         SET sync_in_progress = FALSE,
             last_sync_error = NULL,
             last_successful_sync_at = NOW(),
             last_sync_at = NULL
         WHERE user_id = $1`,
        [userId]
      );

      console.log(`[gcal] Incremental sync complete for user ${userId}.`);

    } catch (err: any) {
      // 401/403 — OAuth revoked
      if (
        err?.code === 401 ||
        err?.code === 403 ||
        err?.response?.data?.error === 'invalid_grant'
      ) {
        console.warn(`[gcal] OAuth revoked for user ${userId} (code: ${err?.code}) — cleaning up watch channel.`);
        await pool.query(
          `UPDATE public.user_integrations
           SET watch_status      = 'revoked'::public.gcal_watch_status,
               watch_channel_id  = NULL,
               watch_resource_id = NULL,
               watch_expires_at  = NULL,
               gcal_sync_token   = NULL,
               sync_in_progress  = FALSE,
               last_sync_error   = $1
           WHERE user_id = $2`,
          [`OAuth credentials revoked: ${err.message}`, userId]
        );
        return;
      }

      // 410 — syncToken expired; fall back to full sync
      if (err?.code === 410) {
        console.warn(`[gcal] syncToken expired (410) for user ${userId} — running full sync to recover.`);
        await integrationRepository.saveSyncToken(userId, PROVIDER, null);

        const freshSyncToken = await doFullSync(
          userId,
          integration.calendar_id || 'primary',
          authClient
        );
        if (freshSyncToken) {
          await integrationRepository.saveSyncToken(userId, PROVIDER, freshSyncToken);
        }

        await pool.query(
          `UPDATE public.user_integrations
           SET sync_in_progress = FALSE, last_successful_sync_at = NOW()
           WHERE user_id = $1`,
          [userId]
        );
        return;
      }

      // Other errors — log and mark as failed
      console.error(`[gcal] Incremental sync failed for user ${userId}:`, err.message);
      await pool.query(
        `UPDATE public.user_integrations
         SET sync_in_progress = FALSE, last_sync_error = $1
         WHERE user_id = $2`,
        [err.message, userId]
      );
      // Do not rethrow — this runs in a fire-and-forget context
    }

  } finally {
    // Always release the advisory lock and return the connection to the pool
    await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [userId]);
    lockClient.release();
  }
}

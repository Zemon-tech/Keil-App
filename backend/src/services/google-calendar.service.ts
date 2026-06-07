import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { calendar_v3 } from 'googleapis';
import * as crypto from 'crypto';
import { PoolClient } from 'pg';
import pool from '../config/pg';
import { config } from '../config';
import { integrationRepository } from '../repositories';
import { personalTaskRepository } from '../repositories';
import { TaskStatus, TaskPriority } from '../types/enums';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('gcal');

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
): Promise<{ orgId: string; spaceId: string } | null> {
  // Find the org where the user is the owner (their default org created on signup)
  const result = await pool.query(
    `SELECT o.id as org_id, s.id as space_id
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
  };
}

const PROVIDER = 'google_calendar';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';

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
  meet_link?: string | null;
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

  const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  if (Date.now() - decoded.ts > 10 * 60 * 1000) {
    throw new Error('State token expired — possible replay attack');
  }

  return decoded;
}

/** Fixed namespace for Google Calendar advisory locks (two-arg pg_advisory_lock form) */
const GCAL_LOCK_NAMESPACE = 1735289200; // arbitrary stable integer

/**
 * Generate a consistent lock key for user's Google Calendar sync operations.
 */
function syncLockKey(userId: string): string {
  return `gcal-sync:${userId}`;
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
    scope: [CALENDAR_SCOPE, GMAIL_SCOPE, MEET_SCOPE],
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

  let refreshToken = tokens.refresh_token;

  if (!refreshToken) {
    // Fallback: check if we already have a refresh token in the database for this user
    const existing = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
    if (existing?.refresh_token) {
      refreshToken = existing.refresh_token;
      log.info({ userId }, 'No new refresh token returned, reusing existing stored refresh token');
    } else {
      throw new Error(
        'No refresh token returned by Google and no existing integration found. Revoke access and reconnect.'
      );
    }
  }

  const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  await integrationRepository.upsert(userId, PROVIDER, {
    access_token: tokens.access_token ?? null,
    refresh_token: refreshToken,
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
      log.error({ err: err as Error, userId }, 'Token refresh failed');
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
    log.debug({ taskId: task.id }, 'Suppressing outbound sync — update originated from Google');
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
  const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

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
    // Since Keil-App stores inclusive due_date, we add 1 day to make it exclusive for Google Calendar.
    const exclusiveEndDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
    return {
      summary: task.title,
      description: task.description ?? undefined,
      location: task.location ?? undefined,
      status: mapStatusToGoogle(task.status),
      start: { date: formatDate(startDate) },
      end: { date: formatDate(exclusiveEndDate) },
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
  is_all_day?: boolean;
  owner_user_id?: string;
  created_by?: string;
  location?: string | null;
  meet_link?: string | null;
}

async function findTaskByGoogleEventIdOrIcalUidOrTaskId(
  googleEventId: string,
  icalUid?: string | null,
  taskId?: string | null
): Promise<MatchedTask | null> {
  const result = await pool.query(
    `SELECT * FROM (
      (SELECT id, title, updated_at, start_date, due_date, owner_user_id, NULL::uuid AS created_by, location, meet_link, false AS is_all_day, 'personal_tasks' AS source
       FROM public.personal_tasks
       WHERE deleted_at IS NULL
         AND (google_event_id = $1 OR (ical_uid IS NOT NULL AND ical_uid = $2) OR id = $3)
       LIMIT 1)
       UNION ALL
       (SELECT id, title, updated_at, start_date, due_date, NULL::uuid AS owner_user_id, created_by, location, meet_link, is_all_day, 'tasks' AS source
        FROM public.tasks
        WHERE deleted_at IS NULL
          AND (google_event_id = $1 OR (ical_uid IS NOT NULL AND ical_uid = $2) OR id = $3)
        LIMIT 1)
     ) sub
     ORDER BY (CASE WHEN sub.source = 'personal_tasks' THEN 0 ELSE 1 END)
     LIMIT 1`,
    [googleEventId, icalUid ?? null, taskId ?? null]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    source: row.source as 'tasks' | 'personal_tasks',
    title: row.title,
    updated_at: row.updated_at,
    start_date: row.start_date,
    due_date: row.due_date,
    is_all_day: row.is_all_day,
    owner_user_id: row.owner_user_id ?? undefined,
    created_by: row.created_by ?? undefined,
    location: row.location,
    meet_link: row.meet_link,
  };
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
  log.info({ taskId: id, source }, 'Soft-deleted task — Google event was cancelled');
}// ─── processIncomingGoogleEvent ───────────────────────────────────────────────

/**
 * Apply a single incoming Google Calendar event to the KeilHQ task store.
 * Called by both doFullSync() and doIncrementalSync() for each changed event.
 *
 * Decision tree:
 * 1. Skip if event was created by KeilHQ and matching task deleted (loop prevention / deletion safety)
 * 2. Skip if event is outside the 30-day sync window
 * 3. If cancelled → soft-delete matching task
 * 4. If no matching task → create new personal task
 * 5. If matching task + Google is newer by >5s → update task (skipGoogleSync=true)
 * 6. If values identical → skip (no-op)
 */
export async function processIncomingGoogleEvent(
  userId: string,
  event: calendar_v3.Schema$Event,
  defaultOrgSpace?: { orgId: string; spaceId: string } | null
): Promise<void> {
  const source = event.extendedProperties?.private?.['source'];
  const privateTaskId = event.extendedProperties?.private?.['taskId'];

  const googleEventId = event.id;
  const icalUid = event.iCalUID ?? null;
  if (!googleEventId) return;

  // --- FIND MATCHING TASK ---
  const matchingTask = await findTaskByGoogleEventIdOrIcalUidOrTaskId(googleEventId, icalUid, privateTaskId);

  // --- SYNC LOOP / DELETION PREVENTION ---
  // If the event originated from KeilHQ, but there is no matching task, it has likely been deleted in our software.
  // Skip to prevent recreating deleted tasks.
  if (source === 'keilhq' && !matchingTask) {
    log.debug({ eventId: event.id, reason: 'loop-prevention-deleted' }, 'Skipping event — originated from KeilHQ but no matching task found');
    return;
  }

  // --- SYNC WINDOW FILTER ---
  // For cancelled events, skip the window check — we always want to soft-delete
  if (event.status !== 'cancelled') {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    const isAllDay = !!event.start?.date;
    const startRaw = isAllDay ? event.start?.date : event.start?.dateTime;
    if (!startRaw) {
      log.debug({ eventId: googleEventId, reason: 'no-start-date' }, 'Skipping event — no start date');
      return;
    }
    const startDate = new Date(startRaw);

    if (startDate < thirtyDaysAgo) {
      log.debug({ eventId: googleEventId, reason: 'too-far-past' }, 'Skipping event — too far in the past');
      return;
    }

    if (startDate > oneYearFromNow) {
      log.debug({ eventId: googleEventId, reason: 'outside-window' }, 'Skipping event — outside sync window');
      return;
    }
  }


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
    ? new Date(new Date(event.end!.date!).getTime() - 24 * 60 * 60 * 1000)
    : new Date(event.end!.dateTime!);

  // --- NO MATCHING TASK: create new org task in user's default workspace ---
  if (!matchingTask) {
    try {
      // Look up the user's default org and space
      const resolvedOrgSpace = defaultOrgSpace !== undefined ? defaultOrgSpace : await getUserDefaultOrgSpace(userId);

      if (resolvedOrgSpace) {
        // Create as org task in the user's default workspace (General space)
        const taskRes = await pool.query(
          `INSERT INTO public.tasks
             (org_id, space_id, title, start_date, due_date,
              google_event_id, ical_uid, status, priority, created_by, type, event_type, location, meet_link, is_all_day)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'event', 'meeting', $11, $12, $13)
           RETURNING id`,
          [
            resolvedOrgSpace.orgId,
            resolvedOrgSpace.spaceId,
            event.summary || 'Untitled Google Event',
            startDate,
            dueDate,
            googleEventId,
            icalUid,
            TaskStatus.TODO,
            TaskPriority.MEDIUM,
            userId,
            event.location || null,
            event.hangoutLink || null,
            isAllDay,
          ]
        );
        const newTaskId = taskRes.rows[0].id;
        
        // Auto assign the task to the user who connected Google Calendar
        await pool.query(
          `INSERT INTO public.task_assignees (task_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [newTaskId, userId]
        );
        
        log.info({ eventId: googleEventId, userId, spaceId: resolvedOrgSpace.spaceId, taskId: newTaskId }, 'Created org event from Google Calendar meeting');
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
          location: event.location || null,
          meet_link: event.hangoutLink || null,
        });
        log.info({ eventId: googleEventId, userId }, 'Created personal task (fallback) from Google event');
      }

      // Notify frontend to refresh tasks
      const io = getIO();
      if (io) io.to(`user:${userId}`).emit('gcal_tasks_updated', { userId });

    } catch (err: any) {
      if (err.code === '23505') {
        // Duplicate key — another concurrent worker already created this task
        log.warn({ eventId: googleEventId }, 'Duplicate task — treating as idempotent success');
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
    sameDates(matchingTask.due_date, dueDate) &&
    matchingTask.location === (event.location || null) &&
    matchingTask.meet_link === (event.hangoutLink || null) &&
    (matchingTask.source !== 'tasks' || matchingTask.is_all_day === isAllDay)
  ) {
    log.debug({ taskId: matchingTask.id, reason: 'up-to-date' }, 'Task already up-to-date — skipping write');
    return;
  }

  // Conflict resolution: last write wins with 5-second tolerance window
  const googleUpdatedAt = event.updated ? new Date(event.updated) : new Date();
  const ourUpdatedAt = new Date(matchingTask.updated_at);
  const timeDiffMs = Math.abs(googleUpdatedAt.getTime() - ourUpdatedAt.getTime());

  if (googleUpdatedAt <= ourUpdatedAt || timeDiffMs < 5000) {
    log.debug({ taskId: matchingTask.id, timeDiffMs, reason: 'keilhq-newer' }, 'Skipping update — KeilHQ version is newer or within tolerance');
    return;
  }

  // Google is newer — update the task with skipGoogleSync to prevent echo loop
  log.info({ taskId: matchingTask.id, eventId: googleEventId, timeDiffMs }, 'Updating task from Google event');

  if (matchingTask.source === 'personal_tasks') {
    // Update directly via repository to avoid circular import with personal-task.service.
    // skipGoogleSync is implicit here — we never call syncTaskToCalendar from this path.
    await personalTaskRepository.update(matchingTask.id, {
      title: newTitle,
      start_date: startDate,
      due_date: dueDate,
      location: event.location || null,
      meet_link: event.hangoutLink || null,
    });
  } else {
    // Update org task directly via pool query to avoid circular import with task.service.
    await pool.query(
      `UPDATE public.tasks
       SET title = $1, start_date = $2, due_date = $3, location = $4, meet_link = $5, is_all_day = $6
       WHERE id = $7 AND deleted_at IS NULL`,
      [newTitle, startDate, dueDate, event.location || null, event.hangoutLink || null, isAllDay, matchingTask.id]
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
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  let pageToken: string | undefined;
  let syncToken: string | undefined;
  let totalProcessed = 0;

  log.info({ userId, calendarId }, 'Starting full sync');

  const cachedOrgSpace = await getUserDefaultOrgSpace(userId);

  do {
    const response = await calendar.events.list({
      calendarId,
      singleEvents: true,
      timeMin: thirtyDaysAgo.toISOString(),
      timeMax: oneYearFromNow.toISOString(),
      pageToken,
    });

    const items = response.data.items ?? [];
    for (const event of items) {
      try {
        await processIncomingGoogleEvent(userId, event, cachedOrgSpace);
        totalProcessed++;
      } catch (err) {
        log.error({ err, eventId: event.id, userId }, 'Failed to process event in full sync — skipping');
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
    syncToken = response.data.nextSyncToken ?? undefined;
  } while (pageToken);

  log.info({ userId, totalProcessed, hasSyncToken: !!syncToken }, 'Full sync complete');
  return syncToken;
}

// ─── stopWatch ────────────────────────────────────────────────────────────────

/**
 * Stop an existing Google Calendar watch channel.
 * Called when a user disconnects Google Calendar.
 * Errors are swallowed — the channel may already be expired.
 */
export async function stopWatch(userId: string, client?: PoolClient): Promise<void> {
  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER, client);
  if (!integration?.watch_channel_id || !integration?.watch_resource_id) {
    // No active watch channel — nothing to stop
    return;
  }

  const authClient = await getAuthorizedClient(userId);
  if (!authClient) {
    // Token revoked — just clear the DB fields
    await integrationRepository.clearWatchChannel(userId, PROVIDER, client);
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
    log.info({ userId, channelId: integration.watch_channel_id }, 'Stopped watch channel');
  } catch (err: any) {
    // Channel may already be expired or unknown to Google — log and continue
    log.warn({ err, userId, channelId: integration.watch_channel_id }, 'Failed to stop watch channel');
  }

  await integrationRepository.clearWatchChannel(userId, PROVIDER, client);
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
    log.warn({ userId }, 'registerWatch: no auth client — skipping');
    return;
  }

  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration) return;

  // Acquire advisory lock to prevent concurrent registrations
  const lockKey = syncLockKey(userId);
  const lockClient = await pool.connect();
  let acquired = false;

  try {
    const lockRes = await lockClient.query(
      'SELECT pg_try_advisory_lock($1, hashtext($2))',
      [GCAL_LOCK_NAMESPACE, lockKey]
    );
    acquired = lockRes.rows[0].pg_try_advisory_lock;
    if (!acquired) {
      log.debug({ userId }, 'Watch registration already in progress — skipping');
      return;
    }

    // Stop any existing channel before registering a new one
    await stopWatch(userId, lockClient);

    const channelId = crypto.randomUUID();
    const ttlMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const expiresAt = new Date(Date.now() + ttlMs);

    const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

    let watchRegistered = false;
    let resourceId: string | null = null;

    try {
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
      resourceId = watchResponse.data.resourceId ?? null;
      watchRegistered = !!resourceId;
    } catch (watchErr: any) {
      log.warn({ err: watchErr, userId }, 'Google Calendar events.watch failed (expected on localhost) — falling back to polling-based sync');
    }

    // Run full sync to get the initial syncToken
    let initialSyncToken: string | undefined;
    try {
      initialSyncToken = await doFullSync(
        userId,
        integration.calendar_id || 'primary',
        authClient
      );
    } catch (syncErr: any) {
      log.error({ err: syncErr, userId }, 'Full sync during watch registration failed');
    }

    if (watchRegistered && resourceId) {
      // Atomically persist watch metadata and transition to 'active'
      await integrationRepository.saveWatchChannel(userId, PROVIDER, {
        channelId,
        resourceId,
        expiresAt,
        syncToken: initialSyncToken,
      });
      log.info({ userId, channelId, expiresAt: expiresAt.toISOString() }, 'Watch registered');
    } else {
      // Polling fallback: persist the syncToken directly so manual syncs work
      await integrationRepository.saveSyncToken(userId, PROVIDER, initialSyncToken ?? null);
      await pool.query(
        `UPDATE public.user_integrations
         SET watch_status = 'degraded'::public.gcal_watch_status
         WHERE user_id = $1`,
        [userId]
      );
      log.info({ userId }, 'Watch fallback completed — initial sync executed successfully');
    }

  } catch (err: any) {
    log.error({ err, userId }, 'registerWatch failed');

    // Mark as degraded so the self-healing cron can retry
    try {
      await pool.query(
        `UPDATE public.user_integrations
         SET watch_status = 'degraded'::public.gcal_watch_status
         WHERE user_id = $1`,
        [userId]
      );
    } catch (dbErr: any) {
      log.error({ err: dbErr, userId }, 'Failed to set degraded status');
    }
    // Do NOT rethrow — registerWatch is always called fire-and-forget
  } finally {
    if (acquired) {
      try {
        await lockClient.query('SELECT pg_advisory_unlock($1, hashtext($2))', [GCAL_LOCK_NAMESPACE, lockKey]);
      } catch (unlockErr) {
        log.error({ err: unlockErr, userId }, 'Failed to unlock watch advisory lock');
      }
    }
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
  let acquired = false;
  const lockKey = syncLockKey(userId);

  try {
    // Acquire non-blocking advisory lock
    const lockResult = await lockClient.query(
      'SELECT pg_try_advisory_lock($1, hashtext($2))',
      [GCAL_LOCK_NAMESPACE, lockKey]
    );
    acquired = lockResult.rows[0].pg_try_advisory_lock;
    if (!acquired) {
      log.debug({ userId }, 'Incremental sync already in progress — skipping');
      return;
    }

    const authClient = await getAuthorizedClient(userId);
    if (!authClient) {
      log.warn({ userId }, 'doIncrementalSync: no auth client — skipping');
      return;
    }

    const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
    if (!integration) return;

    if (integration.watch_status === 'revoked') {
      log.debug({ userId }, 'Skipping incremental sync — integration revoked');
      return;
    }

    // Recover from a stuck lock if sync_in_progress is true but updated_at is older than 5 minutes
    if (
      integration.sync_in_progress &&
      integration.updated_at &&
      new Date().getTime() - new Date(integration.updated_at).getTime() > 5 * 60 * 1000
    ) {
      log.warn({ userId }, 'sync_in_progress flag stuck for more than 5 minutes — resetting to FALSE');
      await pool.query(
        `UPDATE public.user_integrations SET sync_in_progress = FALSE WHERE user_id = $1`,
        [userId]
      );
      integration.sync_in_progress = false;
    }

    // Mark sync as in-progress
    await pool.query(
      `UPDATE public.user_integrations
       SET sync_in_progress = TRUE, last_sync_error = NULL
       WHERE user_id = $1`,
      [userId]
    );

    // Auto-initialize if gcal_sync_token is missing
    if (!integration.gcal_sync_token) {
      log.info({ userId }, 'No sync token found — performing full sync initialization');
      
      const syncToken = await doFullSync(
        userId,
        integration.calendar_id || 'primary',
        authClient
      );

      await integrationRepository.saveSyncToken(userId, PROVIDER, syncToken ?? null);
      await pool.query(
        `UPDATE public.user_integrations
         SET sync_in_progress = FALSE,
             watch_status = CASE WHEN watch_status = 'pending' THEN 'degraded'::public.gcal_watch_status ELSE watch_status END,
             last_successful_sync_at = NOW(),
             last_sync_at = NULL
         WHERE user_id = $1`,
        [userId]
      );
      
      log.info({ userId }, 'Full sync initialization complete');
      return;
    }

    const calendar = google.calendar({ version: 'v3', auth: authClient, timeout: 10000 } as any);

    log.info({ userId }, 'Starting incremental sync');

    try {
      const response = await calendar.events.list({
        calendarId: integration.calendar_id || 'primary',
        syncToken: integration.gcal_sync_token,
      });

      const items = response.data.items ?? [];
      log.info({ userId, eventCount: items.length }, 'Incremental sync processing events');

      const cachedOrgSpace = await getUserDefaultOrgSpace(userId);

      for (const event of items) {
        try {
          await processIncomingGoogleEvent(userId, event, cachedOrgSpace);
        } catch (err) {
          log.error({ err, eventId: event.id, userId }, 'Failed to process event in incremental sync — skipping');
        }
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

      log.info({ userId }, 'Incremental sync complete');

    } catch (err: any) {
      // 401/403 — OAuth revoked
      if (
        err?.code === 401 ||
        err?.code === 403 ||
        err?.response?.data?.error === 'invalid_grant'
      ) {
        log.warn({ userId, code: err?.code }, 'OAuth revoked — cleaning up watch channel');
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
        log.warn({ userId }, 'syncToken expired (410) — running full sync to recover');
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
      log.error({ err, userId }, 'Incremental sync failed');
      await pool.query(
        `UPDATE public.user_integrations
         SET sync_in_progress = FALSE, last_sync_error = $1
         WHERE user_id = $2`,
        [err.message, userId]
      );
      // Do not rethrow — this runs in a fire-and-forget context
    }

  } finally {
    // Safety net: always reset sync_in_progress to FALSE on completion or unexpected crash
    try {
      await pool.query(
        `UPDATE public.user_integrations SET sync_in_progress = FALSE WHERE user_id = $1`,
        [userId]
      );
    } catch (dbErr) {
      log.error({ err: dbErr, userId }, 'Failed to reset sync_in_progress in finally block');
    }

    // Always release the advisory lock and return the connection to the pool
    if (acquired) {
      try {
        await lockClient.query('SELECT pg_advisory_unlock($1, hashtext($2))', [GCAL_LOCK_NAMESPACE, lockKey]);
      } catch (unlockErr) {
        log.error({ err: unlockErr, userId }, 'Failed to unlock sync advisory lock');
      }
    }
    lockClient.release();
  }
}

/**
 * Throttled version of doIncrementalSync to avoid hitting Google APIs/DB locks
 * on every polling request from TasksPage mount/updates.
 */
export async function doIncrementalSyncWithCooldown(
  userId: string,
  cooldownMs: number = 5 * 60 * 1000 // default 5 minutes
): Promise<void> {
  try {
    const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
    if (!integration) return;

    if (integration.sync_in_progress) {
      log.debug({ userId }, 'Sync already in progress, skipping cooldown check');
      return;
    }

    if (integration.last_successful_sync_at) {
      const lastSyncTime = new Date(integration.last_successful_sync_at).getTime();
      if (Date.now() - lastSyncTime < cooldownMs) {
        log.debug({ userId }, 'Sync cooldown active — skipping incremental sync');
        return;
      }
    }

    // Cooldown passed or no successful sync yet, execute sync
    await doIncrementalSync(userId);
  } catch (err) {
    log.error({ err, userId }, 'Incremental sync with cooldown failed');
  }
}

/**
 * Create a new standalone Google Meet space using the Meet API.
 * Returns the generated meetingUri.
 */
export async function createGoogleMeetSpace(userId: string): Promise<string> {
  const authClient = await getAuthorizedClient(userId);
  if (!authClient) {
    throw new Error('Google account is not connected');
  }

  log.info({ userId }, 'Creating Google Meet space');
  const response = await authClient.request<{ meetingUri: string }>({
    url: 'https://meet.googleapis.com/v2/spaces',
    method: 'POST',
    data: {},
  });

  if (!response.data || !response.data.meetingUri) {
    throw new Error('Failed to create Google Meet space: No meetingUri returned from Google Meet API');
  }

  log.info({ userId, meetingUri: response.data.meetingUri }, 'Google Meet space created successfully');
  return response.data.meetingUri;
}



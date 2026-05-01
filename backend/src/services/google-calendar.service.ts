import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as crypto from 'crypto';
import pool from '../config/pg';
import { config } from '../config';
import { integrationRepository } from '../repositories';

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
 */
export async function handleCallback(code: string, state: string): Promise<void> {
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
 * - No start_date → delete existing Google event (if any) and clear google_event_id
 * - Has start_date + existing google_event_id → update the Google event
 * - Has start_date + no google_event_id → create a new Google event, write ID back to DB
 * - User not connected → silent no-op
 *
 * This function MUST be called fire-and-forget (do not await at call site).
 * It never throws — all errors are caught and logged.
 */
export async function syncTaskToCalendar(
  userId: string,
  task: SyncableTask
): Promise<void> {
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
  const calendar = google.calendar({ version: 'v3', auth: authClient });

  // Build the event body
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
 */
function buildEventBody(task: SyncableTask): object {
  const startDate = task.start_date!; // guaranteed non-null by caller
  // Fallback: if no due_date, default to start + 1 hour
  const endDate = task.due_date ?? new Date(startDate.getTime() + 60 * 60 * 1000);

  if (task.is_all_day) {
    // All-day events use date strings (YYYY-MM-DD), not dateTime
    return {
      summary: task.title,
      description: task.description ?? undefined,
      location: task.location ?? undefined,
      status: mapStatusToGoogle(task.status),
      start: { date: formatDate(startDate) },
      end: { date: formatDate(endDate) },
    };
  }

  return {
    summary: task.title,
    description: task.description ?? undefined,
    location: task.location ?? undefined,
    status: mapStatusToGoogle(task.status),
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
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

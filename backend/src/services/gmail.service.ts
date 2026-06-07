import { google } from 'googleapis';
import { getAuthorizedClient } from './google-calendar.service';
import { createServiceLogger } from '../lib/logger';

const log = createServiceLogger('gmail-service');

export interface GmailEmailSummary {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
}

export interface GmailEmailDetails extends GmailEmailSummary {
  body: string;
}

// Helper: parse headers
function getHeader(headers: any[] | undefined, name: string): string {
  if (!headers) return '';
  const header = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : '';
}

// Helper: parse "From" header to separate name and email
function parseFromHeader(fromValue: string): { name: string; email: string } {
  const match = fromValue.match(/^(.*?)\s*<(.*?)>$/);
  if (match) {
    return {
      name: match[1].replace(/['"]/g, '').trim(),
      email: match[2].trim(),
    };
  }
  return {
    name: fromValue,
    email: fromValue,
  };
}

// Helper: decode base64url
function decodeBase64Url(data: string): string {
  if (!data) return '';
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf8');
}

// Helper: recursively locate parts in MIME payload
function findMimePart(parts: any[] | undefined, mimeType: string): any {
  if (!parts) return null;
  for (const part of parts) {
    if (part.mimeType === mimeType) {
      return part;
    }
    if (part.parts) {
      const found = findMimePart(part.parts, mimeType);
      if (found) return found;
    }
  }
  return null;
}

// Helper: extract email body content (prefer HTML, fallback to plain text)
function extractEmailBody(payload: any): string {
  if (!payload) return '';
  if (payload.body && payload.body.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    // Try HTML first
    const htmlPart = findMimePart(payload.parts, 'text/html');
    if (htmlPart && htmlPart.body && htmlPart.body.data) {
      return decodeBase64Url(htmlPart.body.data);
    }

    // Fallback to text/plain
    const plainPart = findMimePart(payload.parts, 'text/plain');
    if (plainPart && plainPart.body && plainPart.body.data) {
      return `<div style="white-space: pre-wrap; font-family: sans-serif;">${decodeBase64Url(plainPart.body.data)}</div>`;
    }
  }

  return '';
}

/**
 * Fetch a list of recent emails in the user's Gmail inbox.
 */
export async function listInboxEmails(
  userId: string,
  searchQuery?: string
): Promise<GmailEmailSummary[]> {
  const authClient = await getAuthorizedClient(userId);
  if (!authClient) {
    throw new Error('Google connection required');
  }

  const gmail = google.gmail({ version: 'v1', auth: authClient });

  log.info({ userId, searchQuery }, 'Listing Gmail inbox messages');

  // Fetch email IDs (default limit: 20 for performance)
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: searchQuery ? `${searchQuery} label:INBOX` : 'label:INBOX',
    maxResults: 20,
  });

  const messages = listRes.data.messages || [];
  if (messages.length === 0) {
    return [];
  }

  // Fetch metadata details in parallel
  const emailSummaries = await Promise.all(
    messages.map(async (msg) => {
      try {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = detail.data.payload?.headers || [];
        const fromRaw = getHeader(headers, 'From');
        const { name: fromName, email: fromEmail } = parseFromHeader(fromRaw);

        return {
          id: msg.id!,
          threadId: msg.threadId!,
          from: fromRaw,
          fromName,
          fromEmail,
          subject: getHeader(headers, 'Subject') || '(No Subject)',
          snippet: detail.data.snippet || '',
          date: getHeader(headers, 'Date'),
        };
      } catch (err) {
        log.error({ err, messageId: msg.id }, 'Failed to fetch email metadata details');
        return null;
      }
    })
  );

  return emailSummaries.filter((e): e is GmailEmailSummary => e !== null);
}

/**
 * Fetch detailed content of a specific email message.
 */
export async function getEmailDetails(
  userId: string,
  messageId: string
): Promise<GmailEmailDetails> {
  const authClient = await getAuthorizedClient(userId);
  if (!authClient) {
    throw new Error('Google connection required');
  }

  const gmail = google.gmail({ version: 'v1', auth: authClient });

  log.info({ userId, messageId }, 'Fetching Gmail message details');

  const detail = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const headers = detail.data.payload?.headers || [];
  const fromRaw = getHeader(headers, 'From');
  const { name: fromName, email: fromEmail } = parseFromHeader(fromRaw);

  const summary: GmailEmailSummary = {
    id: detail.data.id!,
    threadId: detail.data.threadId!,
    from: fromRaw,
    fromName,
    fromEmail,
    subject: getHeader(headers, 'Subject') || '(No Subject)',
    snippet: detail.data.snippet || '',
    date: getHeader(headers, 'Date'),
  };

  const body = extractEmailBody(detail.data.payload);

  return {
    ...summary,
    body,
  };
}

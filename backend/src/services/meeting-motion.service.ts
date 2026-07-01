import { createServiceLogger } from "../lib/logger";
import { ApiError } from "../utils/ApiError";
import { integrationRepository, organisationRepository, spaceRepository, taskRepository } from "../repositories";
import { createPage, MotionPageDTO } from "./motion-page.service";
import { markdownToTiptap, exportMotionPage } from "./notion.service";
import { MeetingRecording } from "./meeting.service";

const log = createServiceLogger("meeting-motion");
const NOTION_PROVIDER = "notion";

async function resolveOrgAndSpace(
  recording: MeetingRecording,
  userId: string,
  orgId?: string | null,
  spaceId?: string | null
): Promise<{ orgId: string; spaceId: string } | null> {
  let resolvedOrgId = orgId ?? null;
  let resolvedSpaceId = spaceId ?? null;

  if (recording.meeting_id) {
    const task = await taskRepository.findById(recording.meeting_id);
    if (task) {
      resolvedOrgId = resolvedOrgId ?? task.org_id ?? null;
      resolvedSpaceId = resolvedSpaceId ?? task.space_id ?? null;
    }
  }

  if (!resolvedOrgId || !resolvedSpaceId) {
    const orgs = await organisationRepository.findByUserId(userId);
    if (orgs && orgs.length > 0) {
      resolvedOrgId = resolvedOrgId ?? orgs[0].id;
      const defaultSpace = await spaceRepository.findDefaultSpace(resolvedOrgId);
      if (defaultSpace) {
        resolvedSpaceId = resolvedSpaceId ?? defaultSpace.id;
      } else {
        const visibleSpaces = await spaceRepository.findVisibleByOrgAndUser(resolvedOrgId, userId);
        if (visibleSpaces && visibleSpaces.length > 0) {
          resolvedSpaceId = resolvedSpaceId ?? visibleSpaces[0].id;
        }
      }
    }
  }

  if (!resolvedOrgId || !resolvedSpaceId) {
    return null;
  }

  return { orgId: resolvedOrgId, spaceId: resolvedSpaceId };
}

export interface SaveMeetingSummaryResult {
  page: MotionPageDTO;
  notionExported: boolean;
}

/**
 * Saves a meeting summary as a Motion page and optionally exports it to Notion.
 */
export async function saveMeetingSummaryToMotion(
  recording: MeetingRecording,
  userId: string,
  options?: {
    orgId?: string | null;
    spaceId?: string | null;
    exportToNotion?: boolean;
  }
): Promise<SaveMeetingSummaryResult> {
  const summaryText = recording.summary_text?.trim();
  if (!summaryText) {
    throw new ApiError(400, "Meeting summary is not available yet");
  }

  const resolved = await resolveOrgAndSpace(
    recording,
    userId,
    options?.orgId,
    options?.spaceId
  );
  if (!resolved) {
    throw new ApiError(400, "Could not resolve workspace for saving meeting summary");
  }

  const tiptapContent = markdownToTiptap(summaryText);
  const pageTitle = `Meeting Summary: ${new Date(recording.created_at).toLocaleDateString()}`;

  const page = await createPage(resolved.orgId, resolved.spaceId, userId, {
    title: pageTitle,
    content: tiptapContent,
  });

  let notionExported = false;
  if (options?.exportToNotion !== false) {
    try {
      const integration = await integrationRepository.findByUserAndProvider(userId, NOTION_PROVIDER);
      if (integration?.access_token) {
        await exportMotionPage(userId, page.id);
        notionExported = true;
        log.info({ recordingId: recording.id, pageId: page.id }, "Meeting summary exported to Notion");
      }
    } catch (err) {
      log.warn({ err, recordingId: recording.id, pageId: page.id }, "Notion export failed or skipped");
    }
  }

  return { page, notionExported };
}

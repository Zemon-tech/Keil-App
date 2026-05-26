import { Request, Response } from "express";
import fetch from "node-fetch";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { orgTaskRepository, organisationRepository } from "../repositories";

/**
 * GET /api/v1/tasks/:taskId/locate
 *
 * Looks up which org + space a task belongs to.
 * Only returns a result if the authenticated user is a fully-accepted member
 * of the organisation that owns the task.
 *
 * Used by the frontend to silently switch workspace context when a user opens
 * a shared task link from a different workspace.
 */
export const locateTask = catchAsync(async (req: Request, res: Response) => {
  const taskId = req.params.taskId as string;
  const userId = (req as any).user?.id as string;

  if (!taskId) {
    throw new ApiError(400, "taskId is required");
  }

  // Fetch the raw task row (not scoped to any org/space — global lookup by PK)
  const task = await orgTaskRepository.findById(taskId);

  if (!task || !task.org_id || !task.space_id) {
    throw new ApiError(404, "Task not found");
  }

  // Security gate: only expose the workspace info if the requesting user is
  // a member of that organisation (pending/invited users are excluded because
  // getMemberRole only returns rows from accepted organisation_members).
  const memberRole = await organisationRepository.getMemberRole(task.org_id, userId);

  if (!memberRole) {
    // User is not a member of the org that owns this task — treat as not found
    // to avoid leaking workspace information.
    throw new ApiError(404, "Task not found");
  }

  res.status(200).json(
    new ApiResponse(200, { orgId: task.org_id, spaceId: task.space_id }, "Task located")
  );
});

/**
 * GET /api/v1/tasks/link-meta
 *
 * Scrapes metadata (title, description, favicon) for any external link.
 */
export const getLinkMetadata = catchAsync(async (req: Request, res: Response) => {
  const urlStr = req.query.url as string;
  if (!urlStr) {
    throw new ApiError(400, "url query parameter is required");
  }

  let targetUrl = urlStr.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = "https://" + targetUrl;
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
      },
      timeout: 5000
    } as any);

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // 1. Title
    let title = "";
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].trim();
    }

    if (!title) {
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
      if (ogTitle && ogTitle[1]) {
        title = ogTitle[1].trim();
      }
    }

    // 2. Description
    let description = "";
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
                      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (descMatch && descMatch[1]) {
      description = descMatch[1].trim();
    }

    const decodeHtml = (str: string) => {
      return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    };

    title = decodeHtml(title);
    description = decodeHtml(description);

    const parsedUrl = new URL(targetUrl);

    // 3. Favicon
    let favicon = "";
    const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
                         html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i) ||
                         html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i) ||
                         html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i);

    if (faviconMatch && faviconMatch[1]) {
      const href = faviconMatch[1].trim();
      if (href.startsWith("http")) {
        favicon = href;
      } else if (href.startsWith("//")) {
        favicon = parsedUrl.protocol + href;
      } else if (href.startsWith("/")) {
        favicon = `${parsedUrl.origin}${href}`;
      } else {
        const basePath = parsedUrl.origin + parsedUrl.pathname.substring(0, parsedUrl.pathname.lastIndexOf("/") + 1);
        favicon = basePath + href;
      }
    } else {
      favicon = `https://www.google.com/s2/favicons?sz=64&domain=${parsedUrl.hostname}`;
    }

    res.status(200).json(
      new ApiResponse(200, {
        title: title || parsedUrl.hostname,
        description: description || `Web resource from ${parsedUrl.hostname}`,
        favicon
      }, "Link metadata fetched successfully")
    );
  } catch (error) {
    try {
      const parsedUrl = new URL(targetUrl);
      res.status(200).json(
        new ApiResponse(200, {
          title: parsedUrl.hostname,
          description: `External link to ${parsedUrl.hostname}`,
          favicon: `https://www.google.com/s2/favicons?sz=64&domain=${parsedUrl.hostname}`
        }, "Fallback metadata generated")
      );
    } catch (e) {
      res.status(200).json(
        new ApiResponse(200, {
          title: targetUrl,
          description: "External web link",
          favicon: ""
        }, "Failed to parse URL, returned fallback")
      );
    }
  }
});

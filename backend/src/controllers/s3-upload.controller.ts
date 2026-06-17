import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as s3UploadService from "../services/s3-upload.service";
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("s3-upload-controller");

/**
 * Controller to get a presigned S3 upload URL for a chat attachment.
 */
export const getChatAttachmentUploadUrl = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const { channelId, fileName, contentType } = req.body;
    if (!channelId || !fileName || !contentType) {
        throw new ApiError(400, "Missing required parameters: channelId, fileName, contentType");
    }

    try {
        const data = await s3UploadService.getChatAttachmentUploadUrl(user.id, channelId, fileName, contentType);
        return res.status(200).json(
            new ApiResponse(200, data, "Chat attachment upload URL generated successfully")
        );
    } catch (err: any) {
        log.error({ err, userId: user.id, channelId }, "Error generating chat attachment upload URL");
        if (err.message.includes("Unauthorized")) {
            throw new ApiError(403, err.message);
        }
        throw new ApiError(500, "Failed to generate upload URL");
    }
});

/**
 * Controller to get a presigned S3 download URL for a chat attachment.
 */
export const getChatAttachmentDownloadUrl = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const { s3Key } = req.body;
    if (!s3Key) {
        throw new ApiError(400, "Missing required parameter: s3Key");
    }

    try {
        const downloadUrl = await s3UploadService.getChatAttachmentDownloadUrl(user.id, s3Key);
        return res.status(200).json(
            new ApiResponse(200, { downloadUrl }, "Chat attachment download URL generated successfully")
        );
    } catch (err: any) {
        log.error({ err, userId: user.id, s3Key }, "Error generating chat attachment download URL");
        if (err.message.includes("Unauthorized")) {
            throw new ApiError(403, err.message);
        }
        throw new ApiError(500, "Failed to generate download URL");
    }
});

/**
 * Controller to get a presigned S3 upload URL for a profile avatar (public).
 */
export const getProfileAvatarUploadUrl = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) {
        throw new ApiError(400, "Missing required parameters: fileName, contentType");
    }

    try {
        const data = await s3UploadService.getProfileAvatarUploadUrl(user.id, fileName, contentType);
        return res.status(200).json(
            new ApiResponse(200, data, "Profile avatar upload URL generated successfully")
        );
    } catch (err: any) {
        log.error({ err, userId: user.id }, "Error generating profile avatar upload URL");
        throw new ApiError(500, "Failed to generate upload URL");
    }
});

/**
 * Controller to get a presigned S3 upload URL for motion page assets (public).
 */
export const getMotionAssetUploadUrl = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const { pageId, fileName, contentType } = req.body;
    if (!pageId || !fileName || !contentType) {
        throw new ApiError(400, "Missing required parameters: pageId, fileName, contentType");
    }

    try {
        const data = await s3UploadService.getMotionAssetUploadUrl(pageId, fileName, contentType);
        return res.status(200).json(
            new ApiResponse(200, data, "Motion asset upload URL generated successfully")
        );
    } catch (err: any) {
        log.error({ err, userId: user.id, pageId }, "Error generating motion asset upload URL");
        throw new ApiError(500, "Failed to generate upload URL");
    }
});

/**
 * Controller to get a presigned S3 upload URL for a task context attachment.
 */
export const getTaskAttachmentUploadUrl = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const { spaceId, fileName, contentType } = req.body;
    if (!spaceId || !fileName || !contentType) {
        throw new ApiError(400, "Missing required parameters: spaceId, fileName, contentType");
    }

    try {
        const data = await s3UploadService.getTaskAttachmentUploadUrl(user.id, spaceId, fileName, contentType);
        return res.status(200).json(
            new ApiResponse(200, data, "Task attachment upload URL generated successfully")
        );
    } catch (err: any) {
        log.error({ err, userId: user.id, spaceId }, "Error generating task attachment upload URL");
        if (err.message.includes("Unauthorized")) {
            throw new ApiError(403, err.message);
        }
        throw new ApiError(500, "Failed to generate upload URL");
    }
});

/**
 * Controller to get a presigned S3 download URL for a task context attachment.
 */
export const getTaskAttachmentDownloadUrl = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const { s3Key } = req.body;
    if (!s3Key) {
        throw new ApiError(400, "Missing required parameter: s3Key");
    }

    try {
        const downloadUrl = await s3UploadService.getTaskAttachmentDownloadUrl(user.id, s3Key);
        return res.status(200).json(
            new ApiResponse(200, { downloadUrl }, "Task attachment download URL generated successfully")
        );
    } catch (err: any) {
        log.error({ err, userId: user.id, s3Key }, "Error generating task attachment download URL");
        if (err.message.includes("Unauthorized")) {
            throw new ApiError(403, err.message);
        }
        throw new ApiError(500, "Failed to generate download URL");
    }
});

/**
 * Controller to get a presigned S3 upload URL for an AI chat image (public).
 */
export const getAiChatImageUploadUrl = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const { fileName, contentType } = req.body;
    if (!fileName || !contentType) {
        throw new ApiError(400, "Missing required parameters: fileName, contentType");
    }

    try {
        const data = await s3UploadService.getAiChatImageUploadUrl(user.id, fileName, contentType);
        return res.status(200).json(
            new ApiResponse(200, data, "AI chat image upload URL generated successfully")
        );
    } catch (err: any) {
        log.error({ err, userId: user.id }, "Error generating AI chat image upload URL");
        throw new ApiError(500, "Failed to generate upload URL");
    }
});



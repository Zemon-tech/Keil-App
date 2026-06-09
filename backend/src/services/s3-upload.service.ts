import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getS3Client } from "../lib/s3";
import { config } from "../config";
import pool from "../config/pg";
import { createServiceLogger } from "../lib/logger";

const log = createServiceLogger("s3-upload-service");

/**
 * Checks if a user is a member of a given channel.
 */
export async function isChannelMember(userId: string, channelId: string): Promise<boolean> {
    const query = `
        SELECT 1 FROM public.channel_members 
        WHERE channel_id = $1 AND user_id = $2
    `;
    const result = await pool.query(query, [channelId, userId]);
    return result.rows.length > 0;
}

/**
 * Parses channel ID from S3 key to authorize retrieval.
 * Key format: chats/${channelId}/${userId}/${timestamp}-${fileName}
 */
export function getChannelIdFromKey(s3Key: string): string | null {
    const parts = s3Key.split("/");
    if (parts.length >= 3 && parts[0] === "chats") {
        return parts[1];
    }
    return null;
}

/**
 * Sanitizes file name to remove safe-breaking chars.
 */
function sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
}

/**
 * Generates presigned PUT URL for a secure chat attachment.
 */
export async function getChatAttachmentUploadUrl(
    userId: string,
    channelId: string,
    fileName: string,
    contentType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
    const isMember = await isChannelMember(userId, channelId);
    if (!isMember) {
        throw new Error("Unauthorized: User is not a member of this channel.");
    }

    const safeName = sanitizeFileName(fileName || "file");
    const timestamp = Date.now();
    const s3Key = `chats/${channelId}/${userId}/${timestamp}-${safeName}`;

    log.debug({ s3Key, bucket: config.awsS3BucketName }, "Generating presigned PUT URL for chat attachment");

    const command = new PutObjectCommand({
        Bucket: config.awsS3BucketName,
        Key: s3Key,
        ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
    return { uploadUrl, s3Key };
}

/**
 * Generates presigned GET URL for a secure chat attachment.
 */
export async function getChatAttachmentDownloadUrl(
    userId: string,
    s3Key: string
): Promise<string> {
    const channelId = getChannelIdFromKey(s3Key);
    if (!channelId) {
        throw new Error("Invalid s3Key format for chat attachment.");
    }

    const isMember = await isChannelMember(userId, channelId);
    if (!isMember) {
        throw new Error("Unauthorized: User is not a member of this channel.");
    }

    log.debug({ s3Key, bucket: config.awsS3BucketName }, "Generating presigned GET URL for chat attachment");

    const command = new GetObjectCommand({
        Bucket: config.awsS3BucketName,
        Key: s3Key,
    });

    return await getSignedUrl(getS3Client(), command, { expiresIn: 900 }); // Valid for 15 mins
}

/**
 * Generates public asset URLs.
 */
function getPublicAssetUrl(s3Key: string): string {
    if (config.awsS3PublicCdnUrl) {
        const baseUrl = config.awsS3PublicCdnUrl.endsWith("/") 
            ? config.awsS3PublicCdnUrl.slice(0, -1) 
            : config.awsS3PublicCdnUrl;
        return `${baseUrl}/${s3Key}`;
    }
    // Fallback directly to the public S3 URL format
    return `https://${config.awsS3PublicBucketName}.s3.${config.awsS3Region}.amazonaws.com/${s3Key}`;
}

/**
 * Generates presigned PUT URL for a public profile icon (avatar).
 */
export async function getProfileAvatarUploadUrl(
    userId: string,
    fileName: string,
    contentType: string
): Promise<{ uploadUrl: string; publicUrl: string; s3Key: string }> {
    const safeName = sanitizeFileName(fileName || "avatar.png");
    const timestamp = Date.now();
    const s3Key = `profiles/${userId}/${timestamp}-${safeName}`;

    log.debug({ s3Key, bucket: config.awsS3PublicBucketName }, "Generating presigned PUT URL for profile avatar");

    const command = new PutObjectCommand({
        Bucket: config.awsS3PublicBucketName,
        Key: s3Key,
        ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
    const publicUrl = getPublicAssetUrl(s3Key);

    return { uploadUrl, publicUrl, s3Key };
}

/**
 * Generates presigned PUT URL for public motion page assets.
 */
export async function getMotionAssetUploadUrl(
    pageId: string,
    fileName: string,
    contentType: string
): Promise<{ uploadUrl: string; publicUrl: string; s3Key: string }> {
    const safeName = sanitizeFileName(fileName || "asset");
    const timestamp = Date.now();
    const s3Key = `motion-pages/assets/${pageId}/${timestamp}-${safeName}`;

    log.debug({ s3Key, bucket: config.awsS3PublicBucketName }, "Generating presigned PUT URL for motion page asset");

    const command = new PutObjectCommand({
        Bucket: config.awsS3PublicBucketName,
        Key: s3Key,
        ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 });
    const publicUrl = getPublicAssetUrl(s3Key);

    return { uploadUrl, publicUrl, s3Key };
}

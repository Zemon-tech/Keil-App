import axios from "axios";
import api from "./api";
import type { FileUIPart } from "ai";

/**
 * Converts a base64 Data URL to a Blob.
 */
export async function dataURLtoBlob(dataurl: string): Promise<Blob> {
    const res = await fetch(dataurl);
    return await res.blob();
}

/**
 * Uploads a client-side chat attachment directly to public S3 bucket using a backend presigned URL.
 * Returns the file updated with its public S3 URL.
 */
export async function uploadChatAttachment(file: FileUIPart): Promise<FileUIPart> {
    // If the file is already a public URL, don't upload again
    if (file.url && !file.url.startsWith("blob:") && !file.url.startsWith("data:")) {
        return file;
    }

    const contentType = file.mediaType || (file as any).mimeType || "image/png";

    // 1. Get presigned PUT URL and public URL from backend
    const res = await api.post("v1/s3-upload/ai-chat/image", {
        fileName: file.filename,
        contentType: contentType,
    });

    const { uploadUrl, publicUrl } = res.data.data;

    // 2. Convert base64 data url back to binary blob
    const blob = await dataURLtoBlob(file.url);

    // 3. Upload directly to S3 using raw axios (no auth headers to prevent S3 signature mismatch)
    await axios.put(uploadUrl, blob, {
        headers: {
            "Content-Type": contentType,
        },
    });

    // 4. Return updated file part with the public URL
    return {
        ...file,
        url: publicUrl,
    };
}

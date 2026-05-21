import { S3Client } from "@aws-sdk/client-s3";
import { config } from "../config";

if (!config.sevallaS3Endpoint || !config.sevallaS3AccessKeyId || !config.sevallaS3SecretAccessKey || !config.sevallaS3BucketName) {
    throw new Error("❌ [s3]: Missing Sevalla S3 configuration in .env file");
}

export const s3 = new S3Client({
    endpoint: config.sevallaS3Endpoint,
    region: config.sevallaS3Region,
    credentials: {
        accessKeyId: config.sevallaS3AccessKeyId,
        secretAccessKey: config.sevallaS3SecretAccessKey,
    },
});

console.log("✅ [s3]: Sevalla S3 client initialized");

import { S3Client } from "@aws-sdk/client-s3";
import { config } from "../config";
import { createServiceLogger } from "./logger";

const log = createServiceLogger("s3");

const s3Configured =
    !!config.awsS3AccessKeyId &&
    !!config.awsS3SecretAccessKey &&
    !!config.awsS3BucketName;

let _s3: S3Client | null = null;

if (s3Configured) {
    _s3 = new S3Client({
        region: config.awsS3Region,
        credentials: {
            accessKeyId: config.awsS3AccessKeyId,
            secretAccessKey: config.awsS3SecretAccessKey,
        },
    });
    log.info("AWS S3 client initialized");
} else {
    log.warn("Missing AWS S3 configuration in .env — S3 features will be unavailable");
}

/**
 * Returns the S3 client, throwing if S3 is not configured.
 * Use this instead of accessing `s3` directly so callers get
 * a clear error only when they actually need S3.
 */
export function getS3Client(): S3Client {
    if (!_s3) {
        throw new Error("❌ [s3]: S3 is not configured. Set AWS_S3_* variables in .env.");
    }
    return _s3;
}

/** @deprecated Prefer `getS3Client()` for lazy error handling. May be null if S3 is not configured. */
export const s3 = _s3;

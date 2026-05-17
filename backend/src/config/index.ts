import dotenv from "dotenv";

dotenv.config();

export const config = {
    port: process.env.PORT || 5001,
    env: process.env.NODE_ENV || "development",
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
    databaseUrl: process.env.DATABASE_URL || "",
    // Google Calendar OAuth
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "",
    googleOAuthStateSecret: process.env.GOOGLE_OAUTH_STATE_SECRET || "",
    frontendUrl: process.env.FRONTEND_URL,
    // Sarvam AI
    sarvamApiKey: process.env.SARVAM_API_KEY || "",
    // Sevalla S3
    sevallaS3Endpoint: process.env.SEVALLA_S3_ENDPOINT || "",
    sevallaS3AccessKeyId: process.env.SEVALLA_S3_ACCESS_KEY_ID || "",
    sevallaS3SecretAccessKey: process.env.SEVALLA_S3_SECRET_ACCESS_KEY || "",
    sevallaS3BucketName: process.env.SEVALLA_S3_BUCKET_NAME || "",
    sevallaS3Region: process.env.SEVALLA_S3_REGION || "auto",
};


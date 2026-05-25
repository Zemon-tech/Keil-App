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
    // Backend public URL — used to construct the Google Calendar webhook address
    // Must be publicly reachable by Google (e.g. https://api.yourdomain.com)
    backendUrl: process.env.BACKEND_URL || "",
    // Sarvam AI
    sarvamApiKey: process.env.SARVAM_API_KEY || "",
    // OpenRouter / Vercel AI SDK
    openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
    openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    openRouterModel: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    // Sevalla S3
    sevallaS3Endpoint: process.env.SEVALLA_S3_ENDPOINT || "",
    sevallaS3AccessKeyId: process.env.SEVALLA_S3_ACCESS_KEY_ID || "",
    sevallaS3SecretAccessKey: process.env.SEVALLA_S3_SECRET_ACCESS_KEY || "",
    sevallaS3BucketName: process.env.SEVALLA_S3_BUCKET_NAME || "",
    sevallaS3Region: process.env.SEVALLA_S3_REGION || "auto",
    // ── Google ADK ───────────────────────────────────────────────────────────
    // Get your API key from https://aistudio.google.com/app/apikey
    googleAdkApiKey: process.env.GOOGLE_ADK_API_KEY || "",
    // Which Gemini model the ADK agent runs on.
    // Recommended: gemini-2.0-flash (fast) or gemini-2.5-pro (more capable)
    googleAdkModel: process.env.GOOGLE_ADK_MODEL || "gemini-2.0-flash",
    // ── Logging ──────────────────────────────────────────────────────────────
    logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
    grafanaLokiHost: process.env.GRAFANA_LOKI_HOST || "",
    grafanaLokiUser: process.env.GRAFANA_LOKI_USER || "",
    grafanaLokiPassword: process.env.GRAFANA_LOKI_PASSWORD || "",
};
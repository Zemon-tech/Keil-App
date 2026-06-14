import dotenv from "dotenv";

dotenv.config();

export const config = {
    port: process.env.PORT || 5001,
    env: process.env.NODE_ENV || "development",
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
    databaseUrl: process.env.DATABASE_URL || "",
    // Direct connection URL for Mastra storage (DDL operations need session/direct mode, not transaction pooler)
    mastraDatabaseUrl: process.env.MASTRA_DATABASE_URL || process.env.DATABASE_URL || "",
    // Google Calendar OAuth
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || "",
    googleOAuthStateSecret: process.env.GOOGLE_OAUTH_STATE_SECRET || "",
    // GitHub Integration OAuth
    githubClientId: process.env.GITHUB_CLIENT_ID || "",
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    githubRedirectUri: process.env.GITHUB_REDIRECT_URI || "",
    // Notion Integration OAuth
    notionClientId: process.env.NOTION_CLIENT_ID || "",
    notionClientSecret: process.env.NOTION_CLIENT_SECRET || "",
    notionRedirectUri: process.env.NOTION_REDIRECT_URI || "",
    frontendUrl: process.env.FRONTEND_URL,
    // Backend public URL — used to construct the Google Calendar webhook address
    // Must be publicly reachable by Google (e.g. https://api.yourdomain.com)
    backendUrl: process.env.BACKEND_URL || "",
    // ElevenLabs STT
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || "",
    // Sarvam AI STT
    sarvamApiKey: process.env.SARVAM_API_KEY || "",
    // OpenRouter / Vercel AI SDK
    openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
    openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    openRouterModel: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    // AWS S3
    awsS3Region: process.env.AWS_S3_REGION || "ap-south-1",
    awsS3AccessKeyId: process.env.AWS_S3_ACCESS_KEY_ID || "",
    awsS3SecretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY || "",
    awsS3BucketName: process.env.AWS_S3_BUCKET_NAME || "",
    awsS3PublicBucketName: process.env.AWS_S3_PUBLIC_BUCKET_NAME || "",
    awsS3PublicCdnUrl: process.env.AWS_S3_PUBLIC_CDN_URL || "",
    // ── Google Generative AI (Gemini via @ai-sdk/google) ─────────────────────
    // Get your API key from https://aistudio.google.com/app/apikey
    googleGenAiApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
    // ── Exa API ──────────────────────────────────────────────────────────────
    exaApiKey: process.env.EXA_API_KEY || "",
    // ── GitHub Models AI ─────────────────────────────────────────────────────
    githubToken: process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_API_KEY || "",
    githubModelsBaseUrl: process.env.GITHUB_MODELS_BASE_URL || "https://models.inference.ai.azure.com",
    githubModelsModel: process.env.GITHUB_MODELS_MODEL || "gpt-4o-mini",
    // ── Logging ──────────────────────────────────────────────────────────────
    logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
    grafanaLokiHost: process.env.GRAFANA_LOKI_HOST || "",
    grafanaLokiUser: process.env.GRAFANA_LOKI_USER || "",
    grafanaLokiPassword: process.env.GRAFANA_LOKI_PASSWORD || "",
};
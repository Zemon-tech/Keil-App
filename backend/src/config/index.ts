import dotenv from "dotenv";

dotenv.config();

export const config = {
    port: process.env.PORT || 5000,
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
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};

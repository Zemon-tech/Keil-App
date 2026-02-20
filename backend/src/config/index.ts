import dotenv from "dotenv";

dotenv.config();

export const config = {
    port: process.env.PORT || 5000,
    env: process.env.NODE_ENV || "development",
    mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/keil-db",
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || "",
};

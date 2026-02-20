import { createClient } from "@supabase/supabase-js";
import { config } from "./index";

if (!config.supabaseUrl || !config.supabasePublishableKey || !config.supabaseSecretKey) {
    throw new Error("❌ [supabase]: Missing Supabase configuration in .env file");
}

// Client for client-side operations (respects Row Level Security)
export const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey);

// Admin client for backend operations (bypasses Row Level Security) - Use with caution!
export const supabaseAdmin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log("✅ [supabase]: Supabase clients initialized");

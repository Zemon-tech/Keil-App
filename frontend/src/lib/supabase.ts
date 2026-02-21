import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ [supabase]: Missing Supabase environment variables");
}

/**
 * Initialized Supabase client for frontend authentication and database operations.
 * Uses VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY from environment variables.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

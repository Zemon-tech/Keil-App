import pool from "../config/pg";
import { SttProvider } from "./transcription/types";

export interface UserAppPreferences {
    user_id: string;
    stt_provider: SttProvider;
    created_at: Date;
    updated_at: Date;
}

/**
 * Fetches user app preferences, creating defaults if none exist.
 */
export const getPreferences = async (userId: string): Promise<UserAppPreferences> => {
    // Try to fetch existing preferences
    const result = await pool.query(
        `SELECT * FROM public.user_app_preferences WHERE user_id = $1 LIMIT 1`,
        [userId]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    // Create default preferences if none exist
    const insertResult = await pool.query(
        `INSERT INTO public.user_app_preferences (user_id) VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [userId]
    );

    if (insertResult.rows.length > 0) {
        return insertResult.rows[0];
    }

    // Race condition fallback: re-fetch
    const refetch = await pool.query(
        `SELECT * FROM public.user_app_preferences WHERE user_id = $1 LIMIT 1`,
        [userId]
    );
    return refetch.rows[0];
};

/**
 * Updates the user's STT provider preference.
 */
export const updateSttProvider = async (
    userId: string,
    provider: SttProvider
): Promise<UserAppPreferences> => {
    const result = await pool.query(
        `INSERT INTO public.user_app_preferences (user_id, stt_provider)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
         SET stt_provider = $2, updated_at = NOW()
         RETURNING *`,
        [userId, provider]
    );
    return result.rows[0];
};

/**
 * Gets just the STT provider for a user (optimized single-column fetch).
 */
export const getSttProvider = async (userId: string): Promise<SttProvider> => {
    const result = await pool.query(
        `SELECT stt_provider FROM public.user_app_preferences WHERE user_id = $1 LIMIT 1`,
        [userId]
    );

    if (result.rows.length > 0) {
        return result.rows[0].stt_provider as SttProvider;
    }

    // Default to sarvam if no preference exists
    return "sarvam";
};

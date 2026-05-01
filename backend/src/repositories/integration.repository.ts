import pool from '../config/pg';
import { UserIntegration } from '../types/entities';

export interface UpsertIntegrationData {
  access_token?: string | null;
  refresh_token: string;
  token_expiry?: Date | null;
  calendar_id?: string;
}

export class IntegrationRepository {
  /**
   * Find a user's integration row for a given provider.
   * Returns null if the user has not connected this provider.
   */
  async findByUserAndProvider(
    userId: string,
    provider: string
  ): Promise<UserIntegration | null> {
    const result = await pool.query(
      `SELECT * FROM public.user_integrations
       WHERE user_id = $1 AND provider = $2
       LIMIT 1`,
      [userId, provider]
    );
    return result.rows.length > 0 ? (result.rows[0] as UserIntegration) : null;
  }

  /**
   * Insert or update the integration row for a user+provider pair.
   * Uses ON CONFLICT to handle re-connections gracefully.
   */
  async upsert(
    userId: string,
    provider: string,
    data: UpsertIntegrationData
  ): Promise<UserIntegration> {
    const result = await pool.query(
      `INSERT INTO public.user_integrations
         (user_id, provider, access_token, refresh_token, token_expiry, calendar_id)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'primary'))
       ON CONFLICT (user_id, provider) DO UPDATE SET
         access_token  = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_expiry  = EXCLUDED.token_expiry,
         calendar_id   = COALESCE(EXCLUDED.calendar_id, user_integrations.calendar_id),
         updated_at    = NOW()
       RETURNING *`,
      [
        userId,
        provider,
        data.access_token ?? null,
        data.refresh_token,
        data.token_expiry ?? null,
        data.calendar_id ?? null,
      ]
    );
    return result.rows[0] as UserIntegration;
  }

  /**
   * Update only the access token and expiry after a token refresh.
   * Called automatically by the Google Calendar service when a token is refreshed.
   */
  async updateTokens(
    userId: string,
    provider: string,
    accessToken: string,
    expiry: Date
  ): Promise<void> {
    await pool.query(
      `UPDATE public.user_integrations
       SET access_token = $3, token_expiry = $4, updated_at = NOW()
       WHERE user_id = $1 AND provider = $2`,
      [userId, provider, accessToken, expiry]
    );
  }

  /**
   * Remove the integration row — effectively disconnecting the provider.
   */
  async delete(userId: string, provider: string): Promise<void> {
    await pool.query(
      `DELETE FROM public.user_integrations
       WHERE user_id = $1 AND provider = $2`,
      [userId, provider]
    );
  }
}

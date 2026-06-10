import pool from '../config/pg';

export interface RateLimitResult {
  allowed: boolean;
  points: number;
  expireAt: Date;
}

/**
 * Atomic rate limiting check using PostgreSQL.
 * Inserts or updates the rate limit count for a given key in a single database round-trip.
 * 
 * @param key Unique key to identify the rate limit scope (e.g. "user:123:action:create_task" or "ip:1.2.3.4:action:login")
 * @param limit Maximum number of requests allowed within the window
 * @param windowSeconds Window size in seconds
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const windowInterval = `${windowSeconds} seconds`;
  
  const query = `
    INSERT INTO public.rate_limits (key, points, expire_at)
    VALUES ($1, 1, NOW() + $2::interval)
    ON CONFLICT (key) DO UPDATE
    SET points = CASE
        WHEN rate_limits.expire_at <= NOW() THEN 1
        ELSE rate_limits.points + 1
    END,
    expire_at = CASE
        WHEN rate_limits.expire_at <= NOW() THEN NOW() + $2::interval
        ELSE rate_limits.expire_at
    END
    RETURNING points, expire_at;
  `;
  
  const result = await pool.query(query, [key, windowInterval]);
  const { points, expire_at } = result.rows[0];
  const expireAt = new Date(expire_at);
  
  return {
    allowed: points <= limit,
    points,
    expireAt,
  };
}

/**
 * Cleanup expired rate limit entries from the database.
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const result = await pool.query('DELETE FROM public.rate_limits WHERE expire_at <= NOW()');
  return result.rowCount ?? 0;
}

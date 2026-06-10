-- Migration: Create rate_limits table for distributed rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key VARCHAR(255) PRIMARY KEY,
    points INTEGER NOT NULL DEFAULT 1,
    expire_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Index to optimize cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_expire_at ON public.rate_limits(expire_at);

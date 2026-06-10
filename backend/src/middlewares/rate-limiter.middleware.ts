import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../services/rate-limiter.service';

export interface RateLimitOptions {
  windowSeconds: number;
  limit: number;
  keyPrefix: string;
  isPublic?: boolean; // If true, limits by IP only. If false, limits by user.id if available, falling back to IP.
  message?: string;
}

/**
 * Express middleware generator for distributed rate limiting.
 */
export function rateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip rate limits in test environments unless explicitly forced
    if (process.env.NODE_ENV === 'test' && !process.env.RATE_LIMIT_TEST) {
      return next();
    }

    try {
      let identifier = '';
      if (options.isPublic) {
        identifier = req.ip || req.socket.remoteAddress || 'anonymous';
      } else {
        const userId = (req as any).user?.id;
        if (userId) {
          identifier = `user:${userId}`;
        } else {
          identifier = `ip:${req.ip || req.socket.remoteAddress || 'anonymous'}`;
        }
      }

      const key = `${options.keyPrefix}:${identifier}`;
      const { allowed, points, expireAt } = await checkRateLimit(key, options.limit, options.windowSeconds);

      // Set standard rate limit headers
      res.setHeader('X-RateLimit-Limit', options.limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, options.limit - points));
      res.setHeader('X-RateLimit-Reset', expireAt.toISOString());

      if (!allowed) {
        res.status(429).json({
          success: false,
          message: options.message || 'Too many requests. Please try again later.',
        });
        return;
      }

      next();
    } catch (error) {
      // Fail open: log the database/rate limit check error, but do not block the user's request.
      console.error(`Rate limiter error for key prefix ${options.keyPrefix}:`, error);
      next();
    }
  };
}

// Predefined Rate Limiters

// AI / LLM endpoints (1 minute and daily limits)
export const aiRateLimiter = rateLimiter({
  windowSeconds: 60,
  limit: 20,
  keyPrefix: 'rl:ai:min',
  isPublic: false,
  message: 'AI rate limit exceeded. Please wait a minute before making another request.',
});

export const aiDailyRateLimiter = rateLimiter({
  windowSeconds: 86400, // 24 hours
  limit: 100,
  keyPrefix: 'rl:ai:day',
  isPublic: false,
  message: 'Daily AI chat limit of 100 requests reached. Please try again tomorrow.',
});

// AI Thread CRUD Operations
export const threadMetadataRateLimiter = rateLimiter({
  windowSeconds: 60,
  limit: 100,
  keyPrefix: 'rl:ai:threads',
  isPublic: false,
  message: 'Too many thread operations. Please try again later.',
});

// Task Creation Rate Limiter
export const taskCreationRateLimiter = rateLimiter({
  windowSeconds: 60,
  limit: 60,
  keyPrefix: 'rl:task:create',
  isPublic: false,
  message: 'Too many tasks created. Please wait a minute before creating more tasks.',
});

// Motion Page Creation Rate Limiter
export const pageCreationRateLimiter = rateLimiter({
  windowSeconds: 60,
  limit: 30,
  keyPrefix: 'rl:page:create',
  isPublic: false,
  message: 'Too many pages created. Please wait a minute before creating more pages.',
});

// Motion Page Update Rate Limiter (replacement for legacy in-memory saveRateLimiter)
export const pageUpdateRateLimiter = rateLimiter({
  windowSeconds: 60,
  limit: 60,
  keyPrefix: 'rl:page:update',
  isPublic: false,
  message: 'Too many requests. Please try again after a minute.',
});

// Authentication and general public endpoints
export const publicAuthRateLimiter = rateLimiter({
  windowSeconds: 60,
  limit: 20,
  keyPrefix: 'rl:auth',
  isPublic: true,
  message: 'Too many authentication attempts. Please try again after a minute.',
});

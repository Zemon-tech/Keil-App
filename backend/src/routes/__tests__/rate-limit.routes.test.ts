import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, cleanupExpiredRateLimits } from '../../services/rate-limiter.service';
import { rateLimiter } from '../../middlewares/rate-limiter.middleware';
import pool from '../../config/pg';
import { Request, Response } from 'express';

describe('Distributed Rate Limiting System Tests', () => {

  beforeEach(async () => {
    // Clean rate limits table before each test
    await pool.query('DELETE FROM public.rate_limits');
  });

  describe('Rate Limiter Database Service', () => {
    it('should allow requests within the limit and block once exceeded', async () => {
      const key = 'test:service:user-1';
      const limit = 3;
      const windowSeconds = 5;

      // First request - allowed
      const res1 = await checkRateLimit(key, limit, windowSeconds);
      expect(res1.allowed).toBe(true);
      expect(res1.points).toBe(1);

      // Second request - allowed
      const res2 = await checkRateLimit(key, limit, windowSeconds);
      expect(res2.allowed).toBe(true);
      expect(res2.points).toBe(2);

      // Third request - allowed
      const res3 = await checkRateLimit(key, limit, windowSeconds);
      expect(res3.allowed).toBe(true);
      expect(res3.points).toBe(3);

      // Fourth request - blocked
      const res4 = await checkRateLimit(key, limit, windowSeconds);
      expect(res4.allowed).toBe(false);
      expect(res4.points).toBe(4);
    });

    it('should respect key isolation', async () => {
      const keyA = 'test:isolation:user-a';
      const keyB = 'test:isolation:user-b';
      const limit = 1;
      const windowSeconds = 10;

      // Request on Key A - allowed
      const resA1 = await checkRateLimit(keyA, limit, windowSeconds);
      expect(resA1.allowed).toBe(true);

      // Request on Key B - allowed (isolated from A)
      const resB1 = await checkRateLimit(keyB, limit, windowSeconds);
      expect(resB1.allowed).toBe(true);

      // Second request on Key A - blocked
      const resA2 = await checkRateLimit(keyA, limit, windowSeconds);
      expect(resA2.allowed).toBe(false);
    });

    it('should reset window after expiration', async () => {
      const key = 'test:reset:user-1';
      const limit = 1;
      const windowSeconds = 1; // 1 second window

      const res1 = await checkRateLimit(key, limit, windowSeconds);
      expect(res1.allowed).toBe(true);

      // Immediate second request - blocked
      const res2 = await checkRateLimit(key, limit, windowSeconds);
      expect(res2.allowed).toBe(false);

      // Wait 1.1s for window to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Third request after expiration - allowed again
      const res3 = await checkRateLimit(key, limit, windowSeconds);
      expect(res3.allowed).toBe(true);
      expect(res3.points).toBe(1);
    });
  });

  describe('Rate Limiter Middleware', () => {
    it('should append rate limit headers and call next() on allowed request', async () => {
      const req = {
        ip: '192.168.1.1',
        socket: {},
        user: { id: 'user-auth-1' }
      } as unknown as Request;

      const headers: Record<string, any> = {};
      const res = {
        setHeader: vi.fn((name, value) => {
          headers[name] = value;
        }),
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      const next = vi.fn();

      const middleware = rateLimiter({
        windowSeconds: 10,
        limit: 5,
        keyPrefix: 'rl:test:mw',
        isPublic: false
      });

      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(headers['X-RateLimit-Limit']).toBe(5);
      expect(headers['X-RateLimit-Remaining']).toBe(4);
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('should return 429 and block request once limit is exceeded', async () => {
      const req = {
        ip: '192.168.1.1',
        socket: {},
        user: { id: 'user-auth-2' }
      } as unknown as Request;

      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as unknown as Response;

      const next = vi.fn();

      const middleware = rateLimiter({
        windowSeconds: 10,
        limit: 2,
        keyPrefix: 'rl:test:mw2',
        isPublic: false
      });

      // Request 1: allowed
      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Request 2: allowed
      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(2);

      // Request 3: blocked
      await middleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(2); // next should not be called again
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false
      }));
    });
  });

  describe('Database Cleanup Service', () => {
    it('should delete expired entries but keep active ones', async () => {
      // Direct insert into rate limits table with one active and one expired record
      await pool.query(`
        INSERT INTO public.rate_limits (key, points, expire_at)
        VALUES 
          ('rl:clean:expired', 5, NOW() - INTERVAL '10 seconds'),
          ('rl:clean:active', 2, NOW() + INTERVAL '10 seconds')
      `);

      const deletedCount = await cleanupExpiredRateLimits();
      expect(deletedCount).toBe(1);

      const remaining = await pool.query('SELECT key FROM public.rate_limits');
      expect(remaining.rows).toHaveLength(1);
      expect(remaining.rows[0].key).toBe('rl:clean:active');
    });
  });
});

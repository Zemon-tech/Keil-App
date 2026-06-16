import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import pool from "../config/pg";
import logger from "../lib/logger";
import { setInLogContext } from "../lib/logger-context";
/**
 * Verifies the JWT token from the Authorization header and attaches the user row to req.user.
 * Relies on Supabase webhook/trigger to have already created the user profile.
 * 
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction
 */
export const protect = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    logger.debug({ method: req.method, url: req.originalUrl }, "Auth protect middleware hit");
    try {
        let token: string | undefined;

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            token = req.headers.authorization.split(" ")[1];
        }

        if (!token) {
            res.status(401).json({
                success: false,
                message: "Not authorized to access this route",
            });
            return;
        }

        // Verify token with Supabase Admin client
        const {
            data: { user: supabaseUser },
            error,
        } = await supabaseAdmin.auth.getUser(token);

        if (error || !supabaseUser) {
            res.status(401).json({
                success: false,
                message: "Invalid or expired token",
            });
            return;
        }

        // Query user from PostgreSQL public.users table (created via trigger)
        const result = await pool.query('SELECT * FROM public.users WHERE id = $1', [supabaseUser.id]);

        if (result.rows.length === 0) {
            // It's possible the trigger hasn't fired yet or the user was deleted manually.
            res.status(401).json({
                success: false,
                message: "User profile not found in database",
            });
            return;
        }

        // Attach user to request object
        (req as any).user = result.rows[0];
        setInLogContext("userId", result.rows[0].id);

        // Session validation and background tracking
        const browserId = req.headers["x-browser-id"] as string;
        if (browserId) {
            const sessionRes = await pool.query(
                "SELECT is_revoked FROM public.user_sessions WHERE user_id = $1 AND browser_id = $2",
                [supabaseUser.id, browserId]
            );

            if (sessionRes.rows.length > 0 && sessionRes.rows[0].is_revoked) {
                res.status(401).json({
                    success: false,
                    code: "SESSION_REVOKED",
                    message: "This session has been signed out."
                });
                return;
            }

            const userAgent = req.headers["user-agent"] || "";
            const platform = (req.headers["x-platform"] || req.headers["sec-ch-ua-platform"] || "") as string;

            pool.query(`
                INSERT INTO public.user_sessions (user_id, browser_id, user_agent, platform, last_seen)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (user_id, browser_id)
                DO UPDATE SET last_seen = NOW(), user_agent = EXCLUDED.user_agent, platform = CASE WHEN EXCLUDED.platform <> '' THEN EXCLUDED.platform ELSE public.user_sessions.platform END
            `, [supabaseUser.id, browserId, userAgent, platform]).catch(err => {
                logger.error({ err, userId: supabaseUser.id, browserId }, "Failed to upsert user session in auth middleware");
            });
        }

        next();
    } catch (err) {
        logger.error({ err: err as Error }, "Auth middleware error");
        res.status(500).json({
            success: false,
            message: "Internal Server Error during authentication",
        });
    }
};

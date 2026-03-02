import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import pool from "../config/pg";
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
    console.log(`🔍 [auth]: Protect middleware hit for ${req.method} ${req.originalUrl}`);
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

        next();
    } catch (err) {
        console.error(`❌ [auth]: Middleware Error: ${(err as Error).message}`);
        res.status(500).json({
            success: false,
            message: "Internal Server Error during authentication",
        });
    }
};

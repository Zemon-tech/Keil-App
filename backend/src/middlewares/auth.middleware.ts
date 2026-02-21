import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import User from "../models/user.model";

/**
 * Middleware to protect routes and synchronize Supabase users with MongoDB.
 * Verifies the JWT token from the Authorization header and attaches the user document to req.user.
 * Automatically creates a MongoDB user if it doesn't already exist.
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

        // Find or create user in MongoDB
        // We use the supabaseId to link accounts
        // supabaseUser.user_metadata typically contains fields like full_name during signup
        let user = await User.findOne({ supabaseId: supabaseUser.id });

        if (!user) {
            user = await User.create({
                supabaseId: supabaseUser.id,
                email: supabaseUser.email,
                fullName: supabaseUser.user_metadata?.full_name || "",
                role: "user",
            });
            console.log(`✅ [auth]: New user created in MongoDB: ${user.email}`);
        } else if (user.email !== supabaseUser.email || user.fullName !== supabaseUser.user_metadata?.full_name) {
            // Sync email or full name if they changed (optional but good practice)
            user.email = supabaseUser.email || user.email;
            user.fullName = supabaseUser.user_metadata?.full_name || user.fullName;
            await user.save();
        }

        // Attach user to request object
        (req as any).user = user;

        next();
    } catch (err) {
        console.error(`❌ [auth]: Middleware Error: ${(err as Error).message}`);
        res.status(500).json({
            success: false,
            message: "Internal Server Error during authentication",
        });
    }
};

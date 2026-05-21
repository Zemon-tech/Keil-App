import { Request, Response } from "express";
import { config } from "../config";
import pino from "pino";
import { getAuthUrl, handleCallback, registerWatch } from "../services/google-calendar.service";

const logger = pino();

export const getGoogleAuthUrl = (req: Request, res: Response) => {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized: Missing authenticated user context" });
    }
    try {
        const url = getAuthUrl(userId);
        res.json({ url });
    } catch (err) {
        logger.error(`Failed to generate Google Auth URL: ${err}`);
        res.status(500).json({ error: "Failed to generate authentication URL" });
    }
};

export const googleCallback = async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error || typeof code !== "string" || typeof state !== "string") {
        logger.error(`Google OAuth Callback parameter validation failed. Error: ${error}`);
        return res.redirect(`${config.frontendUrl}/tasks?gcal=error`);
    }

    try {
        const { userId } = await handleCallback(code, state);
        
        // Redirect first — watch registration must NEVER block or fail
        res.redirect(`${config.frontendUrl}/tasks?gcal=connected`);

        // Fire-and-forget push watch registration
        registerWatch(userId).catch((err) =>
            logger.error(`[gcal] registerWatch failed after OAuth callback for user ${userId}: ${err.message}`)
        );
    } catch (err) {
        logger.error(`Failed to exchange token: ${err}`);
        res.redirect(`${config.frontendUrl}/tasks?gcal=error`);
    }
};

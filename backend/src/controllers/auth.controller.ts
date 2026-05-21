import { Request, Response } from "express";
import { config } from "../config";
import pino from "pino";
import { getAuthUrl, handleCallback, registerWatch } from "../services/google-calendar.service";

const logger = pino();

export const getGoogleAuthUrl = (req: Request, res: Response) => {
    const userId = (req as any).user?.id || (req.query.userId as string);
    if (!userId) {
        return res.status(400).json({ error: "Missing user ID for authentication" });
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

    if (error || !code || !state) {
        logger.error(`Google OAuth Error: ${error}`);
        return res.redirect(`${config.frontendUrl}/tasks?gcal=error`);
    }

    try {
        const { userId } = await handleCallback(code as string, state as string);
        
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

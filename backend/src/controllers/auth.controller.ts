import { Request, Response } from "express";
import { google } from "googleapis";
import { config } from "../config";
import pino from "pino";

const logger = pino();

const oauth2Client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleCallbackUrl
);

export const getGoogleAuthUrl = (req: Request, res: Response) => {
    // Generate a secure random state value.
    const state = "keil_" + Math.random().toString(36).substring(7);
    
    // Add scopes as required (e.g., calendar, gmail, etc.)
    const scopes = [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
        // 'https://www.googleapis.com/auth/calendar.readonly' 
    ];

    const authorizationUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Requests a refresh token
        scope: scopes,
        state: state,
        prompt: 'consent' // Forces consent screen to ensure refresh token is provided
    });

    res.json({ url: authorizationUrl });
};

export const googleCallback = async (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    if (error) {
        logger.error(`Google OAuth Error: ${error}`);
        return res.status(400).json({ error: 'OAuth failed' });
    }

    if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Authorization code is missing' });
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch user info to verify
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });
        const userInfo = await oauth2.userinfo.get();

        logger.info(`Successfully authenticated Google user: ${userInfo.data.email}`);

        // TODO: Save the refresh_token and access_token securely in the database
        // associated with the currently authenticated Keil-App user.
        // For now, we will return the tokens directly or redirect to frontend.
        
        // Redirecting back to frontend (adjust URL as needed for your app's flow)
        // Optionally pass tokens or a status flag via URL fragments or a session.
        res.redirect(`http://localhost:5173/settings?google_sync=success`);
    } catch (err) {
        logger.error(`Failed to exchange token: ${err}`);
        res.status(500).json({ error: 'Failed to exchange authorization code' });
    }
};

import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as userPreferencesService from "../services/user-preferences.service";
import { isValidSttProvider } from "../services/transcription";

/**
 * GET /api/v1/preferences
 * Fetch the current user's app preferences.
 */
export const getPreferences = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const prefs = await userPreferencesService.getPreferences(user.id);

    return res.status(200).json(
        new ApiResponse(200, prefs, "User preferences retrieved successfully")
    );
});

/**
 * PATCH /api/v1/preferences/stt-provider
 * Update the user's STT provider preference.
 * Body: { provider: "sarvam" | "elevenlabs" }
 */
export const updateSttProvider = catchAsync(async (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || !user.id) {
        throw new ApiError(401, "User authentication required");
    }

    const { provider } = req.body;

    if (!provider || !isValidSttProvider(provider)) {
        return res.status(400).json({
            error: "Invalid provider. Must be one of: sarvam, elevenlabs",
        });
    }

    const updated = await userPreferencesService.updateSttProvider(user.id, provider);

    return res.status(200).json(
        new ApiResponse(200, updated, "STT provider updated successfully")
    );
});

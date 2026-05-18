import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import * as aiService from "../services/ai.service";

export const chat = catchAsync(async (req: Request, res: Response) => {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
        throw new ApiError(400, "messages must be an array");
    }

    const normalizedMessages = messages.map((message) => ({
        role: message?.role,
        content: typeof message?.content === "string" ? message.content.trim() : "",
    }));

    const invalidMessage = normalizedMessages.find(
        (message) =>
            !["user", "assistant", "system"].includes(message.role) ||
            !message.content
    );

    if (invalidMessage) {
        throw new ApiError(400, "Each message must include role and content");
    }

    const reply = await aiService.generateAiReply(normalizedMessages);

    return res.status(200).json(
        new ApiResponse(200, reply, "AI response generated successfully")
    );
});

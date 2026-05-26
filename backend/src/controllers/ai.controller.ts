import { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import * as aiService from "../services/ai.service";

export const chat = catchAsync(async (req: Request, res: Response) => {
    const { messages, modelSelection, localAiBaseUrl, localAiModel } = req.body;

    if (!Array.isArray(messages)) {
        throw new ApiError(400, "messages must be an array");
    }

    const normalizedMessages = messages.map((message) => {
        let content = "";
        if (typeof message?.content === "string") {
            content = message.content.trim();
        } else if (Array.isArray(message?.parts)) {
            content = message.parts
                .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
                .map((part: any) => part.text.trim())
                .join("\n")
                .trim();
        }
        return {
            role: message?.role,
            content,
        };
    });

    const invalidMessage = normalizedMessages.find(
        (message) =>
            !["user", "assistant", "system"].includes(message.role) ||
            !message.content
    );

    if (invalidMessage) {
        throw new ApiError(400, "Each message must include role and content");
    }

    const stream = await aiService.generateAiStream(normalizedMessages, {
        modelSelection,
        localAiBaseUrl,
        localAiModel,
    });

    stream.pipeUIMessageStreamToResponse(res);
});

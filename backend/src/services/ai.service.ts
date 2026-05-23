import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, type ModelMessage } from "ai";
import { config } from "../config";
import { ApiError } from "../utils/ApiError";

export type AiChatMessage = {
    role: "user" | "assistant" | "system";
    content: string;
};

const SYSTEM_PROMPT =
    "You are KeilHQ AI, a concise work assistant inside a productivity app. Help users summarize, plan, analyze, and turn requests into practical next steps. Keep responses clear and actionable.";

const toModelMessages = (messages: AiChatMessage[]): ModelMessage[] => {
    return messages.map((message) => ({
        role: message.role,
        content: message.content,
    }));
};

export const generateAiReply = async (messages: AiChatMessage[]) => {
    if (!config.openRouterApiKey) {
        throw new ApiError(500, "OPENROUTER_API_KEY is not configured");
    }

    if (!messages.length) {
        throw new ApiError(400, "At least one message is required");
    }

    const provider = createOpenAICompatible({
        name: "openrouter",
        apiKey: config.openRouterApiKey,
        baseURL: config.openRouterBaseUrl,
        includeUsage: true,
        headers: {
            "HTTP-Referer": config.frontendUrl || "http://localhost:5173",
            "X-Title": "KeilHQ",
        },
    });

    const result = await generateText({
        model: provider(config.openRouterModel),
        system: SYSTEM_PROMPT,
        messages: toModelMessages(messages).slice(-20),
    });

    return {
        content: result.text,
        model: config.openRouterModel,
        usage: result.usage,
        finishReason: result.finishReason,
    };
};

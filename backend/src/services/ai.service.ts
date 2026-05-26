import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, type ModelMessage } from "ai";
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

export const generateAiStream = async (messages: AiChatMessage[]) => {
    // If a custom/local endpoint is used, we bypass the strict OpenRouter API key requirement
    // by defaulting to a dummy key since local servers typically do not require authentication.
    const isLocalOrCustom = config.openRouterBaseUrl && !config.openRouterBaseUrl.includes("openrouter.ai");
    const apiKey = config.openRouterApiKey || (isLocalOrCustom ? "local-key" : "");

    if (!apiKey) {
        throw new ApiError(500, "OPENROUTER_API_KEY is not configured");
    }

    if (!messages.length) {
        throw new ApiError(400, "At least one message is required");
    }

    const provider = createOpenAICompatible({
        name: isLocalOrCustom ? "local-llm" : "openrouter",
        apiKey: apiKey,
        baseURL: config.openRouterBaseUrl,
        includeUsage: true,
        headers: {
            "HTTP-Referer": config.frontendUrl || "http://localhost:5173",
            "X-Title": "KeilHQ",
        },
    });

    return streamText({
        model: provider(config.openRouterModel),
        system: SYSTEM_PROMPT,
        messages: toModelMessages(messages).slice(-20),
    });
};

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, generateText, type ModelMessage } from "ai";
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

export const generateAiStream = async (
    messages: AiChatMessage[],
    options?: {
        modelSelection?: "openrouter" | "local";
        openRouterModel?: string;
        localAiBaseUrl?: string;
        localAiModel?: string;
    }
) => {
    const useLocal = options?.modelSelection === "local";

    // Determine the baseURL and model to query dynamically
    const baseURL = useLocal
        ? (options?.localAiBaseUrl || "http://localhost:8080/v1")
        : config.openRouterBaseUrl;

    const modelName = useLocal
        ? (options?.localAiModel || "local-model")
        : (options?.openRouterModel || config.openRouterModel);

    const isLocalOrCustom = baseURL && !baseURL.includes("openrouter.ai");
    const apiKey = useLocal ? "local-key" : (config.openRouterApiKey || (isLocalOrCustom ? "local-key" : ""));

    if (!apiKey) {
        throw new ApiError(500, "OPENROUTER_API_KEY is not configured");
    }

    if (!messages.length) {
        throw new ApiError(400, "At least one message is required");
    }

    const provider = createOpenAICompatible({
        name: isLocalOrCustom ? "local-llm" : "openrouter",
        apiKey: apiKey,
        baseURL: baseURL,
        includeUsage: true,
        headers: {
            "HTTP-Referer": config.frontendUrl || "http://localhost:5173",
            "X-Title": "KeilHQ",
        },
    });

    return streamText({
        model: provider(modelName),
        system: SYSTEM_PROMPT,
        messages: toModelMessages(messages).slice(-20),
    });
};

export const generateTextResponse = async (
    messages: AiChatMessage[],
    options?: {
        modelSelection?: "openrouter" | "local";
        openRouterModel?: string;
        localAiBaseUrl?: string;
        localAiModel?: string;
    }
) => {
    const useLocal = options?.modelSelection === "local";

    const baseURL = useLocal
        ? (options?.localAiBaseUrl || "http://localhost:8080/v1")
        : config.openRouterBaseUrl;

    const modelName = useLocal
        ? (options?.localAiModel || "local-model")
        : (options?.openRouterModel || config.openRouterModel);

    const isLocalOrCustom = baseURL && !baseURL.includes("openrouter.ai");
    const apiKey = useLocal ? "local-key" : (config.openRouterApiKey || (isLocalOrCustom ? "local-key" : ""));

    if (!apiKey) {
        throw new ApiError(500, "OPENROUTER_API_KEY is not configured");
    }

    if (!messages.length) {
        throw new ApiError(400, "At least one message is required");
    }

    const provider = createOpenAICompatible({
        name: isLocalOrCustom ? "local-llm" : "openrouter",
        apiKey: apiKey,
        baseURL: baseURL,
        includeUsage: true,
        headers: {
            "HTTP-Referer": config.frontendUrl || "http://localhost:5173",
            "X-Title": "KeilHQ",
        },
    });

    return generateText({
        model: provider(modelName),
        system: SYSTEM_PROMPT,
        messages: toModelMessages(messages).slice(-20),
    });
};

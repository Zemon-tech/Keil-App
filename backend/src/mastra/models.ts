import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { RequestContext } from "@mastra/core/request-context";
import { config } from "../config";

// ─── Gemini (default) ─────────────────────────────────────────────────────────

let _geminiModel: ReturnType<ReturnType<typeof createGoogleGenerativeAI>> | null = null;

function getGeminiModel() {
  if (!_geminiModel) {
    if (!config.googleGenAiApiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not configured");
    }
    const google = createGoogleGenerativeAI({
      apiKey: config.googleGenAiApiKey,
    });
    _geminiModel = google("gemini-3.5-flash");
  }
  return _geminiModel;
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────

let _openRouterModel: ReturnType<ReturnType<typeof createOpenAICompatible>> | null = null;

function getOpenRouterModel() {
  if (!_openRouterModel) {
    if (!config.openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: config.openRouterBaseUrl,
      apiKey: config.openRouterApiKey,
    });
    _openRouterModel = openrouter(config.openRouterModel);
  }
  return _openRouterModel;
}

// ─── Local LLM ────────────────────────────────────────────────────────────────

function createLocalModel(baseUrl: string, modelName: string) {
  const provider = createOpenAICompatible({
    name: "local-llm",
    apiKey: "local-key",
    baseURL: baseUrl,
  });
  return provider(modelName);
}

// ─── Model resolver ───────────────────────────────────────────────────────────

/**
 * Resolves the model to use based on the request context.
 * Reads `modelSelection`, `localAiBaseUrl`, and `localAiModel` from context.
 */
export function resolveModel(requestContext?: RequestContext) {
  const modelSelection = requestContext?.get("modelSelection") as string | undefined;

  switch (modelSelection) {
    case "openrouter":
      return getOpenRouterModel();

    case "local": {
      const baseUrl = (requestContext?.get("localAiBaseUrl") as string) || "http://localhost:8080/v1";
      const modelName = (requestContext?.get("localAiModel") as string) || "local-model";
      return createLocalModel(baseUrl, modelName);
    }

    case "gemini":
    default:
      return getGeminiModel();
  }
}

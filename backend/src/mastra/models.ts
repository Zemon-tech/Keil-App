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

let _openRouterModelProvider: ReturnType<typeof createOpenAICompatible> | null = null;

function getOpenRouterModel(modelName?: string) {
  if (!config.openRouterApiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }
  if (!_openRouterModelProvider) {
    _openRouterModelProvider = createOpenAICompatible({
      name: "openrouter",
      baseURL: config.openRouterBaseUrl,
      apiKey: config.openRouterApiKey,
    });
  }
  return _openRouterModelProvider(modelName || config.openRouterModel);
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

// ─── GitHub Models ────────────────────────────────────────────────────────────

let _githubModel: ReturnType<ReturnType<typeof createOpenAICompatible>> | null = null;

function getGithubModel() {
  if (!_githubModel) {
    if (!config.githubToken) {
      throw new Error("GITHUB_TOKEN is not configured for GitHub Models");
    }
    const github = createOpenAICompatible({
      name: "github-models",
      baseURL: config.githubModelsBaseUrl,
      apiKey: config.githubToken,
    });
    _githubModel = github(config.githubModelsModel);
  }
  return _githubModel;
}

// ─── Model resolver ───────────────────────────────────────────────────────────

/**
 * Resolves the model to use based on the request context.
 * Reads `modelSelection`, `localAiBaseUrl`, and `localAiModel` from context.
 */
export function resolveModel(requestContext?: RequestContext) {
  const modelSelection = requestContext?.get("modelSelection") as string | undefined;

  switch (modelSelection) {
    case "openrouter": {
      const openRouterModel = requestContext?.get("openRouterModel") as string | undefined;
      return getOpenRouterModel(openRouterModel);
    }

    case "github":
      return getGithubModel();

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

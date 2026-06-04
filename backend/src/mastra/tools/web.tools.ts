import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { config } from "../../config";

export const webSearchExaTool = createTool({
  id: "web_search_exa",
  description: "Search the web/internet using Exa for real-time information, documentation, current events, and external research.",
  inputSchema: z.object({
    query: z
      .string()
      .describe("The search query. Describe what you want to find in natural language."),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(5)
      .describe("The number of search results to return (default is 5)."),
    type: z
      .enum(["auto", "fast", "instant", "deep-lite", "deep", "deep-reasoning"])
      .optional()
      .default("auto")
      .describe("Exa search mode. 'auto' selects the best mode. Use 'deep' for higher-quality web search and extraction."),
  }),
  execute: async (inputData) => {
    const { query, numResults, type } = inputData;
    const apiKey = config.exaApiKey || process.env.EXA_API_KEY;

    if (!apiKey) {
      return {
        error: "Exa API key is not configured on the backend. Please add EXA_API_KEY to your .env file.",
      };
    }

    try {
      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query,
          numResults,
          type,
          contents: {
            summary: true,
            highlights: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          error: `Exa API responded with status ${response.status}: ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        results?: Array<{
          title?: string;
          url?: string;
          publishedDate?: string;
          author?: string;
          score?: number;
          summary?: string;
          highlights?: string[];
        }>;
      };

      // Clean up the response to only return what is useful to the LLM to avoid context bloating
      const results = data.results?.map((item) => ({
        title: item.title,
        url: item.url,
        score: item.score,
        publishedDate: item.publishedDate,
        author: item.author,
        summary: item.summary,
        highlights: item.highlights,
      }));

      return {
        results: results || [],
      };
    } catch (err: any) {
      return {
        error: `Failed to execute Exa search: ${err?.message || err}`,
      };
    }
  },
});

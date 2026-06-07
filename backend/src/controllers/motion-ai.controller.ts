import { Request, Response } from "express";
import { streamText } from "ai";
import { catchAsync } from "../utils/catchAsync";
import { ApiError } from "../utils/ApiError";
import { resolveModel } from "../mastra/models";

/**
 * POST /api/v1/orgs/:orgId/spaces/:spaceId/notes/:pageId/ai
 * 
 * SSE streaming endpoint for Motion AI tasks (proofread, rewrite, translate, generate, etc.)
 */
export const handleMotionAi = catchAsync(async (req: Request, res: Response) => {
  const { action, text, prompt, context } = req.body;

  if (!action) {
    throw new ApiError(400, "AI action is required");
  }

  // Resolve the model specifically to the GitHub Model as requested by the user
  const model = resolveModel({
    get: (key: string) => (key === "modelSelection" ? "github" : undefined)
  } as any);

  // Set headers for Server-Sent Events (SSE)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable buffering for Nginx/Cloudflare proxying

  // Formulate prompts depending on the action
  let systemPrompt = "You are a helpful assistant integrated into a document editor called Motion.";
  let userPrompt = "";

  switch (action) {
    case "proofread":
      systemPrompt = "You are an expert editor. Fix spelling, grammar, syntax, and punctuation errors in the text. Maintain the original formatting, markdown tags (if any), and tone. Do not write any intro, outro, or commentary—respond ONLY with the corrected text.";
      userPrompt = text || "";
      break;

    case "rewrite": {
      const tone = req.body.tone || "professional";
      systemPrompt = `You are a skilled editor. Rewrite the text to have a ${tone} tone. Keep the core meaning the same but adapt the vocabulary, phrasing, and style. Do not write any intro, outro, or commentary—respond ONLY with the rewritten text.`;
      userPrompt = text || "";
      break;
    }

    case "longer":
      systemPrompt = "You are a writing assistant. Expand the text to make it longer, more detailed, and thorough while retaining its core message. Do not write any intro, outro, or commentary—respond ONLY with the expanded text.";
      userPrompt = text || "";
      break;

    case "shorter":
      systemPrompt = "You are a writing assistant. Make the text shorter and more concise, eliminating fluff while preserving all essential details. Do not write any intro, outro, or commentary—respond ONLY with the shortened text.";
      userPrompt = text || "";
      break;

    case "simplify":
      systemPrompt = "You are a writing assistant. Simplify the vocabulary and structure of the text to make it easy to understand for a general reader. Do not write any intro, outro, or commentary—respond ONLY with the simplified text.";
      userPrompt = text || "";
      break;

    case "translate": {
      const lang = req.body.language || "Spanish";
      systemPrompt = `You are a professional translator. Translate the text into ${lang}. Retain all formatting and structure. Do not write any intro, outro, or commentary—respond ONLY with the translated text.`;
      userPrompt = text || "";
      break;
    }

    case "generate":
    case "custom":
      systemPrompt = "You are a creative writer and writing assistant. Generate high-quality text that matches the user's instructions. Use the provided context of the document to keep the generation relevant and informed.";
      userPrompt = `Document Context:\n${context || "No context available."}\n\nInstructions: ${prompt}\n\nTarget Text (if editing existing selection): ${text || "(none)"}`;
      break;

    case "summarize":
      systemPrompt = "You are a summary specialist. Write a concise, clear summary of the provided text or document context. Do not write any intro, outro, or commentary—respond ONLY with the summary.";
      userPrompt = text || context || "No content provided.";
      break;

    default:
      throw new ApiError(400, `Unsupported AI action: ${action}`);
  }

  // Setup abort controller in case the client closes the connection early
  const abortController = new AbortController();
  req.on("close", () => {
    abortController.abort();
  });

  try {
    const result = await streamText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      abortSignal: abortController.signal,
    });

    for await (const textPart of result.textStream) {
      // Stream in JSON format
      res.write(`data: ${JSON.stringify({ text: textPart })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    if (error.name === "AbortError" || abortController.signal.aborted) {
      // Silent ignore on client abort
      return;
    }
    // Write error to event stream so frontend knows it failed
    res.write(`data: ${JSON.stringify({ error: error.message || "Streaming failed" })}\n\n`);
    res.end();
  }
});

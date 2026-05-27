import { Agent } from "@mastra/core/agent";
import { resolveModel } from "../models";
import {
  searchMotionPagesTool,
  getMotionPageTool,
} from "../tools/motion.tools";

export const motionAgent = new Agent({
  id: "keilhq-motion-agent",
  name: "keilhq-motion-agent",
  description:
    "Manages notes and pages: search by title keyword and retrieve full page content.",
  instructions: `You are the KeilHQ Motion Agent. You help users find their notes and documents.

Search by title keywords using search_motion_pages, then retrieve full content with get_motion_page if needed.
When presenting search results, show the page title and when it was last updated.
You cannot create or edit pages — only search and retrieve.
If the user wants to edit or create notes, direct them to the notes section of the app.`,
  model: ({ requestContext }) => resolveModel(requestContext),
  tools: {
    search_motion_pages: searchMotionPagesTool,
    get_motion_page: getMotionPageTool,
  },
});

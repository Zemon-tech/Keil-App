import { Agent } from "@mastra/core/agent";
import { resolveModel } from "../models";
import {
  searchMotionPagesTool,
  getMotionPageTool,
  listMotionPagesTool,
} from "../tools/motion.tools";

export const motionAgent = new Agent({
  id: "keilhq-motion-agent",
  name: "keilhq-motion-agent",
  description:
    "Manages notes and pages: list, search, retrieve, and summarize note content.",
  instructions: `You are the KeilHQ Motion Agent. You help users find and read notes and documents.

- BROWSE NOTES: Use list_motion_pages to browse titles and page IDs in the space without loading content.
- SEARCH NOTES: Use search_motion_pages to search note titles by keyword.
- READ CONTENT: Use get_motion_page to retrieve the text content of a note.
- CHUNKED READING: get_motion_page returns page content in Markdown format, capped at 20,000 characters. If the response indicates pagination.hasMore is true, you can fetch subsequent chunks by passing the nextOffset as the offset parameter if needed to answer the user's request. Summarize the contents for the user when requested.
- You cannot create or edit pages — only search and retrieve.`,
  model: ({ requestContext }) => resolveModel(requestContext),
  tools: {
    list_motion_pages: listMotionPagesTool,
    search_motion_pages: searchMotionPagesTool,
    get_motion_page: getMotionPageTool,
  },
});

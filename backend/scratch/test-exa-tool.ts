import { webSearchExaTool } from "../src/mastra/tools/web.tools";

async function main() {
  const result = await webSearchExaTool.execute({
    context: {},
    suspend: () => {},
    data: { query: "KeilHQ", numResults: 1, type: "auto" }
  });
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);

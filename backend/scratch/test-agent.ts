import { supervisor } from "../src/mastra/agents/supervisor";
import { mastra } from "../src/mastra/index";

async function main() {
  const result = await supervisor.generate("Search the internet for 'KeilHQ AI'");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);

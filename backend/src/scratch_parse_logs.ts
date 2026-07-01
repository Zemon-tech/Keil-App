import fs from 'fs';
import path from 'path';

const logPath = '/Users/shivangkandoi/.gemini/antigravity-ide/brain/f48bb50b-185e-498d-aa2a-1de2941157c4/.system_generated/logs/transcript.jsonl';

function main() {
  if (!fs.existsSync(logPath)) {
    console.log('Log file does not exist');
    return;
  }
  const lines = fs.readFileSync(logPath, 'utf-8').split('\n');
  console.log(`Scanning ${lines.length} lines for tool calls...`);
  
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.tool_calls) {
        console.log(`\n--- Step ${obj.step_index} (${obj.source}) ---`);
        for (const tc of obj.tool_calls) {
          console.log(`Tool Call: ${tc.name || tc.function?.name}`);
          console.log(`Args:`, JSON.stringify(tc.arguments || tc.function?.arguments));
        }
      }
      if (obj.type === 'PLANNER_RESPONSE' || obj.type === 'TOOL_OUTPUT' || obj.content?.includes('tool')) {
        // Log if it looks like a tool output or agent response
        const contentStr = typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content);
        if (contentStr.includes('list_motion') || contentStr.includes('search_motion') || contentStr.includes('get_motion')) {
          console.log(`\n--- Step ${obj.step_index} (${obj.type}) ---`);
          console.log(contentStr.substring(0, 1000));
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }
}

main();

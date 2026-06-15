export interface StreamingActivity {
  agent: string;
  action: string;
  status: "running" | "complete" | "error";
  timestamp: string;
  tool?: string;
  executionId?: string;
}

export function extractStreamingActivities(message: any): StreamingActivity[] {
  if (!message) return [];

  // If array, target the last message
  if (Array.isArray(message)) {
    if (message.length === 0) return [];
    message = message[message.length - 1];
  }

  const parts = message.parts || (message.content && typeof message.content === "object" ? message.content.parts : undefined);
  if (!parts || !Array.isArray(parts)) {
    return [];
  }

  // Early exit — avoid building the Map when no activity parts exist,
  // which is the common case for plain text messages during streaming.
  const activityParts = parts.filter((p: any) => p.type === "data-agent-activity");
  if (activityParts.length === 0) return [];

  const activityMap = new Map<string, StreamingActivity>();

  for (const part of activityParts) {
    const data = part.data || part;
    const agent = data.agent || data.agentLabel || "KeilHQ AI";
    const action = data.action || "";
    const status = data.status || "running";
    const timestamp = data.timestamp || new Date().toISOString();
    const tool = data.tool;
    const executionId = data.executionId;

    const key = executionId || `${agent}:${tool || action}`;
    const existing = activityMap.get(key);

    // Keep the latest or complete/error status
    if (!existing || status === "complete" || status === "error" || new Date(timestamp) > new Date(existing.timestamp)) {
      activityMap.set(key, {
        agent,
        action,
        status,
        timestamp,
        tool,
        executionId,
      });
    }
  }

  const result = Array.from(activityMap.values());

  if (import.meta.env.DEV && result.length > 0) {
    console.log("[Debug] Parsed Streaming Activities:", result);
  }

  return result;
}

export interface StreamingActivity {
  agent: string;
  action: string;
  status: "running" | "complete" | "error";
  timestamp: string;
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

  const activityParts = parts.filter((p: any) => p.type === "data-agent-activity");

  const activityMap = new Map<string, StreamingActivity>();

  for (const part of activityParts) {
    const agent = part.agent || part.agentLabel || "KeilHQ AI";
    const action = part.action || "";
    const status = part.status || "running";
    const timestamp = part.timestamp || new Date().toISOString();

    const key = `${agent}:${action}`;
    const existing = activityMap.get(key);

    // Keep the latest or complete/error status
    if (!existing || status === "complete" || status === "error" || new Date(timestamp) > new Date(existing.timestamp)) {
      activityMap.set(key, {
        agent,
        action,
        status,
        timestamp,
      });
    }
  }

  const result = Array.from(activityMap.values());

  if (import.meta.env.DEV && result.length > 0) {
    console.log("[Debug] Parsed Streaming Activities:", result);
  }

  return result;
}

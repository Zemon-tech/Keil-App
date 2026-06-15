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

export interface TimelineItem {
  type: "thinking" | "activity";
  id: string;
  status: "active" | "complete" | "pending";
  timestamp?: string;
  text?: string;
  agent?: string;
  action?: string;
  tool?: string;
  args?: any;
  result?: any;
}

export function buildChainOfThoughtTimeline(message: any): TimelineItem[] {
  if (!message) return [];

  // If array, target the last message
  if (Array.isArray(message)) {
    if (message.length === 0) return [];
    message = message[message.length - 1];
  }

  const parts = message.parts || (message.content && typeof message.content === "object" ? message.content.parts : undefined);
  
  const timeline: TimelineItem[] = [];
  const activityMap = new Map<string, TimelineItem>();
  let thinkingStepCounter = 0;
  let currentThinkingStep: TimelineItem | null = null;

  if (parts && Array.isArray(parts)) {
    for (const part of parts) {
      if (part.type === "reasoning") {
        let reasoningText = "";
        if (part.text) {
          reasoningText = part.text;
        } else if (part.reasoning) {
          reasoningText = part.reasoning;
        } else if (Array.isArray(part.details)) {
          reasoningText = part.details
            .filter((d: any) => d.type === "text" && d.text)
            .map((d: any) => d.text)
            .join("");
        }

        if (!reasoningText) continue;

        if (!currentThinkingStep) {
          currentThinkingStep = {
            type: "thinking",
            id: `thinking-${thinkingStepCounter++}`,
            status: "active",
            text: "",
          };
          timeline.push(currentThinkingStep);
        }
        currentThinkingStep.text += reasoningText;

      } else if (part.type === "data-agent-activity") {
        if (currentThinkingStep) {
          currentThinkingStep.status = "complete";
          currentThinkingStep = null;
        }

        const data = part.data || part;
        const agent = data.agent || data.agentLabel || "KeilHQ AI";
        const action = data.action || "";
        const status = data.status === "running" ? "active" : "complete";
        const tool = data.tool;
        const executionId = data.executionId;

        const key = executionId || `${agent}:${tool || action}`;
        
        let item = activityMap.get(key);
        if (!item) {
          item = {
            type: "activity",
            id: key,
            status,
            agent,
            action,
            tool,
          };
          activityMap.set(key, item);
          timeline.push(item);
        } else {
          item.status = status;
          if (action) item.action = action;
          if (tool) item.tool = tool;
          if (agent) item.agent = agent;
        }

      } else if (part.type === "tool-call" || part.type === "tool-invocation") {
        if (currentThinkingStep) {
          currentThinkingStep.status = "complete";
          currentThinkingStep = null;
        }

        const toolCallId = part.toolCallId || part.id;
        const toolName = part.toolName;
        const args = part.args || part.input;

        let item = activityMap.get(toolCallId);
        if (!item && toolName) {
          // Fallback matching by tool name
          const recentActivity = timeline.slice().reverse().find(
            (t) => t.type === "activity" && t.tool === toolName && !t.args
          );
          if (recentActivity) {
            item = recentActivity;
            activityMap.set(toolCallId, item);
          }
        }

        if (!item) {
          item = {
            type: "activity",
            id: toolCallId,
            status: "active",
            tool: toolName,
          };
          activityMap.set(toolCallId, item);
          timeline.push(item);
        }

        if (args) item.args = args;

      } else if (part.type === "tool-result") {
        if (currentThinkingStep) {
          currentThinkingStep.status = "complete";
          currentThinkingStep = null;
        }

        const toolCallId = part.toolCallId || part.id;
        const toolName = part.toolName;
        const result = part.result;

        let item = activityMap.get(toolCallId);
        if (!item && toolName) {
          const recentActivity = timeline.slice().reverse().find(
            (t) => t.type === "activity" && t.tool === toolName && !t.result
          );
          if (recentActivity) {
            item = recentActivity;
            activityMap.set(toolCallId, item);
          }
        }

        if (!item) {
          item = {
            type: "activity",
            id: toolCallId,
            status: "complete",
            tool: toolName,
          };
          activityMap.set(toolCallId, item);
          timeline.push(item);
        }

        item.status = "complete";
        if (result) item.result = result;
      }
    }
  } else {
    // Fallback path: for messages that only have top-level reasoning and/or toolInvocations array
    if (message.reasoning) {
      timeline.push({
        type: "thinking",
        id: `thinking-${thinkingStepCounter++}`,
        status: "complete",
        text: message.reasoning,
      });
    }

    if (message.toolInvocations && Array.isArray(message.toolInvocations)) {
      for (const inv of message.toolInvocations) {
        timeline.push({
          type: "activity",
          id: inv.toolCallId || `inv-${Math.random()}`,
          status: inv.state === "result" ? "complete" : "active",
          tool: inv.toolName,
          args: inv.args,
          result: inv.result,
        });
      }
    }
  }

  if (currentThinkingStep) {
    currentThinkingStep.status = "complete";
  }

  return timeline;
}


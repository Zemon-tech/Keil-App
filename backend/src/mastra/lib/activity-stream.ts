export async function emitActivity(
  context: any,
  payload: {
    agentLabel: string;
    action: string;
    status: "running" | "complete" | "error";
  }
) {
  const activityPayload = {
    agent: payload.agentLabel,
    action: payload.action,
    status: payload.status,
    tool: context?.activeToolId,
    executionId: context?.toolExecutionId,
    timestamp: new Date().toISOString(),
  };

  // ── Primary: direct write via requestContext ──────────────────────────────
  // The UI writer is stored in requestContext at the start of each streaming
  // request. requestContext is the SAME Map object shared across the full chain:
  //   supervisor → sub-agent (taskAgent, chatAgent, ...) → tool
  // So this works regardless of which agent depth the tool runs at.
  const uiWriter = context?.requestContext?.get("uiWriter");
  if (uiWriter) {
    try {
      uiWriter.write({
        type: "data-agent-activity",
        data: activityPayload,
      } as any);
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[Debug] Activity emitted (direct): [${payload.agentLabel}] ${payload.action} (${payload.status})`
        );
      }
    } catch {
      // Silently ignore — never block tool execution
    }
    return;
  }

  // ── Fallback: Mastra context.writer.custom ────────────────────────────────
  // Only reaches here if requestContext writer wasn't stored (e.g. tests or
  // direct tool invocations outside the streaming request handler).
  if (context?.writer?.custom) {
    try {
      await context.writer.custom({
        type: "data-agent-activity",
        data: activityPayload,
      });
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[Debug] Activity emitted (custom writer): [${payload.agentLabel}] ${payload.action} (${payload.status})`
        );
      }
    } catch {
      // Silently ignore to prevent any tool blockages
    }
  }
}

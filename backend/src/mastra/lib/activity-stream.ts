export async function emitActivity(
  context: any,
  payload: {
    agentLabel: string;
    action: string;
    status: "running" | "complete" | "error";
  }
) {
  if (context?.writer?.custom) {
    try {
      await context.writer.custom({
        type: "data-agent-activity",
        data: {
          agent: payload.agentLabel,
          action: payload.action,
          status: payload.status,
          timestamp: new Date().toISOString(),
        },
      });
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[Debug] Activity emitted: [${payload.agentLabel}] ${payload.action} (${payload.status})`
        );
      }
    } catch (err) {
      // Safely ignore to prevent any tool blockages
    }
  }
}

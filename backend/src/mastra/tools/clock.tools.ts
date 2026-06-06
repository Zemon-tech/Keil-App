import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const getCurrentTimeTool = createTool({
  id: "get_current_time",
  description: "Get the current time, date, timezone, and day of the week. Essential for resolving relative dates like 'today', 'tomorrow', 'next week', 'last Friday', etc.",
  inputSchema: z.object({}),
  execute: async () => {
    const now = new Date();
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ];
    
    return {
      isoString: now.toISOString(),
      localTime: now.toString(),
      dateOnly: now.toISOString().split("T")[0],
      dayOfWeek: days[now.getDay()],
      timezoneOffsetMinutes: now.getTimezoneOffset(),
      timezoneOffsetHours: -now.getTimezoneOffset() / 60,
    };
  },
});

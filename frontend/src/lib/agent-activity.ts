export function getToolActivity(
    toolName: string,
    state: "call" | "result" | string,
    result?: any,
    args?: any
): { action: string; details?: string; agent: string } {
    if (state === "result" && result?.activity) {
        return {
            agent: result.activity.agentLabel || result.activity.agent,
            action: result.activity.action,
            details: result.activity.details,
        };
    }

    let agent = "KeilHQ AI";
    if (toolName.includes("task") || toolName.includes("org") || toolName.includes("workspace")) {
        agent = "Task Manager";
    } else if (toolName.includes("chat") || toolName.includes("message") || toolName.includes("channel")) {
        agent = "Chat";
    } else if (toolName.includes("motion") || toolName.includes("page") || toolName.includes("note")) {
        agent = "Notes";
    } else if (toolName.includes("schedule") || toolName.includes("calendar")) {
        agent = "Scheduler";
    } else if (toolName.includes("github")) {
        agent = "GitHub";
    }

    let action = `Executing ${toolName}`;
    let details = "";

    switch (toolName) {
        case "web_search_exa":
            action = args?.query ? `Searching the web for "${args.query}"` : "Searching the web";
            break;
        case "list_tasks":
            action = args?.scope ? `Listing your ${args.scope} tasks` : "Listing tasks";
            break;
        case "get_task":
            action = "Reading task details";
            break;
        case "create_task":
            action = args?.title ? `Creating task "${args.title}"` : "Creating task";
            break;
        case "update_task":
            action = "Updating task";
            break;
        case "delete_task":
            action = "Deleting task";
            break;
        case "resolve_workspace":
            action = "Looking up your workspace";
            break;
        case "search_tasks":
            action = args?.query ? `Searching tasks for "${args.query}"` : "Searching tasks";
            break;
        case "get_calendar_events":
            action = "Reading your calendar";
            break;
        case "get_unscheduled_tasks":
            action = "Fetching your unscheduled tasks";
            break;
        case "auto_schedule_tasks":
            action = "Scheduling tasks into free time slots";
            break;
        case "search_motion_pages":
            action = args?.query ? `Searching notes for "${args.query}"` : "Searching notes";
            break;
        case "list_motion_pages":
            action = args?.query ? `Browsing notes matching "${args.query}"` : "Listing notes";
            break;
        case "get_motion_page":
            action = args?.title ? `Reading "${args.title}"` : "Reading note page";
            break;
        case "create_motion_page":
            action = args?.title ? `Creating note "${args.title}"` : "Creating note page";
            break;
        case "update_motion_page":
            action = "Updating note page";
            break;
        case "get_user_channels":
            action = "Checking your channels";
            break;
        case "get_channel_messages":
            action = "Reading channel messages";
            break;
        case "list_github_issues":
            action = args?.repo ? `Listing issues in ${args.repo}` : "Listing GitHub issues";
            break;
        case "get_github_issue":
            action = args?.issueNumber && args?.repo ? `Reading issue #${args.issueNumber} in ${args.repo}` : "Reading GitHub issue";
            break;
        case "list_github_prs":
            action = args?.repo ? `Listing pull requests in ${args.repo}` : "Listing GitHub pull requests";
            break;
        case "list_github_contributors":
            action = args?.repo ? `Looking up contributors in ${args.repo}` : "Looking up GitHub contributors";
            break;
        case "create_github_issue_from_task":
            action = "Creating GitHub issue from task";
            break;
        case "keilhq-task-agent":
            agent = "Task Manager";
            action = "Delegating to task specialist";
            break;
        case "keilhq-chat-agent":
            agent = "Chat";
            action = "Delegating to chat specialist";
            break;
        case "keilhq-motion-agent":
            agent = "Notes";
            action = "Delegating to notes specialist";
            break;
        case "keilhq-scheduler-agent":
            agent = "Scheduler";
            action = "Delegating to calendar specialist";
            break;
        case "keilhq-github-agent":
            agent = "GitHub";
            action = "Delegating to GitHub specialist";
            break;
    }

    if (state === "result") {
        if (result?.count !== undefined) {
            details = `Fetched ${result.count} item(s)`;
        } else if (result?.success) {
            details = "Action completed successfully";
        }
    }

    return { agent, action, details };
}

export function extractToolInvocations(message: any): any[] {
    if (!message) return [];
    
    if (message.toolInvocations && message.toolInvocations.length > 0) {
        return message.toolInvocations;
    }
    
    if (message.parts) {
        const toolParts = message.parts.filter((p: any) => 
            p.type === "tool-invocation" || 
            p.type === "tool-call" || 
            p.type?.startsWith("tool-input") ||
            p.type === "tool-result"
        );
        
        const invocationsMap = new Map();
        
        for (const p of toolParts) {
            const invocation = p.toolInvocation || {
                state: p.type === "tool-result" ? "result" : "call",
                toolCallId: p.toolCallId || p.id,
                toolName: p.toolName,
                args: p.args || p.input, // Handles JSON string inputs if args is not populated
                result: p.result
            };
            
            if (!invocationsMap.has(invocation.toolCallId) || invocation.state === "result") {
                invocationsMap.set(invocation.toolCallId, invocation);
            }
        }
        
        return Array.from(invocationsMap.values());
    }
    
    return [];
}

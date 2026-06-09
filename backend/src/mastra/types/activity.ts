export interface ActivityEvent {
  agent: string;        // Internal agent ID e.g. 'keilhq-task-agent'
  agentLabel: string;   // Human label e.g. 'Task Manager'
  tool: string;         // Tool name e.g. 'list_tasks'
  icon: string;         // Icon hint for frontend
  action: string;       // Present tense shown while running: "Searching your tasks"
  details: string;      // Past tense shown on completion: "Found 3 tasks"
  status: 'complete' | 'error';
  timestamp: string;    // new Date().toISOString()
}

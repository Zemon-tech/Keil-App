# Feature Spec: Dashboard Agent Context & Generative UI Architecture

## 1. Overview & Goal
The objective is to upgrade the KeilHQ Dashboard Agent (`keilhq-ai`) to support context-aware interactions, conversational task creation, product definition assistance, and a high-performance Generative UI architecture.

---

## 2. Requirements

### 2.1 Workspace & User Context Enrichment
* **Objective**: The agent needs to be fully aware of the user's current environment.
* **Scope of Context**:
  * The user's personal workspace, personal organization, and private spaces.
  * All organizations the user is joined in, the spaces within those organizations, and the user's respective roles.
  * Tasks assigned to the user across all spaces.
  * Contextual information for motion pages and chats.
* **Performance Constraint**: To prevent excessive database queries, the user's workspace/role context profile must be **cached per thread session** rather than fetched on every message.

### 2.2 Conversational & Context-Aware Task Creation
* **Objective**: The agent must handle task creation naturally and conversationally.
* **Requirements**:
  * **Context-Aware Parameters**: The agent should resolve space and organization names to their respective identifiers from the user's context (e.g., if a user mentions an organization by name, the agent knows which one they mean).
  * **Conversational Fallback**: If the user asks to create a task but provides minimal details, the agent must not assume or use placeholders. It should dynamically ask follow-up questions to gather necessary information (e.g., title, space, due date, priority, or assignee).

### 2.3 Product Manager Agent (`keilhq-pm-agent`)
* **Objective**: Introduce a new specialist agent focused on product planning.
* **Requirements**:
  * The agent should take a high-level product idea, define it, and break it down into a list of suggested tasks.
  * **Human-in-the-Loop Constraint**: Following the principle of "AI proposes, human decides", the PM agent must **present the proposed tasks to the user for approval first**. Tasks should only be created in the database after the user explicitly reviews and approves them.

---

## 3. Generative UI Architecture & The Double LLM Issue

### The Problem Statement
Currently, rendering dynamic UI components (like task lists, chat previews, or motion pages) in the dashboard agent is highly inefficient. The supervisor delegates to a sub-agent, which calls a tool to fetch database data, runs a sub-agent LLM call to output text/JSON, and passes it back to the supervisor, which runs *another* LLM call to process and prepare the response for the frontend. 

This double LLM execution pattern causes:
1. Significant latency and response delay.
2. High token consumption and cost.
3. Loss of raw, structured data needed to render clean React UI components on the client.

### Architectural Goal
Design a clean approach using the **Mastra** framework and **Vercel AI SDK** to stream tool outputs directly to the frontend.
* The sub-agent's tool outputs (JSON) should be forwarded down the stream to the client without requiring secondary LLM summaries.
* The frontend must intercept the tool execution results and render them using beautiful, interactive React components (widgets) rather than plain text.
* The developer should propose the optimal implementation structure to achieve this direct tool call stream with minimum overhead.

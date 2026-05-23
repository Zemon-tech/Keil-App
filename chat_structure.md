inclusion: auto
name: docs-update
description: How to write or update structured documentation after making feature changes
---
# Documentation Structure Workflow

When a developer finishes implementing a significant feature or architectural change, this workflow defines how to document the system in a structured, maintainable, and consistent way.

## Guidelines

1. *Location*: Documentation for a specific feature or domain should be placed in docs/<feature-name>/.
2. *Format*: All documentation must be written in Markdown. Use tables and code blocks for readability.
3. *Template*: The documentation should follow the modular structure implemented in docs/auth/. Breakdown the knowledge into domain-specific files rather than one giant README.

---

## Expected File Structure

When creating documentation for a feature, aim to split the information into these core files within your docs/<feature-name>/ directory:

### 1. README.md
- *Purpose*: High-level overview, table of contents, and a quick start guide.
- *Expected Content*:
  - *Overview*: A brief summary of what the feature is and its primary objective.
  - *Table of Contents*: Markdown links to the other files in the folder (e.g., [Frontend Guide](./frontend.md)).
  - *Quick Start*: Step-by-step instructions on how to set up, run, and test the feature.
  - *Tech Stack*: A table listing the technologies used across the stack for this feature.

### 2. architecture.md
- *Purpose*: System design, flow, and justification of technical choices.
- *Expected Content*:
  - *Flow Diagrams*: ASCII art or structural block representations showing how data moves between frontend, backend, and external services.
  - *Key Design Decisions: Document the *why behind architectural choices (e.g., "Why we chose a frontend-driven approach" or "Why we used Context instead of Redux").
  - *Security Model/Boundaries*: Explain how data is protected in this specific feature.

### 3. frontend.md
- *Purpose*: Client-side implementation and usage details.
- *Expected Content*:
  - *File Structure*: A tree representation of only the files relevant to this feature in frontend/src/.
  - *Core Concepts*: Explanations of key Contexts, Providers, or global states used.
  - *Important Components*: Documentation of major UI components or views.
  - *API Integration*: Explanation of how the client requests data from the backend (Axios, interceptors, etc.).
  - *Usage Examples*: Code snippets showing how to consume the feature in other parts of the app.

### 4. backend.md (If applicable)
- *Purpose*: Server-side mechanics, endpoints, and database interactions.
- *Expected Content*:
  - *File Structure*: A tree representation of only the files relevant to this feature in backend/src/.
  - *Models/Schema*: Markdown tables representing database schemas, required fields, and relationships.
  - *Middlewares & Logic*: Explanation of any custom middleware or complex service logic.
  - *Routing*: Examples of how the endpoints are registered and how they are protected.

### 5. environment.md (If applicable)
- *Purpose*: Centralized reference for all configuration requirements.
- *Expected Content*:
  - *Config Tables*: Separate tables for Frontend and Backend variables including Variable Name, Required (Yes/No), Description, and Example.
  - *Sourcing Instructions*: Step-by-step guides on where to find third-party API keys or connection strings.
  - *Security Reminders*: Warnings about which keys must remain private and safe handling practices.

---

## Steps to Execute This Workflow

1. Look through the completed changes to understand the full scope of the feature.
2. Create the docs/<feature-name>/ directory if it does not already exist.
3. Start with the README.md to establish the summary and outline.
4. Write architecture.md to cover flow diagrams and outline key design decisions.
5. Write frontend.md and backend.md as necessary to explain directory structures, data models, state management, and routing.
6. If any new .env variables were added, document their purpose, examples, and security considerations thoroughly in environment.md.
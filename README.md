# ClarityOS — Operating System for Human Clarity

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./frontend/public/keilhq-white.svg" />
    <img alt="ClarityOS" src="./frontend/public/keilhq.svg" height="96" />
  </picture>
</p>

<p align="center"><strong>Clarity first. Execution follows.</strong></p>
<p align="center">We connect everything. We clarify everything. We never act without you.</p>

---

## Overview

ClarityOS is an **Operating System for Human Clarity**.

It makes work clearer, faster, and more manageable by:

- **Extracting intent** from messy asks, chats, and meetings.
- **Removing ambiguity** with targeted clarifying questions.
- **Connecting everything** — tasks, chats, docs, meetings, assets, CRM, ATS — into a single knowledge graph.
- **Protecting focus** by scheduling work intelligently around deep work.

The system does **not** replace people — it asks, suggests, and empowers. AI is always assistive, never silently autonomous.

---

## Core Philosophy

These principles apply to every surface and feature:

- **Clarity before action**
  Every object (task, doc, meeting, message, asset) should answer **“why”** before you act.

- **AI asks, human decides**
  No silent automation. AI proposes; the human explicitly confirms.

- **Show only what matters now**
  Minimal surface, deep intelligence. UIs stay clean while the system reasons in the background.

- **Everything connects**
  Tasks, chats, docs, meetings, assets, CRM, and ATS entries are all nodes in a **knowledge graph**.

- **Background intelligence, foreground simplicity**
  Heavy lifting happens silently. Users see only meaningful nudges and next-best actions.

- **No feature lives alone**
  Every capability should embody the philosophy above and connect to others.

---

## The Clarity Engine (Core Differentiator)

When a task or ask appears (from chat, meeting notes, forms, or integrations), the **Clarity Engine**:

1. **Extracts the crux** with targeted clarifying questions.
2. **Rewrites the ask** as clear objectives & success criteria.
3. **Auto-splits work** into 30–90 minute micro-tasks (only after user approval).
4. **Distributes micro-tasks** across calendars and focus windows while protecting deep work.
5. **Links everything back** to the originating chats, docs, meetings, and assets.

This is the heart of ClarityOS and should guide product, design, and engineering decisions.

---

## Major Capability Areas

### Communication & Collaboration

- Team channels (Slack-style), private channels, 1:1s, and group chats.
- WhatsApp-style real-time messaging with rich media, code snippets, and prompt sharing.
- Message locking (read-only / archived), pinned messages, mentions, reactions, and threads.
- Global chat search with AI summaries.
- AI assistant inside chats for summaries, clarifying questions, and convert-to-task suggestions (always confirmed by the user).

### Work & Task Management

- Tasks & tickets with definitions of done, success criteria, priorities, assignees, and dependencies.
- AI-powered micro-task splitting with time estimates.
- Kanban boards, backlog, milestones, and light sprinting.
- One-click create from chat; deep linking between tasks, docs, and meetings.
- Personal focus dashboards, workload monitoring, and manager capacity views (privacy-respecting).
- Automated, confirmable follow-ups for long-blocked work.

### Calendar & Scheduling

- Individual, team, and company calendars.
- Meeting templates (30/45/60 minutes) with built-in agendas.
- Smart scheduling that respects focus blocks and personal productivity patterns.
- AI-managed personal schedules that suggest where micro-tasks should live.
- Conflict detection and AI-suggested resolutions (always confirmed by the human).

### Library & Resource Management

- Centralized library for docs and assets with auto-tagging and permissions.
- Version control, asset locking, and usage maps (where is this asset referenced?).
- Notification prompts on asset changes, with human-confirmed outreach.

### AI System (Multi-model)

- Built-in, multi-model AI assistant for:
  - Chat and summarization.
  - Task clarity and rewriting.
  - Calendar and scheduling intelligence.
  - Company-wide semantic search and research.
- Roles: **Clarify**, **Suggest**, **Simulate**, **Execute** (Execute only with explicit approval).
- Personal coach for deep-work tips and context-switch alerts.

### Writing & Office Suite

- Unified document editor (block-based), spreadsheet, and presentation tooling.
- Assignable blocks, comment threads, and version history.
- Templates for PRDs, meeting notes, client briefs, onboarding, and more.
- Auto-documentation (e.g., release notes and changelogs generated from task completion).

### Forms & Data Management

- Custom form builder with validation and approval workflows.
- Intake → project automation (e.g., onboarding checklist auto-created on form submit).
- Export to CSV/XLSX/JSON and integrations with downstream systems.

### Integrations & Infra Monitoring

- Integrations with Vercel, AWS, Cloudflare, Git providers, and calendar providers.
- Deployment & domain analytics, cost visibility, and API token management.

### CRM & Client Workspaces

- Client profiles, deals, deliverables, communication history, and profitability reporting.
- Client workspaces with view-only or limited edit access and approval flows.

### ATS & Hiring

- Job postings, candidate pipelines, interview scheduling, and task-linked evaluations.
- Onboarding workflows triggered from hires.

### Content Studio & Agency Features

- Built-in content studio with templates and review workflows.
- Client onboarding checklists, white-label portals, and reusable agency templates.
- Scope control, change-request tracking, and billable revision logs.

### Platform-wide Capabilities

- Offline / low-connectivity mode with background sync.
- Role-based access control, granular permissions, audit logs, and multi-tenant architecture.
- Global smart search (cross-organization and permission-aware).

---

## Project Structure (High-level)

This repo contains the **ClarityOS** application code.

Key parts you are likely to touch:

- **`frontend/`** — Frontend code (Vite, React/TypeScript, etc.).
- **`frontend/public/keilhq.svg`** — Primary logo.
- **`frontend/public/keilhq-white.svg`** — Inverted/white logo for dark backgrounds.
- **Other folders** (e.g., backend/services) — Implementation for APIs, integrations, and platform logic.

Refer to per-folder `README` or docs (if present) for deeper technical details.

---

## Getting Started (Local Development)

> Adjust commands as needed based on your package manager and actual setup.

1. **Install dependencies**

   ```bash
   cd frontend
   pnpm install # or npm install / yarn install
   ```

2. **Run the dev server**

   ```bash
   pnpm dev
   ```

3. **Open the app**

   - Visit `http://localhost:5173` (or the port shown in your terminal).

4. **Run tests** (if configured)

   ```bash
   pnpm test
   ```

---

## How We Work in This Repo

### Branching Model

- **`main`** (or `master`): Always deployable, protected.
- **Feature branches**: `feature/<short-description>`
- **Bugfix branches**: `fix/<short-description>`
- **Experiment branches** (if needed): `exp/<short-description>`

Create a branch for each logical change:

```bash
git checkout -b feature/clarity-engine-ui
```

### Commit Guidelines

We aim for **small, clear, and meaningful commits** that reflect our philosophy of clarity.

#### Format

Use a simple, structured convention:

```text
<type>(scope): <short summary>
```

Recommended `type` values:

- `feat` — New feature.
- `fix` — Bug fix.
- `chore` — Maintenance, tooling, or non-product changes.
- `docs` — Documentation only.
- `refactor` — Code refactor without behavior change.
- `style` — Formatting, CSS, or non-functional style tweaks.
- `test` — Adding or updating tests.

**Examples:**

```text
feat(tasks): add micro-task splitting UI
fix(calendar): prevent overlap with deep work blocks
docs(readme): document clarity engine principles
refactor(chat): extract message composer component
```

#### Content

- **One intention per commit** where possible.
- Write commit messages so that a new contributor can quickly understand **what changed and why**.
- Reference tickets/issues if relevant, e.g. `feat(tasks): add micro-task splitting UI (#123)`.

### Typical Workflow

1. **Sync main**

   ```bash
git checkout main
git pull origin main
   ```

2. **Create a feature branch**

   ```bash
git checkout -b feature/<short-description>
   ```

3. **Make changes and commit**

   ```bash
git status
   git add <files>
   git commit -m "feat(scope): summary"
   ```

4. **Push and open a PR**

   ```bash
git push -u origin feature/<short-description>
   ```

   - Open a Pull Request.
   - Clearly describe:
     - **Problem / context**
     - **Solution**
     - **Screenshots or GIFs** (for UI changes)
     - **Testing performed**

5. **Review & merge**

   - At least one review from another contributor (if applicable).
   - Ensure checks/tests pass before merging.

---

## Design & Product Alignment

When implementing features, always check them against the **ClarityOS philosophy**:

- **Does this increase or decrease clarity for the user?**
- **Is AI asking before acting?**
- **Are we showing only what matters right now?**
- **Is this feature connected to the rest of the system (tasks, chats, docs, calendar, etc.)?**

If a feature feels powerful but noisy or ambiguous, **simplify the surface** and push complexity into background intelligence.

---

## Branding Notes

- Use the **primary logo** (`keilhq.svg`) on light backgrounds and marketing-style surfaces.
- Use the **white logo** (`keilhq-white.svg`) on dark backgrounds.
- Tagline: **"Clarity first. Execution follows."**
- Positioning line: **"We connect everything. We clarify everything. We never act without you."**

Keep brand expressions consistent across app surfaces, docs, and presentations.

---

## Contributing

We welcome thoughtful, clarity-driven contributions.

- Open issues for ideas that impact core philosophy or cross-cutting behaviors (e.g., changes to Clarity Engine flows).
- Prefer **discussion-first** for significant UX or AI behavior changes.
- For small fixes (copy tweaks, style polish, small bugs), feel free to open PRs directly.

If you’re unsure whether something aligns with the vision, err on the side of asking and documenting the decision inside the PR or issue.

---

## License

> Add licensing information here once finalized.

Until the license is explicitly defined, treat this code as **proprietary and confidential** within the team.

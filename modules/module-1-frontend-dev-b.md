# Module 1 (Tasks Core) — Frontend Architecture & Implementation Guide

> Provide a "super easy" and intuitive path to understand and modify the task management frontend.

This document describes the architectural decisions and implementation of the Developer B (Frontend) tasks for **Module 1 (Tasks Core)**. The code was structured to guarantee that future updates, debugging, and extensions (like adding Assignees in Module 2) require minimal effort and isolate moving parts.

---

## 🏗️ 1. Architecture Strategy: Separation of Concerns

We removed legacy `useState`-based local mocking and replaced it with a highly decoupled approach leveraging **TanStack Query (React Query)**:

* **Separated Data Fetching**: All HTTP requests, types, and caching rules live exclusively in **`src/hooks/api/useTasks.ts`**.
* **Smart Orchestrator Component**: **`TasksPage.tsx`** manages simple string-based "UI state" (filters, selections) and passes data downward.
* **Dumb/Presentation Components**: **`TaskListPane.tsx`** and **`TaskDetailPane`** are largely presentational and do very little state management. They render what they receive from props and emit callbacks when an action is taken.

---

## 📂 2. Core Files & Their Responsibilities

### `src/hooks/api/useTasks.ts` (Data Layer)
This file is the single source of truth for all Task-related queries and mutations.
* **What it does**: Defines `TaskDTO`, `CreateTaskInput`, and exposes hooks like `useTasks`, `useTask`, `useCreateTask`, `useChangeTaskStatus`.
* **Why it's easy to change**: If the backend alters its payload shape or changes a route path, **only this file needs to be updated**.
* **Auto-refresh**: Mutations such as `useCreateTask` and `useChangeTaskStatus` hook directly into `queryClient.invalidateQueries`. This means the UI immediately repaints whenever a successful mutation completes, without manual `setTasks([...])` logic.

### `src/components/TasksPage.tsx` (Orchestrator)
This top-level container serves as the glue between the Data Layer and the Presentation Layer.
* **What it does**: Maintains `query` (search string), `statusFilter`, and `selectedTaskId`.
* **Why it's easy to change**: All filters map neatly into a `serverFilters` object. When adding new filters later (such as filtering by tags or dates), you just add the property to `serverFilters`, and React Query automatically refetches the data.

### `src/components/tasks/TaskListPane.tsx` (Presentation)
Renders the side panel list.
* **What it does**: Handles the user interface for list interactions, drag-and-drop handles, and the "Create Task" modal.
* **Why it's easy to change**: We refactored form handling (`handleCreateSubmit`) to compile a strict `CreateTaskInput` payload without any fake IDs or dummy arrays. If new fields are added to the form, simply append them to the `CreateTaskInput` mapping. The component accepts an `isLoading` prop to gracefully show skeleton animations automatically when data fetches.

### `src/components/tasks/TaskDetailPane.tsx` (Feature Details)
Displays the properties of the selected task prominently across split tabs.
* **What it does**: Consumes `task` properties, renders the UI Tabs (Overview, Dependencies, History, etc.), and allows inline status modifications.
* **Why it's easy to change**: We enhanced it with an internal `useTask(taskId)` call. This pattern guarantees that viewing a task grabs the freshest data directly from the server for that particular task, safely defaulting to the initial list data while loading. Any 400 errors thrown by bad status updates (e.g. attempting to mark a blocked task `done`) are centrally caught and toasted automatically.

---

## 🛠️ 3. How to Extend (Developer Cheat Sheet)

Follow these rules when adding new features to Tasks Core:

1. **Changing status options?** Update `TaskStatus` enum in `types/task.ts`, `STATUS_OPTIONS` array in the components, and `STATUS_COLOR` maps.
2. **Adding a new Task property (e.g., "Expected Cost")?**
   * Add typing to `TaskDTO` and `CreateTaskInput` inside `useTasks.ts`.
   * Bind the new property inside the "Create Task" modal inputs in `TaskListPane.tsx`.
   * Add visualization text inside the Overview tab of `TaskDetailPane.tsx`.
3. **Filtering by a new dimension?**
   * Add the filter parameter to `serverFilters` processing inside `TasksPage.tsx`. React Query tracks the filter parameter array, handles caching, and refreshes the pane instantly.

---

## ✅ Phase Check
All criteria from the `Developer B` Phase 0 requirements matching `Module 1 - Tasks Core` have been merged and thoroughly structured as specified. The dependencies check matches real-world ENUMS without mock data leakage.

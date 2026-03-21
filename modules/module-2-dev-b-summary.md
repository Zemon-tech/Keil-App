# Module 2 summary — Dev-B (Frontend)

## ⭐ Overview
A complete, super-simple summary of the features and updates delivered by the Frontend Developer (Dev-B) regarding **Assignees and Dependencies** integration.

---

### 🧩 Stage 1: Data & API Layer
- **Types Upgraded**: Created an `AssigneeUser` interface and extended the `Dependency` type to hold real data instead of mock strings.
- **New Task API Mutations**: Added four robust TanStack Query hooks inside `useTasks.ts` to assign/remove users and lock/unlock dependencies.
- **New Workspace API Query**: Built `useWorkspace.ts` to selectively pull verifiable users mapped to the current workspace.

### 👤 Stage 2: Assignees UI
- **Dynamic Avatars**: Replaced the fake initial-bubbles in the Task Header with an active `AssigneesChip` that reads native arrays.
- **Assignee Picker**: Implemented a modern, interactive dropdown that searches through workspace members and filters out those already assigned.
- **Quick Removal**: Designed a slick hover-based "X" button allowing instant removal of any assignee. 

### 🔗 Stage 3: Dependencies UI
- **Real Data Mapping**: Upgraded `DependencyRow` components to explicitly draw the linked task's real ID, exact status, and color-coded priority.
- **Input Pipeline**: Built an input form straight into the `TaskDetailPane.tsx` allowing you to paste a Task ID and bind it instantly. 
- **Error Guarding**: Wired the frontend to intelligently catch Circular Dependency (400 Error) backend rejections and translate them into friendly Toast pop-ups.

### 🚫 Stage 4: "Blocked" Cleanup (Derived States)
- **Status Sanitization**: Completely scrubbed the fake `"Blocked"` status from backend definitions and frontend enums.
- **Smart Filtering**: Built a derived filter right into `TasksPage.tsx` that visually sorts out purely blocked tasks by verifying `blocked_by_count > 0`.
- **Visual Indicator**: Appended a visual lightning bolt (`Zap`) icon onto affected list items so developers know immediately what is bottlenecked without spoofing the task's core status.

---
trigger: model_decision
description: when working on features, backend endpoints, or database schema related to MVP v0.5
---

# MVP v0.5 - ClarityOS Team Management

This rule defines the strict scope and implementation requirements for ClarityOS MVP v0.5. All development work should adhere to these boundaries to avoid over-engineering or deviating from the release goals.

## 1. Workspace (Multi-tenant Support)
- **Limit**: Each user can create and own exactly **one** workspace.
- **Features**: Workspace creation, adding members (invites/linking), and viewing the member list.
- **Constraints**: Ensure database indexes prevent multiple owned workspaces per `user_id`.

## 2. Tasks & Subtasks
Tasks are the core entity. v0.5 includes:
- **CRUD Operations**: Create, read (list/detail), update, and delete.
- **Fields**: Title, description, status, priority, start_date, and due_date.
- **Validation**: Strict validation for `start_date` and `due_date` (e.g., `due_date >= start_date`).
- **States**: 
  - **Status**: `backlog` | `todo` | `in-progress` | `done`
  - **Priority**: `low` | `medium` | `high` | `urgent`
- **Hierarchies**: Support for parent–child task relationships (recursive sub-tasks).
- **Core Extensions**:
  - **Objectives**: List of goals within a task.
  - **Success Criteria**: Specific metrics for task completion.

## 3. Advanced Task Selection (Listing)
The task engine must support:
- **Server-side Pagination**: Use standard `limit` and `offset`/`cursor`.
- **Filtering**: By `status`, `priority`, `assignee`, and `due_date`.
- **Sorting**: By `due_date`, `priority`, and `created_at`.

## 4. Task Assignees & Dependencies
- **Assignees**: Tasks can have multiple assignees. Support list by user.
- **Dependencies**: 
  - Blocking logic: A task **cannot** be marked as "done" if any of its active dependencies are incomplete.
  - Cleanup: Automatically remove dependency records when a task is deleted.

## 5. Comments & Communication
- **Threaded Conversations**: Top-level comments and nested replies.
- **Deletion**: Hard delete support. Replies must **cascade** (delete child threads if the parent is deleted).
- **Listing**: Paginated fetching of comment threads.

## 6. Activity Logs (Audit Trail)
Minimal tracking for state transitions and record modifications:
- Log task creation and deletions.
- Log status, assignment, and due date changes.
- Log dependency changes.
- Log comment events (creation/deletion).
- Log objective & success criteria updates.
- **Feed**: Paginated activity feed for workspace/task views.

## 7. Dashboard & Ranking Logic
The dashboard must follow a rule-based ranking to surface critical work:
- **Prioritization Logic**: `Urgent` + `Near Due` (within 24-48h).
- **Buckets**:
  1. **Immediate Tasks**: Urgent priority + approaching due date.
  2. **Today's Tasks**: Due or scheduled for today.
  3. **Blocked Tasks**: Blocked by an incomplete dependency.
  4. **Backlog**: Standard backlog items.
- **Ranking Formula**: Implement a backend weight or sorting mechanism combining priority (urgent=3, high=2, med=1, low=0) and time proximity.
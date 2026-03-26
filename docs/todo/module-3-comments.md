# Module 3 — Comments

## Prerequisites
- Phase 0 (Foundation) must be complete
- Module 1 (Tasks Core) must be complete — real task IDs must exist to attach comments to
- Module 2 is **not** required — comments are independent of assignees and dependencies

---

## Context for Developers

### What already exists

**Backend**
- `comment.service.ts` is fully implemented:
  - `createComment()` — creates top-level comment or reply, logs activity
  - `getCommentsByTask()` — flat paginated list
  - `getThreadedComments()` — returns top-level comments with nested `replies[]` array
  - `deleteComment()` — soft delete
  - `hardDeleteComment()` — permanent delete with ownership check, logs activity
- `comment.repository.ts` exists with `findByTask`, `findThreaded`, `findReplies`, `create`, `softDelete`, `delete`
- Routes are already wired in `backend/src/routes/task.routes.ts`:
  - `GET /api/v1/tasks/:id/comments` → `getTaskComments`
  - `POST /api/v1/tasks/:id/comments` → `addComment`
- Delete route is in `backend/src/routes/comment.routes.ts`:
  - `DELETE /api/v1/comments/:id` → `deleteComment`
- DB schema uses `ON DELETE CASCADE` on `parent_comment_id` — deleting a parent comment automatically hard-deletes all its replies at the DB level

**Frontend**
- `TaskDetailPane.tsx` has an `ActivityTab` component (L493–559) that currently handles both comments and a text input
- `handleSend` (L502–506) adds comments to local state only — no API call
- Mock comments live in `mockTasks.ts` as `task.comments[]` with shape `{ id, author, body, timestamp }`
- The `Comment` type in `src/types/task.ts` uses `author: string` (a name string) and `body: string` — this needs updating to match the real API response

### What is missing
- All 3 controller handlers in `comment.controller.ts` are `// TODO` stubs
- No TanStack Query hooks exist for comments
- `ActivityTab` in `TaskDetailPane.tsx` uses local state + mock data — not connected to backend
- `Comment` type in `task.ts` does not match the real `CommentDTO` shape from the service

### MVP spec note
The MVP spec requires **hard delete** for comments. Use `hardDeleteComment()` in the service, not `deleteComment()` (soft delete). The DB cascade ensures replies are also removed.

---

## Branch Names
- `feature/comments-be` — Dev A
- `feature/comments-fe` — Dev B

---

## API Contract

Both developers must agree on these shapes before coding.

### `GET /api/v1/tasks/:id/comments`

Returns threaded comments (top-level with replies nested inside).

```
Query params:
  limit  (optional, default 20)
  offset (optional, default 0)

Response 200:
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "task_id": "uuid",
      "user_id": "uuid",
      "content": "string",
      "parent_comment_id": null,
      "created_at": "ISO string",
      "user": { "id": "uuid", "email": "string", "name": "string | null" },
      "replies": [
        {
          "id": "uuid",
          "task_id": "uuid",
          "user_id": "uuid",
          "content": "string",
          "parent_comment_id": "uuid",
          "created_at": "ISO string",
          "user": { "id": "uuid", "email": "string", "name": "string | null" },
          "replies": []
        }
      ]
    }
  ]
}
```

### `POST /api/v1/tasks/:id/comments`

Creates a top-level comment or a reply.

```
Body:
{
  "content": "string (required, non-empty)",
  "parent_comment_id": "uuid (optional — omit for top-level, include for reply)"
}

Response 201:
{
  "success": true,
  "data": { ...CommentDTO (flat, no replies array) }
}

Response 400: empty content
Response 404: task not found
```

### `DELETE /api/v1/comments/:id`

Hard deletes a comment and all its replies (via DB cascade).

```
Response 200:
{
  "success": true,
  "data": null,
  "message": "Comment deleted successfully"
}

Response 403: user does not own the comment
Response 404: comment not found
```

---

## Dev A — Backend Deliverables

> Branch: `feature/comments-be`

File: `backend/src/controllers/comment.controller.ts`

### Implement `getTaskComments`
- [ ] Extract `id` (taskId) from `req.params.id`
- [ ] Parse `limit` and `offset` from `req.query` — default to `20` and `0`
- [ ] Call `commentService.getThreadedComments(taskId)` — use threaded version for the response
- [ ] Return `200` with the threaded comment array
- [ ] Return `404` if the task does not exist (add a task existence check or let DB constraint surface it)

### Implement `addComment`
- [ ] Extract `taskId` from `req.params.id`
- [ ] Extract `content` and optional `parent_comment_id` from `req.body`
- [ ] Validate `content` is present and non-empty — return `400` with clear message if not
- [ ] Get `workspaceId` from the user's workspace (same pattern used in Module 1)
- [ ] Call `commentService.createComment({ task_id: taskId, user_id: req.user.id, content, parent_comment_id }, workspaceId)`
- [ ] Return `201` with the created comment DTO

### Implement `deleteComment`
- [ ] Extract `id` (commentId) from `req.params.id`
- [ ] Get `workspaceId` from user's workspace
- [ ] Call `commentService.hardDeleteComment(commentId, req.user.id, workspaceId)`
- [ ] Service already throws `403` if user does not own the comment — let `catchAsync` propagate it
- [ ] Return `200` on success

### Notes for Dev A
- `comment.service.ts` has both `deleteComment` (soft) and `hardDeleteComment` (permanent). Use `hardDeleteComment` — the MVP spec requires hard delete.
- The service's `createComment` re-fetches the created comment with user details after insert. This is slightly inefficient but already implemented — do not rewrite the service.
- The task existence check before creating a comment can be lightweight: if the DB FK constraint fails, catch the DB error and return a `404`.

---

## Dev B — Frontend Deliverables

> Branch: `feature/comments-fe`

### Update Comment Type
File: `frontend/src/types/task.ts`

- [ ] Update the `Comment` type to match the real API response:
  ```
  type Comment = {
    id: string;
    task_id: string;
    user_id: string;
    content: string;
    parent_comment_id: string | null;
    created_at: string;
    user: { id: string; email: string; name: string | null };
    replies: Comment[];
  }
  ```
- [ ] Remove old `author: string` and `body: string` and `timestamp: string` fields
- [ ] Run TypeScript — fix every file that references the old Comment shape

### Create Comment Hooks
File: `frontend/src/hooks/api/useComments.ts`

- [ ] `useTaskComments(taskId)` — `useQuery` wrapping `GET /api/v1/tasks/:id/comments`
  - Query key: `["comments", taskId]`
  - Only fetch when `taskId` is defined
  - Returns threaded comment array

- [ ] `useCreateComment()` — `useMutation` wrapping `POST /api/v1/tasks/:id/comments`
  - On success: invalidate `["comments", taskId]` query
  - Accepts `{ taskId, content, parent_comment_id? }`

- [ ] `useDeleteComment()` — `useMutation` wrapping `DELETE /api/v1/comments/:id`
  - On success: invalidate `["comments", taskId]` query
  - Accepts `{ commentId, taskId }` so the query key can be invalidated

### Wire ActivityTab in TaskDetailPane
File: `frontend/src/components/tasks/TaskDetailPane.tsx`

The `ActivityTab` component lives around L493–559. It currently has:
- Local `input` state for the text box
- `handleSend` (L502–506) that pushes a mock comment into local state
- Renders `task.comments` (mock data from task object)

- [ ] Import and call `useTaskComments(task.id)` inside `ActivityTab` (or pass as prop from parent)
- [ ] Replace rendering of `task.comments` with the data returned from `useTaskComments`
- [ ] Replace `handleSend` mock logic with a `useCreateComment` mutation call:
  - On submit: call `createComment({ taskId: task.id, content: input })`
  - Clear the input on success
  - Show a loading indicator on the submit button while mutation is pending
- [ ] Display each comment using real fields: `comment.user.name ?? comment.user.email` for author, `comment.content` for body, `comment.created_at` for timestamp
- [ ] Add delete button to each comment — visible only if `comment.user_id === currentUser.id`
  - Call `useDeleteComment({ commentId: comment.id, taskId: task.id })`
  - Show confirmation or optimistic removal
- [ ] Render threaded replies under each top-level comment:
  - Indent reply rows visually (left border or padding)
  - Each reply shows author, content, timestamp
  - Add a "Reply" button on each top-level comment that opens an inline reply input
  - On submit: call `createComment({ taskId, content, parent_comment_id: comment.id })`
- [ ] Show empty state when no comments exist: `"No comments yet"`
- [ ] Show loading state while `useTaskComments` is fetching

### Remove mock comment data dependency
File: `frontend/src/data/mockTasks.ts`

- [ ] The `comments` array in mock tasks no longer needs to match any real shape — it can remain as placeholder data for now since mock data won't be used once Module 1 is wired. No active changes required here unless TypeScript errors appear.

---

## Acceptance Criteria

- [ ] Comments load from the backend when a task is selected
- [ ] A top-level comment can be created and appears immediately after submit
- [ ] A reply can be created and appears nested under the correct parent comment
- [ ] A comment can be deleted by its author — deleted comment and all its replies disappear
- [ ] A user cannot delete another user's comment — delete button is not shown for other users' comments
- [ ] Empty content is rejected with a visible validation error — no empty comment is sent
- [ ] Comments section shows loading state while fetching
- [ ] Comments section shows empty state when no comments exist
- [ ] Comment list refreshes automatically after create or delete without a page reload
- [ ] Timestamps display correctly from real `created_at` ISO strings

---

## Files Modified Summary

| File | Who | Change |
|---|---|---|
| `backend/src/controllers/comment.controller.ts` | Dev A | Implement all 3 stub handlers |
| `frontend/src/types/task.ts` | Dev B | Update `Comment` type to match API shape |
| `frontend/src/hooks/api/useComments.ts` | Dev B | Create with 3 hooks |
| `frontend/src/components/tasks/TaskDetailPane.tsx` | Dev B | Wire ActivityTab to real comments API |

---

## Impact on Other Modules

| Module | Impact |
|---|---|
| Module 4 (Activity) | Activity logs for `comment_created` and `comment_deleted` are already written by `comment.service.ts`. Module 4 will surface them in the feed — no changes needed here. |
| Module 5 (Dashboard) | No direct dependency on comments. |
| Module 2 (Assignees) | No dependency. Module 2 and Module 3 can be developed in parallel after Module 1 is done. |
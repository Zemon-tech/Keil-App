import { describe, it, expect, beforeEach } from "vitest";
import * as orgTaskService from "../org-task.service";
import pool from "../../config/pg";
import { seedUser, seedOrg, seedSpace } from "../../test/helpers";
import { TaskStatus } from "../../types/enums";
import { ApiError } from "../../utils/ApiError";

describe("Org Task Service Unit Tests", () => {
    // ── Test fixtures ──────────────────────────────────────────────────────────
    const adminUserId = "a1000000-0000-0000-0000-000000000001";
    const adminEmail = "task-admin@test.com";
    const adminName = "Task Admin";

    const memberUserId = "a1000000-0000-0000-0000-000000000002";
    const memberEmail = "task-member@test.com";
    const memberName = "Task Member";

    const orgId = "b1000000-0000-0000-0000-000000000001";
    const spaceId = "c1000000-0000-0000-0000-000000000001";
    const context = { orgId, spaceId };

    beforeEach(async () => {
        // Seed users
        await seedUser(adminUserId, adminEmail, adminName);
        await seedUser(memberUserId, memberEmail, memberName);

        // Seed org + space
        await seedOrg(orgId, "Task Test Org", adminUserId);
        await seedSpace(spaceId, orgId, "Task Space", adminUserId);

        // Ensure roles in organization_members and space_members are seeded
        await pool.query(
            `UPDATE public.space_members SET role = 'admin' WHERE space_id = $1 AND user_id = $2`,
            [spaceId, adminUserId]
        );

        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (org_id, user_id) DO NOTHING`,
            [orgId, memberUserId]
        );
        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'member')
             ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'member'`,
            [orgId, spaceId, memberUserId]
        );
    });

    // ── validateDateOrder ───────────────────────────────────────────────────────
    describe("validateDateOrder (via createTask & updateTask)", () => {
        it("should throw ApiError when due_date is before start_date on task creation", async () => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            await expect(
                orgTaskService.createTask(context, {
                    org_id: orgId,
                    space_id: spaceId,
                    created_by: adminUserId,
                    title: "Invalid Date Task",
                    start_date: today,
                    due_date: yesterday,
                })
            ).rejects.toThrowError(
                new ApiError(400, "due_date must be on or after start_date")
            );
        });

        it("should throw ApiError when due_date is before start_date on task update", async () => {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            // Create a valid task first
            const task = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Valid Date Task",
                start_date: today,
                due_date: tomorrow,
            });

            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            await expect(
                orgTaskService.updateTask(context, task.id, adminUserId, {
                    due_date: yesterday,
                })
            ).rejects.toThrowError(
                new ApiError(400, "due_date must be on or after start_date")
            );
        });
    });

    // ── Subtask Date Bounds Validation ─────────────────────────────────────────
    describe("Subtask Date Bounds Validation", () => {
        it("should throw ApiError when scheduling a subtask outside of parent's dates", async () => {
            const start = new Date("2026-07-01T10:00:00Z");
            const due = new Date("2026-07-10T10:00:00Z");

            const parentTask = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Parent Task",
                start_date: start,
                due_date: due,
            });

            // Out of bounds: start date before parent start
            const beforeStart = new Date("2026-06-30T10:00:00Z");
            await expect(
                orgTaskService.createTask(context, {
                    org_id: orgId,
                    space_id: spaceId,
                    created_by: adminUserId,
                    title: "Subtask Before Parent",
                    parent_task_id: parentTask.id,
                    start_date: beforeStart,
                    due_date: due,
                })
            ).rejects.toThrowError(
                new ApiError(400, "Subtask dates are out of bounds of the parent task")
            );

            // Out of bounds: due date after parent due
            const afterDue = new Date("2026-07-11T10:00:00Z");
            await expect(
                orgTaskService.createTask(context, {
                    org_id: orgId,
                    space_id: spaceId,
                    created_by: adminUserId,
                    title: "Subtask After Parent",
                    parent_task_id: parentTask.id,
                    start_date: start,
                    due_date: afterDue,
                })
            ).rejects.toThrowError(
                new ApiError(400, "Subtask dates are out of bounds of the parent task")
            );
        });

        it("should throw ApiError when scheduling a subtask but parent is not scheduled", async () => {
            const parentTask = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Unscheduled Parent Task",
            });

            await expect(
                orgTaskService.createTask(context, {
                    org_id: orgId,
                    space_id: spaceId,
                    created_by: adminUserId,
                    title: "Subtask",
                    parent_task_id: parentTask.id,
                    start_date: new Date("2026-07-01T10:00:00Z"),
                    due_date: new Date("2026-07-05T10:00:00Z"),
                })
            ).rejects.toThrowError(
                new ApiError(400, "Parent task must be scheduled (have start and due dates) before scheduling subtasks")
            );
        });

        it("should throw ApiError when updating a parent task's dates to be narrower than its subtask's dates", async () => {
            const start = new Date("2026-07-01T10:00:00Z");
            const due = new Date("2026-07-10T10:00:00Z");

            const parentTask = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Parent Task",
                start_date: start,
                due_date: due,
            });

            const subtask = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Subtask",
                parent_task_id: parentTask.id,
                start_date: new Date("2026-07-02T10:00:00Z"),
                due_date: new Date("2026-07-09T10:00:00Z"),
            });

            // Updating parent start to be after subtask start
            const newStart = new Date("2026-07-03T10:00:00Z");
            await expect(
                orgTaskService.updateTask(context, parentTask.id, adminUserId, {
                    start_date: newStart,
                })
            ).rejects.toThrowError(
                new ApiError(400, `Subtask "${subtask.title}" dates would fall out of bounds of the parent task's new dates`)
            );
        });

        it("should align subtask start and due dates/times to parent's exact dates/times if scheduled on the same day", async () => {
            const start = new Date("2026-07-01T10:00:00Z");
            const due = new Date("2026-07-01T12:00:00Z");

            const parentTask = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Parent Task",
                start_date: start,
                due_date: due,
            });

            // Dragged/scheduled on the same day: Jul 1 at a different time (e.g. 10:30 AM)
            const sameDayDragStart = new Date("2026-07-01T10:30:00Z");
            const sameDayDragDue = new Date("2026-07-01T11:30:00Z");

            const subtask = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Subtask Same Day",
                parent_task_id: parentTask.id,
                start_date: sameDayDragStart,
                due_date: sameDayDragDue,
            });

            // The subtask should have aligned start and due dates to match the parent exactly
            expect(new Date(subtask.start_date!).toISOString()).toBe(start.toISOString());
            expect(new Date(subtask.due_date!).toISOString()).toBe(due.toISOString());
        });
    });

    // ── Circular Dependency Detection ──────────────────────────────────────────
    describe("Circular Dependency Detection (via addDependency)", () => {
        it("should throw ApiError when adding a circular dependency", async () => {
            // 1. Create two tasks: Task A and Task B
            const taskA = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Task A",
            });

            const taskB = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Task B",
            });

            // 2. Add dependency: Task A depends on Task B
            await orgTaskService.addDependency(context, taskA.id, taskB.id, adminUserId);

            // 3. Adding dependency: Task B depends on Task A should throw circular dependency error
            await expect(
                orgTaskService.addDependency(context, taskB.id, taskA.id, adminUserId)
            ).rejects.toThrowError(
                new ApiError(400, "Cannot add dependency. This would create a circular dependency.")
            );
        });
    });

    // ── Assignee Validation in changeTaskStatus ────────────────────────────────
    describe("Assignee Validation in changeTaskStatus (member-only-assigned-tasks rule)", () => {
        it("should allow status change if user role is admin or manager even if unassigned", async () => {
            const task = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Unassigned Admin Task",
            });

            const updated = await orgTaskService.changeTaskStatus(
                context,
                task.id,
                adminUserId,
                TaskStatus.IN_PROGRESS,
                "admin"
            );

            expect(updated?.status).toBe(TaskStatus.IN_PROGRESS);
        });

        it("should throw ApiError if user role is member and they are not assigned to the task", async () => {
            const task = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Member Unassigned Task",
            });

            await expect(
                orgTaskService.changeTaskStatus(
                    context,
                    task.id,
                    memberUserId,
                    TaskStatus.IN_PROGRESS,
                    "member"
                )
            ).rejects.toThrowError(
                new ApiError(403, "Members can only change status of tasks assigned to them")
            );
        });

        it("should successfully allow status change if user role is member and they are assigned to the task", async () => {
            const task = await orgTaskService.createTask(context, {
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Member Assigned Task",
            });

            // Assign member to the task
            await orgTaskService.assignUser(context, task.id, memberUserId, adminUserId);

            const updated = await orgTaskService.changeTaskStatus(
                context,
                task.id,
                memberUserId,
                TaskStatus.IN_PROGRESS,
                "member"
            );

            expect(updated?.status).toBe(TaskStatus.IN_PROGRESS);
        });
    });
});

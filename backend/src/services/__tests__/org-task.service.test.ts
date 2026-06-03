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

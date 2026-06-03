import { describe, it, expect, beforeEach } from "vitest";
import * as personalTaskService from "../personal-task.service";
import { seedUser } from "../../test/helpers";
import { TaskStatus } from "../../types/enums";
import { ApiError } from "../../utils/ApiError";

describe("Personal Task Service Unit Tests", () => {
    // ── Test fixtures ──────────────────────────────────────────────────────────
    const userAId = "a1000000-0000-0000-0000-000000000001";
    const userAEmail = "user-a@test.com";
    const userAName = "User A";

    const userBId = "a1000000-0000-0000-0000-000000000002";
    const userBEmail = "user-b@test.com";
    const userBName = "User B";

    beforeEach(async () => {
        // Seed users
        await seedUser(userAId, userAEmail, userAName);
        await seedUser(userBId, userBEmail, userBName);
    });

    // ── validateDateOrder ───────────────────────────────────────────────────────
    describe("validateDateOrder (via createPersonalTask & updatePersonalTask)", () => {
        it("should throw ApiError when due_date is before start_date on task creation", async () => {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            await expect(
                personalTaskService.createPersonalTask({
                    owner_user_id: userAId,
                    title: "Invalid Personal Task",
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

            // Create a valid personal task
            const task = await personalTaskService.createPersonalTask({
                owner_user_id: userAId,
                title: "Valid Personal Task",
                start_date: today,
                due_date: tomorrow,
            });

            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            await expect(
                personalTaskService.updatePersonalTask(task.id, userAId, {
                    due_date: yesterday,
                })
            ).rejects.toThrowError(
                new ApiError(400, "due_date must be on or after start_date")
            );
        });
    });

    // ── Ownership Checks ────────────────────────────────────────────────────────
    describe("Ownership checks on wrong user access", () => {
        it("should return null on getPersonalTaskById if accessed by wrong user", async () => {
            // Create a task for User A
            const task = await personalTaskService.createPersonalTask({
                owner_user_id: userAId,
                title: "User A Task",
            });

            // User B tries to retrieve -> should return null
            const result = await personalTaskService.getPersonalTaskById(task.id, userBId);
            expect(result).toBeNull();

            // User A retrieves -> should succeed
            const actualTask = await personalTaskService.getPersonalTaskById(task.id, userAId);
            expect(actualTask).not.toBeNull();
            expect(actualTask?.title).toBe("User A Task");
        });

        it("should return null on updatePersonalTask if accessed by wrong user", async () => {
            // Create a task for User A
            const task = await personalTaskService.createPersonalTask({
                owner_user_id: userAId,
                title: "User A Task",
            });

            // User B tries to update -> should return null
            const result = await personalTaskService.updatePersonalTask(task.id, userBId, {
                title: "Hacked Title",
            });
            expect(result).toBeNull();

            // Confirm task was NOT updated
            const checkTask = await personalTaskService.getPersonalTaskById(task.id, userAId);
            expect(checkTask?.title).toBe("User A Task");
        });

        it("should return false on deletePersonalTask if accessed by wrong user", async () => {
            // Create a task for User A
            const task = await personalTaskService.createPersonalTask({
                owner_user_id: userAId,
                title: "User A Task",
            });

            // User B tries to delete -> should return false
            const result = await personalTaskService.deletePersonalTask(task.id, userBId);
            expect(result).toBe(false);

            // Confirm task was NOT deleted
            const checkTask = await personalTaskService.getPersonalTaskById(task.id, userAId);
            expect(checkTask).not.toBeNull();

            // User A deletes -> should return true
            const deleteResult = await personalTaskService.deletePersonalTask(task.id, userAId);
            expect(deleteResult).toBe(true);
        });
    });
});

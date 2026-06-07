import { describe, it, expect, beforeEach } from "vitest";
import * as commentService from "../comment.service";
import * as orgTaskService from "../org-task.service";
import pool from "../../config/pg";
import { seedUser, seedOrg, seedSpace } from "../../test/helpers";
import { ApiError } from "../../utils/ApiError";

describe("Comment Service Unit Tests", () => {
    const adminUserId = "a1000000-0000-0000-0000-000000000001";
    const adminEmail = "comment-admin@test.com";
    const adminName = "Comment Admin";

    const memberUserId = "a1000000-0000-0000-0000-000000000002";
    const memberEmail = "comment-member@test.com";
    const memberName = "Comment Member";

    const managerUserId = "a1000000-0000-0000-0000-000000000003";
    const managerEmail = "comment-manager@test.com";
    const managerName = "Comment Manager";

    const otherMemberUserId = "a1000000-0000-0000-0000-000000000004";
    const otherMemberEmail = "comment-other-member@test.com";
    const otherMemberName = "Comment Other Member";

    const orgId = "b1000000-0000-0000-0000-000000000001";
    const spaceId = "c1000000-0000-0000-0000-000000000001";
    const context = { orgId, spaceId };
    let taskId: string;

    beforeEach(async () => {
        // Seed users
        await seedUser(adminUserId, adminEmail, adminName);
        await seedUser(memberUserId, memberEmail, memberName);
        await seedUser(managerUserId, managerEmail, managerName);
        await seedUser(otherMemberUserId, otherMemberEmail, otherMemberName);

        // Seed org + space
        await seedOrg(orgId, "Comment Test Org", adminUserId);
        await seedSpace(spaceId, orgId, "Comment Space", adminUserId);

        // Set roles in organization_members and space_members
        await pool.query(
            `UPDATE public.space_members SET role = 'admin' WHERE space_id = $1 AND user_id = $2`,
            [spaceId, adminUserId]
        );

        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member'), ($1, $3, 'member'), ($1, $4, 'member')
             ON CONFLICT (org_id, user_id) DO NOTHING`,
            [orgId, memberUserId, managerUserId, otherMemberUserId]
        );

        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'member'), ($1, $2, $4, 'manager'), ($1, $2, $5, 'member')
             ON CONFLICT (space_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
            [orgId, spaceId, memberUserId, managerUserId, otherMemberUserId]
        );

        // Create a test task
        const task = await orgTaskService.createTask({ orgId, spaceId }, {
            org_id: orgId,
            space_id: spaceId,
            created_by: adminUserId,
            title: "Test Task"
        });
        taskId = task.id;
    });

    describe("hardDeleteComment", () => {
        it("should succeed when called by the comment owner (even if they are a standard member)", async () => {
            // Create comment by member
            const comment = await commentService.createComment({
                task_id: taskId,
                user_id: memberUserId,
                content: "Member comment content"
            }, { org_id: orgId, space_id: spaceId });

            // Hard delete comment as memberUserId (owner) with role 'member'
            await expect(
                commentService.hardDeleteComment(comment.id, memberUserId, { org_id: orgId, space_id: spaceId }, "member")
            ).resolves.not.toThrow();

            // Verify deleted
            const check = await commentService.getCommentById(comment.id);
            expect(check).toBeNull();
        });

        it("should succeed when called by a Space Admin even if they do not own the comment", async () => {
            // Create comment by member
            const comment = await commentService.createComment({
                task_id: taskId,
                user_id: memberUserId,
                content: "Member comment content"
            }, { org_id: orgId, space_id: spaceId });

            // Hard delete comment as adminUserId (non-owner) with role 'admin'
            await expect(
                commentService.hardDeleteComment(comment.id, adminUserId, { org_id: orgId, space_id: spaceId }, "admin")
            ).resolves.not.toThrow();

            // Verify deleted
            const check = await commentService.getCommentById(comment.id);
            expect(check).toBeNull();
        });

        it("should throw a 403 ApiError when a manager tries to delete another user's comment", async () => {
            // Create comment by member
            const comment = await commentService.createComment({
                task_id: taskId,
                user_id: memberUserId,
                content: "Member comment content"
            }, { org_id: orgId, space_id: spaceId });

            // Hard delete comment as managerUserId (non-owner) with role 'manager' -> should throw 403
            await expect(
                commentService.hardDeleteComment(comment.id, managerUserId, { org_id: orgId, space_id: spaceId }, "manager")
            ).rejects.toThrowError(
                new ApiError(403, "You do not have permission to delete this comment")
            );

            // Verify still exists
            const check = await commentService.getCommentById(comment.id);
            expect(check).not.toBeNull();
        });

        it("should throw a 403 ApiError when a standard member tries to delete another user's comment", async () => {
            // Create comment by member
            const comment = await commentService.createComment({
                task_id: taskId,
                user_id: memberUserId,
                content: "Member comment content"
            }, { org_id: orgId, space_id: spaceId });

            // Hard delete comment as otherMemberUserId (non-owner) with role 'member' -> should throw 403
            await expect(
                commentService.hardDeleteComment(comment.id, otherMemberUserId, { org_id: orgId, space_id: spaceId }, "member")
            ).rejects.toThrowError(
                new ApiError(403, "You do not have permission to delete this comment")
            );

            // Verify still exists
            const check = await commentService.getCommentById(comment.id);
            expect(check).not.toBeNull();
        });
    });
});

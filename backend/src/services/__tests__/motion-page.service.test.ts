import { describe, it, expect, beforeEach } from "vitest";
import * as motionPageService from "../motion-page.service";
import pool from "../../config/pg";
import { seedUser, seedOrg, seedSpace } from "../../test/helpers";
import { MotionPermission, MotionShareType } from "../../types/enums";
import { ApiError } from "../../utils/ApiError";

describe("Motion Page Service Unit Tests", () => {
    // ── Test fixtures ──────────────────────────────────────────────────────────
    const adminUserId = "a1000000-0000-0000-0000-000000000001";
    const adminEmail = "motion-admin@test.com";
    const adminName = "Motion Admin";

    const managerUserId = "a1000000-0000-0000-0000-000000000002";
    const managerEmail = "motion-manager@test.com";
    const managerName = "Motion Manager";

    const memberUserId = "a1000000-0000-0000-0000-000000000003";
    const memberEmail = "motion-member@test.com";
    const memberName = "Motion Member";

    const orgId = "b1000000-0000-0000-0000-000000000001";
    const spaceId = "c1000000-0000-0000-0000-000000000001";
    const targetSpaceId = "c1000000-0000-0000-0000-000000000002";

    beforeEach(async () => {
        // Seed users
        await seedUser(adminUserId, adminEmail, adminName);
        await seedUser(managerUserId, managerEmail, managerName);
        await seedUser(memberUserId, memberEmail, memberName);

        // Seed org + space
        await seedOrg(orgId, "Motion Test Org", adminUserId);

        // Add manager and member to organisation members first
        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [orgId, managerUserId]
        );

        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
            [orgId, memberUserId]
        );

        await seedSpace(spaceId, orgId, "Motion Space", adminUserId);
        await seedSpace(targetSpaceId, orgId, "Target Space", adminUserId);

        // Setup space members
        await pool.query(
            `UPDATE public.space_members SET role = 'admin' WHERE space_id = $1 AND user_id = $2`,
            [spaceId, adminUserId]
        );

        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'manager') ON CONFLICT DO NOTHING`,
            [orgId, spaceId, managerUserId]
        );

        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'member') ON CONFLICT DO NOTHING`,
            [orgId, spaceId, memberUserId]
        );
    });

    // ── updatePage Constraints ──────────────────────────────────────────────────
    describe("updatePage Role Constraints", () => {
        it("should throw ApiError (403) when member attempts to update a page", async () => {
            const page = await motionPageService.createPage(orgId, spaceId, adminUserId, {
                title: "Admin Page",
            });

            await expect(
                motionPageService.updatePage(
                    orgId,
                    spaceId,
                    page.id,
                    memberUserId,
                    { title: "Member Hacked Title" },
                    "member"
                )
            ).rejects.toThrowError(
                new ApiError(403, "Members are not allowed to edit pages in this space")
            );
        });

        it("should throw ApiError (403) when manager attempts to update a page created by someone else", async () => {
            const page = await motionPageService.createPage(orgId, spaceId, adminUserId, {
                title: "Admin Page",
            });

            await expect(
                motionPageService.updatePage(
                    orgId,
                    spaceId,
                    page.id,
                    managerUserId,
                    { title: "Manager Edited" },
                    "manager"
                )
            ).rejects.toThrowError(
                new ApiError(403, "Managers can only edit their own pages")
            );
        });

        it("should successfully update page when manager updates their own page", async () => {
            const page = await motionPageService.createPage(orgId, spaceId, managerUserId, {
                title: "Manager Page",
            });

            const updated = await motionPageService.updatePage(
                orgId,
                spaceId,
                page.id,
                managerUserId,
                { title: "Manager Updated Own Page" },
                "manager"
            );

            expect(updated?.title).toBe("Manager Updated Own Page");
        });
    });

    // ── Share Permissions Verification ──────────────────────────────────────────
    describe("Shared Page Permissions Verification", () => {
        let pageId: string;

        beforeEach(async () => {
            // Admin creates a page in spaceId
            const page = await motionPageService.createPage(orgId, spaceId, adminUserId, {
                title: "Source Document",
            });
            pageId = page.id;

            // Make sure the users are members of targetSpaceId as well
            await pool.query(
                `INSERT INTO public.space_members (org_id, space_id, user_id, role)
                 VALUES ($1, $2, $3, 'admin') ON CONFLICT DO NOTHING`,
                [orgId, targetSpaceId, adminUserId]
            );

            await pool.query(
                `INSERT INTO public.space_members (org_id, space_id, user_id, role)
                 VALUES ($1, $2, $3, 'manager') ON CONFLICT DO NOTHING`,
                [orgId, targetSpaceId, managerUserId]
            );

            await pool.query(
                `INSERT INTO public.space_members (org_id, space_id, user_id, role)
                 VALUES ($1, $2, $3, 'member') ON CONFLICT DO NOTHING`,
                [orgId, targetSpaceId, memberUserId]
            );
        });

        it("should reject edits by anyone on VIEW shared page", async () => {
            // Share with VIEW permission
            await motionPageService.createShare(orgId, spaceId, pageId, adminUserId, {
                share_type: MotionShareType.SPACE,
                permission: MotionPermission.VIEW,
                target_org_id: orgId,
                target_space_id: targetSpaceId,
            }, "admin");

            // Manager tries to edit the shared page in targetSpaceId
            await expect(
                motionPageService.updatePage(
                    orgId,
                    targetSpaceId,
                    pageId,
                    managerUserId,
                    { title: "Manager Edit Share" },
                    "manager"
                )
            ).rejects.toThrowError(
                new ApiError(403, "You only have view access to this shared page")
            );
        });

        it("should respect EDIT_ADMINS and block non-admins from editing", async () => {
            // Share with EDIT_ADMINS permission
            await motionPageService.createShare(orgId, spaceId, pageId, adminUserId, {
                share_type: MotionShareType.SPACE,
                permission: MotionPermission.EDIT_ADMINS,
                target_org_id: orgId,
                target_space_id: targetSpaceId,
            }, "admin");

            // Manager tries to edit -> should throw 403 (blocked at view check since it's admin-only)
            await expect(
                motionPageService.updatePage(
                    orgId,
                    targetSpaceId,
                    pageId,
                    managerUserId,
                    { title: "Manager Edit Admin Share" },
                    "manager"
                )
            ).rejects.toThrowError(
                new ApiError(403, "This shared page is only accessible to admins")
            );

            // Admin tries to edit -> should succeed
            const updated = await motionPageService.updatePage(
                orgId,
                targetSpaceId,
                pageId,
                adminUserId,
                { title: "Admin Edited Shared Page" },
                "admin"
            );
            expect(updated?.title).toBe("Admin Edited Shared Page");
        });

        it("should respect EDIT_MANAGERS and allow managers and admins to edit", async () => {
            // Share with EDIT_MANAGERS permission
            await motionPageService.createShare(orgId, spaceId, pageId, adminUserId, {
                share_type: MotionShareType.SPACE,
                permission: MotionPermission.EDIT_MANAGERS,
                target_org_id: orgId,
                target_space_id: targetSpaceId,
            }, "admin");

            // Member tries to edit -> should throw 403 (blocked at view check since it's admin/manager only)
            await expect(
                motionPageService.updatePage(
                    orgId,
                    targetSpaceId,
                    pageId,
                    memberUserId,
                    { title: "Member Edit Manager Share" },
                    "member"
                )
            ).rejects.toThrowError(
                new ApiError(403, "This shared page is only accessible to admins and managers")
            );

            // Manager tries to edit -> should succeed
            const updated = await motionPageService.updatePage(
                orgId,
                targetSpaceId,
                pageId,
                managerUserId,
                { title: "Manager Edited Shared Page" },
                "manager"
            );
            expect(updated?.title).toBe("Manager Edited Shared Page");
        });
    });
});

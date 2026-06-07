import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import pool from "../../config/pg";
import { seedUser, seedOrg, seedSpace } from "../../test/helpers";

describe("Organisation Routes (/api/v1/orgs)", () => {
    // ── Test fixtures ──────────────────────────────────────────────────────────
    const ownerUserId = "a1000000-0000-0000-0000-000000000001";
    const ownerEmail = "org-owner@test.com";
    const ownerName = "Org Owner";
    const ownerToken = `mock-user-id-${ownerUserId}`;

    const adminUserId = "a1000000-0000-0000-0000-000000000002";
    const adminEmail = "org-admin@test.com";
    const adminName = "Org Admin";
    const adminToken = `mock-user-id-${adminUserId}`;

    const memberUserId = "a1000000-0000-0000-0000-000000000003";
    const memberEmail = "org-member@test.com";
    const memberName = "Org Member";
    const memberToken = `mock-user-id-${memberUserId}`;

    const spaceManagerUserId = "a1000000-0000-0000-0000-000000000004";
    const spaceManagerEmail = "space-manager@test.com";
    const spaceManagerName = "Space Manager";
    const spaceManagerToken = `mock-user-id-${spaceManagerUserId}`;

    const orgId = "b1000000-0000-0000-0000-000000000001";
    const spaceId = "c1000000-0000-0000-0000-000000000001";

    beforeEach(async () => {
        // Seed users
        await seedUser(ownerUserId, ownerEmail, ownerName);
        await seedUser(adminUserId, adminEmail, adminName);
        await seedUser(memberUserId, memberEmail, memberName);
        await seedUser(spaceManagerUserId, spaceManagerEmail, spaceManagerName);

        // Seed org with ownerUserId
        await seedOrg(orgId, "Acme Corporation", ownerUserId);

        // Add adminUserId to org with admin role
        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'admin')
             ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin'`,
            [orgId, adminUserId]
        );

        // Add memberUserId to org with member role
        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'member'`,
            [orgId, memberUserId]
        );

        // Add spaceManagerUserId to org with member role
        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'member'`,
            [orgId, spaceManagerUserId]
        );

        // Seed space
        await seedSpace(spaceId, orgId, "General", ownerUserId);
    });

    it("should reject requests without a token with 401", async () => {
        const response = await request(app)
            .get("/api/v1/orgs")
            .expect(401);

        expect(response.body).toHaveProperty("success", false);
    });

    it("should allow creating a new organisation", async () => {
        const response = await request(app)
            .post("/api/v1/orgs")
            .set("Authorization", `Bearer ${ownerToken}`)
            .send({ name: "Acme Corporate LLC" })
            .expect(201);

        expect(response.body.data.org).toHaveProperty("name", "Acme Corporate LLC");
    });

    // ── Organisation Deletion (Owner only) ──────────────────────────────────────
    describe("DELETE /:orgId - Delete Organisation", () => {
        it("should allow owner to delete organisation", async () => {
            await request(app)
                .delete(`/api/v1/orgs/${orgId}`)
                .set("Authorization", `Bearer ${ownerToken}`)
                .expect(200);
        });

        it("should reject admin deleting organisation", async () => {
            await request(app)
                .delete(`/api/v1/orgs/${orgId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(403);
        });

        it("should reject member deleting organisation", async () => {
            await request(app)
                .delete(`/api/v1/orgs/${orgId}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(403);
        });
    });

    // ── Organisation Management (Owner / Admin allowed, Member blocked) ───────────
    describe("Organisation Management RBAC", () => {
        it("should allow owner and admin to rename organisation", async () => {
            // Rename by admin
            const resAdmin = await request(app)
                .patch(`/api/v1/orgs/${orgId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: "Renamed by Admin" })
                .expect(200);

            expect(resAdmin.body.data.org.name).toBe("Renamed by Admin");

            // Rename by owner
            const resOwner = await request(app)
                .patch(`/api/v1/orgs/${orgId}`)
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ name: "Renamed by Owner" })
                .expect(200);

            expect(resOwner.body.data.org.name).toBe("Renamed by Owner");
        });

        it("should reject member renaming organisation", async () => {
            await request(app)
                .patch(`/api/v1/orgs/${orgId}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ name: "Member Hack" })
                .expect(403);
        });

        it("should allow admin to send invites", async () => {
            const res = await request(app)
                .post(`/api/v1/orgs/${orgId}/invite`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.data).toHaveProperty("token");
        });

        it("should reject member sending invites", async () => {
            await request(app)
                .post(`/api/v1/orgs/${orgId}/invite`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(403);
        });

        it("should allow owner to update org member role", async () => {
            await request(app)
                .patch(`/api/v1/orgs/${orgId}/members/${memberUserId}`)
                .set("Authorization", `Bearer ${ownerToken}`)
                .send({ role: "admin" })
                .expect(200);
        });

        it("should reject admin promoting a member to admin", async () => {
            await request(app)
                .patch(`/api/v1/orgs/${orgId}/members/${memberUserId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ role: "admin" })
                .expect(403);
        });

        it("should reject member updating org member role", async () => {
            await request(app)
                .patch(`/api/v1/orgs/${orgId}/members/${adminUserId}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ role: "member" })
                .expect(403);
        });

        it("should allow admin to manage spaces (create, rename, delete)", async () => {
            // Create space
            const createRes = await request(app)
                .post(`/api/v1/orgs/${orgId}/spaces`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: "Admin Space" })
                .expect(201);

            const newSpaceId = createRes.body.data.space.id;

            // Rename space
            await request(app)
                .patch(`/api/v1/orgs/${orgId}/spaces/${newSpaceId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ name: "Renamed Admin Space" })
                .expect(200);

            // Delete space
            await request(app)
                .delete(`/api/v1/orgs/${orgId}/spaces/${newSpaceId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);
        });

        it("should reject member managing spaces", async () => {
            await request(app)
                .post(`/api/v1/orgs/${orgId}/spaces`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ name: "Member Space" })
                .expect(403);
        });
    });

    // ── Space Role Management (Space Admin allowed, Space Manager blocked) ────────
    describe("Space Role Management RBAC", () => {
        beforeEach(async () => {
            // Set up space roles
            // adminUserId is space owner/admin
            await pool.query(
                `INSERT INTO public.space_members (org_id, space_id, user_id, role)
                 VALUES ($1, $2, $3, 'admin')
                 ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'admin'`,
                [orgId, spaceId, adminUserId]
            );

            // spaceManagerUserId is space manager
            await pool.query(
                `INSERT INTO public.space_members (org_id, space_id, user_id, role)
                 VALUES ($1, $2, $3, 'manager')
                 ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'manager'`,
                [orgId, spaceId, spaceManagerUserId]
            );

            // memberUserId is space member
            await pool.query(
                `INSERT INTO public.space_members (org_id, space_id, user_id, role)
                 VALUES ($1, $2, $3, 'member')
                 ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'member'`,
                [orgId, spaceId, memberUserId]
            );
        });

        it("should allow Space Admin to update space member role", async () => {
            await request(app)
                .patch(`/api/v1/orgs/${orgId}/spaces/${spaceId}/members/${memberUserId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ role: "manager" })
                .expect(200);
        });

        it("should reject Space Manager updating space member role", async () => {
            await request(app)
                .patch(`/api/v1/orgs/${orgId}/spaces/${spaceId}/members/${memberUserId}`)
                .set("Authorization", `Bearer ${spaceManagerToken}`)
                .send({ role: "admin" })
                .expect(403);
        });
    });
});

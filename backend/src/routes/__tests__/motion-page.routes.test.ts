import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import pool from "../../config/pg";
import { seedUser, seedOrg, seedSpace } from "../../test/helpers";

/**
 * Motion Page Routes — Integration Tests
 *
 * Tests the full request lifecycle: auth → controller → service → repository → response.
 * Covers CRUD operations, content validation, cache-relevant response shapes,
 * and error handling.
 */

describe("Motion Page Routes", () => {
    // ── Test fixtures ──────────────────────────────────────────────────────────
    const adminUserId = "a1000000-0000-0000-0000-000000000001";
    const adminEmail = "motion-admin@test.com";
    const adminName = "Motion Admin";
    const adminToken = `mock-user-id-${adminUserId}`;

    const managerUserId = "a1000000-0000-0000-0000-000000000002";
    const managerEmail = "motion-manager@test.com";
    const managerName = "Motion Manager";
    const managerToken = `mock-user-id-${managerUserId}`;

    const memberUserId = "a1000000-0000-0000-0000-000000000003";
    const memberEmail = "motion-member@test.com";
    const memberName = "Motion Member";
    const memberToken = `mock-user-id-${memberUserId}`;

    const orgId = "b1000000-0000-0000-0000-000000000001";
    const spaceId = "c1000000-0000-0000-0000-000000000001";

    const basePath = `/api/v1/orgs/${orgId}/spaces/${spaceId}/notes`;

    beforeEach(async () => {
        // Seed users
        await seedUser(adminUserId, adminEmail, adminName);
        await seedUser(managerUserId, managerEmail, managerName);
        await seedUser(memberUserId, memberEmail, memberName);

        // Seed org + space
        await seedOrg(orgId, "Motion Test Org", adminUserId);
        await seedSpace(spaceId, orgId, "Motion Space", adminUserId);

        // Explicitly update admin's space role to 'admin' (seedSpace sets it to 'owner' which is invalid for space RBAC)
        await pool.query(
            `UPDATE public.space_members SET role = 'admin' WHERE space_id = $1 AND user_id = $2`,
            [spaceId, adminUserId]
        );

        // Add to organisation first, then to space with appropriate roles
        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (org_id, user_id) DO NOTHING`,
            [orgId, managerUserId]
        );
        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'manager')
             ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'manager'`,
            [orgId, spaceId, managerUserId]
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

    // ── Page Creation ──────────────────────────────────────────────────────────

    describe("POST / — Create Page", () => {
        it("should create a root page with default title", async () => {
            const res = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({})
                .expect(201);

            expect(res.body.data).toMatchObject({
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                title: "Untitled",
                parent_id: null,
            });
            expect(res.body.data.id).toBeDefined();
            expect(res.body.data.created_at).toBeDefined();
        });

        it("should create a page with a custom title", async () => {
            const res = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "My First Page" })
                .expect(201);

            expect(res.body.data.title).toBe("My First Page");
        });

        it("should create a subpage under an existing parent", async () => {
            // Create parent
            const parentRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Parent" })
                .expect(201);

            const parentId = parentRes.body.data.id;

            // Create child
            const childRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Child", parent_id: parentId })
                .expect(201);

            expect(childRes.body.data.parent_id).toBe(parentId);
        });

        it("should reject creation with invalid parent_id", async () => {
            const res = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ parent_id: "00000000-0000-0000-0000-000000000000" })
                .expect(400);

            expect(res.body.message).toContain("Parent page not found");
        });

        it("should reject creation by a member (not admin/manager)", async () => {
            await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Unauthorized" })
                .expect(403);
        });
    });

    // ── Page Listing ───────────────────────────────────────────────────────────

    describe("GET / — List Pages", () => {
        it("should return all active pages for the space", async () => {
            // Create two pages
            await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Page A" });
            await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Page B" });

            const res = await request(app)
                .get(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.data).toHaveLength(2);
            expect(res.body.data[0]).toHaveProperty("title");
            expect(res.body.data[0]).toHaveProperty("id");
            expect(res.body.data[0]).toHaveProperty("position");
            expect(res.body.data[0]).not.toHaveProperty("content");
        });

        it("should not include soft-deleted pages", async () => {
            // Create and delete a page
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "To Delete" });

            await request(app)
                .delete(`${basePath}/${createRes.body.data.id}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            const listRes = await request(app)
                .get(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            expect(listRes.body.data).toHaveLength(0);
        });

        it("should be accessible by members", async () => {
            await request(app)
                .get(basePath)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);
        });
    });

    // ── Page Detail ────────────────────────────────────────────────────────────

    describe("GET /:id — Get Page Detail", () => {
        it("should return full page data including content", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Detail Test" });

            const pageId = createRes.body.data.id;

            // Update with content
            await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] } });

            const res = await request(app)
                .get(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            expect(res.body.data.id).toBe(pageId);
            expect(res.body.data.title).toBe("Detail Test");
            expect(res.body.data.content).toBeDefined();
            expect(res.body.data.content.type).toBe("doc");
        });

        it("should return 404 for non-existent page", async () => {
            await request(app)
                .get(`${basePath}/00000000-0000-0000-0000-000000000000`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(404);
        });
    });

    // ── Page Update ────────────────────────────────────────────────────────────

    describe("PATCH /:id — Update Page", () => {
        it("should update title", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Original" });

            const pageId = createRes.body.data.id;

            const res = await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Updated Title" })
                .expect(200);

            expect(res.body.data.title).toBe("Updated Title");
        });

        it("should update content with valid JSON", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Content Test" });

            const pageId = createRes.body.data.id;
            const content = {
                type: "doc",
                content: [
                    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
                    { type: "paragraph", content: [{ type: "text", text: "Body text" }] },
                ],
            };

            const res = await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ content })
                .expect(200);

            expect(res.body.data.content).toEqual(content);
        });

        it("should reject empty title", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Will Empty" });

            const pageId = createRes.body.data.id;

            await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "   " })
                .expect(400);
        });

        it("should reject non-object content", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Bad Content" });

            const pageId = createRes.body.data.id;

            await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ content: "not an object" })
                .expect(400);
        });

        it("should reject content larger than 1MB", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Large Content" });

            const pageId = createRes.body.data.id;

            // Generate content > 1MB
            const largeText = "x".repeat(1_100_000);
            const content = {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: largeText }] }],
            };

            const res = await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ content })
                .expect(413);

            expect(res.body.message).toContain("maximum size");
        });

        it("should update cover_position within valid range", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Cover Test" });

            const pageId = createRes.body.data.id;

            const res = await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ cover_position: 75 })
                .expect(200);

            expect(res.body.data.cover_position).toBe(75);
        });

        it("should reject cover_position outside 0-100", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Bad Cover" });

            const pageId = createRes.body.data.id;

            await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ cover_position: 150 })
                .expect(400);
        });

        it("should prevent a page from being its own parent", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Self Parent" });

            const pageId = createRes.body.data.id;

            await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ parent_id: pageId })
                .expect(400);
        });

        it("should set updated_by to the current user", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ title: "Track Editor" });

            const pageId = createRes.body.data.id;

            // Manager updates the page
            const res = await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ title: "Manager Edited" })
                .expect(200);

            expect(res.body.data.updated_by).toBe(managerUserId);
        });

        it("should reject updates from members (non-admin/manager)", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "No Member Edit" });

            const pageId = createRes.body.data.id;

            await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Hacked" })
                .expect(403);
        });

        it("should rate limit updates (PATCH) exceeding 60 requests per minute", async () => {
            process.env.RATE_LIMIT_TEST = "true";

            // Seed a completely fresh user specifically for this test to avoid rate limit leak from other tests
            const rateLimitUserId = "a1000000-0000-0000-0000-000000000099";
            const rateLimitToken = `mock-user-id-${rateLimitUserId}`;

            await seedUser(rateLimitUserId, "rate-limit@test.com", "Rate Limit User");
            await pool.query(
                `INSERT INTO public.organisation_members (org_id, user_id, role)
                 VALUES ($1, $2, 'member')
                 ON CONFLICT (org_id, user_id) DO NOTHING`,
                [orgId, rateLimitUserId]
            );
            await pool.query(
                `INSERT INTO public.space_members (org_id, space_id, user_id, role)
                 VALUES ($1, $2, $3, 'admin')
                 ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'admin'`,
                [orgId, spaceId, rateLimitUserId]
            );

            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${rateLimitToken}`)
                .send({ title: "Rate Limit Test" });

            const pageId = createRes.body.data.id;

            // Fire 60 requests under the limit
            for (let i = 0; i < 60; i++) {
                await request(app)
                    .patch(`${basePath}/${pageId}`)
                    .set("Authorization", `Bearer ${rateLimitToken}`)
                    .send({ title: `Update ${i}` })
                    .expect(200);
            }

            // The 61st request should return 429 Too Many Requests
            const res = await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${rateLimitToken}`)
                .send({ title: "Update 61" })
                .expect(429);

            expect(res.body.message).toContain("Too many requests");

            delete process.env.RATE_LIMIT_TEST;
        });
    });

    // ── Soft Delete & Trash ────────────────────────────────────────────────────

    describe("DELETE /:id — Soft Delete", () => {
        it("should soft-delete a page and its descendants", async () => {
            // Create a tree: root → child → grandchild
            const rootRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Root" });
            const rootId = rootRes.body.data.id;

            const childRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Child", parent_id: rootId });
            const childId = childRes.body.data.id;

            const grandchildRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Grandchild", parent_id: childId });
            const grandchildId = grandchildRes.body.data.id;

            // Delete root
            await request(app)
                .delete(`${basePath}/${rootId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            // Verify all are in trash
            const trashRes = await request(app)
                .get(`${basePath}/trash`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            const trashIds = trashRes.body.data.map((p: any) => p.id);
            expect(trashIds).toContain(rootId);
            expect(trashIds).toContain(childId);
            expect(trashIds).toContain(grandchildId);

            // Verify none appear in active list
            const listRes = await request(app)
                .get(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            expect(listRes.body.data).toHaveLength(0);
        });

        it("should reject deletion by members", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Protected" });

            await request(app)
                .delete(`${basePath}/${createRes.body.data.id}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(403);
        });
    });

    // ── Restore ────────────────────────────────────────────────────────────────

    describe("PATCH /:id/restore — Restore from Trash", () => {
        it("should restore a soft-deleted page", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Restore Me" });

            const pageId = createRes.body.data.id;

            // Delete
            await request(app)
                .delete(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            // Restore
            const restoreRes = await request(app)
                .patch(`${basePath}/${pageId}/restore`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            expect(restoreRes.body.data.deleted_at).toBeNull();
            expect(restoreRes.body.data.title).toBe("Restore Me");
        });

        it("should return 400 if page is not in trash", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Not Deleted" });

            await request(app)
                .patch(`${basePath}/${createRes.body.data.id}/restore`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(400);
        });
    });

    // ── Hard Delete ────────────────────────────────────────────────────────────

    describe("DELETE /:id/permanent — Hard Delete", () => {
        it("should permanently delete a page", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Permanent Delete" });

            const pageId = createRes.body.data.id;

            // Soft delete first (hard delete works on any page)
            await request(app)
                .delete(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`);

            // Hard delete
            await request(app)
                .delete(`${basePath}/${pageId}/permanent`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            // Verify gone from trash
            const trashRes = await request(app)
                .get(`${basePath}/trash`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            const trashIds = trashRes.body.data.map((p: any) => p.id);
            expect(trashIds).not.toContain(pageId);
        });
    });

    // ── Position & Ordering ────────────────────────────────────────────────────

    describe("Ordering", () => {
        it("should assign incrementing positions to new pages", async () => {
            const res1 = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "First" });
            const res2 = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Second" });

            expect(res2.body.data.position).toBeGreaterThan(res1.body.data.position);
        });

        it("should list pages ordered by position", async () => {
            await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "A" });
            await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "B" });
            await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "C" });

            const listRes = await request(app)
                .get(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            const titles = listRes.body.data.map((p: any) => p.title);
            expect(titles).toEqual(["A", "B", "C"]);
        });
    });

    // ── Authentication ─────────────────────────────────────────────────────────

    describe("Authentication", () => {
        it("should reject requests without auth token", async () => {
            await request(app)
                .get(basePath)
                .expect(401);
        });

        it("should reject requests with invalid token", async () => {
            await request(app)
                .get(basePath)
                .set("Authorization", "Bearer invalid-token")
                .expect(401);
        });
    });

    // ── Space Role Access & Document Ownership Boundaries ───────────────────────

    describe("Space Role Access and Document Ownership Boundaries", () => {
        it("should allow Space manager to edit, share, or delete pages they created, but receive 403 on others' pages", async () => {
            // 1. Manager creates their own page
            const managerPageRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ title: "Manager Private Page" })
                .expect(201);
            const managerPageId = managerPageRes.body.data.id;

            // 2. Admin creates a page
            const adminPageRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Admin Page" })
                .expect(201);
            const adminPageId = adminPageRes.body.data.id;

            // 3. Manager edits their own page -> 200
            await request(app)
                .patch(`${basePath}/${managerPageId}`)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ title: "Manager Page Edited" })
                .expect(200);

            // 4. Manager tries to edit Admin's page -> 403
            await request(app)
                .patch(`${basePath}/${adminPageId}`)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ title: "Manager Hacked Title" })
                .expect(403);

            // 5. Manager creates a share for their own page -> 201
            await request(app)
                .post(`${basePath}/${managerPageId}/shares`)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ share_type: "public_link", permission: "view" })
                .expect(201);

            // 6. Manager tries to share Admin's page -> 403
            await request(app)
                .post(`${basePath}/${adminPageId}/shares`)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ share_type: "public_link", permission: "view" })
                .expect(403);

            // 7. Manager tries to delete Admin's page -> 403
            await request(app)
                .delete(`${basePath}/${adminPageId}`)
                .set("Authorization", `Bearer ${managerToken}`)
                .expect(403);

            // 8. Manager deletes their own page -> 200
            await request(app)
                .delete(`${basePath}/${managerPageId}`)
                .set("Authorization", `Bearer ${managerToken}`)
                .expect(200);
        });

        it("should allow Space admin to edit, share, or delete any page in the space", async () => {
            // 1. Manager creates a page
            const managerPageRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ title: "Page by Manager" })
                .expect(201);
            const pageId = managerPageRes.body.data.id;

            // 2. Admin edits manager's page -> 200
            await request(app)
                .patch(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Edited by Admin" })
                .expect(200);

            // 3. Admin shares manager's page -> 201
            await request(app)
                .post(`${basePath}/${pageId}/shares`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ share_type: "public_link", permission: "view" })
                .expect(201);

            // 4. Admin deletes manager's page -> 200
            await request(app)
                .delete(`${basePath}/${pageId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);
        });

        it("should block standard Space members from creating pages or requesting page shares", async () => {
            // 1. Member tries to create a page -> 403
            await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Member Attempt" })
                .expect(403);

            // 2. Admin creates a page for sharing test
            const pageRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Shared Page" })
                .expect(201);
            const pageId = pageRes.body.data.id;

            // 3. Member tries to share the page -> 403
            await request(app)
                .post(`${basePath}/${pageId}/shares`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ share_type: "public_link", permission: "view" })
                .expect(403);
        });
    });

    describe("Single User Sharing via Email", () => {
        const recipientUserId = "a1000000-0000-0000-0000-000000000099";
        const recipientEmail = "motion-recipient@test.com";
        const recipientName = "Motion Recipient";
        const recipientToken = `mock-user-id-${recipientUserId}`;

        let pageId: string;

        beforeEach(async () => {
            // Seed a recipient user
            await seedUser(recipientUserId, recipientEmail, recipientName);

            // Manually ensure the recipient has a personal org and default space (in case triggers are bypassed in tests)
            const orgRes = await pool.query(
                `INSERT INTO public.organisations (name, owner_user_id, is_personal)
                 VALUES ($1, $2, TRUE)
                 ON CONFLICT DO NOTHING
                 RETURNING id`,
                [`${recipientName}'s Org`, recipientUserId]
            );
            const rOrgId = orgRes.rows[0]?.id || (await pool.query(
                `SELECT id FROM public.organisations WHERE owner_user_id = $1 AND is_personal = TRUE LIMIT 1`,
                [recipientUserId]
            )).rows[0]?.id;

            await pool.query(
                `INSERT INTO public.organisation_members (org_id, user_id, role)
                 VALUES ($1, $2, 'owner')
                 ON CONFLICT DO NOTHING`,
                [rOrgId, recipientUserId]
            );

            await pool.query(
                `INSERT INTO public.spaces (org_id, name, visibility, created_by, is_default, is_private)
                 VALUES ($1, 'Private', 'private', $2, TRUE, TRUE)
                 ON CONFLICT DO NOTHING`,
                [rOrgId, recipientUserId]
            );

            // Admin creates a page
            const pageRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Shared Page by Email" })
                .expect(201);
            pageId = pageRes.body.data.id;
        });

        it("should share a page with an existing user by email", async () => {
            const res = await request(app)
                .post(`${basePath}/${pageId}/shares`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ email: recipientEmail, permission: "view_all" })
                .expect(201);

            expect(res.body.data).toMatchObject({
                page_id: pageId,
                share_type: "space",
                permission: "view_all",
                target_org_is_personal: true,
                target_user_email: recipientEmail,
                target_user_name: recipientName,
            });

            // Recipient should be able to fetch shared pages
            const sharedRes = await request(app)
                .get(`/api/v1/orgs/${res.body.data.target_org_id}/spaces/${res.body.data.target_space_id}/notes/shared`)
                .set("Authorization", `Bearer ${recipientToken}`)
                .expect(200);

            expect(sharedRes.body.data).toHaveLength(1);
            expect(sharedRes.body.data[0].id).toBe(pageId);
            expect(sharedRes.body.data[0].title).toBe("Shared Page by Email");
        });

        it("should reject sharing with an email that is not registered", async () => {
            const res = await request(app)
                .post(`${basePath}/${pageId}/shares`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ email: "not-registered@test.com", permission: "view_all" })
                .expect(404);

            expect(res.body.message).toContain("is not registered on Keil");
        });
    });
});

import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import pool from "../../config/pg";
import { seedUser, seedOrg, seedSpace } from "../../test/helpers";

describe("Org Task Routes Integration Tests", () => {
    // ── Test fixtures ──────────────────────────────────────────────────────────
    const adminUserId = "a1000000-0000-0000-0000-000000000001";
    const adminEmail = "task-admin@test.com";
    const adminName = "Task Admin";
    const adminToken = `mock-user-id-${adminUserId}`;

    const managerUserId = "a1000000-0000-0000-0000-000000000002";
    const managerEmail = "task-manager@test.com";
    const managerName = "Task Manager";
    const managerToken = `mock-user-id-${managerUserId}`;

    const memberUserId = "a1000000-0000-0000-0000-000000000003";
    const memberEmail = "task-member@test.com";
    const memberName = "Task Member";
    const memberToken = `mock-user-id-${memberUserId}`;

    const otherMemberUserId = "a1000000-0000-0000-0000-000000000004";
    const otherMemberEmail = "task-other-member@test.com";
    const otherMemberName = "Task Other Member";
    const otherMemberToken = `mock-user-id-${otherMemberUserId}`;

    const orgId = "b1000000-0000-0000-0000-000000000001";
    const spaceId = "c1000000-0000-0000-0000-000000000001";

    const basePath = `/api/v1/orgs/${orgId}/spaces/${spaceId}/tasks`;

    beforeEach(async () => {
        // Seed users
        await seedUser(adminUserId, adminEmail, adminName);
        await seedUser(managerUserId, managerEmail, managerName);
        await seedUser(memberUserId, memberEmail, memberName);
        await seedUser(otherMemberUserId, otherMemberEmail, otherMemberName);

        // Seed org + space
        await seedOrg(orgId, "Task Test Org", adminUserId);
        await seedSpace(spaceId, orgId, "Task Space", adminUserId);

        // Update admin's space role to 'admin' (seedSpace sets role = 'owner')
        await pool.query(
            `UPDATE public.space_members SET role = 'admin' WHERE space_id = $1 AND user_id = $2`,
            [spaceId, adminUserId]
        );

        // Set up Manager role
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

        // Set up Member role
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

        // Set up Other Member role
        await pool.query(
            `INSERT INTO public.organisation_members (org_id, user_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (org_id, user_id) DO NOTHING`,
            [orgId, otherMemberUserId]
        );
        await pool.query(
            `INSERT INTO public.space_members (org_id, space_id, user_id, role)
             VALUES ($1, $2, $3, 'member')
             ON CONFLICT (space_id, user_id) DO UPDATE SET role = 'member'`,
             [orgId, spaceId, otherMemberUserId]
        );
    });

    // ── RBAC Task Creation ──────────────────────────────────────────────────────
    describe("POST / - Create Task (RBAC)", () => {
        it("should allow an admin to create a task", async () => {
            const res = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Admin Task" })
                .expect(201);

            expect(res.body.data).toMatchObject({
                title: "Admin Task",
                org_id: orgId,
                space_id: spaceId,
                created_by: adminUserId,
                status: "backlog",
                priority: "medium",
            });
        });

        it("should allow a manager to create a task", async () => {
            const res = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ title: "Manager Task", status: "todo", priority: "high" })
                .expect(201);

            expect(res.body.data).toMatchObject({
                title: "Manager Task",
                status: "todo",
                priority: "high",
                created_by: managerUserId,
            });
        });

        it("should block regular members from creating tasks", async () => {
            await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Member Task" })
                .expect(403);
        });
    });

    // ── Task CRUD operations ────────────────────────────────────────────────────
    describe("Task CRUD Actions", () => {
        it("should allow admin/manager to list, update, and delete tasks", async () => {
            // 1. Create a task as admin
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Original Task" })
                .expect(201);

            const taskId = createRes.body.data.id;

            // 2. List tasks (accessible by admin, manager, member)
            const listRes = await request(app)
                .get(basePath)
                .set("Authorization", `Bearer ${memberToken}`)
                .expect(200);

            expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
            const found = listRes.body.data.find((t: any) => t.id === taskId);
            expect(found).toBeDefined();
            expect(found.title).toBe("Original Task");

            // 3. Update task as manager
            const updateRes = await request(app)
                .patch(`${basePath}/${taskId}`)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ title: "Updated Task Title", priority: "urgent" })
                .expect(200);

            expect(updateRes.body.data.title).toBe("Updated Task Title");
            expect(updateRes.body.data.priority).toBe("urgent");

            // Members cannot update tasks
            await request(app)
                .patch(`${basePath}/${taskId}`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ title: "Member Hacked Title" })
                .expect(403);

            // 4. Delete task as admin
            await request(app)
                .delete(`${basePath}/${taskId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(200);

            // Verify deleted (GET by ID returns 404)
            await request(app)
                .get(`${basePath}/${taskId}`)
                .set("Authorization", `Bearer ${adminToken}`)
                .expect(404);
        });
    });

    // ── Status Changes ──────────────────────────────────────────────────────────
    describe("PATCH /:id/status - Change Task Status", () => {
        it("should allow admin and manager to change status without being assigned", async () => {
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Unassigned Task" })
                .expect(201);

            const taskId = createRes.body.data.id;

            const res = await request(app)
                .patch(`${basePath}/${taskId}/status`)
                .set("Authorization", `Bearer ${managerToken}`)
                .send({ status: "in-progress" })
                .expect(200);

            expect(res.body.data.status).toBe("in-progress");
        });

        it("should allow an assigned member to change status, but block unassigned members", async () => {
            // Create a task
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Member Assignment Task" })
                .expect(201);

            const taskId = createRes.body.data.id;

            // Member (unassigned) tries to change status -> 403
            await request(app)
                .patch(`${basePath}/${taskId}/status`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ status: "in-progress" })
                .expect(403);

            // Assign the member to the task
            await request(app)
                .post(`${basePath}/${taskId}/assignees`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ user_id: memberUserId })
                .expect(201);

            // Now the assigned member can change status -> 200
            const res = await request(app)
                .patch(`${basePath}/${taskId}/status`)
                .set("Authorization", `Bearer ${memberToken}`)
                .send({ status: "in-progress" })
                .expect(200);

            expect(res.body.data.status).toBe("in-progress");

            // Another member (unassigned) still blocked -> 403
            await request(app)
                .patch(`${basePath}/${taskId}/status`)
                .set("Authorization", `Bearer ${otherMemberToken}`)
                .send({ status: "done" })
                .expect(403);
        });
    });

    // ── Task Dependencies ───────────────────────────────────────────────────────
    describe("Task Dependencies Constraint", () => {
        it("should fail to mark a task as done if dependencies are incomplete, and pass when complete", async () => {
            // 1. Create two tasks: taskA (depends on taskB)
            const resA = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Task A" })
                .expect(201);
            const taskAId = resA.body.data.id;

            const resB = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ title: "Task B", status: "todo" })
                .expect(201);
            const taskBId = resB.body.data.id;

            // 2. Add dependency (taskA depends on taskB)
            await request(app)
                .post(`${basePath}/${taskAId}/dependencies`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ depends_on_task_id: taskBId })
                .expect(201);

            // 3. Try to mark taskA (dependent) as done -> should fail with 400
            const failRes = await request(app)
                .patch(`${basePath}/${taskAId}/status`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ status: "done" })
                .expect(400);

            expect(failRes.body.message).toContain("dependencies are incomplete");

            // 4. Mark taskB as done
            await request(app)
                .patch(`${basePath}/${taskBId}/status`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ status: "done" })
                .expect(200);

            // 5. Try again to mark taskA as done -> should succeed with 200
            const successRes = await request(app)
                .patch(`${basePath}/${taskAId}/status`)
                .set("Authorization", `Bearer ${adminToken}`)
                .send({ status: "done" })
                .expect(200);

            expect(successRes.body.data.status).toBe("done");
        });
    });
});

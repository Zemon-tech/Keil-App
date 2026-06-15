import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../app";
import { seedUser } from "../../test/helpers";

describe("Personal Task Routes Integration Tests", () => {
    // ── Test fixtures ──────────────────────────────────────────────────────────
    const userAId = "a1000000-0000-0000-0000-000000000001";
    const userAEmail = "user-a@test.com";
    const userAName = "User A";
    const userAToken = `mock-user-id-${userAId}`;

    const userBId = "a1000000-0000-0000-0000-000000000002";
    const userBEmail = "user-b@test.com";
    const userBName = "User B";
    const userBToken = `mock-user-id-${userBId}`;

    const basePath = "/api/v1/personal/tasks";

    beforeEach(async () => {
        // Seed users
        await seedUser(userAId, userAEmail, userAName);
        await seedUser(userBId, userBEmail, userBName);
    });

    // ── Happy Path CRUD Operations ──────────────────────────────────────────────
    describe("Happy Path CRUD Operations (User A)", () => {
        it("should successfully create, read, list, update, and delete personal tasks", async () => {
            // 1. Create a personal task
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({
                    title: "User A Task",
                    description: "User A task description",
                    priority: "high",
                    status: "todo",
                    context: [
                        { id: "item-1", title: "Setup Doc", type: "doc", url: "https://example.com/setup" }
                    ]
                })
                .expect(201);

            expect(createRes.body.data).toMatchObject({
                title: "User A Task",
                description: "User A task description",
                owner_user_id: userAId,
                status: "todo",
                priority: "high",
                parent_task_id: null,
                context: [
                    { id: "item-1", title: "Setup Doc", type: "doc", url: "https://example.com/setup" }
                ]
            });
            expect(createRes.body.data.id).toBeDefined();
            const taskId = createRes.body.data.id;

            // 2. Read task detail by ID
            const getRes = await request(app)
                .get(`${basePath}/${taskId}`)
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(200);

            expect(getRes.body.data.title).toBe("User A Task");
            expect(getRes.body.data.context).toEqual([
                { id: "item-1", title: "Setup Doc", type: "doc", url: "https://example.com/setup" }
            ]);

            // 3. List personal tasks
            const listRes = await request(app)
                .get(basePath)
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(200);

            expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
            const foundTask = listRes.body.data.find((t: any) => t.id === taskId);
            expect(foundTask).toBeDefined();
            expect(foundTask.context).toEqual([
                { id: "item-1", title: "Setup Doc", type: "doc", url: "https://example.com/setup" }
            ]);

            // 4. Update task details
            const updateRes = await request(app)
                .patch(`${basePath}/${taskId}`)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({
                    title: "User A Task Updated",
                    description: "Updated description",
                    priority: "urgent",
                    context: [
                        { id: "item-1", title: "Setup Doc", type: "doc", url: "https://example.com/setup" },
                        { id: "item-2", title: "Figma Link", type: "figma", url: "https://figma.com/file/1" }
                    ]
                })
                .expect(200);

            expect(updateRes.body.data.title).toBe("User A Task Updated");
            expect(updateRes.body.data.description).toBe("Updated description");
            expect(updateRes.body.data.priority).toBe("urgent");
            expect(updateRes.body.data.context).toEqual([
                { id: "item-1", title: "Setup Doc", type: "doc", url: "https://example.com/setup" },
                { id: "item-2", title: "Figma Link", type: "figma", url: "https://figma.com/file/1" }
            ]);

            // 5. Change task status separately
            const statusRes = await request(app)
                .patch(`${basePath}/${taskId}/status`)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({ status: "in-progress" })
                .expect(200);

            expect(statusRes.body.data.status).toBe("in-progress");

            // 6. Delete task
            await request(app)
                .delete(`${basePath}/${taskId}`)
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(200);

            // Verify deleted task is no longer found (returns 404)
            await request(app)
                .get(`${basePath}/${taskId}`)
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(404);
        });
    });

    // ── Ownership Isolation ─────────────────────────────────────────────────────
    describe("Ownership Isolation (User B Access Restrictions)", () => {
        it("should block User B from accessing, modifying, or deleting User A's tasks", async () => {
            // 1. Create a task belonging to User A
            const createRes = await request(app)
                .post(basePath)
                .set("Authorization", `Bearer ${userAToken}`)
                .send({ title: "Private Task A" })
                .expect(201);

            const taskAId = createRes.body.data.id;

            // 2. User B tries to read User A's task -> 404 Not Found
            await request(app)
                .get(`${basePath}/${taskAId}`)
                .set("Authorization", `Bearer ${userBToken}`)
                .expect(404);

            // 3. User B lists their tasks -> User A's task is absent
            const listRes = await request(app)
                .get(basePath)
                .set("Authorization", `Bearer ${userBToken}`)
                .expect(200);

            const foundTask = listRes.body.data.find((t: any) => t.id === taskAId);
            expect(foundTask).toBeUndefined();

            // 4. User B tries to update User A's task -> 404 Not Found
            await request(app)
                .patch(`${basePath}/${taskAId}`)
                .set("Authorization", `Bearer ${userBToken}`)
                .send({ title: "User B Hacked Title" })
                .expect(404);

            // 5. User B tries to change User A's task status -> 404 Not Found
            await request(app)
                .patch(`${basePath}/${taskAId}/status`)
                .set("Authorization", `Bearer ${userBToken}`)
                .send({ status: "done" })
                .expect(404);

            // 6. User B tries to delete User A's task -> 404 Not Found
            await request(app)
                .delete(`${basePath}/${taskAId}`)
                .set("Authorization", `Bearer ${userBToken}`)
                .expect(404);

            // Verify User A can still access their task perfectly
            const finalRes = await request(app)
                .get(`${basePath}/${taskAId}`)
                .set("Authorization", `Bearer ${userAToken}`)
                .expect(200);

            expect(finalRes.body.data.title).toBe("Private Task A");
        });
    });
});

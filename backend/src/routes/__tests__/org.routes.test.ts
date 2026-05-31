import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app";
import { seedUser } from "../../test/helpers";

describe("Organisation Routes (/api/v1/orgs)", () => {
    const mockUserId = "c18a2879-11c5-430c-8ad9-5db4f3316bf8";
    const mockUserEmail = "test-user@keilhq.in";
    const mockUserName = "John Doe";
    // Convention: token = "mock-user-id-<uuid>" triggers the Supabase mock
    const mockToken = `mock-user-id-${mockUserId}`;

    it("should reject requests without a token with 401", async () => {
        const response = await request(app)
            .get("/api/v1/orgs")
            .expect(401);

        expect(response.body).toHaveProperty("success", false);
        expect(response.body).toHaveProperty("message", "Not authorized to access this route");
    });

    it("should allow creating a new organisation", async () => {
        await seedUser(mockUserId, mockUserEmail, mockUserName);

        const response = await request(app)
            .post("/api/v1/orgs")
            .set("Authorization", `Bearer ${mockToken}`)
            .send({ name: "Acme Corporate LLC" })
            .expect(201);

        expect(response.body).toHaveProperty("statusCode", 201);
        // API returns { org: {...}, space: {...} }
        expect(response.body.data).toHaveProperty("org");
        expect(response.body.data).toHaveProperty("space");
        expect(response.body.data.org).toHaveProperty("id");
        expect(response.body.data.org).toHaveProperty("name", "Acme Corporate LLC");
        expect(response.body.data.org).toHaveProperty("owner_user_id", mockUserId);
        expect(response.body.data.org).toHaveProperty("role", "owner");
        expect(response.body.data.space).toHaveProperty("name", "General");
    });

    it("should return list of organisations user belongs to", async () => {
        await seedUser(mockUserId, mockUserEmail, mockUserName);

        // Create an org
        await request(app)
            .post("/api/v1/orgs")
            .set("Authorization", `Bearer ${mockToken}`)
            .send({ name: "Test Org 1" })
            .expect(201);

        // Fetch orgs
        const response = await request(app)
            .get("/api/v1/orgs")
            .set("Authorization", `Bearer ${mockToken}`)
            .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("organisations");
        // User has at least 2 orgs: the auto-created personal org + "Test Org 1"
        expect(response.body.data.organisations.length).toBeGreaterThanOrEqual(2);

        // Find the non-personal org we just created
        const testOrg = response.body.data.organisations.find(
            (o: any) => o.name === "Test Org 1"
        );
        expect(testOrg).toBeDefined();
        expect(testOrg).toHaveProperty("owner_user_id", mockUserId);
        expect(testOrg).toHaveProperty("is_personal", false);
    });
});

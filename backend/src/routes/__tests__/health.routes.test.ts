import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../../app";

describe("GET /api/health", () => {
    it("should return 200 OK with healthy status", async () => {
        const response = await request(app)
            .get("/api/health")
            .expect(200);

        expect(response.body).toHaveProperty("statusCode", 200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("message", "Health status retrieved successfully");
        expect(response.body.data).toHaveProperty("status", "ok");
        expect(response.body.data).toHaveProperty("database");
    });
});

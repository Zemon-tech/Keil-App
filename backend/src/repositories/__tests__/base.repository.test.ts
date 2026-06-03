import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseRepository } from "../base.repository";
import pool from "../../config/pg";
import { seedUser, seedOrg } from "../../test/helpers";

interface TestOrg {
    id: string;
    name: string;
    owner_user_id: string;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

class TestOrgRepository extends BaseRepository<TestOrg> {
    constructor() {
        super("public.organisations");
    }
}

describe("BaseRepository Unit Tests", () => {
    const repo = new TestOrgRepository();

    const mockUserId = "a1000000-0000-0000-0000-000000000001";
    const mockUserEmail = "repo-user@test.com";
    const mockUserName = "Repo User";

    const orgId = "b1000000-0000-0000-0000-000000000001";
    const orgName = "Repo Test Org";

    beforeEach(async () => {
        vi.restoreAllMocks();

        // Seed required data
        await seedUser(mockUserId, mockUserEmail, mockUserName);
        await seedOrg(orgId, orgName, mockUserId);
    });

    // ── Empty Updates Avoid DB Query ─────────────────────────────────────────────
    describe("update with empty data payloads", () => {
        it("should return the record immediately without executing an UPDATE query when payload is empty", async () => {
            const querySpy = vi.spyOn(pool, "query");

            // Perform update with empty payload {}
            const result = await repo.update(orgId, {});

            expect(result).not.toBeNull();
            expect(result?.name).toBe(orgName);

            // Assert that none of the queries sent to the pool contains "UPDATE"
            const updateQueries = querySpy.mock.calls.filter((call) => {
                const sql = call[0];
                return typeof sql === "string" && sql.toUpperCase().includes("UPDATE");
            });

            expect(updateQueries.length).toBe(0); // No UPDATE queries were hit!
        });

        it("should execute an UPDATE query when updates are actually provided", async () => {
            const querySpy = vi.spyOn(pool, "query");

            // Perform update with modifications
            const result = await repo.update(orgId, { name: "A Brand New Name" });

            expect(result).not.toBeNull();
            expect(result?.name).toBe("A Brand New Name");

            // Assert that the UPDATE query was triggered
            const updateQueries = querySpy.mock.calls.filter((call) => {
                const sql = call[0];
                return typeof sql === "string" && sql.toUpperCase().includes("UPDATE");
            });

            expect(updateQueries.length).toBeGreaterThan(0); // Hit the DB!
        });
    });

    // ── Soft Deletion & Restoration Lifecycle ────────────────────────────────────
    describe("softDelete and restore lifecycle states", () => {
        it("should soft delete a record, filter it out from findById, and restore it successfully", async () => {
            // 1. Soft delete the organisation
            const softDeleted = await repo.softDelete(orgId);
            expect(softDeleted).not.toBeNull();
            expect(softDeleted?.deleted_at).not.toBeNull();

            // 2. Querying normally (exclude soft-deleted) -> should return null
            const foundNormal = await repo.findById(orgId);
            expect(foundNormal).toBeNull();

            // 3. Querying with includeDeleted: true -> should return the record
            const foundWithDeleted = await repo.findById(orgId, undefined, true);
            expect(foundWithDeleted).not.toBeNull();
            expect(foundWithDeleted?.id).toBe(orgId);

            // 4. Restore the organisation
            const restored = await repo.restore(orgId);
            expect(restored).not.toBeNull();
            expect(restored?.deleted_at).toBeNull();

            // 5. Querying normally again -> should return the restored record
            const foundAfterRestore = await repo.findById(orgId);
            expect(foundAfterRestore).not.toBeNull();
            expect(foundAfterRestore?.name).toBe(orgName);
        });
    });
});

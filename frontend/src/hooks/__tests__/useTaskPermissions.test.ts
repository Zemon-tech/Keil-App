import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTaskPermissions } from "../useTaskPermissions";

// Setup mock for AppContext
const mockUseAppContext = vi.fn();
vi.mock("@/contexts/AppContext", () => ({
    useAppContext: () => mockUseAppContext(),
}));

describe("useTaskPermissions Hook Unit Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAppContext.mockReturnValue({
            activeOrgId: null,
            activeSpace: null,
        });
    });

    it("should return default member-level block permissions when task is null or undefined", () => {
        const { result: nullResult } = renderHook(() => useTaskPermissions(null));
        expect(nullResult.current).toEqual({
            spaceRole: "member",
            canEditTask: false,
            canDeleteTask: false,
            canAssignTask: false,
            canChangeAnyStatus: false,
            canChangeAssignedStatus: false,
            canComment: false,
            canDeleteOwnComment: false,
            canDeleteAnyComment: false,
        });

        const { result: undefinedResult } = renderHook(() => useTaskPermissions(undefined));
        expect(undefinedResult.current.canEditTask).toBe(false);
    });

    it("should resolve permission flags using activeSpace.role when task org and space match active context", () => {
        mockUseAppContext.mockReturnValue({
            activeOrgId: "org-1",
            activeSpace: { id: "space-1", role: "manager" },
        });

        const matchingTask = {
            org_id: "org-1",
            space_id: "space-1",
            user_space_role: "member", // Should be ignored in favor of activeSpace.role
        };

        const { result } = renderHook(() => useTaskPermissions(matchingTask));

        expect(result.current).toMatchObject({
            spaceRole: "manager", // Resolved from activeSpace
            canEditTask: true,
            canDeleteTask: true,
            canAssignTask: true,
            canChangeAnyStatus: true,
            canChangeAssignedStatus: true,
            canComment: true,
            canDeleteOwnComment: true,
            canDeleteAnyComment: false,
        });
    });

    it("should resolve permission flags using task.user_space_role when task org and space do not match active context", () => {
        mockUseAppContext.mockReturnValue({
            activeOrgId: "org-1",
            activeSpace: { id: "space-1", role: "member" },
        });

        const nonMatchingTask = {
            org_id: "org-2", // Different org
            space_id: "space-2", // Different space
            user_space_role: "admin", // Should be used instead of activeSpace
        };

        const { result } = renderHook(() => useTaskPermissions(nonMatchingTask));

        expect(result.current).toMatchObject({
            spaceRole: "admin", // Resolved from task.user_space_role
            canEditTask: true,
            canDeleteTask: true,
            canAssignTask: true,
            canChangeAnyStatus: true,
            canChangeAssignedStatus: true,
            canComment: true,
            canDeleteOwnComment: true,
            canDeleteAnyComment: true,
        });
    });

    it("should correctly map all 8 capability flags for each SpaceRole ('member', 'manager', 'admin')", () => {
        mockUseAppContext.mockReturnValue({
            activeOrgId: "org-1",
            activeSpace: { id: "space-1", role: "member" },
        });

        // 1. 'member' role mappings
        const { result: memberResult } = renderHook(() => useTaskPermissions({ org_id: "org-1", space_id: "space-1" }));
        expect(memberResult.current).toMatchObject({
            spaceRole: "member",
            canEditTask: false,
            canDeleteTask: false,
            canAssignTask: false,
            canChangeAnyStatus: false,
            canChangeAssignedStatus: true,
            canComment: true,
            canDeleteOwnComment: true,
            canDeleteAnyComment: false,
        });

        // 2. 'manager' role mappings
        mockUseAppContext.mockReturnValue({
            activeOrgId: "org-1",
            activeSpace: { id: "space-1", role: "manager" },
        });
        const { result: managerResult } = renderHook(() => useTaskPermissions({ org_id: "org-1", space_id: "space-1" }));
        expect(managerResult.current).toMatchObject({
            spaceRole: "manager",
            canEditTask: true,
            canDeleteTask: true,
            canAssignTask: true,
            canChangeAnyStatus: true,
            canChangeAssignedStatus: true,
            canComment: true,
            canDeleteOwnComment: true,
            canDeleteAnyComment: false,
        });

        // 3. 'admin' role mappings
        mockUseAppContext.mockReturnValue({
            activeOrgId: "org-1",
            activeSpace: { id: "space-1", role: "admin" },
        });
        const { result: adminResult } = renderHook(() => useTaskPermissions({ org_id: "org-1", space_id: "space-1" }));
        expect(adminResult.current).toMatchObject({
            spaceRole: "admin",
            canEditTask: true,
            canDeleteTask: true,
            canAssignTask: true,
            canChangeAnyStatus: true,
            canChangeAssignedStatus: true,
            canComment: true,
            canDeleteOwnComment: true,
            canDeleteAnyComment: true,
        });
    });
});

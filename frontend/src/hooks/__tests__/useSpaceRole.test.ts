import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useSpaceRole } from "../useSpaceRole";

// Setup mock for AppContext
const mockUseAppContext = vi.fn();
vi.mock("@/contexts/AppContext", () => ({
    useAppContext: () => mockUseAppContext(),
}));

describe("useSpaceRole Hook Unit Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return correct permissions for a regular 'member' role", () => {
        mockUseAppContext.mockReturnValue({
            activeSpace: { role: "member" },
            activeOrg: { role: "member" },
        });

        const { result } = renderHook(() => useSpaceRole());

        expect(result.current).toMatchObject({
            spaceRole: "member",
            orgRole: "member",
            // Regular members cannot manage spaces or create tasks
            canCreateTask: false,
            canEditTask: false,
            canDeleteTask: false,
            canAssignTask: false,
            canChangeAnyStatus: false,
            // Regular members can write comments and change status of assigned tasks
            canChangeAssignedStatus: true,
            canComment: true,
            canDeleteOwnComment: true,
            canDeleteAnyComment: false,
            canCreatePage: false,
            canEditAnyPage: false,
            canManageSpace: false,
            canInviteToOrg: false,
            canManageOrgMembers: false,
            canManageSpaceMembers: false,
        });
    });

    it("should return correct permissions for a 'manager' role", () => {
        mockUseAppContext.mockReturnValue({
            activeSpace: { role: "manager" },
            activeOrg: { role: "member" },
        });

        const { result } = renderHook(() => useSpaceRole());

        expect(result.current).toMatchObject({
            spaceRole: "manager",
            orgRole: "member",
            // Managers can manage tasks and pages
            canCreateTask: true,
            canEditTask: true,
            canDeleteTask: true,
            canAssignTask: true,
            canChangeAnyStatus: true,
            canChangeAssignedStatus: true,
            canComment: true,
            canDeleteOwnComment: true,
            canDeleteAnyComment: false,
            canCreatePage: true,
            // Managers cannot edit ANY page or manage space/org
            canEditAnyPage: false,
            canManageSpace: false,
            canInviteToOrg: false,
            canManageOrgMembers: false,
            canManageSpaceMembers: false,
        });
    });

    it("should return correct permissions for an 'admin' role", () => {
        mockUseAppContext.mockReturnValue({
            activeSpace: { role: "admin" },
            activeOrg: { role: "member" },
        });

        const { result } = renderHook(() => useSpaceRole());

        expect(result.current).toMatchObject({
            spaceRole: "admin",
            orgRole: "member",
            // Admins get high-level comment, task, and space permissions
            canCreateTask: true,
            canEditTask: true,
            canDeleteTask: true,
            canAssignTask: true,
            canChangeAnyStatus: true,
            canChangeAssignedStatus: true,
            canComment: true,
            canDeleteOwnComment: true,
            canDeleteAnyComment: true,
            canCreatePage: true,
            canEditAnyPage: true,
            canManageSpace: false, // Org owner or admin only
            canInviteToOrg: false,
            canManageOrgMembers: false,
            canManageSpaceMembers: true,
        });
    });

    it("should allow space management and org invites if org role is 'owner' or 'admin'", () => {
        // Test Org Owner role
        mockUseAppContext.mockReturnValue({
            activeSpace: { role: "member" },
            activeOrg: { role: "owner" },
        });

        const { result: ownerResult } = renderHook(() => useSpaceRole());
        expect(ownerResult.current.canManageSpace).toBe(true);
        expect(ownerResult.current.canInviteToOrg).toBe(true);
        expect(ownerResult.current.canManageOrgMembers).toBe(true);

        // Test Org Admin role
        mockUseAppContext.mockReturnValue({
            activeSpace: { role: "member" },
            activeOrg: { role: "admin" },
        });

        const { result: adminResult } = renderHook(() => useSpaceRole());
        expect(adminResult.current.canManageSpace).toBe(true);
        expect(adminResult.current.canInviteToOrg).toBe(true);
        expect(adminResult.current.canManageOrgMembers).toBe(true);
    });
});

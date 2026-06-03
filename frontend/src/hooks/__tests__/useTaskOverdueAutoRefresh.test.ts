import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTaskOverdueAutoRefresh } from "../useTaskOverdueAutoRefresh";

// Setup mocks
const mockInvalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}));

const mockOn = vi.fn();
const mockOff = vi.fn();
const mockSocket = {
    on: mockOn,
    off: mockOff,
};
vi.mock("@/lib/socket", () => ({
    getSocket: () => mockSocket,
}));

vi.mock("@/hooks/api/useTasks", () => ({
    taskKeys: {
        all: ["tasks"],
    },
    orgTaskKeys: {
        all: ["orgTasks"],
        lists: (orgId: string, spaceId: string) => ["orgTasks", "lists", orgId, spaceId],
    },
}));

const mockUseAppContext = vi.fn();
vi.mock("@/contexts/AppContext", () => ({
    useAppContext: () => mockUseAppContext(),
}));

describe("useTaskOverdueAutoRefresh Hook Unit Tests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        mockUseAppContext.mockReturnValue({
            activeOrgId: null,
            activeSpaceId: null,
        });
    });

    // ── Socket event listeners registration & cleanup ───────────────────────────
    it("should register socket listeners on mount and clean them up on unmount", () => {
        const { unmount } = renderHook(() => useTaskOverdueAutoRefresh());

        // Verify listeners are attached
        expect(mockOn).toHaveBeenCalledTimes(2);
        expect(mockOn).toHaveBeenNthCalledWith(1, "task_overdue_moved", expect.any(Function));
        expect(mockOn).toHaveBeenNthCalledWith(2, "gcal_tasks_updated", expect.any(Function));

        // Unmount
        unmount();

        // Verify listeners are detached
        expect(mockOff).toHaveBeenCalledTimes(2);
        expect(mockOff).toHaveBeenNthCalledWith(1, "task_overdue_moved", expect.any(Function));
        expect(mockOff).toHaveBeenNthCalledWith(2, "gcal_tasks_updated", expect.any(Function));
    });

    // ── Socket Events Triggering Invalidations ────────────────────────────────────
    it("should invalidate task queries when 'task_overdue_moved' socket event fires", () => {
        renderHook(() => useTaskOverdueAutoRefresh());

        // Extract the registered handler for 'task_overdue_moved'
        const handleOverdueMoved = mockOn.mock.calls.find((call) => call[0] === "task_overdue_moved")?.[1];
        expect(handleOverdueMoved).toBeDefined();

        // Trigger the handler
        handleOverdueMoved({ id: "task-1", status: "todo" });

        // Verify query invalidations were triggered
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ["orgTasks"] });
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ["tasks"] });
    });

    it("should invalidate task queries when 'gcal_tasks_updated' socket event fires", () => {
        renderHook(() => useTaskOverdueAutoRefresh());

        // Extract the registered handler for 'gcal_tasks_updated'
        const handleGcalUpdated = mockOn.mock.calls.find((call) => call[0] === "gcal_tasks_updated")?.[1];
        expect(handleGcalUpdated).toBeDefined();

        // Trigger the handler
        handleGcalUpdated();

        // Verify query invalidations were triggered
        expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ["orgTasks"] });
        expect(mockInvalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ["tasks"] });
    });

    // ── Local Interval Refresh & Cleanup ──────────────────────────────────────────
    it("should run a local interval timer that refreshes active lists and cleans up on unmount", () => {
        vi.useFakeTimers();

        mockUseAppContext.mockReturnValue({
            activeOrgId: "org-123",
            activeSpaceId: "space-456",
        });

        const { unmount } = renderHook(() => useTaskOverdueAutoRefresh());

        // Forward time by 30 seconds (1 interval step)
        vi.advanceTimersByTime(30000);

        // Verify local invalidation was triggered for active list
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ["orgTasks", "lists", "org-123", "space-456"],
        });

        // Clear mock history
        mockInvalidateQueries.mockClear();

        // Unmount hook -> should clear the interval
        unmount();

        // Forward time by another 30 seconds
        vi.advanceTimersByTime(30000);

        // Invalidation should NOT have been called after unmounting
        expect(mockInvalidateQueries).not.toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("should not trigger local interval invalidations if activeOrgId or activeSpaceId are null", () => {
        vi.useFakeTimers();

        mockUseAppContext.mockReturnValue({
            activeOrgId: null,
            activeSpaceId: null,
        });

        renderHook(() => useTaskOverdueAutoRefresh());

        // Forward time by 30 seconds
        vi.advanceTimersByTime(30000);

        // Invalidation should not have been called because active context is null
        expect(mockInvalidateQueries).not.toHaveBeenCalled();

        vi.useRealTimers();
    });
});

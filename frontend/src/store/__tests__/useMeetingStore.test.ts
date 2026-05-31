import { describe, it, expect, beforeEach } from "vitest";
import { useMeetingStore } from "../useMeetingStore";

describe("useMeetingStore Zustand Store", () => {
    beforeEach(() => {
        // Reset the store to initial values before each test
        useMeetingStore.getState().reset();
    });

    it("should toggle dialog open/close/minimize/restore", () => {
        expect(useMeetingStore.getState().isDialogOpen).toBe(false);
        expect(useMeetingStore.getState().isMinimized).toBe(false);

        // Open Dialog
        useMeetingStore.getState().openDialog("meeting-uuid-123");
        expect(useMeetingStore.getState().isDialogOpen).toBe(true);
        expect(useMeetingStore.getState().meetingId).toBe("meeting-uuid-123");
        expect(useMeetingStore.getState().isMinimized).toBe(false);

        // Minimize Dialog
        useMeetingStore.getState().minimizeDialog();
        expect(useMeetingStore.getState().isDialogOpen).toBe(false);
        expect(useMeetingStore.getState().isMinimized).toBe(true);

        // Restore Dialog
        useMeetingStore.getState().restoreDialog();
        expect(useMeetingStore.getState().isDialogOpen).toBe(true);
        expect(useMeetingStore.getState().isMinimized).toBe(false);

        // Close Dialog
        useMeetingStore.getState().closeDialog();
        expect(useMeetingStore.getState().isDialogOpen).toBe(false);
        expect(useMeetingStore.getState().isMinimized).toBe(false);
    });

    it("should set duration correctly with value and function updates", () => {
        expect(useMeetingStore.getState().duration).toBe(0);

        // Direct value update
        useMeetingStore.getState().setDuration(10);
        expect(useMeetingStore.getState().duration).toBe(10);

        // Functional value update
        useMeetingStore.getState().setDuration((prev) => prev + 5);
        expect(useMeetingStore.getState().duration).toBe(15);
    });

    it("should handle status changes and control actions", () => {
        expect(useMeetingStore.getState().status).toBe("idle");
        expect(useMeetingStore.getState().requestAction).toBeNull();

        // Pause action request
        useMeetingStore.getState().setRequestAction("pause");
        expect(useMeetingStore.getState().requestAction).toBe("pause");

        // Status update
        useMeetingStore.getState().setStatus("recording");
        expect(useMeetingStore.getState().status).toBe("recording");
    });

    it("should reset to initial state cleanly", () => {
        useMeetingStore.getState().openDialog("meeting-456");
        useMeetingStore.getState().setStatus("recording");
        useMeetingStore.getState().setDuration(120);
        useMeetingStore.getState().setVolumes([0.1, 0.2, 0.3]);
        useMeetingStore.getState().setRequestAction("stop");

        // Execute reset
        useMeetingStore.getState().reset();

        const state = useMeetingStore.getState();
        expect(state.status).toBe("idle");
        expect(state.duration).toBe(0);
        expect(state.meetingId).toBeNull();
        expect(state.isDialogOpen).toBe(false);
        expect(state.isMinimized).toBe(false);
        expect(state.requestAction).toBeNull();
        expect(state.volumes).toEqual([0.05, 0.05, 0.05, 0.05, 0.05]);
    });
});

import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "../useChatStore";

describe("useChatStore Zustand Store", () => {
    beforeEach(() => {
        // Reset the store to initial values before each test
        useChatStore.setState({
            isChatOpen: false,
            isChatDialogOpen: false,
            activeChannelId: null,
            typingUsers: {},
        });
    });

    it("should toggle chat open and close states", () => {
        expect(useChatStore.getState().isChatOpen).toBe(false);

        useChatStore.getState().openChat();
        expect(useChatStore.getState().isChatOpen).toBe(true);

        useChatStore.getState().closeChat();
        expect(useChatStore.getState().isChatOpen).toBe(false);
        expect(useChatStore.getState().activeChannelId).toBeNull();
    });

    it("should toggle chat dialog open and close states", () => {
        expect(useChatStore.getState().isChatDialogOpen).toBe(false);

        useChatStore.getState().openChatDialog();
        expect(useChatStore.getState().isChatDialogOpen).toBe(true);

        useChatStore.getState().closeChatDialog();
        expect(useChatStore.getState().isChatDialogOpen).toBe(false);
    });

    it("should set the active channel correctly", () => {
        expect(useChatStore.getState().activeChannelId).toBeNull();

        useChatStore.getState().setActiveChannel("channel-123");
        expect(useChatStore.getState().activeChannelId).toBe("channel-123");

        useChatStore.getState().setActiveChannel(null);
        expect(useChatStore.getState().activeChannelId).toBeNull();
    });

    it("should handle adding and removing typing users dynamically", () => {
        const channelId = "channel-abc";
        const userId = "user-789";
        const userName = "Alice";

        // Initial state
        expect(useChatStore.getState().typingUsers[channelId]).toBeUndefined();

        // Add typing user
        useChatStore.getState().addTypingUser(channelId, userId, userName);
        let typing = useChatStore.getState().typingUsers[channelId];
        expect(typing).toHaveLength(1);
        expect(typing[0]).toEqual({ userId, name: userName });

        // Add duplicate typing user - should ignore
        useChatStore.getState().addTypingUser(channelId, userId, userName);
        typing = useChatStore.getState().typingUsers[channelId];
        expect(typing).toHaveLength(1);

        // Remove typing user
        useChatStore.getState().removeTypingUser(channelId, userId);
        typing = useChatStore.getState().typingUsers[channelId];
        expect(typing).toHaveLength(0);
    });
});

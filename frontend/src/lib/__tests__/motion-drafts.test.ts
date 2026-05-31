import { describe, it, expect, beforeEach, vi } from "vitest";
import { saveDraft, getDraft, clearDraft } from "../motion-drafts";

describe("motion-drafts utility", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should save draft content with a timestamp to localStorage", () => {
    const pageId = "test-page-1";
    const content = { type: "doc", content: [{ type: "paragraph", text: "Hello draft" }] };

    saveDraft(pageId, content);

    const raw = localStorage.getItem(`motion:draft:${pageId}`);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!);
    expect(parsed.pageId).toBe(pageId);
    expect(parsed.content).toEqual(content);
    expect(parsed.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it("should retrieve a fresh draft younger than 24 hours", () => {
    const pageId = "test-page-2";
    const content = { type: "doc", content: [{ type: "paragraph", text: "Fresh changes" }] };

    saveDraft(pageId, content);

    const retrieved = getDraft(pageId);
    expect(retrieved).toEqual(content);
  });

  it("should return null and clear the draft if it is older than 24 hours", () => {
    const pageId = "test-page-3";
    const content = { type: "doc", content: [{ type: "paragraph", text: "Stale changes" }] };

    // Save normally first
    saveDraft(pageId, content);

    // Mock Date.now() to simulate 25 hours later
    const twentyFiveHoursMs = 25 * 60 * 60 * 1000;
    const futureTime = Date.now() + twentyFiveHoursMs;
    const dateSpy = vi.spyOn(Date, "now").mockReturnValue(futureTime);

    const retrieved = getDraft(pageId);
    expect(retrieved).toBeNull();

    // Verify draft was cleared from localStorage
    const raw = localStorage.getItem(`motion:draft:${pageId}`);
    expect(raw).toBeNull();

    dateSpy.mockRestore();
  });

  it("should clear the draft when clearDraft is called", () => {
    const pageId = "test-page-4";
    const content = { type: "doc", content: [{ type: "paragraph", text: "To be cleared" }] };

    saveDraft(pageId, content);
    expect(localStorage.getItem(`motion:draft:${pageId}`)).toBeTruthy();

    clearDraft(pageId);
    expect(localStorage.getItem(`motion:draft:${pageId}`)).toBeNull();
  });

  it("should handle localStorage quota errors silently", () => {
    const pageId = "test-page-5";
    const content = { type: "doc", content: [{ type: "paragraph", text: "Quota full" }] };

    // Mock localStorage.setItem to throw an error
    const setItemSpy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Should not crash the application
    expect(() => saveDraft(pageId, content)).not.toThrow();
    expect(consoleWarnSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});

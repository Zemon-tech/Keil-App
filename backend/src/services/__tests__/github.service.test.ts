import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getGitHubAuthUrl,
  handleGitHubCallback,
  listIssues,
  listPullRequests,
  listContributors,
  createIssue,
  linkTaskToGitHubIssue,
} from "../github.service";
import { integrationRepository } from "../../repositories";
import pool from "../../config/pg";

// Mock the integrations repository
vi.mock("../../repositories", () => {
  return {
    integrationRepository: {
      findByUserAndProvider: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  };
});

// Mock pg pool
vi.mock("../../config/pg", () => {
  return {
    default: {
      query: vi.fn(),
    },
  };
});

// Mock config
vi.mock("../../config", () => {
  return {
    config: {
      githubClientId: "mock-client-id",
      githubClientSecret: "mock-client-secret",
      githubRedirectUri: "http://localhost:5000/api/v1/integrations/github/callback",
      frontendUrl: "http://localhost:5173",
    },
  };
});

describe("GitHub Service Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe("getGitHubAuthUrl", () => {
    it("should return correct GitHub OAuth URL", () => {
      const url = getGitHubAuthUrl("test-user-id");
      expect(url).toContain("https://github.com/login/oauth/authorize");
      expect(url).toContain("client_id=mock-client-id");
      expect(url).toContain("state=test-user-id");
      expect(url).toContain("scope=repo+read%3Auser+read%3Aorg");
    });
  });

  describe("handleGitHubCallback", () => {
    it("should exchange code for access token and upsert integration", async () => {
      const mockTokenResponse = {
        access_token: "mock-access-token",
      };

      // Mock global fetch
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTokenResponse,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await handleGitHubCallback("mock-code", "test-user-id");

      expect(result).toEqual({ userId: "test-user-id" });
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://github.com/login/oauth/access_token",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            client_id: "mock-client-id",
            client_secret: "mock-client-secret",
            code: "mock-code",
            redirect_uri: "http://localhost:5000/api/v1/integrations/github/callback",
          }),
        })
      );
      expect(integrationRepository.upsert).toHaveBeenCalledWith(
        "test-user-id",
        "github",
        {
          access_token: "mock-access-token",
          refresh_token: "",
          token_expiry: null,
        }
      );
    });
  });

  describe("GitHub API Operations", () => {
    const mockUserId = "test-user-id";
    const mockRepo = "test-owner/test-repo";

    beforeEach(() => {
      vi.mocked(integrationRepository.findByUserAndProvider).mockResolvedValue({
        id: "integration-id",
        user_id: mockUserId,
        provider: "github",
        access_token: "mock-access-token",
        refresh_token: "",
        token_expiry: null,
        calendar_id: "",
        created_at: new Date(),
        updated_at: new Date(),
        watch_channel_id: null,
        watch_resource_id: null,
        watch_expires_at: null,
        watch_status: undefined,
        gcal_sync_token: null,
        last_sync_at: null,
      });
    });

    it("should list issues filtering out pull requests", async () => {
      const mockIssuesResponse = [
        {
          number: 1,
          title: "Test Issue 1",
          state: "open",
          html_url: "url1",
          comments: 0,
          created_at: "2026-06-04T00:00:00Z",
          updated_at: "2026-06-04T00:00:00Z",
          user: { login: "user1" },
        },
        {
          number: 2,
          title: "Test PR 2",
          state: "open",
          html_url: "url2",
          comments: 0,
          created_at: "2026-06-04T00:00:00Z",
          updated_at: "2026-06-04T00:00:00Z",
          user: { login: "user2" },
          pull_request: {}, // Marks this issue as a PR
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockIssuesResponse,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await listIssues(mockUserId, mockRepo);

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/repos/${mockRepo}/issues?state=open`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-access-token",
          }),
        })
      );
    });

    it("should list pull requests", async () => {
      const mockPRsResponse = [
        {
          number: 3,
          title: "Test PR 3",
          state: "open",
          html_url: "url3",
          user: { login: "user3" },
          created_at: "2026-06-04T00:00:00Z",
          updated_at: "2026-06-04T00:00:00Z",
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockPRsResponse,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await listPullRequests(mockUserId, mockRepo);

      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(3);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/repos/${mockRepo}/pulls?state=open`),
        anyObject()
      );
    });

    it("should list contributors", async () => {
      const mockContributorsResponse = [
        {
          login: "contrib1",
          contributions: 5,
          html_url: "html_url_contrib1",
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockContributorsResponse,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await listContributors(mockUserId, mockRepo);

      expect(result).toHaveLength(1);
      expect(result[0].login).toBe("contrib1");
      expect(result[0].contributions).toBe(5);
    });

    it("should create a GitHub issue", async () => {
      const mockIssueResponse = {
        number: 42,
        html_url: "https://github.com/test-owner/test-repo/issues/42",
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockIssueResponse,
      });
      vi.stubGlobal("fetch", fetchSpy);

      const result = await createIssue(mockUserId, mockRepo, "Issue Title", "Issue Body");

      expect(result).toEqual({ number: 42, html_url: "https://github.com/test-owner/test-repo/issues/42" });
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/repos/${mockRepo}/issues`),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Issue Title", body: "Issue Body" }),
        })
      );
    });
  });

  describe("linkTaskToGitHubIssue", () => {
    it("should run update query on database for task", async () => {
      const querySpy = vi.spyOn(pool, "query").mockResolvedValue({} as any);

      await linkTaskToGitHubIssue("task-id-123", false, "issue-url", 42, "owner/repo");

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE public.tasks"),
        ["issue-url", 42, "owner/repo", "task-id-123"]
      );
    });

    it("should run update query on database for personal task", async () => {
      const querySpy = vi.spyOn(pool, "query").mockResolvedValue({} as any);

      await linkTaskToGitHubIssue("task-id-456", true, "issue-url", 42, "owner/repo");

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE public.personal_tasks"),
        ["issue-url", 42, "owner/repo", "task-id-456"]
      );
    });
  });
});

// Helper for loose object matching in tests
function anyObject() {
  return expect.any(Object);
}

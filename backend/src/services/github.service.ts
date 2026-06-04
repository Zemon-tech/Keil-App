import { config } from '../config';
import { integrationRepository } from '../repositories';
import { ApiError } from '../utils/ApiError';
import { createServiceLogger } from '../lib/logger';
import pool from '../config/pg';

const log = createServiceLogger('github-integration');
const PROVIDER = 'github';

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  user: {
    login: string;
  };
  comments: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  html_url: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GitHubContributor {
  login: string;
  contributions: number;
  html_url: string;
}

/**
 * Generate GitHub OAuth authorization URL
 */
export function getGitHubAuthUrl(userId: string): string {
  if (!config.githubClientId || !config.githubRedirectUri) {
    throw new ApiError(500, 'GitHub OAuth is not configured on this server');
  }

  const scopes = ['repo', 'read:user', 'read:org'].join(' ');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.append('client_id', config.githubClientId);
  url.searchParams.append('redirect_uri', config.githubRedirectUri);
  url.searchParams.append('scope', scopes);
  url.searchParams.append('state', userId);

  return url.toString();
}

/**
 * Handle callback from GitHub OAuth redirect
 */
export async function handleGitHubCallback(code: string, state: string): Promise<{ userId: string }> {
  const userId = state;
  if (!userId) {
    throw new ApiError(400, 'Invalid state parameter');
  }

  if (!config.githubClientId || !config.githubClientSecret) {
    throw new ApiError(500, 'GitHub OAuth is not configured on this server');
  }

  log.info({ userId }, 'Exchanging authorization code for token');

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
      redirect_uri: config.githubRedirectUri,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error({ errorText }, 'Failed to exchange GitHub auth code');
    throw new ApiError(500, 'Failed to obtain GitHub access token');
  }

  const tokenData = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error || !tokenData.access_token) {
    log.error({ tokenData }, 'GitHub OAuth error response');
    throw new ApiError(400, tokenData.error_description || 'GitHub OAuth authorization failed');
  }

  // Save the integration
  await integrationRepository.upsert(userId, PROVIDER, {
    access_token: tokenData.access_token,
    refresh_token: '', // GitHub tokens don't use standard refresh token flow in standard web app flow
    token_expiry: null,
  });

  log.info({ userId }, 'GitHub integration successfully saved');

  return { userId };
}

/**
 * Make an authenticated fetch request to GitHub API
 */
async function githubFetch(userId: string, path: string, options: RequestInit = {}): Promise<any> {
  const integration = await integrationRepository.findByUserAndProvider(userId, PROVIDER);
  if (!integration || !integration.access_token) {
    throw new ApiError(401, 'GitHub account is not connected');
  }

  const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${integration.access_token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'KeilHQ-App',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    log.error({ url, status: response.status, errorData }, 'GitHub API Request failed');
    throw new ApiError(response.status, errorData.message || 'GitHub API error');
  }

  return response.json();
}

/**
 * Fetch issues for a repository
 */
export async function listIssues(
  userId: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<GitHubIssue[]> {
  try {
    const data = await githubFetch(userId, `/repos/${repo}/issues?state=${state}&per_page=30`);
    // GitHub API returns pull requests in the issues list, filter them out
    return (data as any[]).filter((issue) => !issue.pull_request) as GitHubIssue[];
  } catch (err: any) {
    log.error({ err, repo }, 'Error listing GitHub issues');
    throw err;
  }
}

/**
 * Fetch a single issue by number
 */
export async function getIssue(userId: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
  try {
    return await githubFetch(userId, `/repos/${repo}/issues/${issueNumber}`);
  } catch (err: any) {
    log.error({ err, repo, issueNumber }, 'Error fetching GitHub issue');
    throw err;
  }
}

/**
 * Fetch pull requests for a repository
 */
export async function listPullRequests(
  userId: string,
  repo: string,
  state: 'open' | 'closed' | 'all' = 'open'
): Promise<GitHubPullRequest[]> {
  try {
    const data = await githubFetch(userId, `/repos/${repo}/pulls?state=${state}&per_page=30`);
    return data as GitHubPullRequest[];
  } catch (err: any) {
    log.error({ err, repo }, 'Error listing GitHub pull requests');
    throw err;
  }
}

/**
 * Fetch contributors for a repository
 */
export async function listContributors(userId: string, repo: string): Promise<GitHubContributor[]> {
  try {
    const data = await githubFetch(userId, `/repos/${repo}/contributors?per_page=30`);
    return (data as any[]).map((c) => ({
      login: c.login,
      contributions: c.contributions,
      html_url: c.html_url,
    })) as GitHubContributor[];
  } catch (err: any) {
    log.error({ err, repo }, 'Error listing GitHub contributors');
    throw err;
  }
}

/**
 * Create a GitHub issue
 */
export async function createIssue(
  userId: string,
  repo: string,
  title: string,
  body: string
): Promise<{ number: number; html_url: string }> {
  try {
    const response = await githubFetch(userId, `/repos/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return {
      number: response.number,
      html_url: response.html_url,
    };
  } catch (err: any) {
    log.error({ err, repo, title }, 'Error creating GitHub issue');
    throw err;
  }
}

/**
 * Link a KeilHQ task to a GitHub issue in the database
 */
export async function linkTaskToGitHubIssue(
  taskId: string,
  isPersonal: boolean,
  issueUrl: string,
  issueNumber: number,
  repo: string
): Promise<void> {
  const tableName = isPersonal ? 'public.personal_tasks' : 'public.tasks';
  try {
    await pool.query(
      `UPDATE ${tableName}
       SET github_issue_url = $1,
           github_issue_number = $2,
           github_repo = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [issueUrl, issueNumber, repo, taskId]
    );
  } catch (err: any) {
    log.error({ err, taskId, tableName }, 'Error linking task to GitHub issue');
    throw new ApiError(500, 'Failed to link task to GitHub issue in database');
  }
}


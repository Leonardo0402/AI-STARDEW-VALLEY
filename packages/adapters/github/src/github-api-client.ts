/**
 * GitHubApiClient — 调用 GitHub REST API，返回 fixture 类型。
 *
 * 职责：
 * - 鉴权（Bearer token）
 * - 分页（Link header）
 * - rate limit 感知（X-RateLimit-* headers）
 * - N+1 comments / reviews 拉取
 * - raw GitHub JSON → GitHubIssueFixture / GitHubPRFixture
 *
 * 不依赖 GitHubRuntimeAdapter，可独立测试。
 */
import type {
  GitHubIssueFixture,
  GitHubPRFixture,
  GitHubComment,
  GitHubReview,
  GitHubLabel,
  GitHubUser,
} from "./types.js";

export interface GitHubApiClientOptions {
  token: string;
  baseUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimitRemaining?: number,
    public readonly rateLimitReset?: number,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

interface RawGetResult {
  body: unknown;
  headers: Headers;
  status: number;
}

export class GitHubApiClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;

  constructor(options: GitHubApiClientOptions) {
    this.token = options.token;
    this.baseUrl = options.baseUrl ?? "https://api.github.com";
    this.userAgent = options.userAgent ?? "agent-office-github-adapter";
    this.timeoutMs = options.timeoutMs ?? 30000;
  }

  async fetchIssues(owner: string, repo: string): Promise<GitHubIssueFixture[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues?state=all&per_page=100`;
    const pages = await this.paginate<unknown>(url);
    // 过滤掉 PR（issues endpoint 也返回 PR，有 pull_request 字段）
    const issueJsons = pages.filter((j) => !(j as { pull_request?: unknown }).pull_request);
    const issues: GitHubIssueFixture[] = [];
    for (const json of issueJsons) {
      const issue = this.mapIssue(json as RawIssue);
      const comments = await this.fetchComments(owner, repo, issue.number);
      issue.comments = comments;
      issues.push(issue);
    }
    return issues;
  }

  async fetchIssuesSince(owner: string, repo: string, since: string): Promise<GitHubIssueFixture[]> {
    if (!since) return this.fetchIssues(owner, repo);
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues?state=all&per_page=100&since=${encodeURIComponent(since)}`;
    const pages = await this.paginate<unknown>(url);
    const issueJsons = pages.filter((j) => !(j as { pull_request?: unknown }).pull_request);
    const issues: GitHubIssueFixture[] = [];
    for (const json of issueJsons) {
      const issue = this.mapIssue(json as RawIssue);
      const comments = await this.fetchComments(owner, repo, issue.number);
      issue.comments = comments;
      issues.push(issue);
    }
    return issues;
  }

  async fetchPRs(owner: string, repo: string): Promise<GitHubPRFixture[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls?state=all&per_page=100`;
    const pages = await this.paginate<RawPR>(url);
    const prs: GitHubPRFixture[] = [];
    for (const json of pages) {
      const pr = this.mapPR(json);
      const reviews = await this.fetchReviews(owner, repo, pr.number);
      pr.reviews = reviews;
      const comments = await this.fetchComments(owner, repo, pr.number);
      pr.comments = comments;
      prs.push(pr);
    }
    return prs;
  }

  async fetchPRsSince(owner: string, repo: string, since: string): Promise<GitHubPRFixture[]> {
    if (!since) return this.fetchPRs(owner, repo);
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=updated&direction=desc`;
    const prs: GitHubPRFixture[] = [];
    let currentUrl: string | undefined = url;

    while (currentUrl) {
      const result = await this.rawGet(currentUrl);
      const items = result.body as RawPR[];
      if (!Array.isArray(items)) break;

      for (const json of items) {
        if (json.updated_at <= since) {
          return prs;
        }
        const pr = this.mapPR(json);
        pr.reviews = await this.fetchReviews(owner, repo, pr.number);
        pr.comments = await this.fetchComments(owner, repo, pr.number);
        prs.push(pr);
      }

      const link = result.headers.get("link");
      currentUrl = this.parseLinkHeader(link).next;
    }
    return prs;
  }

  // ─── 私有方法 ───────────────────────────────────────────

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": this.userAgent,
    };
    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async rawGet(url: string): Promise<RawGetResult> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: this.buildHeaders(),
        signal: ac.signal,
      });
      const text = await resp.text();
      let body: unknown = text;
      const ct = resp.headers.get("content-type") ?? "";
      if (ct.includes("application/json") || text.startsWith("{") || text.startsWith("[")) {
        try {
          body = JSON.parse(text);
        } catch {
          // keep body as text
        }
      }
      if (!resp.ok) {
        const remaining = resp.headers.get("x-ratelimit-remaining");
        const reset = resp.headers.get("x-ratelimit-reset");
        throw new GitHubApiError(
          `GitHub API error: HTTP ${resp.status} for ${url}`,
          resp.status,
          remaining !== null ? parseInt(remaining, 10) : undefined,
          reset !== null ? parseInt(reset, 10) : undefined,
        );
      }
      await this.waitForRateLimit(resp.headers);
      return { body, headers: resp.headers, status: resp.status };
    } catch (err) {
      if (err instanceof GitHubApiError) throw err;
      if (ac.signal.aborted) {
        throw new GitHubApiError(
          `Request timed out after ${this.timeoutMs}ms: ${url}`,
          0,
        );
      }
      throw new GitHubApiError(
        err instanceof Error ? err.message : String(err),
        0,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private parseLinkHeader(link: string | null): { next?: string } {
    if (!link) return {};
    const nextMatch = link.match(/<([^>]+)>;\s*rel="next"/);
    return nextMatch ? { next: nextMatch[1] } : {};
  }

  private async waitForRateLimit(headers: Headers): Promise<void> {
    const remaining = headers.get("x-ratelimit-remaining");
    if (remaining === null) return;
    const remainingNum = parseInt(remaining, 10);
    if (remainingNum > 0) return;

    const reset = headers.get("x-ratelimit-reset");
    if (reset === null) return;
    const resetSec = parseInt(reset, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    const waitSec = resetSec - nowSec;

    if (waitSec > 60) {
      throw new GitHubApiError(
        `Rate limit exhausted; reset in ${waitSec}s (exceeds 60s threshold)`,
        403,
        0,
        resetSec,
      );
    }

    if (waitSec > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, waitSec * 1000));
    }
  }

  private async paginate<T>(url: string): Promise<T[]> {
    const all: T[] = [];
    let currentUrl: string | undefined = url;
    while (currentUrl) {
      const result = await this.rawGet(currentUrl);
      const items = result.body as T[];
      if (Array.isArray(items)) {
        all.push(...items);
      }
      const link = result.headers.get("link");
      currentUrl = this.parseLinkHeader(link).next;
    }
    return all;
  }

  private async fetchComments(owner: string, repo: string, number: number): Promise<GitHubComment[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`;
    const pages = await this.paginate<RawComment>(url);
    return pages.map((c) => this.mapComment(c));
  }

  private async fetchReviews(owner: string, repo: string, number: number): Promise<GitHubReview[]> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}/pulls/${number}/reviews?per_page=100`;
    const pages = await this.paginate<RawReview>(url);
    return pages.map((r) => this.mapReview(r));
  }

  // ─── JSON 映射 ─────────────────────────────────────────

  private mapIssue(j: RawIssue): GitHubIssueFixture {
    return {
      number: j.number,
      url: j.html_url,
      title: j.title,
      body: j.body ?? "",
      state: j.state as "open" | "closed",
      stateReason: j.state_reason as GitHubIssueFixture["stateReason"],
      labels: (j.labels ?? []).map((l) => ({ name: l.name, color: l.color })),
      assignees: (j.assignees ?? []).map((a) => ({ login: a.login, url: a.url })),
      createdAt: j.created_at,
      updatedAt: j.updated_at,
      closedAt: j.closed_at,
      comments: [],
    };
  }

  private mapPR(j: RawPR): GitHubPRFixture {
    return {
      number: j.number,
      url: j.html_url,
      title: j.title,
      body: j.body ?? "",
      state: j.state as "open" | "closed",
      draft: j.draft ?? false,
      merged: j.merged ?? false,
      mergedAt: j.merged_at,
      mergedBy: j.merged_by ? { login: j.merged_by.login, url: j.merged_by.url } : null,
      mergeCommitSha: j.merge_commit_sha,
      headRef: j.head?.ref ?? "",
      baseRef: j.base?.ref ?? "",
      labels: (j.labels ?? []).map((l) => ({ name: l.name, color: l.color })),
      requestedReviewers: (j.requested_reviewers ?? []).map((r) => ({ login: r.login, url: r.url })),
      reviews: [],
      comments: [],
      createdAt: j.created_at,
      updatedAt: j.updated_at,
      closedAt: j.closed_at,
    };
  }

  private mapComment(j: RawComment): GitHubComment {
    return {
      author: { login: j.user.login, url: j.user.url },
      body: j.body ?? "",
      createdAt: j.created_at,
    };
  }

  private mapReview(j: RawReview): GitHubReview {
    return {
      author: { login: j.user.login, url: j.user.url },
      state: j.state as GitHubReview["state"],
      body: j.body ?? "",
      submittedAt: j.submitted_at,
    };
  }
}

// ─── Raw GitHub JSON 类型（仅内部用） ────────────────────

interface RawLabel { name: string; color?: string; }
interface RawUser { login: string; url?: string; }
interface RawComment { user: RawUser; body?: string; created_at: string; }
interface RawReview { user: RawUser; state: string; body?: string; submitted_at: string; }

interface RawIssue {
  number: number;
  html_url: string;
  title: string;
  body?: string;
  state: string;
  state_reason?: string;
  labels?: RawLabel[];
  assignees?: RawUser[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: unknown;
}

interface RawPR {
  number: number;
  html_url: string;
  title: string;
  body?: string;
  state: string;
  draft?: boolean;
  merged?: boolean;
  merged_at: string | null;
  merged_by?: RawUser | null;
  merge_commit_sha: string | null;
  head?: { ref: string };
  base?: { ref: string };
  labels?: RawLabel[];
  requested_reviewers?: RawUser[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

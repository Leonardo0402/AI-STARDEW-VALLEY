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
  /** 必填。生产从 process.env.GITHUB_TOKEN 读；测试传 ""（不发 Authorization header）。 */
  token: string;
  /** 默认 "https://api.github.com"。测试可指向 msw server。 */
  baseUrl?: string;
  /** 默认 "agent-office-github-adapter"。 */
  userAgent?: string;
  /** 默认 30000。 */
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
    throw new Error("not implemented");
  }

  async fetchPRs(owner: string, repo: string): Promise<GitHubPRFixture[]> {
    throw new Error("not implemented");
  }
}

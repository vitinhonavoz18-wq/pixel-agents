export interface GithubRepoSummary {
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  description: string | null;
  pushedAt: string | null;
  htmlUrl: string;
}

interface GhRepo {
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  description: string | null;
  pushed_at: string | null;
  html_url: string;
}

const toSummary = (r: GhRepo): GithubRepoSummary => ({
  owner: r.owner.login,
  name: r.name,
  fullName: r.full_name,
  private: r.private,
  defaultBranch: r.default_branch,
  description: r.description,
  pushedAt: r.pushed_at,
  htmlUrl: r.html_url,
});

/**
 * Lists only the repositories the backend's GitHub token can already see
 * (fine-grained PAT or GitHub App installation token), optionally narrowed by
 * AGENCY_ALLOWED_REPO_OWNERS. A project can only point at one of these.
 */
export class GithubService {
  constructor(
    private readonly token: string | undefined,
    private readonly allowedOwners: string[],
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get configured(): boolean {
    return Boolean(this.token);
  }

  private async gh<T>(pathname: string): Promise<T> {
    if (!this.token) throw new Error('AGENCY_GITHUB_TOKEN não configurado no backend');
    const res = await this.fetchFn(`https://api.github.com${pathname}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'pixel-agency-backend',
      },
    });
    if (!res.ok) throw new Error(`GitHub respondeu ${res.status} para ${pathname}`);
    return (await res.json()) as T;
  }

  ownerAllowed(owner: string): boolean {
    return (
      this.allowedOwners.length === 0 ||
      this.allowedOwners.some((o) => o.toLowerCase() === owner.toLowerCase())
    );
  }

  async listRepos(): Promise<GithubRepoSummary[]> {
    let repos: GhRepo[];
    try {
      repos = await this.gh<GhRepo[]>('/user/repos?per_page=100&sort=pushed');
    } catch {
      // GitHub App installation tokens have no /user — use the installation list.
      const inst = await this.gh<{ repositories: GhRepo[] }>(
        '/installation/repositories?per_page=100',
      );
      repos = inst.repositories;
    }
    return repos.map(toSummary).filter((r) => this.ownerAllowed(r.owner));
  }

  async getRepo(owner: string, name: string): Promise<GithubRepoSummary> {
    if (!this.ownerAllowed(owner))
      throw new Error(`Owner ${owner} fora de AGENCY_ALLOWED_REPO_OWNERS`);
    return toSummary(
      await this.gh<GhRepo>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`),
    );
  }
}

/**
 * GitHub analysis API route.
 *
 * This endpoint accepts a public GitHub repository URL and returns a compact
 * report assembled from GitHub's REST API. It never clones, stores, or changes
 * the source repository.
 */

/** The repository fields used from GitHub's `/repos/{owner}/{repo}` response. */
type GitHubRepository = {
    full_name: string;
    default_branch: string;
    private: boolean;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    size: number;
    language: string | null;
  };
  
  type GitHubTreeEntry = { path: string; type: string; sha: string };
  
  /** Validates a GitHub URL and returns the `owner/repository` API path. */
  function getRepositoryPath(value: string) {
    const url = new URL(value);
  
    if (url.hostname !== "github.com") {
      throw new Error("Enter a github.com repository URL.");
    }
  
    const [owner, repository] = url.pathname
      .replace(/^\//, "")
      .replace(/\.git$/, "")
      .split("/");
  
    if (!owner || !repository) {
      throw new Error("Enter a repository URL in the form github.com/owner/repo.");
    }
  
    return `${owner}/${repository}`;
  }
  
  /** Builds a top-level folder list and counts files contained in each folder. */
  function summarizeFolders(tree: GitHubTreeEntry[]) {
    return tree
      .filter((entry) => entry.type === "tree" && !entry.path.includes("/"))
      .map((entry) => ({
        name: entry.path,
        files: tree.filter((child) => child.type === "blob" && child.path.startsWith(`${entry.path}/`)).length,
      }));
  }
  
  /**
   * Fetches a live public GitHub report for the URL included in the request body.
   * Private repositories work when the server has a read-only `GITHUB_TOKEN`.
   */
  export async function POST(request: Request) {
    try {
      const { url } = await request.json() as { url?: string };
  
      if (!url) {
        return Response.json({ error: "A repository URL is required." }, { status: 400 });
      }
  
      const path = getRepositoryPath(url);
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };
  
      // Optional fine-grained token enables private repositories and higher limits.
      if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      }
  
      const [repositoryResponse, commitsResponse, pullsResponse, languagesResponse] = await Promise.all([
        fetch(`https://api.github.com/repos/${path}`, { headers }),
        fetch(`https://api.github.com/repos/${path}/commits?per_page=10`, { headers }),
        fetch(`https://api.github.com/repos/${path}/pulls?state=all&per_page=6`, { headers }),
        fetch(`https://api.github.com/repos/${path}/languages`, { headers }),
      ]);
  
      if (!repositoryResponse.ok) {
        const error = repositoryResponse.status === 404
          ? "Repository not found or not accessible."
          : "GitHub could not analyze this repository right now.";
        return Response.json({ error }, { status: repositoryResponse.status });
      }
  
      const repository = await repositoryResponse.json() as GitHubRepository;
      const treeResponse = await fetch(
        `https://api.github.com/repos/${path}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`,
        { headers },
      );
  
      const commits = commitsResponse.ok ? await commitsResponse.json() : [];
      const pullRequests = pullsResponse.ok ? await pullsResponse.json() : [];
      const languages = languagesResponse.ok ? await languagesResponse.json() : {};
      if (!treeResponse.ok) throw new Error("GitHub could not load the repository file tree. Please try again.");
      let treeResult = await treeResponse.json() as { tree: GitHubTreeEntry[]; truncated?: boolean };
      // Recursive responses can be truncated; walk each directory to retain every path.
      if (treeResult.truncated) {
        const entries: GitHubTreeEntry[] = [];
        const pending = [{ sha: repository.default_branch, prefix: "" }];
        while (pending.length) {
          const batch = pending.splice(0, 5);
          const results = await Promise.all(batch.map(async ({ sha, prefix }) => {
            const response = await fetch(`https://api.github.com/repos/${path}/git/trees/${encodeURIComponent(sha)}`, { headers });
            if (!response.ok) throw new Error("GitHub could not load the complete file tree. Please try again.");
            const result = await response.json() as { tree: GitHubTreeEntry[]; truncated?: boolean };
            if (result.truncated) throw new Error("GitHub could not return a complete directory listing.");
            return result.tree.map(entry => ({ ...entry, path: `${prefix}${entry.path}` }));
          }));
          for (const result of results) for (const entry of result) {
            entries.push(entry);
            if (entry.type === "tree") pending.push({ sha: entry.sha, prefix: `${entry.path}/` });
          }
        }
        treeResult = { tree: entries };
      }

      type GitHubIssue = { number: number; title: string; user: { login: string } | null; state: string; created_at: string; pull_request?: unknown };
      const issues: GitHubIssue[] = [];
      let issuesError: string | null = null;
      // GitHub mixes PRs into this endpoint. Continue paging until ten actual issues are found.
      for (let page = 1; issues.length < 10; page++) {
        try {
          const response = await fetch(`https://api.github.com/repos/${path}/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`, { headers });
          if (!response.ok) throw new Error("Issues are unavailable. GitHub may have disabled issues or restricted access.");
          const items = await response.json() as GitHubIssue[];
          issues.push(...items.filter(item => !item.pull_request));
          if (!response.headers.get("link")?.includes('rel="next"')) break;
        } catch {
          issuesError = "Issues could not be fully loaded from GitHub. Please try again.";
          break;
        }
      }
      let collaborators: Array<{ login: string; role: string }> = [];
      let collaboratorsHasMore = false;
      let collaboratorsError: string | null = process.env.GITHUB_TOKEN ? null : "Collaborators require a GitHub token with access to this repository. Configure GITHUB_TOKEN on the server and generate the report again.";
      if (process.env.GITHUB_TOKEN) {
        try {
          const response = await fetch(`https://api.github.com/repos/${path}/collaborators?per_page=100`, { headers });
          if (!response.ok) throw new Error("Unavailable");
          const items = await response.json() as Array<{ login: string; role_name?: string }>;
          collaborators = items.map(item => ({ login: item.login, role: item.role_name ?? "Collaborator" }));
          collaboratorsHasMore = Boolean(response.headers.get("link")?.includes('rel="next"'));
        } catch {
          collaboratorsError = "GitHub could not return collaborators. Check the token’s repository access and permissions, then try again.";
        }
      }

      const files = treeResult.tree.filter((entry) => entry.type === "blob").length;
  
      return Response.json({
        repository: {
          name: repository.full_name,
          branch: repository.default_branch,
          private: repository.private,
          stars: repository.stargazers_count,
          forks: repository.forks_count,
          openIssues: repository.open_issues_count,
          sizeKb: repository.size,
          primaryLanguage: repository.language,
          files,
        },
        commits: commits.map((commit: {
          sha: string;
          commit: { message: string; author: { name: string; date: string } };
        }) => ({
          hash: commit.sha.slice(0, 7),
          title: commit.commit.message.split("\n")[0],
          author: commit.commit.author.name,
          date: commit.commit.author.date,
        })),
        pullRequests: pullRequests.map((pullRequest: {
          number: number;
          title: string;
          user: { login: string };
          state: string;
          merged_at: string | null;
          created_at: string;
        }) => ({
          number: `#${pullRequest.number}`,
          title: pullRequest.title,
          author: pullRequest.user.login,
          status: pullRequest.merged_at ? "Merged" : pullRequest.state === "open" ? "Open" : "Closed",
          date: pullRequest.created_at,
        })),
        issues: issues.slice(0, 10).map(issue => ({
          number: issue.number, title: issue.title, author: issue.user?.login ?? "Deleted user",
          status: issue.state === "open" ? "Open" : "Closed", date: issue.created_at,
        })),
        issuesError,
        collaborators,
        collaboratorsError,
        collaboratorsHasMore,
        languages,
        tree: treeResult.tree.map(({ path, type }) => ({ path, type })),
        folders: summarizeFolders(treeResult.tree),
      });
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : "Unable to analyze that repository.",
      }, { status: 400 });
    }
  }
  
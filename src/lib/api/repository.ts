/**
 * Browser-side client for repository report endpoints.
 *
 * Keeping request code here prevents UI components from knowing API URLs,
 * HTTP methods, or response-error details.
 */

/** A normalized report returned by the repository analysis API. */
export type RepositoryReport = {
    repository: {
      name: string;
      branch: string;
      private: boolean;
      stars: number;
      forks: number;
      openIssues: number;
      sizeKb: number;
      primaryLanguage: string | null;
      files: number;
    };
    commits: Array<{
      hash: string;
      title: string;
      author: string;
      date: string;
    }>;
    pullRequests: Array<{
      number: string;
      title: string;
      author: string;
      status: string;
      date: string;
    }>;
    issues: Array<{ number: number; title: string; author: string; status: string; date: string }>;
    issuesError: string | null;
    collaborators: Array<{ login: string; role: string }>;
    collaboratorsError: string | null;
    collaboratorsHasMore: boolean;
    languages: Record<string, number>;
    tree: Array<{ path: string; type: string }>;
    folders: Array<{ name: string; files: number }>;
  };
  
  type ApiError = { error?: string };
  
  /**
   * Requests a live report for one public GitHub repository.
   *
   * @throws {Error} When the API rejects the URL or GitHub cannot be queried.
   */
  export async function analyzeRepository(url: string): Promise<RepositoryReport> {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  
    const payload = await response.json() as RepositoryReport | ApiError;
  
    if (!response.ok) {
      throw new Error((payload as ApiError).error ?? "Unable to analyze that repository.");
    }
  
    return payload as RepositoryReport;
  }
  
import type { RepositoryReport } from "./repository";

export type ChatTurn = { role: "user" | "model"; text: string };

/** Bound report context so large trees do not consume the entire model quota. */
export async function askRepositoryQuestion(
  question: string,
  report: RepositoryReport,
  history: ChatTurn[],
  signal?: AbortSignal,
): Promise<string> {
  const context = {
    repository: report.repository,
    commits: report.commits.slice(0, 10),
    pullRequests: report.pullRequests.slice(0, 10),
    issues: report.issues.slice(0, 10),
    issuesError: report.issuesError,
    languages: report.languages,
    tree: report.tree.slice(0, 150).map(entry => ({ ...entry, path: entry.path.slice(0, 300) })),
    treeEntriesTotal: report.tree.length,
    treeTruncated: report.tree.length > 150,
    sourceCodeIncluded: false,
  };
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, report: context, history: history.slice(-10).map(turn => ({ ...turn, text: turn.text.slice(0, 6_000) })) }),
    signal,
  });
  const payload = await response.json() as { answer?: string; error?: string };
  if (!response.ok || !payload.answer) throw new Error(payload.error ?? "Unable to get an answer. Please try again.");
  return payload.answer;
}

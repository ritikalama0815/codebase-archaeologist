"use client";

/**
 * Main dashboard for the GitHub repository intelligence report.
 * The page fetches report data from `/api/analyze` and only displays real
 * GitHub results after the user supplies a public repository URL.
 */

import {
  ArrowRight, X
} from "lucide-react";
import { FormEvent, useState } from "react";

/** Reusable display colours for GitHub-detected languages. */
const TECH_COLORS = ["#3178c6", "#38bdf8", "#f7df1e", "#7b3fe4", "#e44b23", "#179b5e"];

/** Turns an ISO date from GitHub into a compact, local date. */
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

/** Modal used to collect a GitHub repository URL and start an analysis. */
function RepositoryDialog({ close, onAnalyze }: {
  close: () => void;
  onAnalyze: (url: string) => Promise<void>;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /** Submits the URL and leaves the dialog open if GitHub rejects it. */
  async function submit() {
    setError("");
    setLoading(true);

    try {
      await onAnalyze(url);
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Analysis could not be started.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-shade" onMouseDown={close}>
      <section className="repo-dialog" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button close" onClick={close} aria-label="Close">
          <X size={18} />
        </button>
        <h2>Analyze a GitHub repository</h2>
        <label className="field-label" htmlFor="repo-url">Repository URL</label>
        <input id="repo-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://github.com/owner/repository" />
        <button className="analyze-button" onClick={submit} disabled={loading}>
          {loading ? "Analyzing repository…" : "Generate report"}
          <ArrowRight size={17} />
        </button>
        {error && <p className="form-error">{error}</p>}
      </section>
    </div>
  );
}

"use client";

/**
 * Main dashboard for the GitHub repository intelligence report.
 * The page fetches report data from `/api/analyze` and only displays real
 * GitHub results after the user supplies a public repository URL.
 */

import {
  ArrowRight, Check, ChevronDown, Download,
  File, FolderGit2, GitBranch, GitCommitHorizontal, GitMerge, LayoutDashboard,
  CircleDot, MessageSquare, Plus, Send, X, MessageCircle
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { askRepositoryQuestion, type ChatTurn } from "@/lib/api/chat";
import {
  analyzeRepository as requestRepositoryReport,
  type RepositoryReport,
} from "@/lib/api/repository";

type ChatMessage = { who: "you" | "chat assistant"; text: string };

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

/** Renders the initial empty state instead of a sample or dummy report. */
function EmptyReport({ openDialog }: { openDialog: () => void }) {
  return (
    <section className="empty-report">
      <span className="metric-icon violet"><FolderGit2 size={22} /></span>
      <p className="caps">NO REPOSITORY LOADED</p>
      <p>Paste a public GitHub URL to generate a report from its actual commits, pull requests, languages, and file structure.</p>
      <button className="analyze-button" onClick={openDialog}>Analyze a repository</button>
    </section>
  );
}

/** The interactive, client-rendered dashboard page. */
export default function Home() {
  const [modalOpen, setModalOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("Overview");
  const [report, setReport] = useState<RepositoryReport | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatRequest = useRef<AbortController | null>(null);
  const chatHistory = useRef<ChatTurn[]>([]);
  const messagesEnd = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, chatLoading, chatError]);
  useEffect(() => () => chatRequest.current?.abort(), []);

  /** Requests the live report and resets the contextual assistant message. */
  async function analyzeRepository(url: string) {
    const result = await requestRepositoryReport(url);

    chatRequest.current?.abort();
    chatRequest.current = null;
    chatHistory.current = [];
    setChatLoading(false);
    setChatError("");
    setQuestion("");
    setReport(result);
    setMessages([{
      who: "chat assistant",
      text: `I have a live report for ${result.repository.name}. Ask about its commits, PRs, file tree, or detected languages.`,
    }]);
  }

  /** Ask Gemini using the current report and successful conversation turns. */
  async function askRepository(event: FormEvent) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || !report || chatRequest.current) return;
    const controller = new AbortController();
    chatRequest.current = controller;
    setChatLoading(true);
    setChatError("");
    setMessages(current => [...current, { who: "you", text: prompt }]);
    setQuestion("");
    try {
      const answer = await askRepositoryQuestion(prompt, report, chatHistory.current, controller.signal);
      if (chatRequest.current !== controller) return;
      chatHistory.current = [...chatHistory.current, { role: "user", text: prompt }, { role: "model", text: answer }].slice(-10) as ChatTurn[];
      setMessages(current => [...current, { who: "chat assistant", text: answer }]);
    } catch (error) {
      if (controller.signal.aborted || chatRequest.current !== controller) return;
      setChatError(error instanceof Error ? error.message : "Unable to get an answer. Please try again.");
      setMessages(current => current.slice(0, -1));
      setQuestion(prompt);
    } finally {
      if (chatRequest.current === controller) {
        chatRequest.current = null;
        setChatLoading(false);
      }
    }
  }

  /** Updates the selected navigation item and scrolls to its report section. */
  function navigateTo(name: string) {
    setActiveSection(name);
    const target = ({ Overview: "overview", Repository: "structure", Activity: "activity", "Pull requests": "pull-requests", Issues: "issues"} as Record<string, string>)[name];
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const navItems = [[LayoutDashboard, "Overview"], [FolderGit2, "Repository"], [GitCommitHorizontal, "Activity"], [GitMerge, "Pull requests"], [CircleDot, "Issues"]] as const;
  const languages = report ? Object.entries(report.languages).sort((left, right) => right[1] - left[1]) : [];
  const totalLanguageBytes = languages.reduce((total, [, bytes]) => total + bytes, 0);
  const repositoryName = report?.repository.name.split("/")[1] ?? "Repository";
  const openPullRequests = report?.pullRequests.filter((pullRequest) => pullRequest.status === "Open").length ?? 0;

  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="#overview"><span>CODEBASE</span>ARCHAEOLOGIST</a>
        <div className="top-actions"><button className="header-link" onClick={() => setModalOpen(true)}><Plus size={15} /> New report</button></div>
      </header>

      <aside className="sidebar">
        <button className="repo-picker" onClick={() => setModalOpen(true)}><span className="repo-logo">{repositoryName.slice(0, 1).toUpperCase()}</span><span><strong>{repositoryName}</strong><small>{report ? `${report.repository.private ? "private" : "public"} / ${report.repository.branch}` : "choose a repository"}</small></span><ChevronDown size={15} /></button>
        <nav><p className="caps">REPORT</p>{navItems.map(([Icon, label]) => <button key={label} onClick={() => navigateTo(label)} className={activeSection === label ? "nav-active" : ""}><Icon size={17} />{label}</button>)}</nav>
        <div className="access-card"><span className="access-icon"><Check size={13} /></span><div><p className="caps">DATA SOURCE</p><strong>{report ? "GitHub REST API" : "Waiting for repository"}</strong><small>{report ? "Fetched just now" : "Public repos supported"}</small></div></div>
      </aside>

      <section className="content" id="overview">
        {!report ? <EmptyReport openDialog={() => setModalOpen(true)} /> : <>
          <div className="report-top">
            <div>
              <p className="crumb">
                <GitBranch size={14} /> {report.repository.name} 
                <span>•</span> {report.repository.branch}
              </p>
              <h1>
                Repository Report
              </h1>
              <p className="subtitle">
                Live report generated from GitHub on {new Date().toLocaleDateString()}.
              </p>
            </div>
            <button className="download" onClick={() => window.print()}>
              <Download size={16} /> Export PDF
            </button>
          </div>


          <section className="activity-card repository-summary">
            <div className="panel-heading">Repository overview</div>
            {[
              ["Recent commits", `${report.commits.length} commits`],
              ["Pull requests", `${report.pullRequests.length} recent · ${openPullRequests} open`],
              ["Codebase", `${report.repository.files.toLocaleString()} files`],
              ["Primary language", report.repository.primaryLanguage ?? "Unknown"],
              ["Community", `${report.repository.stars.toLocaleString()} stars · ${report.repository.forks.toLocaleString()} forks`],
              ["Repository size", `${report.repository.sizeKb.toLocaleString()} KB · ${report.repository.openIssues.toLocaleString()} open issues`],
            ].map(([label, value]) => <div className="summary-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </section>

          <div className="section-heading" id="activity">
                <div>
                  <h2>Recent commits</h2>
                </div>
          </div>


          <section className="activity-card">
                <div className="activity-tabs">
                  <span className="selected-tab">Commits ( Latest {report.commits.length} results)</span>
                  <a href={`https://github.com/${report.repository.name}/commits`} target="_blank" rel="noreferrer">GitHub history ↗</a>
                </div>
                <div className="commit-list">{report.commits.map((commit) => <div className="commit" key={commit.hash}>
                  <span className="commit-mark"><GitCommitHorizontal size={16} /></span>
                  <div>
                    <strong>{commit.title}</strong>
                    <small><b>{commit.hash}</b> · {commit.author}</small>
                  </div>
                  <time>{formatDate(commit.date)}</time>
                  </div>)}
                </div>
          </section>


          <div className="lower-grid" id="structure">
            <section>
                  <div className="section-heading">
                    <div>
                      <h2>Folder structure</h2>
                    </div>
                  </div>
                  <div className="structure-card">
                    <div className="panel-heading">{repositoryName} <span>{report.repository.files.toLocaleString()} files</span></div>
                    <div className="tree" tabIndex={0} aria-label="Complete repository file structure">
                      {[...report.tree].sort((a, b) => a.path.localeCompare(b.path)).map(entry => <div className="tree-entry" key={entry.path} style={{ paddingLeft: `${12 + (entry.path.split("/").length - 1) * 18}px` }} title={entry.path}>
                        {entry.type === "tree" ? <FolderGit2 size={15} /> : entry.type === "commit" ? <GitBranch size={15} /> : <File size={15} />}
                        <span>{entry.path.split("/").at(-1)}</span>
                        {entry.type === "commit" && <small>submodule</small>}
                      </div>)}
                      {!report.tree.length && <p className="muted">This repository has no files.</p>}
                    </div>
                  </div>
            </section>



            <section>
              <div className="section-heading">
                <div>
                  <h2>Common Tech stack</h2>
                </div>
              </div>
              <div className="stack-card">
                {languages.length ? <>
                  <svg className="language-graph" viewBox="0 0 520 370" role="img" aria-label="Top six repository languages connected to a central node. All language percentages are listed below.">
                    <defs>
                      <pattern id="graph-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M 26 0 L 0 0 0 26" fill="none" stroke="#163042" strokeWidth="0.6" /></pattern>
                      <radialGradient id="graph-glow"><stop stopColor="#12506c" /><stop offset="1" stopColor="#0d1117" /></radialGradient>
                    </defs>
                    <rect width="520" height="370" fill="url(#graph-grid)" />
                    <circle cx="260" cy="185" r="120" fill="none" stroke="#256080" strokeDasharray="5 7" />
                    {languages.slice(0, 6).map(([language, bytes], index) => {
                      const angle = (index / Math.min(languages.length, 6)) * Math.PI * 2 - Math.PI / 2;
                      const x = 260 + Math.cos(angle) * 174;
                      const y = 185 + Math.sin(angle) * 132;
                      const color = TECH_COLORS[index % TECH_COLORS.length];
                      return <g key={language}>
                        <line x1="260" y1="185" x2={x} y2={y} stroke={color} strokeOpacity="0.5" />
                        <rect x={x - 65} y={y - 27} width="130" height="54" rx="6" fill="#161b22" stroke={color} />
                        <text x={x} y={y - 3} textAnchor="middle" fill="#f0f6fc" fontSize="12">{language}</text>
                        <text x={x} y={y + 16} textAnchor="middle" fill={color} fontSize="11">{((bytes / totalLanguageBytes) * 100).toFixed(1)}%</text>
                      </g>;
                    })}
                    <circle cx="260" cy="185" r="62" fill="url(#graph-glow)" stroke="#256080" />
                    <text x="260" y="182" textAnchor="middle" fill="#79c0ff" fontSize="13" fontWeight="600">TOP LANGUAGES</text>
                    <text x="260" y="201" textAnchor="middle" fill="#8b949e" fontSize="10">by code size</text>
                  </svg>
                  <div className="language-bar" aria-hidden="true">{languages.map(([language, bytes], index) => <span key={language} style={{ width: `${bytes / totalLanguageBytes * 100}%`, background: TECH_COLORS[index % TECH_COLORS.length] }} />)}</div>
                  <div className="language-legend">{languages.map(([language, bytes], index) => <div key={language}><i style={{ background: TECH_COLORS[index % TECH_COLORS.length] }} /><strong>{language}</strong><span>{(bytes / totalLanguageBytes * 100).toFixed(1)}%</span></div>)}</div>
                </> : <p className="muted">No language data detected by GitHub.</p>}
              </div>
          </section>


        </div>
          
          <div className="section-heading pr-heading" id="pull-requests">
              <h2>Pull requests</h2>
          </div>


          <section className="pr-card">
            {report.pullRequests.map((pullRequest) => <div className="pr-row" key={pullRequest.number}>
              <span className="pr-number">{pullRequest.number}</span>
              <div>
                <strong>{pullRequest.title}</strong>
                <small>opened by {pullRequest.author}</small>
              </div>
              <span className={pullRequest.status === "Open" ? "status open" : "status"}>{pullRequest.status}</span>
              <time>{formatDate(pullRequest.date)}</time>
            </div>)}
          </section>
          <div className="section-heading" id="issues"><h2>Issues</h2></div>
          <section className="pr-card">
            <div className="panel-heading">Recent issues <a href={`https://github.com/${report.repository.name}/issues`} target="_blank" rel="noreferrer">View all ↗</a></div>
            {report.issuesError && <p className="section-note" role="status">{report.issuesError}</p>}
            {report.issues.map(issue => <div className="pr-row" key={issue.number}>
              <span className="pr-number">#{issue.number}</span>
              <div><strong><a href={`https://github.com/${report.repository.name}/issues/${issue.number}`} target="_blank" rel="noreferrer">{issue.title}</a></strong><small>opened by {issue.author}</small></div>
              <span className={issue.status === "Open" ? "status open" : "status"}>{issue.status}</span>
              <time>{formatDate(issue.date)}</time>
            </div>)}
            {!report.issuesError && !report.issues.length && <p className="section-note">No issues found in this repository.</p>}
          </section>

        </>}
      </section>

      <aside className="chat-panel">
        <div className="chat-head">
          <div>
            <h2>Repository questions</h2>
          </div>
          <button className="icon-button"><MessageSquare size={17} /></button>
        </div>

        <div className="chat-context">
          <span>{report ? "Ask about Report Data" : "Analyze a repository first"}</span>
          <Check size={14} />
        </div>
        
        <div className="messages" role="log" aria-live="polite" aria-label="Repository conversation">{messages.map((message, index) => <div className={`message ${message.who}`} key={index}>{message.who === "chat assistant" && <span className="bot-badge">
          <MessageCircle size={13} />
          </span>}
          <p>{message.text}</p>
          </div>)}
          {chatLoading && <p className="chat-progress" role="status">Gemini is thinking…</p>}
          {chatError && <p className="chat-error" role="alert">{chatError}</p>}
          <div ref={messagesEnd} />
        </div>

        <div className="suggestions">
          <button disabled={!report || chatLoading} onClick={() => setQuestion("What changed recently?")}>What changed recently?</button>
          <button disabled={!report || chatLoading} onClick={() => setQuestion("Which languages are used?")}>Which languages are used?</button>
        </div>

        <form className="chat-form" onSubmit={askRepository}>
          <textarea aria-label="Question about the repository" maxLength={2000} disabled={!report || chatLoading} className="chat-input" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this repository..." />
            <button disabled={!report || chatLoading || !question.trim()} aria-label={chatLoading ? "Waiting for Gemini" : "Send"}><Send size={16} /></button>
        </form>
        <p className="chat-foot">Powered by Gemini · Answers use report data, not source code.</p>

      </aside>

      {modalOpen && <RepositoryDialog close={() => setModalOpen(false)} onAnalyze={analyzeRepository} />}
    </main>
  );
}

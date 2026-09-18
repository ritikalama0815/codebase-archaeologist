# Codebase Archaeologist

Codebase Archaeologist turns a public GitHub repository URL into a technical report.

## It reports the following:

- Recent commits, authors, and dates
- Recent pull requests and their status
- Repository stars, forks, open issues, size, and default branch
- A folder graph built from GitHub's recursive file tree
- Languages detected by GitHub, shown as the technology stack
- A print-friendly report that can be saved as a PDF from the browser print dialog

All displayed repository facts are requested live from the GitHub REST API. The app does not clone, alter, or save a repository.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Next.js, paste a public URL such as `https://github.com/vercel/next.js`, and select **Generate real report**.


The important dependencies are:

- `next`, `react`, and `react-dom` — the web application framework and UI runtime.
- `typescript` plus `@types/react`, `@types/node`, and `@types/react-dom` — type checking.
- `tailwindcss` and `@tailwindcss/postcss` — CSS processing; this project also uses regular CSS in `src/app/globals.css`.
- `lucide-react` — the interface icons.
- `eslint` and `eslint-config-next` — linting.


### Optional GitHub token

Public repositories work without configuration, but GitHub will apply unauthenticated rate limits. To analyze private repositories that your token can read, create a fine-grained GitHub personal access token with read-only **Contents** and **Pull requests** permissions, then create `.env.local`:

```bash
GITHUB_TOKEN=github_pat_your_token_here
```

Never prefix this variable with `NEXT_PUBLIC_`, commit `.env.local`, or place the token in `page.tsx`. The server route reads it safely and sends it only to GitHub.

## Validation

```bash
npm run lint
```

## Project structure

```text
src/app/page.tsx              Interactive report dashboard and URL dialog
src/app/api/analyze/route.ts  Server route that fetches and normalizes GitHub data
src/lib/api/repository.ts     Typed browser API client used by the dashboard
src/app/globals.css           Dashboard styles and responsive layout
src/app/layout.tsx            Root document layout and metadata
```

## Gemini chat

Set the following in `.env` or `.env.local`, next to `package.json`, then restart the development server:

```dotenv
GEMINI_API_KEY=your_key_here
# Optional model override:
GEMINI_MODEL=gemini-3.1-flash-lite
```

Create a key in [Google AI Studio](https://aistudio.google.com/apikey). The key stays on the server; do not prefix it with `NEXT_PUBLIC_`. Environment files are ignored by Git. In a deployment, configure the same variables in your hosting provider's environment settings.

After generating a repository report, ask a question in the chat. `/api/chat` sends the report's metadata, recent commits, PRs, issues, languages, up to 150 file paths, and the last ten conversation messages to Gemini. No source-code contents or diffs are fetched. The assistant is instructed to acknowledge missing context. Switching repositories clears the conversation.

The default model has a free tier, subject to Google's account and model quotas. Using an API key from a billed project may incur charges; this app does not change billing settings. Quota and connection errors appear in the chat, and failed questions can be sent again.

Before exposing this personal app publicly, add authentication and a shared rate limit to the chat endpoint to control use of your API quota.

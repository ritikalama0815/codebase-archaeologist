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

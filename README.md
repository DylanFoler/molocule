# Molocule

> GTM Signal Tracker + GitHub PR Auto-Summarizer

A full-stack tool for GTM and engineering teams. Track buying signals across target companies and auto-generate PR digests from your GitHub repos — all in a slick monochrome black UI with floating 3D geometric shapes.

## What it does

### Buying Signal Tracker

- Add target companies (name, website, LinkedIn, GitHub org, blog RSS)
- Nightly scans detect: **Funding**, **Key Hires**, **Layoffs**, **Product Launches**
- Claude AI writes a one-line "why this matters for your pipeline" insight per signal
- Signal deduplication — no noise
- Slack ping + email digest delivery

### Dev Digest

- Connect GitHub repos via OAuth
- Auto-pull PRs, workflow runs, and contributors for any date range
- Claude summarizes: what shipped, CI health, blockers
- PDF export with full PR list
- Weekly digest via GitHub Actions cron

## Stack

- **Frontend**: Next.js 16 (App Router) · TypeScript · Tailwind CSS
- **Auth**: NextAuth.js — GitHub OAuth
- **Database**: Supabase (Postgres + RLS)
- **LLM**: Anthropic Claude (`claude-sonnet-4-6`) — works without key (fallback mode)
- **GitHub**: Octokit REST
- **Workers**: Python — feedparser, PyGitHub, APScheduler, anthropic
- **Scheduling**: GitHub Actions (nightly cron)

## Quick Start

### 1. Set up Supabase

- Create project at [supabase.com](https://supabase.com)
- Run `supabase/schema.sql` in the SQL Editor

### 2. Create GitHub OAuth App

- Go to github.com/settings/developers → OAuth Apps → New
- Callback URL: `http://localhost:3000/api/auth/callback/github`

### 3. Configure environment

```bash
cd frontend
cp .env.example .env.local
# Fill in: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, Supabase keys, ANTHROPIC_API_KEY
```

### 4. Run

```bash
cd frontend && npm install && npm run dev
# → http://localhost:3000
```

> **No Anthropic key?** The app works fully without one — signals and digests get smart static fallback summaries instead.

## Project Structure

```
Molocule/
├── frontend/          # Next.js full-stack (UI + API routes)
├── backend/           # Express + Prisma (standalone API)
├── workers/           # Python scraping + APScheduler
├── supabase/          # schema.sql
├── .github/workflows/ # nightly-signals.yml, pr-summarizer.yml
└── CLAUDE.md          # Full technical documentation
```

See [`CLAUDE.md`](./CLAUDE.md) for complete technical documentation, architecture decisions, and deployment guide.

## GitHub Actions

Set these secrets in your repo → Settings → Secrets:

| Secret              | Description                                 |
| ------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_URL`   | Your deployed app URL                       |
| `CRON_SECRET`       | Must match your app's `CRON_SECRET` env var |
| `SLACK_WEBHOOK_URL` | Optional — Slack notifications              |

## Deployment

Deploy `frontend/` to Vercel. Set Root Directory → `frontend`. All env vars from `.env.example`.

---

_Portfolio project — built to demonstrate: scheduled jobs, web scraping, LLM integration, change detection, GitHub API, PDF generation, and full-stack TypeScript._

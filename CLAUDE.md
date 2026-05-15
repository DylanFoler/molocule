# Molocule — CLAUDE.md

## Project Overview

Full-stack GTM signal tracker + GitHub PR auto-summarizer. Portfolio piece targeting GTM engineering and full-stack engineering roles.

**Live modules:**
1. **Buying Signal Tracker** — add target companies, nightly scans detect funding/hires/layoffs/launches, Claude writes one-line insights, Slack/email delivery
2. **Dev Digest** — connect GitHub repos via OAuth, auto-pull PRs + CI runs, Claude summarizes, PDF export

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend + API | Next.js (App Router), TypeScript, Tailwind CSS |
| Auth | NextAuth.js — GitHub OAuth (repo scope) |
| Database | Supabase (Postgres + RLS) |
| LLM | Anthropic Claude API (`claude-sonnet-4-6`) — graceful fallback when key absent |
| GitHub data | Octokit REST |
| Python workers | feedparser, requests, PyGitHub, APScheduler, anthropic |
| Scheduling | GitHub Actions (nightly cron) |

## Project Structure

```
Molocule/
├── frontend/          # Next.js full-stack app (UI + API routes)
│   ├── app/
│   │   ├── (dashboard)/    # Protected routes: dashboard, companies, signals, reports
│   │   ├── api/            # REST endpoints
│   │   │   ├── auth/       # NextAuth GitHub OAuth
│   │   │   ├── companies/  # CRUD for tracked companies
│   │   │   ├── signals/    # Signal feed + deduplication
│   │   │   ├── reports/    # Digest generation (Claude + GitHub)
│   │   │   ├── repos/      # Connected repo management
│   │   │   ├── github/     # GitHub repo listing
│   │   │   └── cron/scan/  # Nightly scanner endpoint (CRON_SECRET protected)
│   │   └── page.tsx        # Login page
│   ├── components/
│   │   ├── geometric-background.tsx  # Canvas 3D wireframe animation
│   │   ├── sidebar.tsx
│   │   ├── signal-card.tsx
│   │   ├── company-card.tsx
│   │   ├── company-form.tsx
│   │   ├── report-card.tsx
│   │   ├── stats-overview.tsx
│   │   └── ui/             # shadcn-style primitives
│   └── lib/
│       ├── claude.ts       # LLM wrapper (fails gracefully without API key)
│       ├── github-client.ts
│       ├── supabase.ts
│       ├── types.ts
│       └── utils.ts
├── backend/           # Express + Prisma (optional — same logic as API routes)
│   ├── src/
│   └── prisma/schema.prisma
├── workers/           # Python scraping + scheduling
│   ├── scraper.py     # RSS + NewsAPI scanning
│   ├── llm.py         # Claude summarization
│   ├── github_processor.py
│   └── scheduler.py   # APScheduler (or --run-now for CI)
├── supabase/
│   └── schema.sql     # Full DB schema with RLS — run in Supabase SQL editor
├── .github/workflows/
│   ├── nightly-signals.yml  # 06:00 UTC daily
│   └── pr-summarizer.yml    # 08:00 UTC Sundays + manual trigger
└── docker-compose.yml  # Local Postgres (alternative to Supabase)
```

## Environment Variables

Copy `frontend/.env.example` → `frontend/.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<32-char random hex>
GITHUB_CLIENT_ID=<from github.com/settings/developers>
GITHUB_CLIENT_SECRET=<from github.com/settings/developers>
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
ANTHROPIC_API_KEY=sk-ant-...   # Optional — app works without it (fallback summaries)
CRON_SECRET=<32-char random hex>
```

## Database

Run `supabase/schema.sql` in the Supabase SQL Editor. Creates:
- `users` — synced from GitHub OAuth
- `companies` — tracked target companies per user
- `signals` — detected buying signals (FUNDING, KEY_HIRE, LAYOFF, PRODUCT_LAUNCH, GENERAL)
- `repos` — connected GitHub repositories
- `digests` — generated PR summaries with raw PR/workflow data
- `notifications` — Slack/email delivery config

All tables have Row Level Security (RLS). The service role key bypasses RLS — used by API routes and workers.

## Running Locally

```bash
# 1. Install frontend
cd frontend && npm install

# 2. Set up env
cp .env.example .env.local  # fill in values

# 3. Run DB schema (Supabase SQL editor) or start local Postgres
docker-compose up -d  # optional local Postgres

# 4. Start
npm run dev  # http://localhost:3000
```

## Key Patterns

**Claude API fallback** — `lib/claude.ts` checks for `ANTHROPIC_API_KEY` at the top. If missing, returns static fallback strings so the app is fully functional without an API key.

**Signal deduplication** — before inserting a signal, `api/signals/route.ts` checks for the same title within the last 7 days. Duplicate → skipped.

**Cron security** — `api/cron/scan/route.ts` and `api/signals/route.ts` (POST) require `Authorization: Bearer <CRON_SECRET>`. Set the same secret in GitHub Actions secrets.

**Server vs. client components** — dashboard pages are Server Components. `CompanyForm` is a Client Component that calls `router.refresh()` internally — never pass function props from server to client components.

**PDF export** — `report-card.tsx` uses `jspdf` (dynamically imported) to generate PDFs client-side with full PR list and AI summary.

## GitHub Actions Secrets Required

| Secret | Value |
|---|---|
| `NEXT_PUBLIC_URL` | Your deployed URL (e.g. `https://molocule.vercel.app`) |
| `CRON_SECRET` | Must match `CRON_SECRET` in your app's env |
| `SLACK_WEBHOOK_URL` | Optional — Slack incoming webhook |

## Design System

Monochrome black aesthetic:
- Background: `#040404`
- Surfaces: `rgba(255,255,255,0.02–0.06)`
- Borders: `rgba(255,255,255,0.06–0.12)`
- Text: `rgba(255,255,255,0.88)` primary, `rgba(255,255,255,0.38)` muted
- Geometric background: canvas-rendered wireframe 3D shapes (cube, octahedron, tetrahedron, icosahedron, prism, diamond, star) with connection lines

## Deployment (Vercel)

1. Push to GitHub
2. Import repo in Vercel
3. Set all env vars from `frontend/.env.example`
4. Set **Root Directory** → `frontend`
5. Framework: Next.js (auto-detected)
6. Add GitHub Actions secrets for the cron jobs

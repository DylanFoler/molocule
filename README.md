# Molocule

> Signal intelligence for sharp analysts

Track buying signals across target companies. Molocule scans the web nightly, classifies what matters (funding, hires, layoffs, product launches), writes AI-powered insights per signal, and visualizes how companies connect to each other in a force-directed molecule graph.

---

## What it does

### AI Company Discovery

- Describe your competitive landscape in plain English and Claude Haiku suggests 6-8 relevant companies to track with a one-line reason for each
- Select and batch-add companies in one action: GitHub org, LinkedIn, and RSS feed are auto-enriched for all of them in parallel
- Discovery button is always accessible from the companies page, not just on first login
- Falls back to keyword-matched curated lists when no API key is set

### Signal Tracker

- Add any company by name or URL and auto-enrich it: name, description, GitHub org, LinkedIn, and blog RSS feed are all pulled automatically
- Nightly batched scans across Google News and Hacker News detect signals relevant to each tracked company, processed in groups of 3 with a runtime guard so the function never times out
- Every signal is classified: Funding, Key Hire, Layoff, Product Launch, or General
- Claude Sonnet 4.6 writes 2-3 sentence analyst-grade insights per signal citing specific figures, named people, and concrete business outcomes (deals, headcount, pricing, roadmap, competitive position)
- Prompt caching on the system prompt cuts repeat input token costs by 90% across each nightly scan batch
- Nightly scan can be paused and resumed per user from the companies page without touching GitHub Actions
- Company aliases: tracking JPMorgan also scans for Chase and JPMC; Google searches pull Alphabet and YouTube results
- Signal deduplication prevents the same article from appearing twice within 7 days
- Quality filter blocks: law firm docket listings, analyst screener articles, satirical clickbait, promotional content, price prediction articles, listicles, procedural legal filings, and wrong-domain false positives for ambiguous brand names

### Company Network

- Force-directed molecule graph visualizes how your tracked companies relate to each other
- Five edge types: Direct rivals, Talent flow, Market pressure, News cross-ref, Same sector
- Edge deduplication ensures each company pair shows only one connection, highest strength wins
- Every connection description is grounded in real signal data: funding amounts, actual headline text, role-specific predictions based on what the executive brought from their previous company
- Clicking a connection shows a multi-sentence analysis with a specific forward-looking prediction
- Focused subgraph view at /network/[id] shows a company and its real connections only
- Click, zoom, pan, and scroll the info panel without it closing

### Company Detail

- Per-company signal history with type filters
- Atom-style card with electron dots for each signal type detected
- Scan any company on demand for immediate signal refresh

### Auto-enrichment

- Enter a company name or URL: description, GitHub org, LinkedIn, and blog RSS are fetched automatically
- GitHub discovery scans website HTML directly for org links, then tries common brand slug variants (slug-ai, slug-labs, slug-hq, slug-inc, slug-io) before falling back to the search API
- Company names use og:title casing so OpenAI stores as OpenAI not Openai
- LinkedIn URLs are scraped from the company website HTML and GitHub org profile
- RSS feeds probed across 15+ common paths in parallel; falls back to Substack detection for companies that publish there

---

## Stack

| Layer | Tech |
|---|---|
| Frontend + API routes | Next.js (App Router), TypeScript, Tailwind CSS |
| Auth | NextAuth.js, GitHub OAuth |
| Database | SQLite via Prisma ORM |
| LLM | Claude Sonnet 4.6 (signal insights, prompt caching), Claude Haiku 4.5 (company discovery) |
| Scheduling | GitHub Actions (nightly cron at 06:00 UTC) |
| Deployment | Vercel (or any Node.js host) |

---

## Quick start

### 1. GitHub OAuth App

- Go to github.com/settings/developers, OAuth Apps, New OAuth App
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/api/auth/callback/github`

### 2. Environment

```bash
cd frontend
cp .env.example .env.local
# Fill in NEXTAUTH_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, CRON_SECRET
```

### 3. Database

```bash
cd frontend
npx prisma db push
```

This creates `prisma/molocule.db` automatically — no external database service needed.

### 4. Run locally

```bash
cd frontend && npm install && npm run dev
# Open http://localhost:3000
```

No Anthropic key? The app works fully without one. Company discovery returns keyword-matched curated lists and signals get smart static fallback insights based on headline parsing.

---

## Project structure

```
molocule/
├── frontend/           # Next.js full-stack app (UI + all API routes)
│   ├── app/
│   │   ├── (dashboard)/    # Signal overview, companies, signals, network
│   │   └── api/            # REST endpoints: companies, signals, cron, scan-toggle, suggest
│   ├── components/         # React components including force-directed network graph
│   ├── lib/                # Claude, scanner, page-cache, company-aliases, Prisma client
│   └── prisma/
│       ├── schema.prisma   # Database schema
│       └── molocule.db     # SQLite database (auto-created on first run)
├── .github/workflows/
│   └── nightly-signals.yml # Daily signal scan at 06:00 UTC
└── vercel.json             # Build config
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_URL` | Yes | App URL (`http://localhost:3000` locally) |
| `NEXTAUTH_SECRET` | Yes | Random 32-char hex string |
| `GITHUB_CLIENT_ID` | Yes | From your GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | Yes | From your GitHub OAuth App |
| `DATABASE_URL` | Yes | SQLite path — `file:./prisma/molocule.db` |
| `ANTHROPIC_API_KEY` | No | Claude API key — app works without it |
| `CRON_SECRET` | Yes | Shared secret for the nightly scan webhook |

Generate secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## GitHub Actions secrets

Set these in your repo under Settings, Secrets and variables, Actions:

| Secret | Value |
|---|---|
| `NEXT_PUBLIC_URL` | Your deployment URL, no trailing slash |
| `CRON_SECRET` | Must match `CRON_SECRET` in your app's env vars |

---

## Demo data

Click "Load demo data" on the dashboard or companies page to load real companies with pre-written signals. Loads instantly, no page refresh needed. Clear it with the same button.

---

_Built to demonstrate: signal intelligence, LLM integration with prompt caching, AI-powered onboarding, web scraping, force-directed graph visualization, company enrichment pipelines, and full-stack TypeScript._

# molocule

> Signal Intelligence for sharp analysts

Track buying signals across target companies. Molocule scans the web nightly, classifies what matters (funding, hires, layoffs, product launches), writes AI-powered insights per signal, and visualizes how companies connect to each other in a force-directed molecule graph.

---

## What it does

### Signal Tracker

- Add any company by name or URL and auto-enrich it: name, description, GitHub org, LinkedIn, and blog RSS feed are all pulled automatically
- Nightly scans across Google News and Hacker News detect signals relevant to each tracked company
- Every signal is classified: Funding, Key Hire, Layoff, Product Launch, or General
- Claude writes a one-line insight per signal that names numbers, people, and specific business implications
- Company aliases: tracking JPMorgan also scans for Chase and JPMC; Google searches pull Alphabet and YouTube results
- Signal deduplication prevents the same article from appearing twice within 7 days
- Quality filter blocks: law firm docket listings, satirical clickbait, promotional content, price prediction articles, listicles, and procedural legal filings with no outcome

### Company Network

- Force-directed molecule graph visualizes how your tracked companies relate to each other
- Five edge types: Direct rivals, Talent flow, Market pressure, News cross-ref, Same sector
- Every connection description is grounded in real signal data, not templates: funding amounts, actual headline text, role-specific predictions based on what the executive brought from their previous company
- Clicking a connection shows a 3-sentence analysis with a specific forward-looking prediction
- Focused subgraph view at /network/[id] shows a company and its real connections only
- Click, zoom, pan, and scroll the info panel without it closing

### Company Detail

- Per-company signal history with type filters
- Atom-style card with electron dots for each signal type detected
- Scan any company on demand for immediate signal refresh

### Auto-enrichment

- Enter a company name or URL: description, GitHub org, LinkedIn, and blog RSS are fetched automatically
- Company names are cleaned before display: "Welcome to AMD" becomes "AMD", "Stripe | Payments" becomes "Stripe"
- LinkedIn URLs are scraped from the company's own website HTML
- RSS feeds are probed across 8 common paths in parallel when no feed link is declared

---

## Stack

| Layer | Tech |
|---|---|
| Frontend + API routes | Next.js (App Router), TypeScript, Tailwind CSS |
| Auth | NextAuth.js, GitHub OAuth |
| Database | Supabase (Postgres + RLS) |
| LLM | Anthropic Claude (`claude-sonnet-4-6`), graceful fallback without key |
| Scheduling | GitHub Actions (nightly cron at 06:00 UTC) |

---

## Quick start

### 1. Supabase

- Create a project at [supabase.com](https://supabase.com)
- Run `supabase/schema.sql` in the SQL Editor

### 2. GitHub OAuth App

- Go to github.com/settings/developers, OAuth Apps, New OAuth App
- Homepage URL: `http://localhost:3000`
- Callback URL: `http://localhost:3000/api/auth/callback/github`

### 3. Environment

```bash
cd frontend
cp .env.example .env.local
# Fill in all values — see comments in .env.example
```

### 4. Run locally

```bash
cd frontend && npm install && npm run dev
# Open http://localhost:3000
```

No Anthropic key? The app works fully without one. Signals get smart static fallback insights based on company name and signal type.

---

## Project structure

```
molocule/
├── frontend/           # Next.js full-stack app (UI + all API routes)
│   ├── app/
│   │   ├── (dashboard)/    # Signal overview, companies, signals, network
│   │   └── api/            # REST endpoints: companies, signals, cron, demo
│   ├── components/         # React components
│   └── lib/                # Claude, scanner, page-cache, company-aliases
├── supabase/
│   └── schema.sql          # Full DB schema with RLS
├── .github/workflows/
│   └── nightly-signals.yml # Daily signal scan at 06:00 UTC
└── vercel.json             # Build config (Root Directory override)
```

---

## Deploy to Vercel

The `vercel.json` at the repo root handles the build config automatically. Just:

1. Import the repo in [Vercel](https://vercel.com)
2. Leave Root Directory as `./` (vercel.json handles it)
3. Add all environment variables from `frontend/.env.example`
4. Deploy

### GitHub Actions secrets

Set these in your repo under Settings, Secrets and variables, Actions:

| Secret | Value |
|---|---|
| `NEXT_PUBLIC_URL` | Your Vercel deployment URL, no trailing slash |
| `CRON_SECRET` | Must match `CRON_SECRET` in your Vercel env vars |

Generate `CRON_SECRET` with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXTAUTH_URL` | Yes | App URL (`http://localhost:3000` locally) |
| `NEXTAUTH_SECRET` | Yes | Random 32-char hex string |
| `GITHUB_CLIENT_ID` | Yes | From your GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | Yes | From your GitHub OAuth App |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (bypasses RLS) |
| `ANTHROPIC_API_KEY` | No | Claude API key — app works without it |
| `CRON_SECRET` | Yes | Shared secret for the nightly scan webhook |

---

## Demo data

Click "Load demo data" on the dashboard or companies page to load 8 real companies with 18 pre-written signals. Loads instantly, no page refresh needed. Clear it with the same button.

---

_Built to demonstrate: signal intelligence, web scraping, LLM integration, force-directed graph visualization, company enrichment, and full-stack TypeScript._

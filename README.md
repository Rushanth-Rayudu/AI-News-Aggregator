# AI News Aggregator

A full-stack AI news aggregation and intelligence platform that collects RSS/Atom coverage, groups related reporting, evaluates sources, and presents structured events with summaries, significance scores, and supporting evidence.

**Project identifier:** `AI-News-Aggregator` · **Technical identifier:** `ai-news-aggregator`

## Overview

AI news is spread across company blogs, research publications, technology journalism, and open-source communities. Several outlets can cover the same development. AI News Aggregator keeps the reporting attached to a shared event so readers can follow the news without losing its sources.

## Current features

- **Ingestion:** a 36-source registry, per-source polling intervals, normalization, canonical URLs, fingerprints, and conservative title-based clustering. Registered sources include disabled entries; registration does not imply a working feed.
- **Evidence:** organization-aware source counts, official-source selection, quality tiers, independent reporting, and supporting coverage.
- **Analysis:** Gemini summaries, category classification, hype detection, heuristic importance scores, confidence labels, cached results, and quota fallback.
- **Reading:** Top AI Events, What's Moving, the Intelligence Feed, Latest, Important, and Following. Important sorts by significance rather than imposing a fixed minimum score.
- **Discovery:** search, time/category/source filters, pagination, Manage Following, and follow controls on events.
- **Context:** event details, source links, an evidence timeline, and Since Your Last Visit highlights.
- **Updates:** polling every 60 seconds offers new signals for insertion without automatically reordering the current feed.
- **Operations:** Source Health diagnostics and loading, empty, error, and retry states.
- **Presentation:** responsive landing and dashboard pages, Light, Dark, and a restrained green-phosphor, terminal-inspired SYS theme; reduced-motion support.
- **Optional email:** a scheduled daily digest through SMTP.

Following and visit history are stored in the browser. They do not require accounts and do not synchronize between devices. Scores and evidence labels are heuristics, not probabilities or independent fact-checks.

## Product pages

| Route | Purpose |
| --- | --- |
| `/home` | Product overview, pipeline explanation, sources, and entry to the feed |
| `/news` | Canonical application/dashboard |
| `/` | Redirects to `/home` |
| `/intelligence`, `/intelligence-dashboard` | Backward-compatible redirects to `/news` |
| Other paths | Branded not-found page |

## Architecture

| Layer | Implementation |
| --- | --- |
| Frontend | React and Vite; plain CSS; browser-local preferences |
| Backend | Node.js and Express; read APIs and protected ingestion/digest endpoints |
| Database | PostgreSQL when `DATABASE_URL` is set; SQLite for local development otherwise |
| AI | Server-side Gemini via `@google/genai` |
| Content | RSS/Atom parsed with `rss-parser` |
| Automation | Internal `node-cron` scheduler or the included GitHub Actions workflows |
| Deployment arrangement | Vercel frontend, Render backend, Supabase PostgreSQL |

The deployment arrangement is documented here without claiming that any particular hosted instance is currently healthy. No verified production frontend/backend URLs are stored in the repository.

### Processing pipeline

```text
Enabled RSS/Atom sources
  -> Parse and normalize text, URLs, publication dates, fingerprints
  -> Skip already stored URLs/fingerprints
  -> Gemini analysis (or conservative fallback); reject unrelated items
  -> Match related events within a publication-time window
  -> Evaluate source priority; store article and create/update event
  -> Read API enriches organization counts, evidence and source ordering
  -> Structured event in AI News Aggregator
```

Matching protects distinct versions and developments such as API availability, pricing, lawsuits, and safety follow-ups. Ambiguous matches stay separate. The selected display source can change when better coverage arrives; supporting articles remain attached. Source diagnostics are recorded separately.

### Source and evidence model

The registry records publisher organizations, aliases, source types, and quality tiers. Multiple feeds from one organization do **not** automatically count as independent corroboration. First-party coverage can be selected as official when appropriate; contested stories can retain independent reporting as their display source.

Document count and organization count are distinct. An official source indicates proximity to an announcement, not proof of every claim. Review `server/feeds/registry.json` and `server/services/sourceIntelligence.js` when changing this behavior.

## Project structure

```text
client/
  src/
    components/       Feed, event details, source health, landing modules
    pages/            Landing page
    styles/           Landing styles
    data/             Frontend source catalog
    utils/            API, routing, preferences, time and event helpers
  public/             Icons
  index.html
  vercel.json         SPA rewrites
server/
  ai/                 Gemini service and bounded analysis cache
  database/           SQLite/PostgreSQL adapters and schemas
  email/              SMTP digest
  feeds/              Source registry
  routes/             Express API
  scheduler/          Internal scheduled jobs
  services/           Ingestion, matching, source evaluation, search
  tests/              Node test-runner suites and coverage fixtures
shared/
  interests.json      Following catalog
.github/
  workflows/          RSS ingestion and daily digest triggers
.env.example
```

## Local development (PowerShell)

Use Node.js 22.12+ or a newer compatible LTS release, npm, and Git. SQLite's native dependency may require build tools if a prebuilt binary is unavailable.

Clone the repository:

```powershell
git clone https://github.com/Rushanth-Rayudu/AI-News-Aggregator.git
Set-Location AI-News-Aggregator
Copy-Item .env.example .env
npm --prefix server install
npm --prefix client install
```

For an existing checkout, keep your existing `.env`; do not overwrite it. Edit the root `.env` for backend configuration. Leave `DATABASE_URL` blank to use a local SQLite database. Gemini and SMTP are optional. With the internal scheduler enabled, an initial ingestion starts shortly after the backend starts.

Start the backend from the project root:

```powershell
Set-Location server
npm run dev
```

In a second terminal, start from the project root:

```powershell
Set-Location client
npm run dev
```

- Landing: `http://localhost:5178/home`
- Feed: `http://localhost:5178/news`
- Backend/API: `http://localhost:8000/api`

The client defaults to relative `/api` requests. Vite proxies these to `http://localhost:8000`. The backend loads the root `.env`; Vite does **not** automatically load that parent file. For a custom browser API address, put `VITE_API_BASE_URL=https://your-backend.example/api` in `client/.env.local` or the frontend hosting environment. It must include `/api`. Never put server secrets in a `VITE_*` variable.

For a custom local proxy target, set `$env:VITE_API_PROXY_TARGET = 'http://localhost:8000'` in the terminal before starting Vite. Check Vite's output if port 5178 is already occupied.

### Environment variables

No secrets are required for local SQLite storage and fallback analysis. Features and production connections need their corresponding settings.

| Variable | Scope / requirement | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server; required for PostgreSQL | PostgreSQL connection string; blank selects SQLite |
| `DATABASE_PATH` | Server; optional SQLite only | Local filename; default is `server/database/ai_intelligence.db`; relative overrides resolve from the working directory |
| `PGSSLMODE` | Server; PostgreSQL deployment | `require` enables the adapter's current SSL mode; its certificate verification is disabled |
| `GEMINI_API_KEY` | Server; optional | Enables Gemini analysis and digest summaries |
| `PORT` | Server; optional | Default `8000` |
| `CORS_ORIGIN` | Server; production-specific | Comma-separated allowed frontend origins |
| `INGEST_SECRET` | Server and automation; required for ingestion POSTs | Expected in `x-ingest-secret` |
| `DIGEST_SECRET` | Server and automation; required for digest POSTs | Expected in `x-digest-secret` |
| `ENABLE_INTERNAL_SCHEDULER` | Server; optional | Defaults enabled; set exactly `false` when external automation owns scheduling |
| `POLL_INTERVAL_MINUTES` | Internal scheduler; optional | Default `10`; cron minute-step interval, use an integer from 1 to 59 |
| `MAX_NEW_ITEMS_PER_SOURCE` | Server; optional | Default `10` accepted new items per source run; not a hard Gemini request budget |
| `MAX_ARTICLE_AGE_DAYS` | Server; optional | Default `30`; `0` disables the age cutoff |
| `DIGEST_HOUR`, `DIGEST_MINUTE`, `DIGEST_TIMEZONE` | Internal scheduler; optional | Defaults `7`, `0`, `Asia/Kolkata` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Server; required for email | SMTP connection; secure is the string `true` or `false` |
| `SMTP_USER`, `SMTP_PASSWORD` | Server; required for authenticated email | SMTP credentials |
| `EMAIL_FROM`, `EMAIL_TO` | Server; required for email | Sender and recipient; configure privately |
| `VITE_API_BASE_URL` | Frontend build; optional locally, needed for separate backend hosting | API base including `/api`; default `/api` |
| `VITE_API_PROXY_TARGET` | Local Vite process environment; optional | Development proxy origin |
| `BACKEND_URL` | GitHub Actions secret | Backend origin without `/api`; workflows append endpoint paths |

The example configuration contains placeholders only. The legacy SQLite filename is intentionally retained to avoid silently creating a new empty database.

## Gemini quota and fallback

Valid analysis results, including rejected non-AI articles, are cached by article inputs for 24 hours in a cache bounded to 500 entries. Stored article URLs/fingerprints are skipped before analysis. The cache is process-local and resets on restart.

A quota/rate-limit response triggers a five-minute pause shared by article analysis and digest generation. Cached article results remain reusable. Missing configuration, API errors, invalid responses, or cooldown use fallback behavior rather than removing existing processed content. Fallback uses keyword relevance, taxonomy rules, an excerpt, importance 40/100, and Low confidence; it is not equivalent to AI analysis.

Ordinary rendering, searches, filters, and read polling do not invoke Gemini. Summaries are stored with events and can be replaced when a preferred source updates an event.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api` | API identity and endpoint overview |
| GET | `/api/events` | Filtered, searchable, sorted, paginated events |
| GET | `/api/events/:id` | Event with supporting articles |
| GET | `/api/events/since` | Developments discovered since a supplied timestamp |
| GET | `/api/themes` | Category activity |
| GET | `/api/sources` | Sources and health diagnostics |
| GET | `/api/status` | Counts, freshness, and configuration indicators |
| POST | `/api/refresh`, `/api/internal/ingest` | Ingestion; requires `x-ingest-secret` |
| POST | `/api/send-test-email`, `/api/internal/digest` | Digest; requires `x-digest-secret` |

Dashboard refresh reloads read APIs; it is not an unauthenticated ingestion trigger.

## Testing

Run from the project root:

```powershell
npm --prefix server test
npm --prefix client run lint
npm --prefix client run build
git diff --check
```

Server suites cover connection recovery, transaction handling, matching, source priority, organization-aware evidence, search, Following, timestamps, taxonomy, and Gemini cache/cooldown behavior. These are controlled tests, not proof of live provider availability. Do not run live ingestion or email scripts against production merely to validate documentation.

## Deployment

Use the existing Vercel/Render/Supabase resources; product renaming does not require changing their names or hostnames.

1. **Database:** configure the backend with its Supabase PostgreSQL connection. For a new database, review and apply `server/database/postgresSchema.sql` through your database administration workflow. Backend startup does not initialize the PostgreSQL schema. The SQLite import script is an explicit migration tool, not a naming step.
2. **Render backend:** root directory `server`, build `npm ci`, start `npm start`. Configure database, Gemini, CORS, scheduler, and optional email/secrets on the backend only.
3. **Vercel frontend:** root directory `client`, build `npm run build`, output `dist`. Set `VITE_API_BASE_URL` to the actual backend URL ending in `/api`. The included `client/vercel.json` provides SPA rewrites; it does not proxy API calls to Render.
4. **Automation:** included workflows request ingestion every ten minutes and digest at 01:30 UTC (07:00 India time). Configure repository secrets `BACKEND_URL`, `INGEST_SECRET`, and `DIGEST_SECRET`. Set backend `ENABLE_INTERNAL_SCHEDULER=false` when these workflows own scheduling. Alternatively use the internal scheduler and disable scheduled workflow triggers to avoid duplicate jobs.

GitHub Actions uses the workflow cron expressions, not the backend's digest time variables. Hosting cold starts and scheduling delays depend on the selected plans; no free-tier availability is guaranteed.

### Naming and compatibility

The GitHub repository is now `AI-News-Aggregator`, and the local Git remote is `https://github.com/Rushanth-Rayudu/AI-News-Aggregator.git`.

Existing checkout folders may retain `ai-intelligence-dashboard` until closed and renamed safely. Keep working deployment hostnames, database resources, environment-variable names, and route aliases unchanged. Browser keys `ai-intelligence-filters`, `ai-intelligence-watchlist`, and `ai-intelligence-last-visit` preserve existing preferences.

## Security

Gemini, database, SMTP, ingestion, and digest credentials belong on the server or in automation secrets. The frontend receives no secret credentials by design. Root `.env` is ignored, and frontend local environment files are ignored by `client/.gitignore`. All `VITE_*` values must be considered public build inputs.

Ingestion/digest endpoints require their configured secret headers. CORS restricts browser origins but is not authentication. The current PostgreSQL SSL implementation encrypts transport without validating certificates; stricter verification is a separate infrastructure/security task.

## Current limitations

- Third-party feeds can disappear, rate-limit, or time out; check Source Health for current status.
- Matching and classification are heuristic. Historical records may retain older Other categories.
- Gemini analysis depends on configuration, network access, and quota. Fallback records are not automatically reanalyzed when service returns.
- The analysis cache resets on backend restart and is not shared across instances.
- Source counts do not establish factual truth, and multiple documents may come from one organization.
- Following and visit history remain local to one browser.
- Hosted instances may have cold starts or delayed scheduled runs.

## Screenshots

Curated screenshots are not included yet. Future captures should show `/home` and `/news` on desktop and mobile, including the three themes. Place intentional, reviewed images in a future `docs/screenshots/` directory; do not publish temporary QA captures.

## Author

**V.RUSHANTH RAYUDU**

[GitHub](https://github.com/Rushanth-Rayudu)

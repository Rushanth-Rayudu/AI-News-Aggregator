# AI Intelligence Dashboard

A continuously updating AI-news intelligence system. Monitors authoritative AI sources, deduplicates stories, clusters events, scores importance & credibility, and presents a minimal dashboard — powered by Gemini AI.

---

## What It Does

- **Monitors 15+ AI news sources** every 10 minutes (RSS/Atom feeds)
- **Deduplicates** identical and near-duplicate stories automatically
- **Clusters events**: 5 articles about the same release → 1 event card
- **Scores importance & credibility** per article and event
- **Uses Gemini AI** to summarize, classify, and detect hype
- **Sends a daily email digest** at 07:00 via SMTP (Hostinger-ready)
- **Dashboard** at `http://localhost:5178` — clean, dark, fast

---

## Architecture

```
┌─────────────────────────────────────────┐
│              RSS Sources (15+)          │
└────────────────┬────────────────────────┘
                 │  Fetch every 10 min (cron)
                 ▼
┌─────────────────────────────────────────┐
│         RSS Ingestion Engine            │
│  Normalize · Fingerprint · Deduplicate  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│          Gemini AI Processing           │
│  Classify · Summarize · Score · Detect  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│        SQLite Database                  │
│  sources · articles · events · digests  │
└────────────────┬────────────────────────┘
                 │
        ┌────────┴────────┐
        ▼                 ▼
┌──────────────┐  ┌──────────────────────┐
│  React UI    │  │  Daily Email Digest  │
│  :5178       │  │  07:00 Asia/Kolkata  │
└──────────────┘  └──────────────────────┘
```

---

## Quick Start

### 1. Clone / open the project

```bash
cd ai-intelligence-dashboard
```

### 2. Copy environment config

```bash
cp .env.example .env
```

Edit `.env` and fill in your values (see below).

### 3. Install backend dependencies

```bash
cd server
npm install
```

### 4. Install frontend dependencies

```bash
cd ../client
npm install
```

### 5. Start the backend

```bash
cd ../server
node index.js
```

Backend runs on: **http://localhost:8000**

### 6. Start the frontend (new terminal)

```bash
cd client
npm run dev
```

Dashboard runs on: **http://localhost:5178**

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key | `AIza...` |
| `SMTP_HOST` | SMTP server hostname | `smtp.hostinger.com` |
| `SMTP_PORT` | SMTP port | `465` |
| `SMTP_SECURE` | Use TLS (`true`/`false`) | `true` |
| `SMTP_USER` | SMTP username / email | `you@domain.com` |
| `SMTP_PASSWORD` | SMTP password | `yourpassword` |
| `EMAIL_FROM` | From address | `"AI Intel" <you@domain.com>` |
| `EMAIL_TO` | Digest recipient | `you@gmail.com` |
| `POLL_INTERVAL_MINUTES` | Feed polling interval | `10` |
| `DIGEST_HOUR` | Daily digest hour (24h) | `7` |
| `DIGEST_MINUTE` | Daily digest minute | `0` |
| `DIGEST_TIMEZONE` | Timezone for digest | `Asia/Kolkata` |
| `DATABASE_PATH` | SQLite file path | `./database/ai_intelligence.db` |
| `PORT` | Backend port | `8000` |

### Configuring Gemini

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. Add to `.env`: `GEMINI_API_KEY=your_key_here`

If `GEMINI_API_KEY` is not set, the app still works — articles are stored without AI summaries.

### Configuring Hostinger SMTP

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@yourdomain.com
SMTP_PASSWORD=your_email_password
EMAIL_FROM="AI Intelligence" <your_email@yourdomain.com>
EMAIL_TO=recipient@gmail.com
```

---

## How RSS Ingestion Works

1. Every `POLL_INTERVAL_MINUTES` minutes, the scheduler fetches all enabled sources in `server/feeds/registry.json`
2. Each feed is parsed via `rss-parser`
3. Items are normalized (title, URL, description, date, image)
4. A SHA-256 fingerprint is computed from title + URL + description snippet
5. Duplicate fingerprints and duplicate URLs are skipped
6. Near-duplicate titles (Jaccard similarity > 40%) are clustered into the same event
7. New items go through Gemini AI processing
8. Results are stored in SQLite

---

## How Deduplication Works

- **Exact URL match**: same URL → skip
- **Fingerprint match**: same content hash → skip  
- **Title similarity**: Jaccard word overlap > 40% → same event cluster
- When an event cluster grows, importance score increases with each additional credible source

---

## How Importance Scoring Works

Base importance is set by Gemini (0–100). It increases when:
- A primary source (Tier 1) reports the story: +20
- Additional sources report the same event: +5 each
- Official model releases, major benchmarks, safety developments score highest

---

## How Gemini Is Used

Gemini processes each new article to determine:
1. Is it actually AI-related?
2. Category (Model Release, AI Research, etc.)
3. Is the title sensationalized/hype?
4. Summary: What happened, Why it matters, Key points
5. Importance score (0–100)
6. Confidence label (High / Medium / Low)

Summaries are stored once and never re-generated for the same article.

---

## Adding a New RSS Source

Edit `server/feeds/registry.json` and add an entry:

```json
{
  "sourceName": "My Source",
  "feedUrl": "https://example.com/feed.xml",
  "homepageUrl": "https://example.com",
  "sourceType": "journalism",
  "credibilityTier": 3,
  "enabled": true,
  "pollingInterval": 15,
  "category": "AI News"
}
```

Restart the server. The source will be seeded on first run if the `sources` table is empty, or you can add it manually to the DB.

---

## Troubleshooting

**Backend won't start:**
```bash
cd server && node index.js
# Check for missing npm packages:
npm install
```

**Feed not fetching:**
- Check `lastError` in the `sources` table
- Ensure the feed URL actually returns RSS/Atom XML
- Some feeds require different User-Agent headers

**Gemini errors:**
- Verify your `GEMINI_API_KEY` in `.env`
- App works without it (raw RSS data stored, no AI summaries)

**No events showing in dashboard:**
- Wait 30–60 seconds after starting server for first pipeline run
- Check backend logs for errors
- Click the ↻ refresh button in the status panel

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/events` | List events (supports `?category=`, `?timeframe=6h/24h/7d`) |
| GET | `/api/events/:id` | Single event with sources |
| GET | `/api/sources` | All configured sources |
| GET | `/api/status` | System health status |
| POST | `/api/refresh` | Trigger immediate feed refresh |
| POST | `/api/send-test-email` | Send test digest email |

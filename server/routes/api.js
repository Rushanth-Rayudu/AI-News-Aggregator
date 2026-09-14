const express = require('express');
const db = require('../database/db');
const { runPipeline } = require('../services/processingPipeline');
const { sendDailyDigest } = require('../email/digestService');

const { enrichEvent, metadata, healthOf } = require('../services/sourceIntelligence');
const { eventQuery } = require('../services/searchService');
const { fetchDiagnostics } = require('../services/sourceHealth');
const router = express.Router();

function requireInternalSecret(headerName, envVarName) {
    return (req, res, next) => {
        const configuredSecret = process.env[envVarName];
        if (!configuredSecret) {
            return res.status(500).json({ error: `${envVarName} is not configured` });
        }

        const providedSecret = req.headers[headerName.toLowerCase()];
        if (providedSecret !== configuredSecret) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        next();
    };
}

router.get('/', (req, res) => {
    res.json({
        name: "AI Intelligence Dashboard API",
        version: "1.0.0",
        status: "online",
        endpoints: {
            "GET /api/status": "System health and database metrics",
            "GET /api/events": "List deduplicated news events (supports ?category=, ?timeframe=, ?sort=, ?limit=, ?offset=)",
            "GET /api/events/since": "Recent events discovered since an ISO timestamp (?since=&limit=)",
            "GET /api/events/:id": "Single event details with source articles",
            "GET /api/sources": "List monitored RSS news sources with latest article",
            "GET /api/themes": "Current AI themes derived from recent event data",
            "POST /api/refresh": "Trigger immediate feed refresh",
            "POST /api/send-test-email": "Send daily digest email test"
        }
    });
});

router.get('/events', async (req, res) => {
    try {
        // Default to 50 for a fast initial load; allow up to 300. offset enables
        // safe server-side "Load more" pagination without unbounded responses.
        const rawLimit = parseInt(req.query.limit, 10);
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 300) : 50;
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
        const category = req.query.category;
        const timeframe = req.query.timeframe;
        const sort = req.query.sort || 'importance';

        const { query, params } = eventQuery({...req.query,limit,offset,category,timeframe,sort});

        const events = await db.prepare(query).all(...params);

        // Fetch every article for the selected events in a single query.
        // A per-event query (N+1) exhausted the Postgres connection pool for
        // larger limits and returned 500 "timeout exceeded when trying to connect".
        let articlesByEventId = {};
        if (events.length > 0) {
            const eventIds = events.map(evt => evt.id);
            const placeholders = eventIds.map(() => '?').join(', ');
            const articles = await db.prepare(`
                SELECT a.eventId, a.title, a.description, a.url, a.publishedAt, a.discoveredAt, s.sourceName, a.isPrimary, s.credibilityTier, s.sourceType
                FROM articles a 
                JOIN sources s ON a.sourceId = s.id 
                WHERE a.eventId IN (${placeholders})
            `).all(...eventIds);

            articlesByEventId = articles.reduce((byEvent, article) => {
                (byEvent[article.eventId] = byEvent[article.eventId] || []).push(article);
                return byEvent;
            }, {});
        }

        const eventsWithSources = events.map(evt => enrichEvent(evt, articlesByEventId[evt.id] || []));

        res.json(eventsWithSources);
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

// Registered before /events/:id so "since" is not captured as an event id.
// Returns events discovered after an ISO timestamp with a true total count so
// the dashboard can answer "what changed since my last visit" without N+1.
router.get('/events/since', async (req, res) => {
    try {
        const since = req.query.since;
        const rawLimit = parseInt(req.query.limit, 10);
        const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;

        let conditions = [];
        let params = [];
        if (since) {
            conditions.push('discoveredAt > ?');
            const parsed = new Date(since);
            if (!Number.isFinite(parsed.getTime())) return res.status(400).json({ error: 'Invalid visit timestamp' });
            params.push(parsed.toISOString().replace('T', ' ').replace('Z', ''));
        }

        const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

        const countRow = await db.prepare(`SELECT COUNT(*) as count FROM events${whereClause}`).get(...params);
        const events = await db.prepare(
            `SELECT * FROM events${whereClause} ORDER BY importanceScore DESC, discoveredAt DESC LIMIT ?`
        ).all(...params, limit);

        let articlesByEventId = {};
        if (events.length > 0) {
            const eventIds = events.map(evt => evt.id);
            const placeholders = eventIds.map(() => '?').join(', ');
            const articles = await db.prepare(`
                SELECT a.eventId, a.title, a.description, a.url, a.publishedAt, a.discoveredAt, s.sourceName, a.isPrimary, s.credibilityTier, s.sourceType
                FROM articles a
                JOIN sources s ON a.sourceId = s.id
                WHERE a.eventId IN (${placeholders})
            `).all(...eventIds);

            articlesByEventId = articles.reduce((byEvent, article) => {
                (byEvent[article.eventId] = byEvent[article.eventId] || []).push(article);
                return byEvent;
            }, {});
        }

        res.json({
            count: countRow ? countRow.count || 0 : 0,
            events: events.map(evt => enrichEvent(evt, articlesByEventId[evt.id] || [])),
        });
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

// Current themes derived from real recent event data (no hard-coded trends).
router.get('/themes', async (req, res) => {
    try {
        const themes = await db.prepare(`
            SELECT category, COUNT(*) as count, MAX(updatedAt) as latestUpdatedAt
            FROM events
            WHERE updatedAt >= datetime('now', '-7 days')
              AND category IS NOT NULL AND category != ''
            GROUP BY category
            ORDER BY count DESC, latestUpdatedAt DESC
            LIMIT 8
        `).all();
        res.json(themes);
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

router.get('/events/:id', async (req, res) => {
    try {
        const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const articles = await db.prepare(`
            SELECT a.title, a.description, a.url, a.publishedAt, a.discoveredAt, s.sourceName, a.isPrimary, s.credibilityTier, s.sourceType
            FROM articles a 
            JOIN sources s ON a.sourceId = s.id 
            WHERE a.eventId = ?
        `).all(event.id);

        event.sources = articles;
        res.json(enrichEvent(event));
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

router.get('/sources', async (req, res) => {
    try {
        const sources = await db.prepare('SELECT * FROM sources').all();
        const diagnostics = await fetchDiagnostics(db);

        // Attach each source's latest article metadata in a single windowed
        // query (no per-source N+1). Works on both Postgres and SQLite >= 3.25.
        const latestBySource = {};
        if (sources.length > 0) {
            const latest = await db.prepare(`
                SELECT sourceId, title, publishedAt FROM (
                    SELECT a.sourceId, a.title, a.publishedAt,
                           ROW_NUMBER() OVER (PARTITION BY a.sourceId ORDER BY a.publishedAt DESC) AS rn
                    FROM articles a
                ) ranked WHERE ranked.rn = 1
            `).all();

            for (const row of latest) {
                latestBySource[row.sourceId] = { title: row.title, publishedAt: row.publishedAt };
            }
        }

        res.json(sources.map(s => ({ ...metadata(s), ...diagnostics[s.id], ...healthOf(s, {publishedAt:diagnostics[s.id]?.lastArticleAt || latestBySource[s.id]?.publishedAt}), latestArticle: latestBySource[s.id] || null, lastError: s.lastError ? healthOf(s,latestBySource[s.id]).healthReason : null })));
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

router.get('/status', async (req, res) => {
    try {
        const sourceRows = await db.prepare('SELECT s.*, MAX(a.publishedAt) AS publishedAt FROM sources s LEFT JOIN articles a ON a.sourceId=s.id GROUP BY s.id').all();
        const diagnostics = await fetchDiagnostics(db);
        const sources = {total:sourceRows.length,enabled:0,disabled:0,healthy:0,degraded:0,stale:0,failed:0};
        for(const s of sourceRows) {
            if (s.enabled) sources.enabled++;
            sources[healthOf(s,{publishedAt:diagnostics[s.id]?.lastArticleAt || s.publishedAt}).health]++;
        }
        const articles = await db.prepare('SELECT COUNT(*) as count FROM articles').get();
        const events = await db.prepare('SELECT COUNT(*) as count FROM events').get();
        const lastDigest = await db.prepare('SELECT sentAt FROM daily_digests ORDER BY id DESC LIMIT 1').get();

        res.json({
            sources,
            articles: articles.count || 0,
            events: events.count || 0,
            geminiConfigured: !!process.env.GEMINI_API_KEY,
            smtpConfigured: !!process.env.SMTP_PASSWORD,
            lastDigest: lastDigest ? lastDigest.sentAt : null
        });
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

// Admin endpoints (in production add authentication)
router.post('/refresh', requireInternalSecret('x-ingest-secret', 'INGEST_SECRET'), async (req, res) => {
    try {
        // Run async, don't wait for completion to avoid timeout
        runPipeline().catch(console.error);
        res.json({ status: 'started' });
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

router.post('/send-test-email', requireInternalSecret('x-digest-secret', 'DIGEST_SECRET'), async (req, res) => {
    try {
        await sendDailyDigest({ dryRun: req.body && req.body.dryRun === true });
        res.json({ status: 'sent' });
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

router.post('/internal/ingest', requireInternalSecret('x-ingest-secret', 'INGEST_SECRET'), async (req, res) => {
    try {
        await runPipeline();
        res.json({ status: 'ingest started' });
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

router.post('/internal/digest', requireInternalSecret('x-digest-secret', 'DIGEST_SECRET'), async (req, res) => {
    try {
        const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
        const result = await sendDailyDigest({ dryRun });
        res.json({ status: dryRun ? 'digest dry-run' : 'digest sent', result });
    } catch (error) {
        res.status(500).json({ error: 'Request failed. Please retry shortly.' });
    }
});

module.exports = router;

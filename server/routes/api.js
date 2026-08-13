const express = require('express');
const db = require('../database/db');
const { runPipeline } = require('../services/processingPipeline');
const { sendDailyDigest } = require('../email/digestService');

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
            "GET /api/events": "List deduplicated news events (supports ?category= and ?timeframe=)",
            "GET /api/events/:id": "Single event details with source articles",
            "GET /api/sources": "List monitored RSS news sources",
            "POST /api/refresh": "Trigger immediate feed refresh",
            "POST /api/send-test-email": "Send daily digest email test"
        }
    });
});

router.get('/events', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const category = req.query.category;
        const timeframe = req.query.timeframe;
        const sort = req.query.sort || 'importance';

        let query = 'SELECT * FROM events';
        let params = [];
        let conditions = [];

        if (category && category !== 'All') {
            conditions.push('category = ?');
            params.push(category);
        }

        if (timeframe) {
            let hours = 24;
            if (timeframe === '6h') hours = 6;
            if (timeframe === '7d') hours = 24 * 7;
            conditions.push(`updatedAt >= datetime('now', '-${hours} hours')`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        if (sort === 'latest') {
            query += ' ORDER BY updatedAt DESC, importanceScore DESC LIMIT ?';
        } else {
            query += ' ORDER BY importanceScore DESC, updatedAt DESC LIMIT ?';
        }
        params.push(limit);

        const events = await db.prepare(query).all(...params);

        const eventsWithSources = await Promise.all(events.map(async (evt) => {
            const articles = await db.prepare(`
                SELECT a.title, a.url, a.publishedAt, s.sourceName, a.isPrimary 
                FROM articles a 
                JOIN sources s ON a.sourceId = s.id 
                WHERE a.eventId = ?
            `).all(evt.id);
            return { ...evt, sources: articles };
        }));

        res.json(eventsWithSources);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/events/:id', async (req, res) => {
    try {
        const event = await db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });

        const articles = await db.prepare(`
            SELECT a.title, a.url, a.publishedAt, s.sourceName, a.isPrimary 
            FROM articles a 
            JOIN sources s ON a.sourceId = s.id 
            WHERE a.eventId = ?
        `).all(event.id);

        event.sources = articles;
        res.json(event);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/sources', async (req, res) => {
    try {
        const sources = await db.prepare('SELECT * FROM sources').all();
        res.json(sources);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/status', async (req, res) => {
    try {
        const sources = await db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN lastError IS NULL THEN 1 ELSE 0 END) as healthy FROM sources').get();
        const articles = await db.prepare('SELECT COUNT(*) as count FROM articles').get();
        const events = await db.prepare('SELECT COUNT(*) as count FROM events').get();
        const lastDigest = await db.prepare('SELECT sentAt FROM daily_digests ORDER BY id DESC LIMIT 1').get();

        res.json({
            sources: { total: sources.total || 0, healthy: sources.healthy || 0 },
            articles: articles.count || 0,
            events: events.count || 0,
            geminiConfigured: !!process.env.GEMINI_API_KEY,
            smtpConfigured: !!process.env.SMTP_PASSWORD,
            lastDigest: lastDigest ? lastDigest.sentAt : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin endpoints (in production add authentication)
router.post('/refresh', async (req, res) => {
    try {
        // Run async, don't wait for completion to avoid timeout
        runPipeline().catch(console.error);
        res.json({ status: 'started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/send-test-email', async (req, res) => {
    try {
        await sendDailyDigest({ dryRun: req.body && req.body.dryRun === true });
        res.json({ status: 'sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/internal/ingest', requireInternalSecret('x-ingest-secret', 'INGEST_SECRET'), async (req, res) => {
    try {
        await runPipeline();
        res.json({ status: 'ingest started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/internal/digest', requireInternalSecret('x-digest-secret', 'DIGEST_SECRET'), async (req, res) => {
    try {
        const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
        const result = await sendDailyDigest({ dryRun });
        res.json({ status: dryRun ? 'digest dry-run' : 'digest sent', result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;

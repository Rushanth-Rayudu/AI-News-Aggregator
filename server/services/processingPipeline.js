const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { fetchFeed } = require('./rssService');
const { findMatchingEvent } = require('./deduplicationService');
const { processArticle } = require('../ai/geminiService');

async function syncPostgresSequences() {
    if (!process.env.DATABASE_URL || !db.pool) return;

    const tables = ['sources', 'events', 'articles', 'daily_digests', 'system_logs'];
    for (const table of tables) {
        await db.pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0), true);`);
    }
}

async function processSource(source) {
    console.log(`Processing source: ${source.sourceName}`);
    try {
        const items = await fetchFeed(source.feedUrl);
        const maxItemsPerSource = parseInt(process.env.MAX_NEW_ITEMS_PER_SOURCE || '10', 10);
        let newItemsProcessed = 0;

        for (const item of items) {
            if (newItemsProcessed >= maxItemsPerSource) {
                break;
            }

            const existing = await db.prepare('SELECT id FROM articles WHERE fingerprint = ?').get(item.fingerprint);
            if (existing) {
                continue;
            }

            const existingUrl = await db.prepare('SELECT id FROM articles WHERE url = ?').get(item.url);
            if (existingUrl) {
                continue;
            }

            const aiData = await processArticle(item.title, item.description, source.credibilityTier, item.url);

            if (!aiData.isAiRelated) {
                continue;
            }

            const event = await findMatchingEvent(item.title, item.description, db);
            let eventId;
            const isPrimary = source.sourceType === 'primary';

            if (!event) {
                const insertEvent = db.prepare(`
                    INSERT INTO events (title, summary, whyItMatters, keyPoints, category, importanceScore, confidenceScore, confidenceLabel)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);
                const result = await insertEvent.run(
                    item.title,
                    aiData.summary.whatHappened,
                    aiData.summary.whyItMatters,
                    JSON.stringify(aiData.summary.keyPoints || []),
                    aiData.category,
                    aiData.importanceScore,
                    source.credibilityTier === 1 ? 90 : 50,
                    aiData.confidenceLabel
                );
                eventId = result.lastInsertRowid;
            } else {
                eventId = event.id;
                if (isPrimary) {
                    await db.prepare(`
                        UPDATE events SET 
                            importanceScore = importanceScore + 20, 
                            confidenceLabel = 'High', 
                            updatedAt = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(eventId);
                } else {
                    await db.prepare(`
                        UPDATE events SET 
                            importanceScore = importanceScore + 5,
                            updatedAt = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `).run(eventId);
                }
            }

            const insertArticle = db.prepare(`
                INSERT INTO articles (eventId, sourceId, title, description, url, imageUrl, publishedAt, fingerprint, isPrimary)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            await insertArticle.run(
                eventId,
                source.id,
                item.title,
                item.description,
                item.url,
                item.imageUrl,
                item.publishedAt.toISOString(),
                item.fingerprint,
                Boolean(isPrimary)
            );

            newItemsProcessed++;
        }

        await db.prepare('UPDATE sources SET lastSuccessfulFetch = CURRENT_TIMESTAMP, lastError = NULL WHERE id = ?').run(source.id);
        console.log(`Finished ${source.sourceName}: ${newItemsProcessed} new items processed.`);

    } catch (error) {
        await db.prepare('UPDATE sources SET lastError = ? WHERE id = ?').run(error.message, source.id);
        await db.prepare('INSERT INTO system_logs (level, module, message) VALUES (?, ?, ?)').run('error', 'processingPipeline', `Error processing source ${source.sourceName}: ${error.message}`);
    }
}

async function syncSourcesWithRegistry() {
    try {
        await syncPostgresSequences();

        const registryPath = path.join(__dirname, '..', 'feeds', 'registry.json');
        if (!fs.existsSync(registryPath)) return;

        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        let synced = 0;

        for (const s of registry) {
            try {
                const isEnabled = s.enabled !== false ? true : false;
                let existing = await db.prepare('SELECT id FROM sources WHERE feedUrl = ?').get(s.feedUrl);
                if (!existing) {
                    existing = await db.prepare('SELECT id FROM sources WHERE sourceName = ?').get(s.sourceName);
                }
                if (existing) {
                    await db.prepare(`
                        UPDATE sources SET 
                            sourceName = ?, feedUrl = ?, homepageUrl = ?, sourceType = ?,
                            credibilityTier = ?, category = ?, enabled = ?, pollingInterval = ?
                        WHERE id = ?
                    `).run(
                        s.sourceName, s.feedUrl, s.homepageUrl, s.sourceType,
                        s.credibilityTier, s.category, isEnabled, s.pollingInterval || 15, existing.id
                    );
                } else {
                    await db.prepare(`
                        INSERT INTO sources (sourceName, feedUrl, homepageUrl, sourceType, credibilityTier, category, enabled, pollingInterval)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        s.sourceName, s.feedUrl, s.homepageUrl, s.sourceType,
                        s.credibilityTier, s.category, isEnabled, s.pollingInterval || 15
                    );
                }
                synced++;
            } catch (entryError) {
                console.warn(`[Sync] Skipped source "${s.sourceName}": ${entryError.message}`);
            }
        }
        console.log(`Synchronized source registry: ${synced}/${registry.length} sources active.`);
    } catch (error) {
        console.error("Error synchronizing source registry:", error.message);
    }
}

async function runPipeline() {
    await syncSourcesWithRegistry();
    const sources = await db.prepare('SELECT * FROM sources WHERE enabled = TRUE').all();
    for (const source of sources) {
        await processSource(source);
    }
}

module.exports = {
    runPipeline,
    syncSourcesWithRegistry
};


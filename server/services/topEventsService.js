const { enrichEvent, timestampMs } = require('./sourceIntelligence');
const HOUR = 3600000;

// Later coverage alone is not a new development. Preserve the cluster's original
// publication; distinct developments qualify through existing clustering rules.
function selectTopEvents(events, now = Date.now(), limit = 4) {
    const confidence = label => ({ high: 3, medium: 2, low: 1 }[String(label).toLowerCase()] || 0);
    const authority = sources => Math.max(0, ...sources.map(s => ({ A: 4, B: 3, C: 2, D: 1 }[s.qualityTier] || 0)));
    return events.map(event => {
        const sources = event.sources || [];
        const times = sources.map(s => timestampMs(s.publishedAt)).filter(Number.isFinite);
        const published = times.length ? Math.min(...times) : NaN;
        const age = now - published;
        return { event, published, age, sources, authority: authority(sources),
            confidence: confidence(event.confidenceLabel),
            bucket: age <= 24 * HOUR ? 0 : age <= 72 * HOUR ? 1 : 2 };
    }).filter(e => Number.isFinite(e.age) && e.age >= 0 && e.age <= 168 * HOUR &&
        Number(e.event.importanceScore) >= 60 && e.confidence >= 2 && e.authority >= 2)
      .sort((a, b) => a.bucket - b.bucket ||
        Number(b.event.importanceScore) - Number(a.event.importanceScore) ||
        b.confidence - a.confidence || b.authority - a.authority ||
        (b.event.organizationCount || 1) - (a.event.organizationCount || 1) ||
        b.published - a.published || Number(b.event.id) - Number(a.event.id))
      .slice(0, limit).map(({ event, published, bucket, sources }) => ({
        ...event, publishedAt: new Date(published).toISOString(),
        latestCoverageAt: new Date(Math.max(...sources.map(s => timestampMs(s.publishedAt)).filter(Number.isFinite))).toISOString(),
        freshnessBucket: ['24h', '72h', '7d'][bucket],
      }));
}

const CANDIDATE_BATCH_SIZE = 200;
async function loadTopEvents(db, now = Date.now()) {
    // Keyset pages keep candidate memory and every IN list bounded. Rank each
    // batch with the current best four, so no SQL pre-sort can discard a winner.
    const upperId = (await db.prepare('SELECT MAX(id) AS id FROM events').get())?.id;
    if (!upperId) return [];
    let afterId = 0, best = [];
    const cutoff = new Date(now - 168 * HOUR).toISOString().replace('T', ' ').replace('Z', '');
    while (afterId < upperId) {
        const candidates = await db.prepare(`
            SELECT e.* FROM events e
            WHERE e.id > ? AND e.id <= ? AND e.importanceScore >= 60 AND
            REPLACE(CAST((SELECT MIN(publishedAt) FROM articles a WHERE a.eventId=e.id) AS TEXT),'T',' ') >= ?
            ORDER BY e.id ASC LIMIT ?
        `).all(afterId, upperId, cutoff, CANDIDATE_BATCH_SIZE);
        if (!candidates.length) break;
        const articles = await db.prepare(`
            SELECT a.eventId, a.title, a.description, a.url, a.publishedAt, a.discoveredAt,
                   s.sourceName, a.isPrimary, s.credibilityTier, s.sourceType
            FROM articles a JOIN sources s ON a.sourceId=s.id
            WHERE a.eventId IN (${candidates.map(() => '?').join(',')})
        `).all(...candidates.map(e => e.id));
        const grouped = new Map();
        for (const article of articles) {
            if (!grouped.has(article.eventId)) grouped.set(article.eventId, []);
            grouped.get(article.eventId).push(article);
        }
        best = selectTopEvents([...best, ...candidates.map(e => enrichEvent(e, grouped.get(e.id) || []))], now);
        afterId = candidates[candidates.length - 1].id;
        if (candidates.length < CANDIDATE_BATCH_SIZE) break;
    }
    return best;
}

function ingestionStatus(sources, latestArticleDiscoveredAt, now = Date.now()) {
    const enabled = sources.filter(s => s.enabled);
    const successful = enabled.map(s => timestampMs(s.lastSuccessfulFetch)).filter(Number.isFinite);
    const last = successful.length ? Math.max(...successful) : NaN;
    const current = enabled.some(s => {
        const age = now - timestampMs(s.lastSuccessfulFetch);
        return age >= 0 && age <= Math.max(HOUR, (s.pollingInterval || 30) * 3 * 60000);
    });
    return {
        // A source fetch is NOT a fabricated complete-pipeline timestamp.
        lastSuccessfulSourceFetchAt: Number.isFinite(last) ? new Date(last).toISOString() : null,
        latestArticleDiscoveredAt: Number.isFinite(timestampMs(latestArticleDiscoveredAt)) ? new Date(timestampMs(latestArticleDiscoveredAt)).toISOString() : null,
        sourceFetchStatus: current ? 'current' : successful.length ? 'stale' : 'unknown',
    };
}
module.exports = { selectTopEvents, loadTopEvents, ingestionStatus, CANDIDATE_BATCH_SIZE };

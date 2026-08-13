const db = require('../database/db');

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'about', 'have', 'has', 
    'had', 'will', 'would', 'could', 'should', 'been', 'were', 'was', 'are', 'is', 
    'be', 'into', 'over', 'after', 'than', 'more', 'most', 'some', 'such', 'only',
    'other', 'then', 'them', 'these', 'they', 'what', 'which', 'when', 'where'
]);

// Title similarity checking using Jaccard index on meaningful word tokens
function calculateTitleSimilarity(title1, title2) {
    const tokenize = (str) => new Set(
        str.toLowerCase()
           .replace(/[^a-z0-9\s]/g, '')
           .split(/\s+/)
           .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    );
    const set1 = tokenize(title1);
    const set2 = tokenize(title2);
    if (set1.size === 0 || set2.size === 0) return 0;
    
    let intersection = 0;
    for (const w of set1) {
        if (set2.has(w)) intersection++;
    }
    const union = set1.size + set2.size - intersection;
    return intersection / union;
}

async function findMatchingEvent(title, description, db) {
    const recentEvents = await db.prepare(`SELECT * FROM events WHERE updatedAt >= datetime('now', '-2 days')`).all();

    for (const event of recentEvents) {
        const sim = calculateTitleSimilarity(title, event.title);
        if (sim > 0.4) {
            return event;
        }
    }
    return null;
}

module.exports = {
    findMatchingEvent,
    calculateTitleSimilarity
};

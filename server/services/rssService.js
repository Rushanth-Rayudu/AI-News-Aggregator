const Parser = require('rss-parser');
const crypto = require('crypto');

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'AI-Intelligence-Dashboard/1.0',
    }
});

function generateFingerprint(title, url, description) {
    const text = `${title || ''}|${url || ''}|${(description || '').slice(0, 100)}`;
    return crypto.createHash('sha256').update(text).digest('hex');
}

async function fetchFeed(feedUrl) {
    try {
        const feed = await parser.parseURL(feedUrl);
        const maxAgeDays = parseInt(process.env.MAX_ARTICLE_AGE_DAYS || '30', 10);
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(Date.now() - maxAgeMs);

        const parsedItems = feed.items.map(item => {
            const title = item.title ? item.title.trim() : 'No Title';
            const url = item.link || item.guid || '';
            const description = item.contentSnippet || item.content || '';
            
            let publishedAt = new Date();
            if (item.pubDate || item.isoDate) {
                const parsedDate = new Date(item.isoDate || item.pubDate);
                if (!isNaN(parsedDate.getTime())) {
                    publishedAt = parsedDate;
                }
            }

            // Optional image extraction depending on rss format (e.g. media:content or enclosures)
            let imageUrl = null;
            if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image')) {
                imageUrl = item.enclosure.url;
            } else if (item['media:content'] && item['media:content'].$) {
                imageUrl = item['media:content'].$.url;
            }

            const fingerprint = generateFingerprint(title, url, description);

            return {
                title,
                url,
                description,
                publishedAt,
                imageUrl,
                fingerprint
            };
        });

        // Filter out items older than cutoffDate (unless cutoff is 0 / disabled)
        if (maxAgeDays > 0) {
            return parsedItems.filter(item => item.publishedAt >= cutoffDate);
        }
        return parsedItems;
    } catch (error) {
        console.error(`Error fetching feed ${feedUrl}:`, error.message);
        throw error;
    }
}

module.exports = {
    fetchFeed,
    generateFingerprint
};

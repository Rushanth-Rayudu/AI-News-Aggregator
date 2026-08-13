require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('./database/db');

db.prepare("UPDATE sources SET feedUrl = 'https://www.anthropic.com/news/rss', lastError = NULL WHERE sourceName = 'Anthropic News'").run();
db.prepare("UPDATE sources SET feedUrl = 'https://ai.meta.com/blog/rss', lastError = NULL WHERE sourceName = 'Meta AI Blog'").run();
db.prepare("UPDATE sources SET feedUrl = 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', lastError = NULL WHERE sourceName = 'The Verge AI'").run();
db.prepare("UPDATE sources SET feedUrl = 'https://spectrum.ieee.org/feeds/feed.rss', lastError = NULL WHERE sourceName = 'IEEE Spectrum AI'").run();
console.log('Feed URLs updated in database.');
process.exit(0);

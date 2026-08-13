const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { createPostgresAdapter } = require('./postgresAdapter');

if (process.env.DATABASE_URL) {
    const postgresDb = createPostgresAdapter(process.env.DATABASE_URL);
    module.exports = postgresDb;
} else {
    const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'ai_intelligence.db');

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });

    db.pragma('journal_mode = WAL');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);

    module.exports = db;
}

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const sqliteDbPath = process.env.DATABASE_PATH || path.join(__dirname, 'ai_intelligence.db');
const postgresUrl = process.env.DATABASE_URL;

if (!postgresUrl) {
    console.error('DATABASE_URL is required. Set it before running the migration.');
    process.exit(1);
}

async function main() {
    console.log(`Reading SQLite source database from: ${sqliteDbPath}`);
    const sqliteDb = new Database(sqliteDbPath, { readonly: true });
    const pool = new Pool({
        connectionString: postgresUrl,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    });

    try {
        const schemaPath = path.join(__dirname, 'postgresSchema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        console.log('Creating PostgreSQL schema...');
        await pool.query(schemaSql);

        const tables = ['sources', 'events', 'articles', 'daily_digests', 'system_logs'];

        for (const table of tables) {
            const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
            console.log(`Migrating ${table}: ${rows.length} rows`);

            for (const row of rows) {
                const columns = Object.keys(row);
                const columnList = columns.map(column => `"${column}"`).join(', ');
                const values = columns.map((_, index) => `$${index + 1}`).join(', ');
                const assignments = columns
                    .filter(column => column !== 'id')
                    .map(column => `"${column}" = EXCLUDED."${column}"`)
                    .join(', ');

                const sql = `INSERT INTO ${table} (${columnList}) VALUES (${values}) ON CONFLICT (id) DO UPDATE SET ${assignments}`;
                await pool.query(sql, columns.map(column => row[column]));
            }
        }

        console.log('SQLite to PostgreSQL migration finished successfully.');
        console.log('Source database was not modified or deleted.');
    } catch (error) {
        console.error('Migration failed. No source database changes were made.');
        console.error(error.stack || error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
        sqliteDb.close();
    }
}

main();

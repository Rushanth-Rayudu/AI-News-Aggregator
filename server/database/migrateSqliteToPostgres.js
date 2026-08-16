require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
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

async function repairPostgresSchema(pool) {
    const expectedColumnsByTable = {
        sources: ['id', 'sourcename', 'feedurl', 'homepageurl', 'sourcetype', 'credibilitytier', 'enabled', 'pollinginterval', 'category', 'lastsuccessfulfetch', 'lasterror'],
        events: ['id', 'title', 'summary', 'whyitmatters', 'keypoints', 'category', 'importancescore', 'confidencescore', 'confidencelabel', 'discoveredat', 'updatedat'],
        articles: ['id', 'eventid', 'sourceid', 'title', 'description', 'content', 'url', 'imageurl', 'publishedat', 'discoveredat', 'fingerprint', 'isprimary'],
        daily_digests: ['id', 'sentat', 'content', 'status'],
        system_logs: ['id', 'level', 'module', 'message', 'timestamp'],
    };

    for (const [table, expectedColumns] of Object.entries(expectedColumnsByTable)) {
        const { rows } = await pool.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = $1 ORDER BY ordinal_position",
            [table]
        );
        const actualColumns = rows.map(row => row.column_name);

        for (const expectedColumn of expectedColumns) {
            if (actualColumns.includes(expectedColumn)) {
                continue;
            }

            const matchingColumn = actualColumns.find(column => column.toLowerCase() === expectedColumn.toLowerCase());
            if (matchingColumn && matchingColumn !== expectedColumn) {
                await pool.query(`ALTER TABLE "${table}" RENAME COLUMN "${matchingColumn}" TO "${expectedColumn}"`);
            }
        }
    }
}

async function hasExistingRow(pool, table, row) {
    if (table === 'sources') {
        const { rows } = await pool.query(
            `SELECT id FROM "${table}" WHERE "id" = $1 OR "feedurl" = $2 LIMIT 1`,
            [row.id, row.feedUrl]
        );
        return rows.length > 0;
    }

    if (table === 'articles') {
        const { rows } = await pool.query(
            `SELECT id FROM "${table}" WHERE "id" = $1 OR "url" = $2 OR "fingerprint" = $3 LIMIT 1`,
            [row.id, row.url, row.fingerprint]
        );
        return rows.length > 0;
    }

    const { rows } = await pool.query(
        `SELECT id FROM "${table}" WHERE "id" = $1 LIMIT 1`,
        [row.id]
    );
    return rows.length > 0;
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
        await repairPostgresSchema(pool);

        const tables = ['sources', 'events', 'articles', 'daily_digests', 'system_logs'];

        for (const table of tables) {
            const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
            let inserted = 0;
            console.log(`Migrating ${table}: ${rows.length} rows`);

            for (const row of rows) {
                const existing = await hasExistingRow(pool, table, row);
                if (existing) {
                    continue;
                }

                const columns = Object.keys(row);
                const normalizedColumns = columns.map(column => column.toLowerCase());
                const columnList = normalizedColumns.map(column => `"${column}"`).join(', ');
                const values = columns.map((_, index) => `$${index + 1}`).join(', ');
                const assignments = normalizedColumns
                    .filter(column => column !== 'id')
                    .map(column => `"${column}" = EXCLUDED."${column}"`)
                    .join(', ');

                const sql = `INSERT INTO "${table}" (${columnList}) VALUES (${values}) ON CONFLICT ("id") DO UPDATE SET ${assignments}`;
                await pool.query(sql, columns.map(column => row[column]));
                inserted += 1;
            }

            console.log(`Finished ${table}: ${inserted} inserted / ${rows.length} total`);
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

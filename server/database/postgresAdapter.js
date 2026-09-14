const { Pool } = require('pg');

function normalizeSqlForPostgres(sql) {
    if (!sql) return sql;

    let normalized = sql
        .replace(/datetime\(\s*'now'\s*,\s*'-(\d+)\s*hours?'\s*\)/gi, "CURRENT_TIMESTAMP - interval '$1 hours'")
        .replace(/datetime\(\s*'now'\s*,\s*'-(\d+)\s*days?'\s*\)/gi, "CURRENT_TIMESTAMP - interval '$1 days'")
        .replace(/datetime\(\s*'now'\s*,\s*'-(\d+)\s*minutes?'\s*\)/gi, "CURRENT_TIMESTAMP - interval '$1 minutes'");

    let paramIndex = 0;
    normalized = normalized.replace(/\?/g, () => {
        paramIndex += 1;
        return `$${paramIndex}`;
    });

    return normalized;
}

function normalizeParams(params) {
    return params.flat();
}

function camelizePostgresRow(row) {
    if (!row || typeof row !== 'object') return row;

    const mapping = {
        id: 'id',
        sourcename: 'sourceName',
        feedurl: 'feedUrl',
        homepageurl: 'homepageUrl',
        sourcetype: 'sourceType',
        credibilitytier: 'credibilityTier',
        enabled: 'enabled',
        pollinginterval: 'pollingInterval',
        category: 'category',
        lastsuccessfulfetch: 'lastSuccessfulFetch',
        lasterror: 'lastError',
        latestupdatedat: 'latestUpdatedAt',
        title: 'title',
        summary: 'summary',
        whyitmatters: 'whyItMatters',
        keypoints: 'keyPoints',
        importancescore: 'importanceScore',
        confidencescore: 'confidenceScore',
        confidencelabel: 'confidenceLabel',
        discoveredat: 'discoveredAt',
        updatedat: 'updatedAt',
        eventid: 'eventId',
        sourceid: 'sourceId',
        description: 'description',
        content: 'content',
        url: 'url',
        imageurl: 'imageUrl',
        publishedat: 'publishedAt',
        fingerprint: 'fingerprint',
        isprimary: 'isPrimary',
        sentat: 'sentAt',
        status: 'status',
        level: 'level',
        module: 'module',
        message: 'message',
        timestamp: 'timestamp'
    };

    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [mapping[key] ?? key, value])
    );
}

class PreparedQuery {
    constructor(pool, sql) {
        this.pool = pool;
        this.sql = normalizeSqlForPostgres(sql);
    }

    async get(...params) {
        const query = this.sql.trim();
        const sql = /\sLIMIT\s+/i.test(query) ? query : `${query} LIMIT 1`;
        const result = await this.pool.query(sql, normalizeParams(params));
        return camelizePostgresRow(result.rows[0]) || undefined;
    }

    async all(...params) {
        const result = await this.pool.query(this.sql, normalizeParams(params));
        return result.rows.map(camelizePostgresRow);
    }

    async run(...params) {
        let sql = this.sql;
        if (/^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql)) {
            sql = `${sql.trim()} RETURNING id`;
        }

        const result = await this.pool.query(sql, normalizeParams(params));
        const lastInsertRowid = result.rows && result.rows[0] && typeof result.rows[0].id !== 'undefined'
            ? result.rows[0].id
            : null;

        return {
            lastInsertRowid,
            changes: result.rowCount || 0,
            rowCount: result.rowCount || 0
        };
    }
}


async function runTransaction(pool, callback) {
    const client = await pool.connect();
    let connectionError;
    let releaseError;
    const onError = error => { connectionError ||= error; };
    client.on('error', onError);
    const query = async (...args) => {
        if (connectionError) throw connectionError;
        const result = await client.query(...args);
        if (connectionError) throw connectionError;
        return result;
    };
    const transactionClient = { query };
    try {
        await query('BEGIN');
        const result = await callback({
            pool: transactionClient,
            prepare: sql => new PreparedQuery(transactionClient, sql),
        });
        await query('COMMIT');
        return result;
    } catch (error) {
        releaseError = connectionError;
        if (!connectionError) {
            try { await client.query('ROLLBACK'); }
            catch (rollbackError) { releaseError = rollbackError; }
        }
        throw error;
    } finally {
        // Keep the listener attached until the pool owns or destroys the client.
        client.release(releaseError || connectionError);
        client.removeListener('error', onError);
    }
}

function createPostgresAdapter(connectionString) {
    const pool = new Pool({
        connectionString,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    });

    // The database host (e.g. the Supabase connection pooler) may terminate
    // an idle pooled connection at any time. pg-pool surfaces that as an
    // 'error' event on the Pool. Without a listener it becomes an *unhandled*
    // 'error' event, which crashes the entire Node process. That crash takes
    // the HTTP server down with it: the port stops listening and the Vite
    // proxy replies with 502 Bad Gateway for every /api request. pg-pool
    // removes and ends the affected idle client itself, so we only need to
    // observe the error to keep the process alive.
    pool.on('error', (err) => {
        console.error('[pg pool] idle connection dropped; next request will reconnect:', err.code || 'connection error');
    });

    return {
        pool,
        async withTransaction(callback) {
            return runTransaction(pool, callback);
        },
        prepare(query) {
            return new PreparedQuery(pool, query);
        },
        exec(query) {
            return pool.query(normalizeSqlForPostgres(query));
        },
        close() {
            return pool.end();
        },
    };
}

module.exports = {
    createPostgresAdapter,
    runTransaction,
    normalizeSqlForPostgres,
};

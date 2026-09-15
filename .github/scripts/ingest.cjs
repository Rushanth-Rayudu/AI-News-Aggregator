const https = require('node:https');
const { setTimeout: sleep } = require('node:timers/promises');

class IngestionError extends Error {}
function backendOrigin(raw) {
    const message = 'BACKEND_URL must contain the HTTPS Render service origin only (no /api, whitespace, quotes, credentials, query, or fragment). Configure the repository Actions secret.';
    try {
        if (!raw || !/^https:\/\//.test(raw) || /[\s"'\\]/.test(raw)) throw new Error();
        const url = new URL(raw);
        // Compare the literal suffix too: URL parsing would hide /api/.. paths.
        const suffix = raw.slice('https://'.length);
        if (url.protocol !== 'https:' || !url.hostname || !url.hostname.includes('.') || /[?#]/.test(raw) ||
            !url.hostname.split('.').every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)) ||
            url.username || url.password || url.search || url.hash ||
            !['', '/'].includes(url.pathname) || !/^[^/]+\/?$/.test(suffix)) throw new Error();
        return url.origin;
    } catch { throw new IngestionError(message); }
}
function configuration(env) {
    const origin = backendOrigin(env.BACKEND_URL);
    if (!env.INGEST_SECRET || !env.INGEST_SECRET.trim()) throw new IngestionError('INGEST_SECRET is missing. Configure the repository Actions secret to match Render; never paste it into logs or chat.');
    if (/[\r\n]/.test(env.INGEST_SECRET)) throw new IngestionError('INGEST_SECRET contains an invalid newline. Check the repository Actions secret.');
    return { origin, secret: env.INGEST_SECRET };
}

// Native HTTPS keeps credentials out of shell interpolation and process arguments.
// Do not follow redirects: the authentication header must stay at the given origin.
function requestJson(url, { method = 'GET', headers = {}, timeoutMs = 90000, connectTimeoutMs = 15000 } = {}, transport = https) {
    return new Promise((resolve, reject) => {
        let connectionTimer;
        const req = transport.request(url, { method, headers, agent: false }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => {
                body += chunk;
                if (Buffer.byteLength(body) > 65536) req.destroy(new IngestionError('Backend response exceeded the expected size.'));
            });
            res.on('error', () => req.destroy(new IngestionError('Backend response was interrupted.')));
            res.on('end', () => {
                clearTimeout(deadline); clearTimeout(connectionTimer);
                let json = null;
                try { json = JSON.parse(body); } catch { /* Validate without logging the body. */ }
                resolve({ status: res.statusCode, json });
            });
        });
        const deadline = setTimeout(() => req.destroy(new IngestionError('Backend request timed out.')), timeoutMs);
        req.on('socket', socket => {
            connectionTimer = setTimeout(() => req.destroy(new IngestionError('Backend connection timed out.')), connectTimeoutMs);
            socket.once(socket.encrypted ? 'secureConnect' : 'connect', () => clearTimeout(connectionTimer));
        });
        req.on('error', error => {
            clearTimeout(deadline); clearTimeout(connectionTimer);
            reject(error instanceof IngestionError ? error : new IngestionError('Backend network or TLS connection failed.'));
        });
        req.end();
    });
}

function validateCompletion(body) {
    const result = body?.result;
    const keys = ['sourcesTotal', 'attempted', 'succeeded', 'failed', 'skipped', 'articlesAdded'];
    if (!result || !keys.every(k => Number.isSafeInteger(result[k]) && result[k] >= 0) ||
        result.attempted + result.skipped !== result.sourcesTotal ||
        result.succeeded + result.failed !== result.attempted ||
        !Number.isFinite(Date.parse(result.completedAt)) ||
        !['completed', 'partial', 'failed'].includes(result.status)) {
        throw new IngestionError('Backend did not return a valid ingestion completion summary. Deploy the matching backend update; HTTP reachability alone is not ingestion success.');
    }
    return result;
}

async function run(env = process.env, { request = requestJson, wait = sleep, log = console.log } = {}) {
    const { origin, secret } = configuration(env);
    // Retry only this read-only wake-up request. A timed-out POST may still be
    // processing on Render; immediately retrying it could waste provider quota.
    let ready = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await request(origin + '/api/status', { timeoutMs: 90000 });
            if (response.status >= 200 && response.status < 300 && response.json?.sources) ready = true;
            else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                throw new IngestionError('Backend health endpoint returned HTTP ' + response.status + '. Check the service origin and deployment.');
            }
        } catch (error) {
            if (error instanceof IngestionError && error.message.startsWith('Backend health endpoint')) throw error;
        }
        if (ready) break;
        if (attempt < 3) { log('Backend is not ready; retrying the read-only wake-up check (' + attempt + '/3).'); await wait(15000); }
    }
    if (!ready) throw new IngestionError('Backend wake-up failed after three attempts (network, timeout, or invalid health response). No ingestion POST was sent.');
    log('Backend reachable. Waiting for authenticated ingestion to complete.');
    const response = await request(origin + '/api/internal/ingest', {
        method: 'POST', headers: { 'x-ingest-secret': secret }, timeoutMs: 1200000,
    });
    if (response.status === 401 || response.status === 403) throw new IngestionError('Ingestion authentication failed. Match the repository INGEST_SECRET to Render.');
    if (response.status < 200 || response.status >= 300) throw new IngestionError('Ingestion endpoint returned HTTP ' + response.status + '. Check Render logs; the POST was not retried.');
    const result = validateCompletion(response.json);
    log('Ingestion finished: ' + result.attempted + ' sources attempted, ' + result.succeeded + ' succeeded, ' +
        result.failed + ' failed, ' + result.skipped + ' not due; ' + result.articlesAdded + ' articles added.');
    if (!result.sourcesTotal) throw new IngestionError('No enabled sources were available for ingestion.');
    if (result.failed || result.status !== 'completed') throw new IngestionError('Ingestion finished with source failures. Some articles may have been saved; inspect source health and Render logs.');
    return result;
}
if (require.main === module) run().catch(error => {
    console.error(error instanceof IngestionError ? error.message : 'Scheduled ingestion failed. Inspect backend health and configuration.');
    process.exitCode = 1;
});
module.exports = { backendOrigin, configuration, requestJson, validateCompletion, run, IngestionError };

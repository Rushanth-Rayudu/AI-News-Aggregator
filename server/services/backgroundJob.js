// Background failures must not become unhandled rejections.
async function runBackgroundJob(label, job) {
    try { await job(); }
    catch {
        console.error('[' + label + '] Job failed; server remains running. Check database/network connectivity before retrying.');
    }
}
module.exports = { runBackgroundJob };

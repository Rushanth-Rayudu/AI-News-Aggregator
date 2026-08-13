const cron = require('node-cron');
const { runPipeline } = require('../services/processingPipeline');
const { sendDailyDigest } = require('../email/digestService');

function initScheduler() {
    if (process.env.ENABLE_INTERNAL_SCHEDULER === 'false') {
        console.log('[Scheduler] Internal scheduler disabled by ENABLE_INTERNAL_SCHEDULER=false');
        return;
    }

    const pollInterval = parseInt(process.env.POLL_INTERVAL_MINUTES || '10', 10);
    const digestHour = process.env.DIGEST_HOUR || '7';
    const digestMinute = process.env.DIGEST_MINUTE || '0';
    const digestTimezone = process.env.DIGEST_TIMEZONE || 'Asia/Kolkata';

    console.log(`Setting up RSS polling every ${pollInterval} minutes.`);
    cron.schedule(`*/${pollInterval} * * * *`, async () => {
        console.log(`[Cron] Starting scheduled RSS pipeline run at ${new Date().toISOString()}`);
        await runPipeline();
    });

    console.log(`Setting up daily digest at ${digestHour}:${digestMinute} timezone: ${digestTimezone}`);
    cron.schedule(`${digestMinute} ${digestHour} * * *`, async () => {
        console.log(`[Cron] Starting scheduled daily digest at ${new Date().toISOString()}`);
        await sendDailyDigest();
    }, {
        timezone: digestTimezone
    });

    setTimeout(() => {
        console.log("[Startup] Running initial pipeline fetch...");
        runPipeline();
    }, 2000);
}

module.exports = {
    initScheduler
};

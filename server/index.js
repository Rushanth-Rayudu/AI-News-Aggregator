require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const db = require('./database/db');
const { initScheduler } = require('./scheduler/cronJobs');
const apiRoutes = require('./routes/api');
const { runBackgroundJob } = require('./services/backgroundJob');
const { syncSourcesWithRegistry } = require('./services/processingPipeline');

const app = express();
const PORT = process.env.PORT || 8000;
const defaultCorsOrigins = [
    'http://localhost:5173',
    'http://localhost:5178',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5178',
    'http://127.0.0.1:3000',
];
const corsOrigins = (process.env.CORS_ORIGIN || defaultCorsOrigins.join(',')).split(',').map(v => v.trim()).filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
            return callback(null, true);
        }
        callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Serve static frontend build if client/dist exists
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
}

// Root landing page & SPA fallback
app.use((req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }

    const indexPath = path.join(clientDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
    }

    res.status(200).send(getLandingHtml(PORT));
});

// Sync source registry on startup
runBackgroundJob('Startup registry sync', syncSourcesWithRegistry);


// Start Scheduler
if (process.env.ENABLE_INTERNAL_SCHEDULER !== 'false') {
    initScheduler();
} else {
    console.log('[Scheduler] Internal scheduler disabled; production automation will trigger via GitHub Actions.');
}

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

function getLandingHtml(port) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI News Aggregator — API Portal</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #f1f5f9; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .card { background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; max-width: 650px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        .title-group { display: flex; align-items: center; gap: 12px; }
        .icon { width: 40px; height: 40px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; color: white; }
        h1 { font-size: 22px; font-weight: 700; color: #f8fafc; }
        .badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; padding: 6px 12px; border-radius: 9999px; font-size: 13px; font-weight: 500; }
        .dot { width: 8px; height: 8px; background: #4ade80; border-radius: 50%; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        p.desc { color: #94a3b8; line-height: 1.6; margin-bottom: 24px; font-size: 15px; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
        .endpoint-card { background: #0f172a; border: 1px solid #1e293b; padding: 14px; border-radius: 8px; display: block; text-decoration: none; color: inherit; transition: border-color 0.2s, transform 0.2s; }
        .endpoint-card:hover { border-color: #3b82f6; transform: translateY(-2px); }
        .method { font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 4px; }
        .path { font-family: monospace; font-size: 14px; color: #f1f5f9; font-weight: 600; }
        .btn-group { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
        .btn { padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; border: none; }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }
        .btn-secondary:hover { background: #334155; color: white; }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <div class="title-group">
                <div class="icon">AI</div>
                <div>
                    <h1>AI News Aggregator</h1>
                    <span style="color: #64748b; font-size: 13px;">Backend API & Ingestion Service</span>
                </div>
            </div>
            <div class="badge">
                <span class="dot"></span> Active (Port ${port})
            </div>
        </div>
        <p class="desc">
            AI News Aggregator provides RSS/Atom ingestion, event clustering, source evaluation, and optional Gemini analysis. Check system health for current source and configuration status.
        </p>
        <div class="grid">
            <a href="/api/status" target="_blank" class="endpoint-card">
                <div class="method">GET</div>
                <div class="path">/api/status</div>
            </a>
            <a href="/api/events" target="_blank" class="endpoint-card">
                <div class="method">GET</div>
                <div class="path">/api/events</div>
            </a>
            <a href="/api/sources" target="_blank" class="endpoint-card">
                <div class="method">GET</div>
                <div class="path">/api/sources</div>
            </a>
            <a href="/api" target="_blank" class="endpoint-card">
                <div class="method">GET</div>
                <div class="path">/api</div>
            </a>
        </div>
        <div class="btn-group">
            <a href="http://localhost:5178" class="btn btn-primary">Open React Dashboard (Port 5178) &rarr;</a>
            <a href="/api/status" class="btn btn-secondary">Check System Health</a>
        </div>
    </div>
</body>
</html>`;
}


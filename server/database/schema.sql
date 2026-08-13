-- ai_intelligence.db schema

CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sourceName TEXT NOT NULL,
    feedUrl TEXT UNIQUE NOT NULL,
    homepageUrl TEXT,
    sourceType TEXT, -- e.g., 'primary', 'research', 'journalism'
    credibilityTier INTEGER, -- e.g., 1 (highest), 2, 3
    enabled BOOLEAN DEFAULT 1,
    pollingInterval INTEGER DEFAULT 15,
    category TEXT,
    lastSuccessfulFetch DATETIME,
    lastError TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    whyItMatters TEXT,
    keyPoints TEXT, -- JSON array
    category TEXT,
    importanceScore INTEGER DEFAULT 0,
    confidenceScore INTEGER DEFAULT 0,
    confidenceLabel TEXT, -- 'High', 'Medium', 'Low'
    discoveredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER,
    sourceId INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    url TEXT UNIQUE NOT NULL,
    imageUrl TEXT,
    publishedAt DATETIME,
    discoveredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    fingerprint TEXT UNIQUE NOT NULL,
    isPrimary BOOLEAN DEFAULT 0,
    FOREIGN KEY(eventId) REFERENCES events(id),
    FOREIGN KEY(sourceId) REFERENCES sources(id)
);

CREATE TABLE IF NOT EXISTS daily_digests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sentAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    content TEXT,
    status TEXT -- 'success', 'error'
);

CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT, -- 'info', 'error', 'warning'
    module TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_publishedAt ON articles(publishedAt);
CREATE INDEX IF NOT EXISTS idx_articles_eventId ON articles(eventId);
CREATE INDEX IF NOT EXISTS idx_events_importanceScore ON events(importanceScore DESC);
CREATE INDEX IF NOT EXISTS idx_events_updatedAt ON events(updatedAt DESC);

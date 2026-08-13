CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    sourceName TEXT NOT NULL,
    feedUrl TEXT UNIQUE NOT NULL,
    homepageUrl TEXT,
    sourceType TEXT,
    credibilityTier INTEGER,
    enabled BOOLEAN DEFAULT TRUE,
    pollingInterval INTEGER DEFAULT 15,
    category TEXT,
    lastSuccessfulFetch TIMESTAMP,
    lastError TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    whyItMatters TEXT,
    keyPoints TEXT,
    category TEXT,
    importanceScore INTEGER DEFAULT 0,
    confidenceScore INTEGER DEFAULT 0,
    confidenceLabel TEXT,
    discoveredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    eventId INTEGER,
    sourceId INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT,
    url TEXT UNIQUE NOT NULL,
    imageUrl TEXT,
    publishedAt TIMESTAMP,
    discoveredAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fingerprint TEXT UNIQUE NOT NULL,
    isPrimary BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (eventId) REFERENCES events (id),
    FOREIGN KEY (sourceId) REFERENCES sources (id)
);

CREATE TABLE IF NOT EXISTS daily_digests (
    id SERIAL PRIMARY KEY,
    sentAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content TEXT,
    status TEXT
);

CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level TEXT,
    module TEXT,
    message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_publishedAt ON articles(publishedAt);
CREATE INDEX IF NOT EXISTS idx_articles_eventId ON articles(eventId);
CREATE INDEX IF NOT EXISTS idx_events_importanceScore ON events(importanceScore DESC);
CREATE INDEX IF NOT EXISTS idx_events_updatedAt ON events(updatedAt DESC);

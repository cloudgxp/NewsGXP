-- NewsGXP Phase 2 Initial D1 Schema
-- Stores ingested AI & Tech articles, Workers AI enrichments, seen-URL tombstones, and sync audit logs.

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  published_at TEXT,
  first_seen_at TEXT NOT NULL,
  sort_at TEXT NOT NULL,
  author TEXT,
  summary TEXT,
  ai_summary TEXT,
  ai_tags TEXT,
  ai_quality_score INTEGER,
  ai_enriched_at TEXT,
  image_url TEXT,
  categories TEXT,
  is_bookmarked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_articles_sort_at ON articles (sort_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_provider_sort ON articles (provider_id, sort_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_topic_sort ON articles (topic, sort_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_retention ON articles (is_bookmarked, sort_at);

-- Tombstones for previously discovered URLs so items pruned after 45 days are not re-ingested
-- or re-summarized when an upstream RSS/HTML page still lists older posts.
CREATE TABLE IF NOT EXISTS seen_urls (
  canonical_url TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_seen_urls_first_seen ON seen_urls (first_seen_at);

-- Audit log for scheduled (8:00 PM EST) and manual ingestion runs.
CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  providers_total INTEGER NOT NULL DEFAULT 0,
  providers_succeeded INTEGER NOT NULL DEFAULT 0,
  providers_failed INTEGER NOT NULL DEFAULT 0,
  articles_inserted INTEGER NOT NULL DEFAULT 0,
  articles_enriched INTEGER NOT NULL DEFAULT 0,
  articles_pruned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started ON sync_runs (started_at DESC);

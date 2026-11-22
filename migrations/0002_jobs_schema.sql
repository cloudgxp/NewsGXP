-- NewsGXP Phase 3/4 D1 Schema
-- Stores remote AI job postings aggregated directly from company career pages,
-- Workers AI verification/summaries, and daily job sync audit logs.

CREATE TABLE IF NOT EXISTS job_postings (
  id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  company_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  department TEXT,
  location_raw TEXT NOT NULL,
  work_mode TEXT NOT NULL,
  region TEXT NOT NULL,
  ai_category TEXT NOT NULL,
  salary_range TEXT,
  description_snippet TEXT,
  ai_summary TEXT,
  ai_verified_remote INTEGER,
  ai_verified_ai INTEGER,
  ai_enriched_at TEXT,
  posted_at TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_bookmarked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_jobs_active_first_seen ON job_postings (is_active, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company_active ON job_postings (company_id, is_active, first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_category_region ON job_postings (is_active, ai_category, region);
CREATE INDEX IF NOT EXISTS idx_jobs_retention ON job_postings (is_active, is_bookmarked, last_seen_at);

CREATE TABLE IF NOT EXISTS job_sync_runs (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  companies_total INTEGER NOT NULL DEFAULT 0,
  companies_succeeded INTEGER NOT NULL DEFAULT 0,
  companies_failed INTEGER NOT NULL DEFAULT 0,
  jobs_discovered INTEGER NOT NULL DEFAULT 0,
  jobs_active INTEGER NOT NULL DEFAULT 0,
  jobs_closed INTEGER NOT NULL DEFAULT 0,
  jobs_enriched INTEGER NOT NULL DEFAULT 0,
  jobs_pruned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_sync_runs_started ON job_sync_runs (started_at DESC);

/**
 * Direct Company Career-Page Ingestion Pipeline (Phase 3 & 4)
 *
 * 1. Fetches all 21 official company career portals via plain fetch() in gentle batches
 * 2. Upserts matched remote AI jobs into D1 while preserving original `first_seen_at`
 * 3. Snapshot-diffs each succeeding company: unseen roles are marked `is_active = 0`
 *    (failed fetches never close existing roles)
 * 4. Enriches up to MAX_AI_JOBS_ENRICH_PER_RUN unenriched active jobs via Workers AI
 * 5. Purges closed, unbookmarked jobs older than RETENTION_DAYS (default 45 days)
 */

import { CompanyCareerConfig, TRACKED_COMPANIES } from '../src/config/companies';
import { enrichJobWithWorkersAI } from './enrich';
import { ParsedJob, parseCompanyJobsResponse } from './jobParsers';

export interface JobIngestionEnv {
  DB: D1Database;
  AI?: Ai;
  RETENTION_DAYS?: string;
  MAX_AI_JOBS_ENRICH_PER_RUN?: string;
}

export interface JobIngestionReport {
  runId: string;
  triggerType: 'cron' | 'manual';
  startedAt: string;
  finishedAt: string;
  companiesTotal: number;
  companiesSucceeded: number;
  companiesFailed: number;
  jobsDiscovered: number;
  jobsActive: number;
  jobsClosed: number;
  jobsEnriched: number;
  jobsPruned: number;
  status: 'completed' | 'partial' | 'failed';
  failedCompanies: string[];
}

const DEFAULT_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/2.0';

async function fetchCompanyJobs(company: CompanyCareerConfig): Promise<ParsedJob[]> {
  const isHtml = company.ats === 'google_careers';
  const res = await fetch(company.apiUrl, {
    headers: {
      'User-Agent': DEFAULT_BROWSER_UA,
      Accept: isHtml
        ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        : 'application/json, text/plain, */*',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${company.name} careers`);
  }

  const body = await res.text();
  return parseCompanyJobsResponse(body, company);
}

export async function runJobsIngestion(
  env: JobIngestionEnv,
  triggerType: 'cron' | 'manual',
  options?: { companyIds?: string[]; skipAi?: boolean }
): Promise<JobIngestionReport> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const retentionDays = Math.max(1, Number(env.RETENTION_DAYS || '45') || 45);
  const maxAiEnrich = Math.max(0, Number(env.MAX_AI_JOBS_ENRICH_PER_RUN || '60') || 60);
  const cutoffIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const targetCompanies = options?.companyIds?.length
    ? TRACKED_COMPANIES.filter((c) => options.companyIds!.includes(c.id))
    : TRACKED_COMPANIES;

  await env.DB.prepare(
    `INSERT INTO job_sync_runs (id, trigger_type, started_at, companies_total, status)
     VALUES (?, ?, ?, ?, 'running')`
  )
    .bind(runId, triggerType, startedAt, targetCompanies.length)
    .run();

  let companiesSucceeded = 0;
  let companiesFailed = 0;
  let jobsDiscovered = 0;
  let jobsClosed = 0;
  const failedCompanies: string[] = [];

  // Fetch gently in batches of 4
  const BATCH_SIZE = 4;
  for (let i = 0; i < targetCompanies.length; i += BATCH_SIZE) {
    const batch = targetCompanies.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(batch.map((c) => fetchCompanyJobs(c)));

    for (let idx = 0; idx < batch.length; idx++) {
      const company = batch[idx];
      const result = settled[idx];

      if (result.status !== 'fulfilled') {
        companiesFailed++;
        failedCompanies.push(`${company.id}: ${result.reason?.message || 'Fetch error'}`);
        console.warn(`[JobIngest] Company ${company.id} failed:`, result.reason);
        continue;
      }

      companiesSucceeded++;
      const companySyncAt = new Date().toISOString();

      // Deduplicate within company payload by canonicalUrl
      const deduped = new Map<string, ParsedJob>();
      for (const job of result.value) {
        if (!deduped.has(job.canonicalUrl)) {
          deduped.set(job.canonicalUrl, job);
        }
      }
      const uniqueJobs = Array.from(deduped.values());

      // Check which URLs are genuinely new so we can count discoveries accurately
      const seenBefore = new Set<string>();
      const urls = uniqueJobs.map((j) => j.canonicalUrl);
      const LOOKUP_CHUNK = 80;
      for (let k = 0; k < urls.length; k += LOOKUP_CHUNK) {
        const slice = urls.slice(k, k + LOOKUP_CHUNK);
        const placeholders = slice.map(() => '?').join(',');
        const { results } = await env.DB.prepare(
          `SELECT canonical_url FROM job_postings WHERE canonical_url IN (${placeholders})`
        )
          .bind(...slice)
          .all<{ canonical_url: string }>();
        for (const r of results) {
          seenBefore.add(r.canonical_url);
        }
      }

      // Upsert matched jobs in chunks (never overwriting first_seen_at!)
      const WRITE_CHUNK = 30;
      for (let k = 0; k < uniqueJobs.length; k += WRITE_CHUNK) {
        const chunk = uniqueJobs.slice(k, k + WRITE_CHUNK);
        const stmts = chunk.map((job) => {
          if (!seenBefore.has(job.canonicalUrl)) {
            jobsDiscovered++;
          }
          return env.DB.prepare(
            `INSERT INTO job_postings (
              id, canonical_url, company_id, company_name, title, url, department,
              location_raw, work_mode, region, ai_category, salary_range,
              description_snippet, posted_at, first_seen_at, last_seen_at, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ON CONFLICT(canonical_url) DO UPDATE SET
              title = excluded.title,
              department = COALESCE(excluded.department, job_postings.department),
              location_raw = excluded.location_raw,
              work_mode = excluded.work_mode,
              region = excluded.region,
              ai_category = excluded.ai_category,
              salary_range = COALESCE(excluded.salary_range, job_postings.salary_range),
              description_snippet = COALESCE(excluded.description_snippet, job_postings.description_snippet),
              posted_at = COALESCE(excluded.posted_at, job_postings.posted_at),
              last_seen_at = excluded.last_seen_at,
              is_active = 1`
          ).bind(
            job.id,
            job.canonicalUrl,
            job.companyId,
            job.companyName,
            job.title,
            job.url,
            job.department,
            job.locationRaw,
            job.workMode,
            job.region,
            job.aiCategory,
            job.salaryRange,
            job.descriptionSnippet,
            job.postedAt,
            companySyncAt,
            companySyncAt
          );
        });

        await env.DB.batch(stmts);
      }

      // Close postings for this succeeding company that vanished since last sync
      const closeRes = await env.DB.prepare(
        `UPDATE job_postings
         SET is_active = 0
         WHERE company_id = ? AND last_seen_at < ? AND is_active = 1`
      )
        .bind(company.id, companySyncAt)
        .run();
      jobsClosed += closeRes.meta?.changes ?? 0;
    }
  }

  // Enrich up to MAX_AI_JOBS_ENRICH_PER_RUN active unenriched jobs via Workers AI
  let jobsEnriched = 0;
  if (env.AI && !options?.skipAi && maxAiEnrich > 0) {
    const { results: unenriched } = await env.DB.prepare(
      `SELECT id, company_name, title, department, location_raw, ai_category, description_snippet
       FROM job_postings
       WHERE is_active = 1 AND ai_enriched_at IS NULL
       ORDER BY first_seen_at DESC
       LIMIT ?`
    )
      .bind(maxAiEnrich)
      .all<{
        id: string;
        company_name: string;
        title: string;
        department: string | null;
        location_raw: string;
        ai_category: string;
        description_snippet: string | null;
      }>();

    const AI_CONCURRENCY = 6;
    for (let i = 0; i < unenriched.length; i += AI_CONCURRENCY) {
      const group = unenriched.slice(i, i + AI_CONCURRENCY);
      const enrichments = await Promise.all(
        group.map((row) =>
          enrichJobWithWorkersAI(env.AI!, {
            id: row.id,
            companyName: row.company_name,
            title: row.title,
            department: row.department,
            locationRaw: row.location_raw,
            aiCategory: row.ai_category,
            descriptionSnippet: row.description_snippet,
          })
        )
      );

      const updateStmts: D1PreparedStatement[] = [];
      const enrichedAt = new Date().toISOString();
      enrichments.forEach((res, idx) => {
        if (!res) return;
        const row = group[idx];
        updateStmts.push(
          env.DB.prepare(
            `UPDATE job_postings
             SET ai_summary = ?, ai_verified_remote = ?, ai_verified_ai = ?,
                 ai_category = COALESCE(?, ai_category), ai_enriched_at = ?
             WHERE id = ?`
          ).bind(
            res.summary,
            res.isRemote ? 1 : 0,
            res.isAiRole ? 1 : 0,
            res.aiCategory,
            enrichedAt,
            row.id
          )
        );
      });

      if (updateStmts.length > 0) {
        await env.DB.batch(updateStmts);
        jobsEnriched += updateStmts.length;
      }
    }
  }

  // Purge closed, unbookmarked jobs older than RETENTION_DAYS (never delete still-active jobs)
  const pruneRes = await env.DB.prepare(
    `DELETE FROM job_postings
     WHERE is_active = 0 AND is_bookmarked = 0 AND last_seen_at < ?`
  )
    .bind(cutoffIso)
    .run();
  const jobsPruned = pruneRes.meta?.changes ?? 0;

  // Tidy sync logs > 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(`DELETE FROM job_sync_runs WHERE started_at < ?`)
    .bind(ninetyDaysAgo)
    .run();

  const activeCountRow = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM job_postings
     WHERE is_active = 1
       AND (ai_verified_remote IS NULL OR ai_verified_remote = 1)
       AND (ai_verified_ai IS NULL OR ai_verified_ai = 1)`
  ).first<{ total: number }>();
  const jobsActive = activeCountRow?.total ?? 0;

  const finishedAt = new Date().toISOString();
  const status: 'completed' | 'partial' | 'failed' =
    companiesFailed === 0
      ? 'completed'
      : companiesSucceeded > 0
        ? 'partial'
        : 'failed';

  await env.DB.prepare(
    `UPDATE job_sync_runs
     SET finished_at = ?, companies_succeeded = ?, companies_failed = ?,
         jobs_discovered = ?, jobs_active = ?, jobs_closed = ?,
         jobs_enriched = ?, jobs_pruned = ?, status = ?, error_summary = ?
     WHERE id = ?`
  )
    .bind(
      finishedAt,
      companiesSucceeded,
      companiesFailed,
      jobsDiscovered,
      jobsActive,
      jobsClosed,
      jobsEnriched,
      jobsPruned,
      status,
      failedCompanies.length > 0 ? failedCompanies.join(' | ').slice(0, 1000) : null,
      runId
    )
    .run();

  return {
    runId,
    triggerType,
    startedAt,
    finishedAt,
    companiesTotal: targetCompanies.length,
    companiesSucceeded,
    companiesFailed,
    jobsDiscovered,
    jobsActive,
    jobsClosed,
    jobsEnriched,
    jobsPruned,
    status,
    failedCompanies,
  };
}

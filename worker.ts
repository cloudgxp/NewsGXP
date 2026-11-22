import { onRequestGet } from './functions/api/feed/[provider]';
import { ALLOWED_FEEDS } from './src/config/feeds';
import { TRACKED_COMPANIES } from './src/config/companies';
import { Article, JobPosting, JobSyncRunSummary, SyncRunSummary } from './src/types';
import { runNewsIngestion } from './worker/ingest';
import { runJobsIngestion } from './worker/jobIngest';

export interface WorkerEnv extends Env {
  SYNC_SECRET?: string;
}

interface ArticleRow {
  id: string;
  url: string;
  title: string;
  provider_id: string;
  topic: string;
  published_at: string | null;
  first_seen_at: string;
  sort_at: string;
  author: string | null;
  summary: string | null;
  ai_summary: string | null;
  ai_tags: string | null;
  ai_quality_score: number | null;
  image_url: string | null;
  categories: string | null;
}

interface SyncRunRow {
  id: string;
  trigger_type: string;
  started_at: string;
  finished_at: string | null;
  providers_total: number;
  providers_succeeded: number;
  providers_failed: number;
  articles_inserted: number;
  articles_enriched: number;
  articles_pruned: number;
  status: string;
}

interface JobRow {
  id: string;
  company_id: string;
  company_name: string;
  title: string;
  url: string;
  department: string | null;
  location_raw: string;
  work_mode: 'remote' | 'hybrid' | 'onsite';
  region: string;
  ai_category: string;
  salary_range: string | null;
  description_snippet: string | null;
  ai_summary: string | null;
  ai_verified_remote: number | null;
  ai_verified_ai: number | null;
  posted_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: number;
}

interface JobSyncRunRow {
  id: string;
  trigger_type: string;
  started_at: string;
  finished_at: string | null;
  companies_total: number;
  companies_succeeded: number;
  companies_failed: number;
  jobs_discovered: number;
  jobs_active: number;
  jobs_closed: number;
  jobs_enriched: number;
  jobs_pruned: number;
  status: string;
}

const BASE_ACTIVE_JOB_FILTER =
  'is_active = 1 AND (ai_verified_remote IS NULL OR ai_verified_remote = 1) AND (ai_verified_ai IS NULL OR ai_verified_ai = 1)';

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
};

function jsonResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      ...(extraHeaders || {}),
    },
  });
}

function safeParseStringArray(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // Ignore malformed JSON
  }
  return undefined;
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

function mapArticleRow(row: ArticleRow): Article {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    providerId: row.provider_id,
    publishedAt: row.published_at || row.first_seen_at,
    firstSeenAt: row.first_seen_at,
    sortAt: row.sort_at,
    author: row.author || undefined,
    summary: row.summary || undefined,
    aiSummary: row.ai_summary || undefined,
    aiTags: safeParseStringArray(row.ai_tags),
    aiQualityScore: row.ai_quality_score ?? undefined,
    imageUrl: row.image_url || undefined,
    categories: safeParseStringArray(row.categories),
  };
}

function mapSyncRun(row: SyncRunRow | null): SyncRunSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    triggerType: row.trigger_type,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    providersTotal: row.providers_total,
    providersSucceeded: row.providers_succeeded,
    providersFailed: row.providers_failed,
    articlesInserted: row.articles_inserted,
    articlesEnriched: row.articles_enriched,
    articlesPruned: row.articles_pruned,
    status: row.status,
  };
}

function mapJobRow(row: JobRow): JobPosting {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name,
    title: row.title,
    url: row.url,
    department: row.department || undefined,
    locationRaw: row.location_raw,
    workMode: row.work_mode,
    region: row.region,
    aiCategory: row.ai_category,
    salaryRange: row.salary_range || undefined,
    descriptionSnippet: row.description_snippet || undefined,
    aiSummary: row.ai_summary || undefined,
    aiVerifiedRemote:
      row.ai_verified_remote === null ? undefined : row.ai_verified_remote === 1,
    aiVerifiedAi: row.ai_verified_ai === null ? undefined : row.ai_verified_ai === 1,
    postedAt: row.posted_at || undefined,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    isActive: row.is_active === 1,
  };
}

function mapJobSyncRun(row: JobSyncRunRow | null): JobSyncRunSummary | null {
  if (!row) return null;
  return {
    id: row.id,
    triggerType: row.trigger_type,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    companiesTotal: row.companies_total,
    companiesSucceeded: row.companies_succeeded,
    companiesFailed: row.companies_failed,
    jobsDiscovered: row.jobs_discovered,
    jobsActive: row.jobs_active,
    jobsClosed: row.jobs_closed,
    jobsEnriched: row.jobs_enriched,
    jobsPruned: row.jobs_pruned,
    status: row.status,
  };
}

async function fetchLatestNewsSyncRun(db: D1Database, excludeRunning = false): Promise<SyncRunSummary | null> {
  try {
    const where = excludeRunning ? `WHERE status != 'running'` : '';
    const row = await db
      .prepare(
        `SELECT id, trigger_type, started_at, finished_at, providers_total,
                providers_succeeded, providers_failed, articles_inserted,
                articles_enriched, articles_pruned, status
         FROM sync_runs
         ${where}
         ORDER BY started_at DESC
         LIMIT 1`
      )
      .first<SyncRunRow>();
    return mapSyncRun(row ?? null);
  } catch {
    return null;
  }
}

async function fetchLatestJobSyncRun(db: D1Database, excludeRunning = false): Promise<JobSyncRunSummary | null> {
  try {
    const where = excludeRunning ? `WHERE status != 'running'` : '';
    const row = await db
      .prepare(
        `SELECT id, trigger_type, started_at, finished_at, companies_total,
                companies_succeeded, companies_failed, jobs_discovered,
                jobs_active, jobs_closed, jobs_enriched, jobs_pruned, status
         FROM job_sync_runs
         ${where}
         ORDER BY started_at DESC
         LIMIT 1`
      )
      .first<JobSyncRunRow>();
    return mapJobSyncRun(row ?? null);
  } catch {
    return null;
  }
}

async function handleGetArticles(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.DB) {
    return jsonResponse({ error: 'D1 database binding (DB) is not configured' }, 503);
  }

  const url = new URL(request.url);
  const providersParam = url.searchParams.get('providers');
  const topicParam = url.searchParams.get('topic')?.trim() || null;
  const searchParam = url.searchParams.get('q')?.trim() || null;
  const daysParam = Number(url.searchParams.get('days') || '0');
  const limitParam = Math.min(250, Math.max(1, Number(url.searchParams.get('limit') || '150') || 150));
  const offsetParam = Math.max(0, Number(url.searchParams.get('offset') || '0') || 0);

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (providersParam !== null) {
    const requestedIds = providersParam
      .split(',')
      .map((s) => s.trim())
      .filter((id) => Boolean(ALLOWED_FEEDS[id]));

    if (requestedIds.length === 0) {
      return jsonResponse({
        articles: [],
        total: 0,
        lastSyncedAt: null,
        lastSyncRun: null,
        needsInitialSync: false,
      });
    }

    conditions.push(`provider_id IN (${requestedIds.map(() => '?').join(',')})`);
    params.push(...requestedIds);
  }

  if (topicParam) {
    conditions.push('topic = ?');
    params.push(topicParam);
  }

  if (Number.isFinite(daysParam) && daysParam > 0) {
    const sinceIso = new Date(Date.now() - daysParam * 24 * 60 * 60 * 1000).toISOString();
    conditions.push('sort_at >= ?');
    params.push(sinceIso);
  }

  if (searchParam) {
    const like = `%${searchParam.toLowerCase()}%`;
    conditions.push(
      "(LOWER(title) LIKE ? OR LOWER(COALESCE(summary, '')) LIKE ? OR LOWER(COALESCE(ai_summary, '')) LIKE ? OR LOWER(COALESCE(author, '')) LIKE ?)"
    );
    params.push(like, like, like, like);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [articlesRes, countRes, lastSyncRun, totalStoredRes] = await Promise.all([
      env.DB.prepare(
        `SELECT id, url, title, provider_id, topic, published_at, first_seen_at, sort_at,
                author, summary, ai_summary, ai_tags, ai_quality_score, image_url, categories
         FROM articles
         ${whereClause}
         ORDER BY sort_at DESC
         LIMIT ? OFFSET ?`
      )
        .bind(...params, limitParam, offsetParam)
        .all<ArticleRow>(),
      env.DB.prepare(`SELECT COUNT(*) as total FROM articles ${whereClause}`)
        .bind(...params)
        .first<{ total: number }>(),
      fetchLatestNewsSyncRun(env.DB, true),
      env.DB.prepare(`SELECT COUNT(*) as total FROM articles`).first<{ total: number }>(),
    ]);

    const articles = articlesRes.results.map(mapArticleRow);
    const totalStored = totalStoredRes?.total ?? 0;

    return jsonResponse(
      {
        articles,
        total: countRes?.total ?? articles.length,
        lastSyncedAt: lastSyncRun?.finishedAt || lastSyncRun?.startedAt || null,
        lastSyncRun,
        needsInitialSync: totalStored === 0 && !lastSyncRun,
      },
      200,
      CACHE_HEADERS
    );
  } catch (err: unknown) {
    console.error('[API /api/articles] D1 query error:', err);
    return jsonResponse(
      {
        error: 'Failed to load articles from D1 database',
        details: err instanceof Error ? err.message : 'Unknown database error',
      },
      500
    );
  }
}

async function handleGetJobs(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.DB) {
    return jsonResponse({ error: 'D1 database binding (DB) is not configured' }, 503);
  }

  const url = new URL(request.url);
  const companyParam = url.searchParams.get('company')?.trim() || null;
  const categoryParam = url.searchParams.get('category')?.trim() || null;
  const regionParam = url.searchParams.get('region')?.trim() || null;
  const searchParam = url.searchParams.get('q')?.trim() || null;
  const newThisWeekParam = url.searchParams.get('newThisWeek');
  const newThisWeekOnly = newThisWeekParam === '1' || newThisWeekParam === 'true';
  const limitParam = Math.min(250, Math.max(1, Number(url.searchParams.get('limit') || '150') || 150));
  const offsetParam = Math.max(0, Number(url.searchParams.get('offset') || '0') || 0);

  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const conditions: string[] = [BASE_ACTIVE_JOB_FILTER];
  const params: unknown[] = [];

  if (companyParam) {
    conditions.push('company_id = ?');
    params.push(companyParam);
  }

  if (categoryParam) {
    conditions.push('ai_category = ?');
    params.push(categoryParam);
  }

  if (regionParam) {
    conditions.push('region = ?');
    params.push(regionParam);
  }

  if (newThisWeekOnly) {
    conditions.push('first_seen_at >= ?');
    params.push(sevenDaysAgoIso);
  }

  if (searchParam) {
    const like = `%${searchParam.toLowerCase()}%`;
    conditions.push(
      "(LOWER(title) LIKE ? OR LOWER(company_name) LIKE ? OR LOWER(COALESCE(department, '')) LIKE ? OR LOWER(COALESCE(ai_summary, '')) LIKE ? OR LOWER(COALESCE(description_snippet, '')) LIKE ?)"
    );
    params.push(like, like, like, like, like);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  try {
    const [jobsRes, countRes, newWeekRes, companyCountsRes, lastSyncRun, totalActiveRes] =
      await Promise.all([
        env.DB.prepare(
          `SELECT id, company_id, company_name, title, url, department, location_raw,
                  work_mode, region, ai_category, salary_range, description_snippet,
                  ai_summary, ai_verified_remote, ai_verified_ai, posted_at,
                  first_seen_at, last_seen_at, is_active
           FROM job_postings
           ${whereClause}
           ORDER BY first_seen_at DESC, COALESCE(posted_at, first_seen_at) DESC
           LIMIT ? OFFSET ?`
        )
          .bind(...params, limitParam, offsetParam)
          .all<JobRow>(),
        env.DB.prepare(`SELECT COUNT(*) as total FROM job_postings ${whereClause}`)
          .bind(...params)
          .first<{ total: number }>(),
        env.DB.prepare(
          `SELECT COUNT(*) as total FROM job_postings
           WHERE ${BASE_ACTIVE_JOB_FILTER} AND first_seen_at >= ?`
        )
          .bind(sevenDaysAgoIso)
          .first<{ total: number }>(),
        env.DB.prepare(
          `SELECT company_id, COUNT(*) as cnt FROM job_postings
           WHERE ${BASE_ACTIVE_JOB_FILTER}
           GROUP BY company_id`
        ).all<{ company_id: string; cnt: number }>(),
        fetchLatestJobSyncRun(env.DB, true),
        env.DB.prepare(`SELECT COUNT(*) as total FROM job_postings`).first<{ total: number }>(),
      ]);

    const companyCounts: Record<string, number> = {};
    for (const row of companyCountsRes.results) {
      companyCounts[row.company_id] = row.cnt;
    }

    const jobs = jobsRes.results.map(mapJobRow);
    const totalStored = totalActiveRes?.total ?? 0;

    return jsonResponse(
      {
        jobs,
        total: countRes?.total ?? jobs.length,
        newThisWeekCount: newWeekRes?.total ?? 0,
        companyCounts,
        lastSyncedAt: lastSyncRun?.finishedAt || lastSyncRun?.startedAt || null,
        lastSyncRun,
        needsInitialSync: totalStored === 0 && !lastSyncRun,
      },
      200,
      CACHE_HEADERS
    );
  } catch (err: unknown) {
    console.error('[API /api/jobs] D1 query error:', err);
    return jsonResponse(
      {
        error: 'Failed to load remote AI jobs from D1 database',
        details: err instanceof Error ? err.message : 'Unknown database error',
      },
      500
    );
  }
}

function buildWeeklyDigestMarkdown(
  topArticles: Article[],
  newJobs: JobPosting[],
  generatedAt: string
): string {
  const dateLabel = generatedAt.slice(0, 10);
  const lines: string[] = [
    `# AI & Tech Weekly Briefing + Remote AI Jobs (${dateLabel})`,
    '',
    '## Top AI & Tech Stories This Week',
    '',
  ];

  if (topArticles.length === 0) {
    lines.push('_No new stories recorded in the past 7 days._', '');
  } else {
    for (const art of topArticles) {
      const note = art.aiSummary || art.summary;
      const signal =
        art.aiQualityScore && art.aiQualityScore >= 4 ? ` [Signal ${art.aiQualityScore}/5]` : '';
      lines.push(`- **[${art.title}](${art.url})** (${art.providerId})${signal}`);
      if (note) {
        lines.push(`  - ${note}`);
      }
    }
    lines.push('');
  }

  lines.push('## New Remote AI Jobs This Week', '');

  if (newJobs.length === 0) {
    lines.push('_No new remote AI roles discovered in the past 7 days._', '');
  } else {
    for (const job of newJobs) {
      const details = [job.aiCategory, job.region, job.salaryRange].filter(Boolean).join(' • ');
      lines.push(`- **${job.companyName}** — [${job.title}](${job.url}) (${details})`);
      if (job.aiSummary) {
        lines.push(`  - ${job.aiSummary}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function handleGetWeeklyDigest(env: WorkerEnv): Promise<Response> {
  if (!env.DB) {
    return jsonResponse({ error: 'D1 database binding (DB) is not configured' }, 503);
  }

  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const generatedAt = new Date().toISOString();

  try {
    const [articlesRes, jobsRes] = await Promise.all([
      env.DB.prepare(
        `SELECT id, url, title, provider_id, topic, published_at, first_seen_at, sort_at,
                author, summary, ai_summary, ai_tags, ai_quality_score, image_url, categories
         FROM articles
         WHERE sort_at >= ?
         ORDER BY COALESCE(ai_quality_score, 3) DESC, sort_at DESC
         LIMIT 15`
      )
        .bind(sevenDaysAgoIso)
        .all<ArticleRow>(),
      env.DB.prepare(
        `SELECT id, company_id, company_name, title, url, department, location_raw,
                work_mode, region, ai_category, salary_range, description_snippet,
                ai_summary, ai_verified_remote, ai_verified_ai, posted_at,
                first_seen_at, last_seen_at, is_active
         FROM job_postings
         WHERE ${BASE_ACTIVE_JOB_FILTER} AND first_seen_at >= ?
         ORDER BY first_seen_at DESC
         LIMIT 30`
      )
        .bind(sevenDaysAgoIso)
        .all<JobRow>(),
    ]);

    const topArticles = articlesRes.results.map(mapArticleRow);
    const newJobs = jobsRes.results.map(mapJobRow);
    const markdown = buildWeeklyDigestMarkdown(topArticles, newJobs, generatedAt);

    return jsonResponse(
      {
        generatedAt,
        windowDays: 7,
        topArticles,
        newJobs,
        markdown,
      },
      200,
      CACHE_HEADERS
    );
  } catch (err: unknown) {
    console.error('[API /api/digest/weekly] D1 query error:', err);
    return jsonResponse(
      {
        error: 'Failed to generate weekly digest',
        details: err instanceof Error ? err.message : 'Unknown database error',
      },
      500
    );
  }
}

async function handleManualSync(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.DB) {
    return jsonResponse({ error: 'D1 database binding (DB) is not configured' }, 503);
  }

  // Require Bearer token when SYNC_SECRET is configured (production)
  if (env.SYNC_SECRET) {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const valid = token.length > 0 && (await constantTimeEqual(token, env.SYNC_SECRET));
    if (!valid) {
      return jsonResponse({ error: 'Unauthorized sync trigger' }, 401);
    }
  }

  let target: 'all' | 'news' | 'jobs' = 'all';
  let providerIds: string[] | undefined;
  let companyIds: string[] | undefined;
  let skipAi = false;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as {
        target?: 'all' | 'news' | 'jobs';
        providers?: string[];
        companies?: string[];
        skipAi?: boolean;
      };
      if (body.target === 'news' || body.target === 'jobs' || body.target === 'all') {
        target = body.target;
      }
      if (Array.isArray(body.providers)) {
        providerIds = body.providers;
      }
      if (Array.isArray(body.companies)) {
        companyIds = body.companies;
      }
      if (typeof body.skipAi === 'boolean') {
        skipAi = body.skipAi;
      }
    }
  } catch {
    // Allow empty POST body
  }

  if (target === 'news') {
    const news = await runNewsIngestion(env, 'manual', { providerIds, skipAi });
    return jsonResponse({ target: 'news', ...news }, 200);
  }

  if (target === 'jobs') {
    const jobs = await runJobsIngestion(env, 'manual', { companyIds, skipAi });
    return jsonResponse({ target: 'jobs', ...jobs }, 200);
  }

  const news = await runNewsIngestion(env, 'manual', { providerIds, skipAi });
  const jobs = await runJobsIngestion(env, 'manual', { companyIds, skipAi });
  return jsonResponse({ target: 'all', news, jobs }, 200);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      const [lastSyncRun, lastJobSyncRun] = env.DB
        ? await Promise.all([
            fetchLatestNewsSyncRun(env.DB, false),
            fetchLatestJobSyncRun(env.DB, false),
          ])
        : [null, null];

      return jsonResponse({
        status: 'ok',
        name: 'NewsGXP',
        tagline: 'AI & Tech news. Your providers.',
        providersCount: Object.keys(ALLOWED_FEEDS).length,
        companiesCount: TRACKED_COMPANIES.length,
        hasDatabase: Boolean(env.DB),
        hasWorkersAI: Boolean(env.AI),
        lastSyncRun,
        lastJobSyncRun,
        time: new Date().toISOString(),
      });
    }

    if (url.pathname === '/api/articles' && request.method === 'GET') {
      return handleGetArticles(request, env);
    }

    if (url.pathname === '/api/jobs' && request.method === 'GET') {
      return handleGetJobs(request, env);
    }

    if (url.pathname === '/api/digest/weekly' && request.method === 'GET') {
      return handleGetWeeklyDigest(env);
    }

    if (url.pathname === '/api/sync' && request.method === 'POST') {
      return handleManualSync(request, env);
    }

    const match = url.pathname.match(/^\/api\/feed\/([^/]+)$/);
    if (match && request.method === 'GET') {
      const provider = decodeURIComponent(match[1]);
      return onRequestGet({
        request,
        params: { provider },
        env,
      });
    }

    // Serve static assets from Vite build
    return env.ASSETS.fetch(request);
  },

  async scheduled(
    _controller: ScheduledController,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const newsReport = await runNewsIngestion(env, 'cron');
        console.log(
          JSON.stringify({
            event: 'scheduled_news_sync',
            status: newsReport.status,
            providersSucceeded: newsReport.providersSucceeded,
            providersFailed: newsReport.providersFailed,
            articlesInserted: newsReport.articlesInserted,
            articlesEnriched: newsReport.articlesEnriched,
            articlesPruned: newsReport.articlesPruned,
          })
        );

        const jobReport = await runJobsIngestion(env, 'cron');
        console.log(
          JSON.stringify({
            event: 'scheduled_jobs_sync',
            status: jobReport.status,
            companiesSucceeded: jobReport.companiesSucceeded,
            companiesFailed: jobReport.companiesFailed,
            jobsDiscovered: jobReport.jobsDiscovered,
            jobsActive: jobReport.jobsActive,
            jobsClosed: jobReport.jobsClosed,
            jobsEnriched: jobReport.jobsEnriched,
            jobsPruned: jobReport.jobsPruned,
          })
        );
      })()
    );
  },
};

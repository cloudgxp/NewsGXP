/**
 * NewsGXP Scheduled & Manual Ingestion Pipeline
 *
 * 1. Fetches all 32 approved AI & Tech providers using plain fetch()
 * 2. Parses RSS/Atom/HTML into normalized articles
 * 3. Skips items > RETENTION_DAYS old or already recorded in seen_urls (anti-reingestion guard)
 * 4. Deduplicates by canonical_url and upserts new articles into D1
 * 5. Enriches up to MAX_AI_ENRICH_PER_RUN new articles with Workers AI
 * 6. Prunes unbookmarked articles older than RETENTION_DAYS (default 45 days)
 */

import { ALLOWED_FEEDS, FeedConfig } from '../src/config/feeds';
import {
  parseHtmlProvider,
  parseRssOrAtom,
  ParsedArticle,
} from './parsers';
import { enrichArticleWithWorkersAI } from './enrich';

export interface ProviderMeta {
  id: string;
  topic: string;
  categories: string[];
}

export const PROVIDER_META: Record<string, ProviderMeta> = {
  // Frontier Labs (9)
  openai: { id: 'openai', topic: 'Frontier Labs', categories: ['AI', 'Research', 'Product'] },
  'openai-research': {
    id: 'openai-research',
    topic: 'Frontier Labs',
    categories: ['AI', 'Research', 'Frontier Models'],
  },
  anthropic: {
    id: 'anthropic',
    topic: 'Frontier Labs',
    categories: ['AI', 'Anthropic', 'Frontier Safety'],
  },
  'google-ai': {
    id: 'google-ai',
    topic: 'Frontier Labs',
    categories: ['AI', 'Google', 'Research'],
  },
  'google-gemini': {
    id: 'google-gemini',
    topic: 'Frontier Labs',
    categories: ['AI', 'Gemini', 'Multimodal'],
  },
  'google-deepmind': {
    id: 'google-deepmind',
    topic: 'Frontier Labs',
    categories: ['AI', 'DeepMind', 'Research'],
  },
  'meta-ai': { id: 'meta-ai', topic: 'Frontier Labs', categories: ['AI', 'Meta', 'Open Source'] },
  mistral: {
    id: 'mistral',
    topic: 'Frontier Labs',
    categories: ['AI', 'Open Source', 'LLMs'],
  },
  cohere: {
    id: 'cohere',
    topic: 'Frontier Labs',
    categories: ['AI', 'Cohere', 'Enterprise AI'],
  },

  // Cloud & Engineering (11)
  google: {
    id: 'google',
    topic: 'Cloud & Engineering',
    categories: ['Technology', 'AI', 'Products'],
  },
  'google-developers': {
    id: 'google-developers',
    topic: 'Cloud & Engineering',
    categories: ['Technology', 'Developer Tools', 'APIs'],
  },
  'microsoft-ai': {
    id: 'microsoft-ai',
    topic: 'Cloud & Engineering',
    categories: ['AI', 'Microsoft', 'Copilot'],
  },
  'azure-foundry': {
    id: 'azure-foundry',
    topic: 'Cloud & Engineering',
    categories: ['AI', 'Azure', 'Cloud'],
  },
  'microsoft-skills': {
    id: 'microsoft-skills',
    topic: 'Cloud & Engineering',
    categories: ['Technology', 'AI Skills', 'Adoption'],
  },
  'aws-genai': {
    id: 'aws-genai',
    topic: 'Cloud & Engineering',
    categories: ['AI', 'AWS', 'Generative AI'],
  },
  'aws-ml': {
    id: 'aws-ml',
    topic: 'Cloud & Engineering',
    categories: ['AI', 'Machine Learning', 'AWS'],
  },
  'github-blog': {
    id: 'github-blog',
    topic: 'Cloud & Engineering',
    categories: ['Technology', 'Developer Tools', 'Open Source'],
  },
  'github-changelog': {
    id: 'github-changelog',
    topic: 'Cloud & Engineering',
    categories: ['Technology', 'Changelog', 'GitHub Copilot'],
  },
  huggingface: {
    id: 'huggingface',
    topic: 'Cloud & Engineering',
    categories: ['AI', 'Open Source', 'Transformers'],
  },
  perplexity: {
    id: 'perplexity',
    topic: 'Cloud & Engineering',
    categories: ['AI', 'Search', 'Changelog'],
  },

  // Hardware & Edge (4)
  'nvidia-genai': {
    id: 'nvidia-genai',
    topic: 'Hardware & Edge',
    categories: ['AI', 'NVIDIA', 'Hardware'],
  },
  'nvidia-developer': {
    id: 'nvidia-developer',
    topic: 'Hardware & Edge',
    categories: ['Technology', 'GPU Compute', 'CUDA'],
  },
  'amd-blogs': { id: 'amd-blogs', topic: 'Hardware & Edge', categories: ['AI', 'Hardware', 'ROCm'] },
  'apple-intelligence': {
    id: 'apple-intelligence',
    topic: 'Hardware & Edge',
    categories: ['AI', 'Apple Intelligence', 'On-Device AI'],
  },

  // Generative Media (8)
  'stability-ai': {
    id: 'stability-ai',
    topic: 'Generative Media',
    categories: ['AI', 'Diffusion Models', 'Media Generation'],
  },
  'runway-news': {
    id: 'runway-news',
    topic: 'Generative Media',
    categories: ['AI', 'Video Generation', 'Runway'],
  },
  'pika-blog': {
    id: 'pika-blog',
    topic: 'Generative Media',
    categories: ['AI', 'Video', 'Creative AI'],
  },
  'luma-news': {
    id: 'luma-news',
    topic: 'Generative Media',
    categories: ['AI', 'Video', '3D'],
  },
  'elevenlabs-product': {
    id: 'elevenlabs-product',
    topic: 'Generative Media',
    categories: ['AI', 'Audio', 'Voice AI'],
  },
  'elevenlabs-research': {
    id: 'elevenlabs-research',
    topic: 'Generative Media',
    categories: ['AI', 'Audio Research', 'Speech Synthesis'],
  },
  'suno-blog': {
    id: 'suno-blog',
    topic: 'Generative Media',
    categories: ['AI', 'Music AI', 'Creative Audio'],
  },
  'suno-release-notes': {
    id: 'suno-release-notes',
    topic: 'Generative Media',
    categories: ['AI', 'Music AI', 'Release Notes'],
  },
};

export interface IngestionEnv {
  DB: D1Database;
  AI?: Ai;
  RETENTION_DAYS?: string;
  MAX_AI_ENRICH_PER_RUN?: string;
}

export interface IngestionReport {
  runId: string;
  triggerType: 'cron' | 'manual';
  startedAt: string;
  finishedAt: string;
  providersTotal: number;
  providersSucceeded: number;
  providersFailed: number;
  articlesInserted: number;
  articlesEnriched: number;
  articlesPruned: number;
  status: 'completed' | 'partial' | 'failed';
  failedProviders: string[];
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/1.0';

async function fetchUpstreamFeed(cfg: FeedConfig): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent': cfg.headers?.['User-Agent'] || DEFAULT_USER_AGENT,
    Accept: cfg.contentType || 'application/rss+xml, application/xml, text/xml, */*',
    ...(cfg.headers || {}),
  };

  const res = await fetch(cfg.url, { headers });
  if (res.ok) {
    return res.text();
  }

  if (cfg.fallbackUrl) {
    const fallbackRes = await fetch(cfg.fallbackUrl, {
      headers: {
        'User-Agent': cfg.headers?.['User-Agent'] || DEFAULT_USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml, text/html, */*',
        ...(cfg.headers || {}),
      },
    });
    if (fallbackRes.ok) {
      return fallbackRes.text();
    }
  }

  throw new Error(`HTTP ${res.status} from ${cfg.url}`);
}

async function fetchAndParseProvider(providerId: string): Promise<ParsedArticle[]> {
  const cfg = ALLOWED_FEEDS[providerId];
  const meta = PROVIDER_META[providerId];
  if (!cfg || !meta) return [];

  const body = await fetchUpstreamFeed(cfg);
  const isHtml = (cfg.contentType || '').includes('text/html');

  return isHtml
    ? parseHtmlProvider(providerId, body, meta.topic, meta.categories)
    : parseRssOrAtom(body, providerId, meta.topic, meta.categories);
}

/**
 * Runs the full news ingestion, optional Workers AI enrichment, and 45-day retention purge.
 */
export async function runNewsIngestion(
  env: IngestionEnv,
  triggerType: 'cron' | 'manual',
  options?: { providerIds?: string[]; skipAi?: boolean }
): Promise<IngestionReport> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const retentionDays = Math.max(1, Number(env.RETENTION_DAYS || '45') || 45);
  const maxAiEnrich = Math.max(0, Number(env.MAX_AI_ENRICH_PER_RUN || '100') || 100);
  const cutoffIso = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const targetProviderIds = options?.providerIds?.length
    ? options.providerIds.filter((id) => Boolean(ALLOWED_FEEDS[id]))
    : Object.keys(ALLOWED_FEEDS);

  await env.DB.prepare(
    `INSERT INTO sync_runs (id, trigger_type, started_at, providers_total, status)
     VALUES (?, ?, ?, ?, 'running')`
  )
    .bind(runId, triggerType, startedAt, targetProviderIds.length)
    .run();

  let providersSucceeded = 0;
  let providersFailed = 0;
  const failedProviders: string[] = [];
  const fetchedArticles: ParsedArticle[] = [];

  // Fetch in bounded batches of 6 to stay well within Worker subrequest & memory limits
  const BATCH_SIZE = 6;
  for (let i = 0; i < targetProviderIds.length; i += BATCH_SIZE) {
    const batch = targetProviderIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((id) => fetchAndParseProvider(id)));

    results.forEach((result, idx) => {
      const providerId = batch[idx];
      if (result.status === 'fulfilled') {
        providersSucceeded++;
        fetchedArticles.push(...result.value);
      } else {
        providersFailed++;
        failedProviders.push(`${providerId}: ${result.reason?.message || 'Unknown error'}`);
        console.warn(`[Ingest] Provider ${providerId} failed:`, result.reason);
      }
    });
  }

  // Deduplicate in-memory and filter out dated articles already older than retention window
  const candidateMap = new Map<string, ParsedArticle>();
  for (const art of fetchedArticles) {
    if (art.publishedAt && art.publishedAt < cutoffIso) {
      continue;
    }
    if (!candidateMap.has(art.canonicalUrl)) {
      candidateMap.set(art.canonicalUrl, art);
    }
  }

  // Filter out URLs already seen in seen_urls (prevents re-ingesting purged 45-day-old undated items)
  const candidates = Array.from(candidateMap.values());
  const alreadySeen = new Set<string>();

  const SEEN_CHUNK = 80;
  for (let i = 0; i < candidates.length; i += SEEN_CHUNK) {
    const chunk = candidates.slice(i, i + SEEN_CHUNK);
    const placeholders = chunk.map(() => '?').join(',');
    const { results } = await env.DB.prepare(
      `SELECT canonical_url FROM seen_urls WHERE canonical_url IN (${placeholders})`
    )
      .bind(...chunk.map((c) => c.canonicalUrl))
      .all<{ canonical_url: string }>();

    for (const row of results) {
      alreadySeen.add(row.canonical_url);
    }
  }

  const brandNew = candidates.filter((c) => !alreadySeen.has(c.canonicalUrl));
  let articlesInserted = 0;
  const nowIso = new Date().toISOString();

  // Batch insert new articles + seen_urls tombstones
  const WRITE_CHUNK = 25;
  for (let i = 0; i < brandNew.length; i += WRITE_CHUNK) {
    const chunk = brandNew.slice(i, i + WRITE_CHUNK);
    const statements: D1PreparedStatement[] = [];

    for (const art of chunk) {
      const sortAt = art.publishedAt || nowIso;
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO articles
           (id, canonical_url, url, title, provider_id, topic, published_at, first_seen_at, sort_at, author, summary, image_url, categories)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          art.id,
          art.canonicalUrl,
          art.url,
          art.title,
          art.providerId,
          art.topic,
          art.publishedAt,
          nowIso,
          sortAt,
          art.author,
          art.summary,
          art.imageUrl,
          JSON.stringify(art.categories)
        )
      );
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO seen_urls (canonical_url, provider_id, first_seen_at)
           VALUES (?, ?, ?)`
        ).bind(art.canonicalUrl, art.providerId, nowIso)
      );
    }

    const batchResults = await env.DB.batch(statements);
    // Even-indexed statements are article inserts
    for (let j = 0; j < batchResults.length; j += 2) {
      articlesInserted += batchResults[j].meta?.changes ?? 0;
    }
  }

  // Enrich up to MAX_AI_ENRICH_PER_RUN unenriched recent articles with Workers AI
  let articlesEnriched = 0;
  if (env.AI && !options?.skipAi && maxAiEnrich > 0) {
    const { results: unenriched } = await env.DB.prepare(
      `SELECT id, title, provider_id, topic, url, summary
       FROM articles
       WHERE ai_enriched_at IS NULL
       ORDER BY sort_at DESC
       LIMIT ?`
    )
      .bind(maxAiEnrich)
      .all<{
        id: string;
        title: string;
        provider_id: string;
        topic: string;
        url: string;
        summary: string | null;
      }>();

    // Process AI calls in small parallel groups of 6
    const AI_CONCURRENCY = 6;
    for (let i = 0; i < unenriched.length; i += AI_CONCURRENCY) {
      const group = unenriched.slice(i, i + AI_CONCURRENCY);
      const enrichments = await Promise.all(
        group.map((row) =>
          enrichArticleWithWorkersAI(env.AI!, {
            id: row.id,
            title: row.title,
            providerId: row.provider_id,
            topic: row.topic,
            url: row.url,
            summary: row.summary,
          })
        )
      );

      const updateStmts: D1PreparedStatement[] = [];
      const enrichedAt = new Date().toISOString();
      enrichments.forEach((res, idx) => {
        if (!res) return;
        updateStmts.push(
          env.DB.prepare(
            `UPDATE articles
             SET ai_summary = ?, ai_tags = ?, ai_quality_score = ?, ai_enriched_at = ?
             WHERE id = ?`
          ).bind(
            res.aiSummary,
            JSON.stringify(res.aiTags),
            res.aiQualityScore,
            enrichedAt,
            group[idx].id
          )
        );
      });

      if (updateStmts.length > 0) {
        await env.DB.batch(updateStmts);
        articlesEnriched += updateStmts.length;
      }
    }
  }

  // 45-day retention cleanup (preserves bookmarked articles and keeps seen_urls tombstones)
  const pruneResult = await env.DB.prepare(
    `DELETE FROM articles WHERE is_bookmarked = 0 AND sort_at < ?`
  )
    .bind(cutoffIso)
    .run();
  const articlesPruned = pruneResult.meta?.changes ?? 0;

  // Tidy old audit logs (>90 days) and very old tombstones (>365 days)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM sync_runs WHERE started_at < ?`).bind(ninetyDaysAgo),
    env.DB.prepare(`DELETE FROM seen_urls WHERE first_seen_at < ?`).bind(oneYearAgo),
  ]);

  const finishedAt = new Date().toISOString();
  const status: 'completed' | 'partial' | 'failed' =
    providersFailed === 0
      ? 'completed'
      : providersSucceeded > 0
        ? 'partial'
        : 'failed';

  await env.DB.prepare(
    `UPDATE sync_runs
     SET finished_at = ?, providers_succeeded = ?, providers_failed = ?,
         articles_inserted = ?, articles_enriched = ?, articles_pruned = ?,
         status = ?, error_summary = ?
     WHERE id = ?`
  )
    .bind(
      finishedAt,
      providersSucceeded,
      providersFailed,
      articlesInserted,
      articlesEnriched,
      articlesPruned,
      status,
      failedProviders.length > 0 ? failedProviders.join(' | ').slice(0, 1000) : null,
      runId
    )
    .run();

  return {
    runId,
    triggerType,
    startedAt,
    finishedAt,
    providersTotal: targetProviderIds.length,
    providersSucceeded,
    providersFailed,
    articlesInserted,
    articlesEnriched,
    articlesPruned,
    status,
    failedProviders,
  };
}

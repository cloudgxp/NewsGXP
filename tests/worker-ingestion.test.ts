import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import worker, { WorkerEnv } from '../worker';
import { parseHtmlProvider, parseRssOrAtom } from '../worker/parsers';
import { parseEnrichmentJson } from '../worker/enrich';
import { runNewsIngestion } from '../worker/ingest';

/**
 * Lightweight D1Database adapter backed by Node's built-in SQLite (node:sqlite)
 * so migrations and SQL queries execute identically against real SQLite.
 */
function createSqliteD1(): { db: D1Database; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  for (const mig of ['0001_initial_schema.sql', '0002_jobs_schema.sql']) {
    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), 'migrations', mig),
      'utf8'
    );
    raw.exec(migrationSql);
  }

  function createStatement(sql: string, boundParams: unknown[] = []): D1PreparedStatement {
    const stmt: any = {
      bind(...values: unknown[]) {
        return createStatement(sql, values);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const prepared = raw.prepare(sql);
        const row = prepared.get(...(boundParams as any[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return { ...row } as T;
      },
      async all<T = unknown>() {
        const prepared = raw.prepare(sql);
        const rows = prepared.all(...(boundParams as any[])) as Record<string, unknown>[];
        return {
          results: rows.map((r) => ({ ...r })) as T[],
          success: true,
          meta: { changes: 0 },
        };
      },
      async run() {
        const prepared = raw.prepare(sql);
        const info = prepared.run(...(boundParams as any[]));
        return {
          results: [],
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
      _sql: sql,
      _params: boundParams,
    };
    return stmt as D1PreparedStatement;
  }

  const db: any = {
    prepare(sql: string) {
      return createStatement(sql);
    },
    async batch(statements: D1PreparedStatement[]) {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results;
    },
    async exec(sql: string) {
      raw.exec(sql);
      return { count: 1, duration: 0 };
    },
  };

  return { db: db as D1Database, raw };
}

test('parsers extract RSS, Atom, and filtered Anthropic HTML cleanly', () => {
  const recentDate = new Date().toUTCString();
  const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel>
      <item>
        <title>Introducing Next-Gen Reasoning &amp; Agents</title>
        <link>https://openai.com/index/next-gen-reasoning/?utm_source=rss</link>
        <pubDate>${recentDate}</pubDate>
        <description><![CDATA[<p>A major step forward in coding agents.</p>]]></description>
        <category>Research</category>
      </item>
    </channel></rss>`;

  const rssArticles = parseRssOrAtom(sampleRss, 'openai', 'Frontier Labs', ['AI']);
  assert.equal(rssArticles.length, 1);
  assert.equal(rssArticles[0].title, 'Introducing Next-Gen Reasoning & Agents');
  assert.equal(rssArticles[0].canonicalUrl, 'https://openai.com/index/next-gen-reasoning');
  assert.equal(rssArticles[0].summary, 'A major step forward in coding agents.');
  assert.ok(rssArticles[0].publishedAt);

  const sampleAnthropicHtml = `
    <a href="/news/announcements">Announcements</a>
    <a href="/news/claude-next">
      <time>Nov 20, 2026</time>
      <span class="title">Introducing Claude Next for Agents</span>
    </a>`;
  const anthropicArticles = parseHtmlProvider(
    'anthropic',
    sampleAnthropicHtml,
    'Frontier Labs',
    ['AI']
  );
  assert.equal(anthropicArticles.length, 1);
  assert.equal(anthropicArticles[0].title, 'Introducing Claude Next for Agents');
  assert.equal(anthropicArticles[0].url, 'https://www.anthropic.com/news/claude-next');
});

test('parseEnrichmentJson parses clean and fenced JSON and clamps scores', () => {
  const fenced = '```json\n{"summary": "Major model launch.", "tags": ["LLMs", "Agents", "Safety", "Extra"], "quality_score": 9}\n```';
  const parsed = parseEnrichmentJson(fenced);
  assert.ok(parsed);
  assert.equal(parsed.aiSummary, 'Major model launch.');
  assert.deepEqual(parsed.aiTags, ['LLMs', 'Agents', 'Safety']);
  assert.equal(parsed.aiQualityScore, 5);
  assert.equal(parseEnrichmentJson('not valid json'), null);
});

test('runNewsIngestion deduplicates, caps Workers AI, purges >45d unbookmarked, and blocks re-ingestion', async () => {
  const { db, raw } = createSqliteD1();
  const originalFetch = globalThis.fetch;

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toUTCString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toUTCString();

  const mockRss = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel>
      <item>
        <title>Fresh Frontier Paper</title>
        <link>https://openai.com/research/fresh-paper</link>
        <pubDate>${twoDaysAgo}</pubDate>
        <description>Fresh breakthrough in reasoning.</description>
      </item>
      <item>
        <title>Second Fresh Update</title>
        <link>https://openai.com/news/second-update</link>
        <pubDate>${twoDaysAgo}</pubDate>
        <description>Another recent release.</description>
      </item>
      <item>
        <title>Ancient Post From 60 Days Ago</title>
        <link>https://openai.com/news/ancient-post</link>
        <pubDate>${sixtyDaysAgo}</pubDate>
        <description>Should be skipped by 45-day window.</description>
      </item>
    </channel></rss>`;

  const mockAnthropicHtml = `
    <a href="/news/undated-post"><span class="title">Undated New Launch</span></a>
  `;

  let aiCalls = 0;
  const mockAi = {
    async run() {
      aiCalls++;
      return {
        response: JSON.stringify({
          summary: 'Concise AI takeaway for career & YouTube prep.',
          tags: ['Frontier Models', 'Agents'],
          quality_score: 5,
        }),
      };
    },
  } as unknown as Ai;

  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    if (url.includes('openai.com')) {
      return new Response(mockRss, { status: 200 });
    }
    if (url.includes('anthropic.com')) {
      return new Response(mockAnthropicHtml, { status: 200 });
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;

  try {
    // Seed an old unbookmarked article and an old bookmarked article (50 days old)
    const fiftyDaysAgoIso = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000).toISOString();
    raw
      .prepare(
        `INSERT INTO articles (id, canonical_url, url, title, provider_id, topic, first_seen_at, sort_at, is_bookmarked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'old-unbookmarked',
        'https://www.anthropic.com/news/old-unbookmarked',
        'https://www.anthropic.com/news/old-unbookmarked',
        'Old Unbookmarked Story',
        'anthropic',
        'Frontier Labs',
        fiftyDaysAgoIso,
        fiftyDaysAgoIso,
        0
      );
    raw
      .prepare(
        `INSERT INTO articles (id, canonical_url, url, title, provider_id, topic, first_seen_at, sort_at, is_bookmarked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'old-bookmarked',
        'https://www.anthropic.com/news/old-bookmarked',
        'https://www.anthropic.com/news/old-bookmarked',
        'Old Bookmarked Story',
        'anthropic',
        'Frontier Labs',
        fiftyDaysAgoIso,
        fiftyDaysAgoIso,
        1
      );

    // Run 1: ingest openai, openai-research (overlapping URLs!), and anthropic with AI cap = 2
    const report1 = await runNewsIngestion(
      {
        DB: db,
        AI: mockAi,
        RETENTION_DAYS: '45',
        MAX_AI_ENRICH_PER_RUN: '2',
      },
      'cron',
      { providerIds: ['openai', 'openai-research', 'anthropic'] }
    );

    assert.equal(report1.providersSucceeded, 3);
    assert.equal(report1.providersFailed, 0);
    // 2 fresh OpenAI (deduplicated across openai + openai-research; ancient 60d skipped) + 1 Anthropic = 3
    assert.equal(report1.articlesInserted, 3);
    // Strict AI cap of 2 enforced even though 3 were inserted
    assert.equal(report1.articlesEnriched, 2);
    assert.equal(aiCalls, 2);
    // Old unbookmarked purged, old bookmarked preserved!
    assert.equal(report1.articlesPruned, 1);

    const remainingIds = (
      raw.prepare(`SELECT id FROM articles`).all() as Array<{ id: string }>
    ).map((r) => r.id);
    assert.ok(!remainingIds.includes('old-unbookmarked'));
    assert.ok(remainingIds.includes('old-bookmarked'));

    // Simulate aging out the undated Anthropic article after 46 days -> purge it
    const fortySixDaysAgoIso = new Date(now.getTime() - 46 * 24 * 60 * 60 * 1000).toISOString();
    raw
      .prepare(`UPDATE articles SET sort_at = ? WHERE canonical_url = ?`)
      .run(fortySixDaysAgoIso, 'https://www.anthropic.com/news/undated-post');

    // Run 2: same upstream still lists /news/undated-post, but seen_urls prevents re-ingestion!
    const report2 = await runNewsIngestion(
      {
        DB: db,
        AI: mockAi,
        RETENTION_DAYS: '45',
        MAX_AI_ENRICH_PER_RUN: '10',
      },
      'cron',
      { providerIds: ['openai', 'anthropic'] }
    );

    assert.equal(report2.articlesInserted, 0, 'seen_urls must prevent re-ingesting purged items');
    assert.equal(report2.articlesPruned, 1, 'aged undated Anthropic item should be pruned');
  } finally {
    globalThis.fetch = originalFetch;
    raw.close();
  }
});

test('Worker API serves /api/health, /api/articles, protected /api/sync, /api/feed, and scheduled()', async () => {
  const { db, raw } = createSqliteD1();
  const originalFetch = globalThis.fetch;

  const env: WorkerEnv = {
    DB: db,
    AI: undefined as unknown as Ai,
    ASSETS: {
      fetch: async () => new Response('<html>SPA</html>', { status: 200 }),
    } as unknown as Fetcher,
    RETENTION_DAYS: '45',
    MAX_AI_ENRICH_PER_RUN: '40',
    MAX_AI_JOBS_ENRICH_PER_RUN: '40',
    SYNC_SECRET: 'super-secret-token',
  };

  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    if (url.includes('google.com/about/careers')) {
      return new Response('<html></html>', { status: 200 });
    }
    if (
      url.includes('greenhouse.io') ||
      url.includes('ashbyhq.com') ||
      url.includes('workable.com') ||
      url.includes('github.careers') ||
      url.includes('careers.amd.com') ||
      url.includes('careers.microsoft.com')
    ) {
      return new Response(JSON.stringify({ jobs: [], data: { positions: [] } }), { status: 200 });
    }
    return new Response(
      `<rss version="2.0"><channel><item><title>Worker Cron Story</title><link>https://openai.com/news/worker-cron</link><pubDate>${new Date().toUTCString()}</pubDate><description>Stored in D1.</description></item></channel></rss>`,
      { status: 200 }
    );
  }) as typeof fetch;

  try {
    // 1. /api/sync rejects missing or wrong secret
    const unauthRes = await worker.fetch(
      new Request('https://newsgxp.dev/api/sync', { method: 'POST' }),
      env
    );
    assert.equal(unauthRes.status, 401);

    // 2. /api/sync succeeds with valid Bearer token
    const syncRes = await worker.fetch(
      new Request('https://newsgxp.dev/api/sync', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer super-secret-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target: 'news', providers: ['openai'], skipAi: true }),
      }),
      env
    );
    assert.equal(syncRes.status, 200);
    const syncBody = (await syncRes.json()) as any;
    assert.equal(syncBody.articlesInserted, 1);

    // 3. /api/articles returns the stored D1 article
    const articlesRes = await worker.fetch(
      new Request('https://newsgxp.dev/api/articles?providers=openai&days=7'),
      env
    );
    assert.equal(articlesRes.status, 200);
    const articlesBody = (await articlesRes.json()) as any;
    assert.equal(articlesBody.articles.length, 1);
    assert.equal(articlesBody.articles[0].title, 'Worker Cron Story');
    assert.equal(articlesBody.needsInitialSync, false);
    assert.ok(articlesBody.lastSyncedAt);

    // 4. /api/health reports 32 providers and latest sync run
    const healthRes = await worker.fetch(new Request('https://newsgxp.dev/api/health'), env);
    assert.equal(healthRes.status, 200);
    const healthBody = (await healthRes.json()) as any;
    assert.equal(healthBody.providersCount, 32);
    assert.equal(healthBody.companiesCount, 21);
    assert.equal(healthBody.hasDatabase, true);
    assert.ok(healthBody.lastSyncRun);

    // 5. Removed providers return 404 on /api/feed/:provider
    for (const removed of ['crunchyroll', 'xai', 'claude', 'midjourney']) {
      const res = await worker.fetch(
        new Request(`https://newsgxp.dev/api/feed/${removed}`),
        env
      );
      assert.equal(res.status, 404);
    }

    // 6. scheduled() registers work with ctx.waitUntil
    const waited: Promise<unknown>[] = [];
    const mockCtx = {
      waitUntil(p: Promise<unknown>) {
        waited.push(p);
      },
      passThroughOnException() {},
    } as unknown as ExecutionContext;
    await worker.scheduled({} as ScheduledController, env, mockCtx);
    assert.equal(waited.length, 1);
    await Promise.all(waited);
  } finally {
    globalThis.fetch = originalFetch;
    raw.close();
  }
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import worker, { WorkerEnv } from '../worker';
import { COMPANY_BY_ID, TRACKED_COMPANIES } from '../src/config/companies';
import {
  classifyAiJob,
  detectRegion,
  parseAshbyJobs,
  parseGoogleCareersHtml,
  parseGreenhouseJobs,
  parseJibeJobs,
  parseMicrosoftEightfoldJobs,
  parseWorkableJobs,
} from '../worker/jobParsers';
import { parseJobEnrichmentJson } from '../worker/enrich';
import { runJobsIngestion } from '../worker/jobIngest';

function createJobsSqliteD1(): { db: D1Database; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  for (const mig of ['0001_initial_schema.sql', '0002_jobs_schema.sql']) {
    const sql = fs.readFileSync(path.resolve(process.cwd(), 'migrations', mig), 'utf8');
    raw.exec(sql);
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

test('tracked company registry covers 21 direct company career pages without third-party boards', () => {
  assert.equal(TRACKED_COMPANIES.length, 21);
  for (const company of TRACKED_COMPANIES) {
    assert.ok(!/ziprecruiter|indeed|glassdoor|monster|linkedin/i.test(company.apiUrl));
    assert.ok(!/ziprecruiter|indeed|glassdoor|monster|linkedin/i.test(company.careersUrl));
  }
});

test('job parsers cover Greenhouse, Ashby (hybrid vs remote), Workable, Jibe, Google, and Microsoft', () => {
  // 1. Greenhouse (non-AI-native requires AI keywords; excludes onsite)
  const ghJobs = parseGreenhouseJobs(
    {
      jobs: [
        {
          id: 1,
          title: 'Staff AI Platform Engineer',
          location: { name: 'Remote - US' },
          absolute_url: 'https://job-boards.greenhouse.io/cloudflare/jobs/1',
          updated_at: '2026-11-20T12:00:00Z',
          departments: [{ name: 'Engineering' }],
        },
        {
          id: 2,
          title: 'Account Executive',
          location: { name: 'Remote - US' },
          absolute_url: 'https://job-boards.greenhouse.io/cloudflare/jobs/2',
        },
        {
          id: 3,
          title: 'Senior Machine Learning Engineer',
          location: { name: 'Austin, TX' },
          absolute_url: 'https://job-boards.greenhouse.io/cloudflare/jobs/3',
        },
      ],
    },
    COMPANY_BY_ID['cloudflare']
  );
  assert.equal(ghJobs.length, 1);
  assert.equal(ghJobs[0].title, 'Staff AI Platform Engineer');
  assert.equal(ghJobs[0].region, 'US');

  // 2. Ashby (guards against isRemote: true when workplaceType is Hybrid or OnSite!)
  const ashbyJobs = parseAshbyJobs(
    {
      jobs: [
        {
          id: 'a1',
          title: 'Research Engineer, Reasoning Agents',
          location: 'San Francisco',
          isRemote: true,
          workplaceType: 'Hybrid',
          jobUrl: 'https://jobs.ashbyhq.com/openai/a1',
          publishedAt: '2026-11-20T00:00:00Z',
        },
        {
          id: 'a2',
          title: 'Applied AI Engineer',
          location: 'Remote - US',
          isRemote: true,
          workplaceType: 'Remote',
          department: 'Applied AI',
          jobUrl: 'https://jobs.ashbyhq.com/openai/a2',
          publishedAt: '2026-11-21T00:00:00Z',
          compensation: { compensationTierSummary: '$240K - $320K' },
        },
        {
          id: 'a3',
          title: 'Corporate Payroll Specialist',
          location: 'Remote',
          isRemote: true,
          workplaceType: 'Remote',
          jobUrl: 'https://jobs.ashbyhq.com/openai/a3',
        },
      ],
    },
    COMPANY_BY_ID['openai']
  );
  assert.equal(ashbyJobs.length, 1);
  assert.equal(ashbyJobs[0].title, 'Applied AI Engineer');
  assert.equal(ashbyJobs[0].aiCategory, 'Applied AI & Agents');
  assert.equal(ashbyJobs[0].salaryRange, '$240K - $320K');

  // 3. Workable
  const workableJobs = parseWorkableJobs(
    {
      jobs: [
        {
          title: 'Open-Source ML Engineer - EMEA Remote',
          telecommuting: true,
          department: 'Open Source',
          url: 'https://apply.workable.com/j/HF123',
          published_on: '2026-11-18',
          country: 'France',
          city: 'Paris',
        },
      ],
    },
    COMPANY_BY_ID['huggingface']
  );
  assert.equal(workableJobs.length, 1);
  assert.equal(workableJobs[0].region, 'EMEA');

  // 4. Jibe (GitHub ANY vs AMD LAT_LNG)
  const githubJibe = parseJibeJobs(
    {
      jobs: [
        {
          data: {
            title: 'Staff Software Engineer, AI Agents',
            full_location: 'United States',
            location_type: 'ANY',
            meta_data: { canonical_url: 'https://githubinc.jibeapply.com/jobs/5740' },
            posted_date: '2026-11-19T12:00:00+0000',
          },
        },
      ],
    },
    COMPANY_BY_ID['github']
  );
  assert.equal(githubJibe.length, 1);
  assert.equal(githubJibe[0].region, 'US');
  assert.equal(githubJibe[0].aiCategory, 'Applied AI & Agents');

  const amdJibeOnsite = parseJibeJobs(
    {
      jobs: [
        {
          data: {
            title: 'Agentic AI Systems Architecture Fellow',
            full_location: 'Austin, Texas',
            location_type: 'LAT_LNG',
            meta_data: { canonical_url: 'https://careers.amd.com/jobs/88560' },
          },
        },
      ],
    },
    COMPANY_BY_ID['amd']
  );
  assert.equal(amdJibeOnsite.length, 0);

  // 5. Google Careers AF_initDataCallback('ds:1')
  const googleHtml = `<script>AF_initDataCallback({key: 'ds:1', hash: '1', data:[${JSON.stringify([
    [
      '122808594377646790',
      'Staff AI Software Engineer, Gemini Cloud',
      'https://signin',
      [null, '<p>Build agentic systems</p>'],
      [null, '<p>Qualifications</p>'],
      'tenant',
      null,
      'Google',
      'en-US',
      [['New York, NY, USA']],
      [null, 'Build Gemini features. US: $190,000 - $275,000 (USD) + bonus.'],
      [2],
      [1794499670, 0],
      [1794499670, 0],
      [1794499670, 0],
      [null, ''],
      1,
      null,
      [null, 'In-office locations: New York, NY. Remote location(s): Pennsylvania, USA.'],
    ],
  ])}], sideChannel: {}});</script>`;
  const googleJobs = parseGoogleCareersHtml(googleHtml, COMPANY_BY_ID['google']);
  assert.equal(googleJobs.length, 1);
  assert.equal(
    googleJobs[0].url,
    'https://www.google.com/about/careers/applications/jobs/results/122808594377646790'
  );
  assert.equal(googleJobs[0].salaryRange, '$190,000 - $275,000 (USD)');
  assert.equal(googleJobs[0].region, 'US');

  // 6. Microsoft Eightfold
  const msJobs = parseMicrosoftEightfoldJobs(
    {
      data: {
        positions: [
          {
            id: 9001,
            name: 'Principal Applied AI Scientist',
            locations: ['United States, Multiple Locations'],
            department: 'AI Platform',
            postedTs: 1795222850,
            workLocationOption: 'remote',
            locationFlexibility: 'Up to 100% work from home',
            positionUrl: '/careers/job/9001',
          },
          {
            id: 9002,
            name: 'AI Program Director',
            locations: ['Houston, TX'],
            department: 'Consulting',
            workLocationOption: 'onsite',
            positionUrl: '/careers/job/9002',
          },
        ],
      },
    },
    COMPANY_BY_ID['microsoft']
  );
  assert.equal(msJobs.length, 1);
  assert.equal(msJobs[0].url, 'https://apply.careers.microsoft.com/careers/job/9001');
  assert.equal(msJobs[0].aiCategory, 'ML & Research');
});

test('region detection, deterministic classification, and job enrichment JSON parser', () => {
  assert.equal(detectRegion('Remote - US'), 'US');
  assert.equal(detectRegion('Remote, United Kingdom'), 'EMEA');
  assert.equal(detectRegion('Toronto, Canada (Remote)'), 'Americas');
  assert.equal(detectRegion('Remote (Worldwide)'), 'Global');

  assert.equal(
    classifyAiJob('Recruiting Coordinator', 'People', null, true).matches,
    false
  );
  assert.equal(
    classifyAiJob('Senior Software Engineer', 'Product', null, false).matches,
    false
  );
  assert.equal(
    classifyAiJob('AI Security Researcher', 'Safety', null, false).category,
    'AI Security & Safety'
  );

  const enriched = parseJobEnrichmentJson(
    '```json\n{"summary": "Leads multi-agent LLM orchestration.", "is_remote": true, "is_ai_role": true, "ai_category": "Applied AI & Agents"}\n```'
  );
  assert.ok(enriched);
  assert.equal(enriched.isRemote, true);
  assert.equal(enriched.isAiRole, true);
  assert.equal(enriched.aiCategory, 'Applied AI & Agents');
});

test('runJobsIngestion snapshot-diffs active/closed roles, preserves first_seen_at, caps AI, and purges closed >45d', async () => {
  const { db, raw } = createJobsSqliteD1();
  const originalFetch = globalThis.fetch;

  let anthropicJobsList = [
    {
      id: 101,
      title: 'Staff Safety Research Scientist',
      location: { name: 'Remote - US' },
      absolute_url: 'https://job-boards.greenhouse.io/anthropic/jobs/101',
      updated_at: '2026-11-20T00:00:00Z',
    },
    {
      id: 102,
      title: 'Applied AI Solutions Architect',
      location: { name: 'Remote - US' },
      absolute_url: 'https://job-boards.greenhouse.io/anthropic/jobs/102',
      updated_at: '2026-11-20T00:00:00Z',
    },
    {
      id: 103,
      title: 'Misclassified AI Hybrid Role',
      location: { name: 'Remote - US' },
      absolute_url: 'https://job-boards.greenhouse.io/anthropic/jobs/103',
      updated_at: '2026-11-20T00:00:00Z',
    },
  ];
  let failCloudflare = false;

  const mockAi = {
    async run(_model: string, input: any) {
      const prompt = String(input?.messages?.[1]?.content || '');
      if (prompt.includes('Misclassified AI Hybrid Role')) {
        return {
          response: JSON.stringify({
            summary: 'Requires 3 days onsite in SF.',
            is_remote: false,
            is_ai_role: true,
            ai_category: 'Engineering (AI Co.)',
          }),
        };
      }
      return {
        response: JSON.stringify({
          summary: 'Remote AI role verified by Workers AI.',
          is_remote: true,
          is_ai_role: true,
          ai_category: 'Applied AI & Agents',
        }),
      };
    },
  } as unknown as Ai;

  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    if (url.includes('/anthropic/')) {
      return new Response(JSON.stringify({ jobs: anthropicJobsList }), { status: 200 });
    }
    if (url.includes('/cloudflare/')) {
      if (failCloudflare) {
        return new Response('Rate limited', { status: 429 });
      }
      return new Response(
        JSON.stringify({
          jobs: [
            {
              id: 201,
              title: 'Workers AI Systems Engineer',
              location: { name: 'Remote - US' },
              absolute_url: 'https://job-boards.greenhouse.io/cloudflare/jobs/201',
            },
          ],
        }),
        { status: 200 }
      );
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;

  try {
    // Seed an old closed unbookmarked job (50d), old closed bookmarked job (50d), and old still-active job (50d)
    const fiftyDaysAgo = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString();
    raw
      .prepare(
        `INSERT INTO job_postings (id, canonical_url, company_id, company_name, title, url, location_raw, work_mode, region, ai_category, first_seen_at, last_seen_at, is_active, is_bookmarked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'old-closed',
        'https://job-boards.greenhouse.io/anthropic/jobs/900',
        'anthropic',
        'Anthropic',
        'Old Closed Job',
        'https://job-boards.greenhouse.io/anthropic/jobs/900',
        'Remote - US',
        'remote',
        'US',
        'ML & Research',
        fiftyDaysAgo,
        fiftyDaysAgo,
        0,
        0
      );
    raw
      .prepare(
        `INSERT INTO job_postings (id, canonical_url, company_id, company_name, title, url, location_raw, work_mode, region, ai_category, first_seen_at, last_seen_at, is_active, is_bookmarked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        'old-closed-saved',
        'https://job-boards.greenhouse.io/anthropic/jobs/901',
        'anthropic',
        'Anthropic',
        'Old Closed Saved Job',
        'https://job-boards.greenhouse.io/anthropic/jobs/901',
        'Remote - US',
        'remote',
        'US',
        'ML & Research',
        fiftyDaysAgo,
        fiftyDaysAgo,
        0,
        1
      );

    // Run 1: Both companies succeed; AI cap = 3 so all 3 Anthropic jobs get enriched
    const r1 = await runJobsIngestion(
      {
        DB: db,
        AI: mockAi,
        RETENTION_DAYS: '45',
        MAX_AI_JOBS_ENRICH_PER_RUN: '3',
      },
      'cron',
      { companyIds: ['anthropic', 'cloudflare'] }
    );
    assert.equal(r1.companiesSucceeded, 2);
    assert.equal(r1.companiesFailed, 0);
    assert.equal(r1.jobsDiscovered, 4);
    assert.equal(r1.jobsEnriched, 3);
    assert.equal(r1.jobsPruned, 1); // old-closed pruned; old-closed-saved preserved!

    const savedRow = raw
      .prepare(`SELECT first_seen_at FROM job_postings WHERE canonical_url = ?`)
      .get('https://job-boards.greenhouse.io/anthropic/jobs/101') as { first_seen_at: string };
    const initialFirstSeen = savedRow.first_seen_at;

    // Run 2: Anthropic removes job 102; Cloudflare returns HTTP 429!
    anthropicJobsList = [anthropicJobsList[0], anthropicJobsList[2]];
    failCloudflare = true;

    const r2 = await runJobsIngestion(
      {
        DB: db,
        AI: mockAi,
        RETENTION_DAYS: '45',
        MAX_AI_JOBS_ENRICH_PER_RUN: '3',
      },
      'cron',
      { companyIds: ['anthropic', 'cloudflare'] }
    );
    assert.equal(r2.companiesSucceeded, 1);
    assert.equal(r2.companiesFailed, 1);
    assert.equal(r2.jobsClosed, 1); // job 102 closed

    // Verify first_seen_at on job 101 was NOT overwritten
    const afterRow = raw
      .prepare(`SELECT first_seen_at FROM job_postings WHERE canonical_url = ?`)
      .get('https://job-boards.greenhouse.io/anthropic/jobs/101') as { first_seen_at: string };
    assert.equal(afterRow.first_seen_at, initialFirstSeen);

    // Verify Cloudflare job 201 stayed active even though Cloudflare failed!
    const cfRow = raw
      .prepare(`SELECT is_active FROM job_postings WHERE canonical_url = ?`)
      .get('https://job-boards.greenhouse.io/cloudflare/jobs/201') as { is_active: number };
    assert.equal(cfRow.is_active, 1);

    // Verify GET /api/jobs hides closed job 102 AND AI-rejected non-remote job 103
    const env: WorkerEnv = {
      DB: db,
      AI: mockAi,
      ASSETS: { fetch: async () => new Response('SPA', { status: 200 }) } as unknown as Fetcher,
      RETENTION_DAYS: '45',
      MAX_AI_ENRICH_PER_RUN: '40',
      MAX_AI_JOBS_ENRICH_PER_RUN: '40',
      SYNC_SECRET: 'secret',
    };

    const jobsRes = await worker.fetch(new Request('https://newsgxp.dev/api/jobs'), env);
    assert.equal(jobsRes.status, 200);
    const jobsPayload = (await jobsRes.json()) as any;
    const titles = jobsPayload.jobs.map((j: any) => j.title);
    assert.ok(titles.includes('Staff Safety Research Scientist'));
    assert.ok(titles.includes('Workers AI Systems Engineer'));
    assert.ok(!titles.includes('Applied AI Solutions Architect'));
    assert.ok(!titles.includes('Misclassified AI Hybrid Role'));

    // Verify GET /api/digest/weekly generates valid Markdown with our new remote job
    const digestRes = await worker.fetch(
      new Request('https://newsgxp.dev/api/digest/weekly'),
      env
    );
    assert.equal(digestRes.status, 200);
    const digestPayload = (await digestRes.json()) as any;
    assert.match(digestPayload.markdown, /## New Remote AI Jobs This Week/);
    assert.match(digestPayload.markdown, /Staff Safety Research Scientist/);
  } finally {
    globalThis.fetch = originalFetch;
    raw.close();
  }
});

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Simple in-memory cache for Crunchyroll and PlayStation RSS feeds
interface CacheEntry {
  data: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

const ALLOWED_FEEDS: Record<string, { url: string; name: string }> = {
  crunchyroll: {
    url: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss',
    name: 'Crunchyroll',
  },
  playstation: {
    url: 'https://blog.playstation.com/feed/',
    name: 'PlayStation Blog',
  },
};

const feedCache = new Map<string, CacheEntry>();

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'NewsGXP',
    tagline: 'Your news. Your providers.',
    time: new Date().toISOString(),
  });
});

async function handleFeedRequest(providerId: string, forceFresh: boolean, res: express.Response) {
  const feedConfig = ALLOWED_FEEDS[providerId];
  if (!feedConfig) {
    return res.status(404).json({
      error: 'Unsupported or unknown news provider',
      allowedProviders: Object.keys(ALLOWED_FEEDS),
    });
  }

  const now = Date.now();
  const cached = feedCache.get(providerId);

  if (!forceFresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(cached.data);
  }

  try {
    const upstreamResponse = await fetch(feedConfig.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        error: `Upstream ${feedConfig.name} feed returned HTTP ${upstreamResponse.status}`,
      });
    }

    const xmlData = await upstreamResponse.text();
    feedCache.set(providerId, {
      data: xmlData,
      fetchedAt: now,
    });

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(xmlData);
  } catch (err: any) {
    console.error(`[${feedConfig.name} Feed] Upstream fetch error:`, err.message || err);
    return res.status(502).json({
      error: `Failed to fetch ${feedConfig.name} news feed from upstream service`,
      details: err.message || 'Unknown network error',
    });
  }
}

// Unified Feed Gateway endpoint
app.get('/api/feed/:provider', async (req, res) => {
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  await handleFeedRequest(req.params.provider, forceFresh, res);
});

// Legacy proxy endpoints for backward compatibility
app.get('/api/proxy/crunchyroll/rss', async (req, res) => {
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  await handleFeedRequest('crunchyroll', forceFresh, res);
});

app.get('/api/proxy/playstation/rss', async (req, res) => {
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  await handleFeedRequest('playstation', forceFresh, res);
});

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NewsGXP Server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});

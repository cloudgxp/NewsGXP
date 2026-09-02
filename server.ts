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

let crunchyrollRssCache: CacheEntry | null = null;
let playstationRssCache: CacheEntry | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    name: 'NewsGXP',
    tagline: 'Your news. Your providers.',
    time: new Date().toISOString(),
  });
});

// Crunchyroll RSS Proxy endpoint
// Solves CORS constraints while keeping provider-specific fetching bounded
app.get('/api/proxy/crunchyroll/rss', async (req, res) => {
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  const now = Date.now();

  if (!forceFresh && crunchyrollRssCache && now - crunchyrollRssCache.fetchedAt < CACHE_TTL_MS) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(crunchyrollRssCache.data);
  }

  try {
    const upstreamUrl = 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss';
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        error: `Upstream Crunchyroll feed returned HTTP ${upstreamResponse.status}`,
      });
    }

    const xmlData = await upstreamResponse.text();
    crunchyrollRssCache = {
      data: xmlData,
      fetchedAt: now,
    };

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(xmlData);
  } catch (err: any) {
    console.error('[Crunchyroll Proxy] Upstream fetch error:', err.message || err);
    return res.status(502).json({
      error: 'Failed to fetch Crunchyroll news feed from upstream service',
      details: err.message || 'Unknown network error',
    });
  }
});

// PlayStation Blog RSS Proxy endpoint
// Solves CORS constraints while preserving provider isolation and bounded caching
app.get('/api/proxy/playstation/rss', async (req, res) => {
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  const now = Date.now();

  if (!forceFresh && playstationRssCache && now - playstationRssCache.fetchedAt < CACHE_TTL_MS) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(playstationRssCache.data);
  }

  try {
    const upstreamUrl = 'https://blog.playstation.com/feed/';
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        error: `Upstream PlayStation Blog feed returned HTTP ${upstreamResponse.status}`,
      });
    }

    const xmlData = await upstreamResponse.text();
    playstationRssCache = {
      data: xmlData,
      fetchedAt: now,
    };

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(xmlData);
  } catch (err: any) {
    console.error('[PlayStation Proxy] Upstream fetch error:', err.message || err);
    return res.status(502).json({
      error: 'Failed to fetch PlayStation Blog news feed from upstream service',
      details: err.message || 'Unknown network error',
    });
  }
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

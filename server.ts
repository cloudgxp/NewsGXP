import express from 'express';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

// Share one per-client budget across feed aliases, including forced refreshes.
// The default memory store is per process; use a shared store when scaling out.
const feedRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many feed requests. Please try again later.' },
});

// Simple in-memory cache for provider feeds (RSS and JSON)
interface CacheEntry {
  data: string;
  contentType: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

interface FeedConfig {
  url: string;
  name: string;
  contentType?: string;
  headers?: Record<string, string>;
  fallbackUrl?: string;
}

const NINTENDO_QUERY = 'query LatestNewsArticles($limit: Int!, $offset: Int = 0, $tags: [String!]!) { collection: newsArticles(limit: $limit, skip: $offset, sort: [publishDate_DESC, priority_DESC], where: { tags: { all: $tags } }) { total offset: skip items { id locale tags { id } title body { snippet: text(characterLimit: 250) } media { publicId resourceType } publishDate url(relative: true) slug } } }';
const NINTENDO_VARS = JSON.stringify({ limit: 30, offset: 0, tags: ['syndicationNcom'] });

const ALLOWED_FEEDS: Record<string, FeedConfig> = {
  xbox: {
    url: 'https://news.xbox.com/en-us/feed/',
    name: 'Xbox Wire',
  },
  crunchyroll: {
    url: 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss',
    name: 'Crunchyroll',
  },
  playstation: {
    url: 'https://blog.playstation.com/feed/',
    name: 'PlayStation Blog',
  },
  nintendo: {
    url: `https://graph.nintendo.com/?query=${encodeURIComponent(NINTENDO_QUERY)}&variables=${encodeURIComponent(NINTENDO_VARS)}`,
    name: 'Nintendo',
    contentType: 'application/json; charset=utf-8',
    headers: {
      'apollographql-client-name': 'ncom',
      'apollographql-client-version': '1.0.0',
    },
    fallbackUrl: 'https://www.nintendo.com/us/whatsnew/',
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
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(cached.data);
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/1.0',
      'Accept': feedConfig.contentType || 'application/rss+xml, application/xml, text/xml, */*',
      ...(feedConfig.headers || {}),
    };

    let upstreamResponse = await fetch(feedConfig.url, {
      headers: upstreamHeaders,
    });

    let responseData = '';
    let resolvedContentType = feedConfig.contentType || 'application/xml; charset=utf-8';

    if (!upstreamResponse.ok && feedConfig.fallbackUrl) {
      console.warn(`[${feedConfig.name} Feed] Primary endpoint failed with HTTP ${upstreamResponse.status}, attempting fallback`);
      const fallbackResponse = await fetch(feedConfig.fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (fallbackResponse.ok) {
        const html = await fallbackResponse.text();
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          try {
            const nextData = JSON.parse(nextDataMatch[1]);
            const apollo = nextData.props?.pageProps?.initialApolloState || {};
            const items = Object.values(apollo).filter((v: any) => v && v.__typename === 'NewsArticle');
            if (items.length > 0) {
              responseData = JSON.stringify({
                data: {
                  collection: {
                    total: items.length,
                    offset: 0,
                    items,
                  },
                },
              });
              resolvedContentType = 'application/json; charset=utf-8';
            }
          } catch (jsonErr) {
            console.warn(`[${feedConfig.name} Feed] Failed to parse NEXT_DATA fallback:`, jsonErr);
          }
        }
      }
    }

    if (!responseData) {
      if (!upstreamResponse.ok) {
        return res.status(upstreamResponse.status).json({
          error: `Upstream ${feedConfig.name} feed returned HTTP ${upstreamResponse.status}`,
        });
      }
      responseData = await upstreamResponse.text();
    }

    feedCache.set(providerId, {
      data: responseData,
      contentType: resolvedContentType,
      fetchedAt: now,
    });

    res.setHeader('Content-Type', resolvedContentType);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(responseData);
  } catch (err: any) {
    console.error(`[${feedConfig.name} Feed] Upstream fetch error:`, err.message || err);
    return res.status(502).json({
      error: `Failed to fetch ${feedConfig.name} news feed from upstream service`,
      details: err.message || 'Unknown network error',
    });
  }
}

// Unified Feed Gateway endpoint
app.get('/api/feed/:provider', feedRateLimit, async (req, res) => {
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  await handleFeedRequest(req.params.provider, forceFresh, res);
});

// Legacy proxy endpoints for backward compatibility
app.get('/api/proxy/crunchyroll/rss', feedRateLimit, async (req, res) => {
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  await handleFeedRequest('crunchyroll', forceFresh, res);
});

app.get('/api/proxy/playstation/rss', feedRateLimit, async (req, res) => {
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

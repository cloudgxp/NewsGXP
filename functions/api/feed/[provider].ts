/**
 * Cloudflare Pages Function: Feed Gateway
 * Route: /api/feed/[provider]
 *
 * Securely proxies approved provider RSS feeds to resolve browser CORS limitations
 * without exposing an open proxy.
 */

interface Env {
  // Cloudflare environment bindings if needed in future
}

interface FeedConfig {
  url: string;
  name: string;
  contentType?: string;
  headers?: Record<string, string>;
  fallbackUrl?: string;
}

const NINTENDO_QUERY = 'query LatestNewsArticles($limit: Int!, $offset: Int = 0, $tags: [String!]!) { collection: newsArticles(limit: $limit, skip: $offset, sort: [publishDate_DESC, priority_DESC], where: { tags: { all: $tags } }) { total offset: skip items { id locale tags { id } title body { snippet: text(characterLimit: 250) } media { publicId resourceType } publishDate url(relative: true) slug } } }';
const NINTENDO_VARS = JSON.stringify({ limit: 30, offset: 0, tags: ['syndicationNcom'] });

// Strict provider allowlist - prevents open proxy vulnerabilities
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

export const onRequestGet = async (context: {
  request: Request;
  params: Record<string, string | string[]>;
  env: Env;
}): Promise<Response> => {
  const providerParam = context.params.provider;
  const providerId = Array.isArray(providerParam) ? providerParam[0] : providerParam;

  if (!providerId || !ALLOWED_FEEDS[providerId]) {
    return new Response(
      JSON.stringify({
        error: 'Unsupported or unknown news provider',
        allowedProviders: Object.keys(ALLOWED_FEEDS),
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }

  const feedConfig = ALLOWED_FEEDS[providerId];
  const requestUrl = new URL(context.request.url);
  const forceFresh = requestUrl.searchParams.get('fresh') === '1' || requestUrl.searchParams.get('fresh') === 'true';

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
      console.warn(`[FeedGateway] Primary endpoint failed with HTTP ${upstreamResponse.status}, attempting fallback for ${feedConfig.name}`);
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
            console.warn(`[FeedGateway] Failed to parse NEXT_DATA fallback for ${feedConfig.name}:`, jsonErr);
          }
        }
      }
    }

    if (!responseData) {
      if (!upstreamResponse.ok) {
        return new Response(
          JSON.stringify({
            error: `Upstream feed returned HTTP ${upstreamResponse.status}`,
            provider: providerId,
          }),
          {
            status: 502,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
      responseData = await upstreamResponse.text();
    }

    const headers = new Headers();
    headers.set('Content-Type', resolvedContentType);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-Provider-Id', providerId);

    if (forceFresh) {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      // 60-second edge cache to maximize performance and protect upstream from high load
      headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
    }

    return new Response(responseData, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: `Failed to retrieve ${feedConfig.name} feed from upstream`,
        details: err?.message || 'Unknown network error',
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};

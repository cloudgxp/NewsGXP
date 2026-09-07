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

// Strict provider allowlist - prevents open proxy vulnerabilities
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
    const upstreamResponse = await fetch(feedConfig.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/1.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

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

    const xmlText = await upstreamResponse.text();

    const headers = new Headers();
    headers.set('Content-Type', 'application/xml; charset=utf-8');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('X-Provider-Id', providerId);

    if (forceFresh) {
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      // 60-second edge cache to maximize performance and protect upstream from high load
      headers.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
    }

    return new Response(xmlText, {
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

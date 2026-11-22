/**
 * Cloudflare Worker Feed Gateway
 * Route: /api/feed/[provider]
 *
 * Securely proxies approved AI & Tech provider feeds to resolve browser CORS limitations
 * without exposing an open proxy.
 */

import { ALLOWED_FEEDS } from '../../../src/config/feeds';

interface Env {
  // Cloudflare environment bindings (D1, Browser Run, etc.) will be added in Phase 2
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 NewsGXP/1.0';

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
  const forceFresh =
    requestUrl.searchParams.get('fresh') === '1' ||
    requestUrl.searchParams.get('fresh') === 'true';

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': feedConfig.headers?.['User-Agent'] || DEFAULT_USER_AGENT,
      Accept: feedConfig.contentType || 'application/rss+xml, application/xml, text/xml, */*',
      ...(feedConfig.headers || {}),
    };

    const upstreamResponse = await fetch(feedConfig.url, {
      headers: upstreamHeaders,
    });

    let responseData = '';
    let resolvedContentType = feedConfig.contentType || 'application/xml; charset=utf-8';

    if (!upstreamResponse.ok && feedConfig.fallbackUrl) {
      console.warn(
        `[FeedGateway] Primary endpoint failed with HTTP ${upstreamResponse.status}, attempting fallback for ${feedConfig.name}`
      );
      const fallbackResponse = await fetch(feedConfig.fallbackUrl, {
        headers: {
          'User-Agent': feedConfig.headers?.['User-Agent'] || DEFAULT_USER_AGENT,
          Accept:
            feedConfig.contentType ||
            'application/rss+xml, application/xml, text/xml, text/html, */*',
          ...(feedConfig.headers || {}),
        },
      });

      if (fallbackResponse.ok) {
        responseData = await fallbackResponse.text();
        const fallbackType = fallbackResponse.headers.get('content-type');
        if (fallbackType) {
          resolvedContentType = fallbackType;
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

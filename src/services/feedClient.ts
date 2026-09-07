/**
 * NewsGXP Shared Feed Client
 *
 * Handles feed retrieval from the same-origin feed gateway (/api/feed/:provider),
 * response status checking, content-type verification, and diagnostic error logging.
 *
 * Keeps network fetching and HTTP error detection decoupled from provider XML normalization.
 */

export interface FetchFeedOptions {
  forceFresh?: boolean;
}

/**
 * Fetches the raw RSS/XML string for a registered provider.
 *
 * @param providerId The provider identifier (e.g., 'crunchyroll', 'playstation')
 * @param providerName The human-readable name of the provider
 * @param options Additional options such as cache busting
 * @returns Raw XML string ready for provider-specific DOM parsing
 */
export async function fetchProviderXml(
  providerId: string,
  providerName: string,
  options?: FetchFeedOptions
): Promise<string> {
  const query = options?.forceFresh ? '?fresh=1' : '';
  const endpoint = `/api/feed/${encodeURIComponent(providerId)}${query}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });
  } catch (networkError: any) {
    console.error(
      `[FeedClient] Network error connecting to gateway for ${providerName} (${providerId}):`,
      networkError?.message || networkError
    );
    throw new Error(
      `Unable to reach the ${providerName} news feed service. Please check your network connection.`
    );
  }

  // 1. Verify request succeeded
  if (!response.ok) {
    console.error(
      `[FeedClient] Gateway returned HTTP status ${response.status} (${response.statusText}) for provider "${providerId}"`
    );

    if (response.status === 404) {
      throw new Error(`Feed provider "${providerName}" is not recognized.`);
    }

    if (response.status === 401 || response.status === 403) {
      console.error(`[FeedClient] Request blocked for provider "${providerId}".`);
      throw new Error(`Unable to retrieve provider feed: access was denied.`);
    }

    if (response.status === 502 || response.status === 504) {
      throw new Error(
        `Unable to retrieve provider feed: upstream ${providerName} service is temporarily unavailable.`
      );
    }

    throw new Error(
      `Unable to retrieve provider feed: gateway returned error status ${response.status}.`
    );
  }

  // 2. Verify Content-Type is reasonable when provided
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    console.error(
      `[FeedClient] Diagnostic: Expected RSS/XML but received text/html for ${providerName} (${providerId}).`
    );
    throw new Error(
      `Unable to retrieve provider feed. Expected RSS/XML but received text/html.`
    );
  }

  // 3. Verify response body exists
  const rawBody = await response.text();
  if (!rawBody || rawBody.trim().length === 0) {
    console.warn(`[FeedClient] Received empty response body for provider "${providerId}".`);
    return '';
  }

  const trimmed = rawBody.trim();

  // 4. Verify response appears to be XML/RSS and not an HTML document fallback
  if (
    trimmed.startsWith('<!DOCTYPE html') ||
    trimmed.startsWith('<!doctype html') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<div id="root">')
  ) {
    console.error(
      `[FeedClient] Diagnostic: Expected RSS/XML but received HTML document (SPA fallback) for ${providerName} (${providerId}).`
    );
    throw new Error(
      `Unable to retrieve provider feed. Expected RSS/XML but received text/html.`
    );
  }

  // Quick structural heuristic: XML should start with <?xml or a root tag like <rss, <feed, <rdf
  if (
    !trimmed.startsWith('<?xml') &&
    !trimmed.startsWith('<rss') &&
    !trimmed.startsWith('<feed') &&
    !trimmed.startsWith('<rdf:RDF')
  ) {
    console.warn(
      `[FeedClient] Diagnostic: Feed body does not begin with standard XML declaration or RSS root for provider "${providerId}". First 100 chars: ${trimmed.slice(0, 100)}`
    );
  }

  return rawBody;
}

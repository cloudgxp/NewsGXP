import { Article, NewsProvider } from '../types';
import { crunchyrollProvider } from '../providers/crunchyroll';
import { playStationProvider } from '../providers/playstation';

/**
 * FeedService
 *
 * Coordinates news providers and supplies normalized Article models to the UI.
 * The UI consumes data from this service without needing to know provider-specific
 * network or parsing details.
 */
export class FeedService {
  // Registered news providers
  private providers: NewsProvider[] = [crunchyrollProvider, playStationProvider];

  /**
   * Returns all registered news providers.
   */
  public getAllProviders(): NewsProvider[] {
    return [...this.providers];
  }

  /**
   * Finds a provider by unique ID.
   */
  public getProvider(id: string): NewsProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  /**
   * Returns metadata for the default active news provider.
   */
  public getProviderInfo(): NewsProvider {
    return this.providers[0];
  }

  /**
   * Fetches articles from all specified followed providers.
   */
  public async getArticlesForProviders(
    followedIds: string[],
    options?: { forceFresh?: boolean }
  ): Promise<Article[]> {
    if (!followedIds || followedIds.length === 0) {
      return [];
    }

    const targetProviders = this.providers.filter((p) => followedIds.includes(p.id));
    if (targetProviders.length === 0) {
      return [];
    }

    // Fetch in parallel across followed providers
    const results = await Promise.allSettled(
      targetProviders.map((provider) => provider.fetchArticles(options))
    );

    const allArticles: Article[] = [];
    let hadError = false;
    let lastErrorMessage = '';

    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        allArticles.push(...res.value);
      } else {
        hadError = true;
        lastErrorMessage = res.reason?.message || `Failed to fetch from ${targetProviders[idx].name}`;
        console.warn(`[FeedService] Provider ${targetProviders[idx].id} fetch failed:`, res.reason);
      }
    });

    // If all target providers failed, throw so the UI shows an error state
    if (hadError && allArticles.length === 0) {
      throw new Error(lastErrorMessage || 'Failed to fetch stories from followed providers.');
    }

    // Sort chronologically newest first
    allArticles.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });

    return allArticles;
  }

  /**
   * Retrieves normalized articles from the default/active providers.
   */
  public async getLatestArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    return this.getArticlesForProviders(this.providers.map((p) => p.id), options);
  }
}

export const feedService = new FeedService();

import { Article, ArticlesApiResponse, NewsProvider } from '../types';
import { openAIProvider } from '../providers/openai';
import { googleProvider } from '../providers/google';
import { microsoftSkillsProvider } from '../providers/microsoft-skills';
import {
  openAiResearchProvider,
  googleAiProvider,
  googleGeminiProvider,
  googleDeepMindProvider,
  mistralProvider,
  githubBlogProvider,
  githubChangelogProvider,
  googleDevelopersProvider,
  microsoftAiProvider,
  azureFoundryProvider,
  awsGenAiProvider,
  awsMlProvider,
  huggingFaceProvider,
  nvidiaGenAiProvider,
  nvidiaDeveloperProvider,
  stabilityAiProvider,
} from '../providers/rssProviders';
import {
  anthropicProvider,
  metaAiProvider,
  cohereProvider,
  perplexityProvider,
  amdBlogsProvider,
  runwayProvider,
  pikaBlogProvider,
  lumaNewsProvider,
  elevenLabsProductProvider,
  elevenLabsResearchProvider,
  sunoBlogProvider,
  sunoReleaseNotesProvider,
  appleIntelligenceProvider,
} from '../providers/htmlProviders';

export const TOPIC_ORDER = [
  'Frontier Labs',
  'Cloud & Engineering',
  'Hardware & Edge',
  'Generative Media',
] as const;

export const DEFAULT_FOLLOWED_PROVIDERS: string[] = [
  'openai',
  'anthropic',
  'google-ai',
  'google-deepmind',
  'huggingface',
  'github-blog',
];

function normalizeUrlForDedup(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.hash = '';
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase();
  } catch {
    return rawUrl.trim().replace(/\/+$/, '').toLowerCase();
  }
}

export interface LoadedFeedResult {
  articles: Article[];
  lastSyncedAt: Date | null;
  source: 'd1' | 'live';
}

/**
 * FeedService
 *
 * Coordinates AI & Tech news providers and loads pre-ingested articles from the
 * Cloudflare D1 API (/api/articles), with automatic fallback to live provider feeds
 * before the first scheduled sync populates D1.
 */
export class FeedService {
  // 32 verified plain-fetch AI & Tech providers grouped across 4 beats
  private providers: NewsProvider[] = [
    // Frontier Labs (9)
    openAIProvider,
    openAiResearchProvider,
    anthropicProvider,
    googleAiProvider,
    googleGeminiProvider,
    googleDeepMindProvider,
    metaAiProvider,
    mistralProvider,
    cohereProvider,

    // Cloud & Engineering (11)
    googleProvider,
    googleDevelopersProvider,
    microsoftAiProvider,
    azureFoundryProvider,
    microsoftSkillsProvider,
    awsGenAiProvider,
    awsMlProvider,
    githubBlogProvider,
    githubChangelogProvider,
    huggingFaceProvider,
    perplexityProvider,

    // Hardware & Edge (4)
    nvidiaGenAiProvider,
    nvidiaDeveloperProvider,
    amdBlogsProvider,
    appleIntelligenceProvider,

    // Generative Media (8)
    stabilityAiProvider,
    runwayProvider,
    pikaBlogProvider,
    lumaNewsProvider,
    elevenLabsProductProvider,
    elevenLabsResearchProvider,
    sunoBlogProvider,
    sunoReleaseNotesProvider,
  ];

  public getAllProviders(): NewsProvider[] {
    return [...this.providers];
  }

  public getAllTopics(): string[] {
    const canonical: string[] = [...TOPIC_ORDER];
    const discovered: string[] = Array.from(new Set(this.providers.map((p) => p.topic)));
    return [
      ...canonical.filter((t) => discovered.includes(t)),
      ...discovered.filter((t) => !canonical.includes(t)),
    ];
  }

  public getProvidersByTopic(topic: string): NewsProvider[] {
    return this.providers.filter((p) => p.topic.toLowerCase() === topic.toLowerCase());
  }

  public getProviderIdsForTopic(topic: string): string[] {
    return this.getProvidersByTopic(topic).map((p) => p.id);
  }

  public getProvider(id: string): NewsProvider | undefined {
    return this.providers.find((p) => p.id === id);
  }

  public getProviderInfo(): NewsProvider {
    return this.providers[0];
  }

  /**
   * Primary path: Fetches pre-ingested, AI-enriched articles from Cloudflare D1 (/api/articles).
   * Falls back to live gateway fetching only if D1 has not been populated yet.
   */
  public async getStoredArticles(
    followedIds: string[],
    options?: { days?: number; forceFresh?: boolean }
  ): Promise<LoadedFeedResult> {
    if (!followedIds || followedIds.length === 0) {
      return { articles: [], lastSyncedAt: null, source: 'd1' };
    }

    const params = new URLSearchParams();
    params.set('providers', followedIds.join(','));
    params.set('limit', '200');
    if (options?.days && options.days > 0) {
      params.set('days', String(options.days));
    }
    if (options?.forceFresh) {
      params.set('_t', String(Date.now()));
    }

    try {
      const response = await fetch(`/api/articles?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const payload = (await response.json()) as ArticlesApiResponse;
        if (!payload.needsInitialSync) {
          return {
            articles: payload.articles,
            lastSyncedAt: payload.lastSyncedAt ? new Date(payload.lastSyncedAt) : null,
            source: 'd1',
          };
        }
      }
    } catch (err) {
      console.warn('[FeedService] D1 /api/articles unavailable, falling back to live fetch:', err);
    }

    // Fallback when D1 hasn't had its first sync yet (or running vite-only preview)
    const liveArticles = await this.getArticlesForProviders(followedIds, {
      forceFresh: options?.forceFresh,
    });
    return {
      articles: liveArticles,
      lastSyncedAt: new Date(),
      source: 'live',
    };
  }

  /**
   * Live client-side fallback: Fetches directly from /api/feed/:provider and deduplicates by URL.
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

    const results = await Promise.allSettled(
      targetProviders.map((provider) => provider.fetchArticles(options))
    );

    const allArticles: Article[] = [];
    const seenUrls = new Set<string>();
    let hadError = false;
    let lastErrorMessage = '';

    results.forEach((res, idx) => {
      if (res.status === 'fulfilled') {
        for (const article of res.value) {
          const canonicalUrl = normalizeUrlForDedup(article.url);
          if (!seenUrls.has(canonicalUrl)) {
            seenUrls.add(canonicalUrl);
            allArticles.push(article);
          }
        }
      } else {
        hadError = true;
        lastErrorMessage =
          res.reason?.message || `Failed to fetch from ${targetProviders[idx].name}`;
        console.warn(`[FeedService] Provider ${targetProviders[idx].id} fetch failed:`, res.reason);
      }
    });

    if (hadError && allArticles.length === 0) {
      throw new Error(lastErrorMessage || 'Failed to fetch stories from followed providers.');
    }

    allArticles.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });

    return allArticles;
  }

  public async getLatestArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    return this.getArticlesForProviders(
      this.providers.map((p) => p.id),
      options
    );
  }
}

export const feedService = new FeedService();

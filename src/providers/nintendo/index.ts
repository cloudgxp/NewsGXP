import { Article, NewsProvider } from '../../types';
import { decodeHtmlEntities, stripHtmlTags } from '../../utils/text';
import { fetchProviderJson } from '../../services/feedClient';

/**
 * Official category tag mappings from Nintendo News & Events.
 * Preserves true category semantics without guessing from headlines.
 */
const NINTENDO_TAG_MAP: Record<string, string> = {
  articleCategoryGameNews: 'Game News',
  articleCategoryEvents: 'Events',
  articleCategoryPromotions: 'Promotions',
  syndicationNintendoSwitchOnline: 'Nintendo Switch Online',
  articleCategoryAskTheDeveloper: 'Ask the Developer',
  syndicationNintendoSwitch2: 'Nintendo Switch 2',
  platformNintendoSwitch: 'Nintendo Switch',
  syndicationZeldaPortal: 'The Legend of Zelda',
  syndicationMarioPortal: 'Super Mario',
  merchandise: 'Merchandise',
};

/**
 * Raw data shape returned by Nintendo's GraphQL API (graph.nintendo.com)
 * and embedded in __NEXT_DATA__ initialApolloState.
 */
interface NintendoRawArticle {
  id: string;
  locale?: string;
  title: string;
  publishDate?: string;
  url?: string;
  'url({"relative":true})'?: string;
  slug?: string;
  body?: {
    snippet?: string;
    text?: string;
    [key: string]: any;
  };
  media?: {
    publicId?: string;
    resourceType?: string;
  };
  tags?: Array<{ id: string } | string | { __ref: string }>;
  [key: string]: any;
}

interface NintendoApiResponse {
  data?: {
    collection?: {
      total?: number;
      offset?: number;
      items?: NintendoRawArticle[];
    };
  };
}

/**
 * Nintendo News & Events Provider
 *
 * Implements the NewsProvider contract for Nintendo.
 * Retrieves stories via the server-side feed gateway (which targets Nintendo's
 * official GraphQL API at graph.nintendo.com with NEXT_DATA fallback)
 * and normalizes them into shared Article models.
 */
export class NintendoProvider implements NewsProvider {
  public readonly id = 'nintendo';
  public readonly name = 'Nintendo';
  public readonly description =
    'Official Nintendo news, game announcements, events, promotions, and Nintendo Switch Online updates.';
  public readonly homepage = 'https://www.nintendo.com/us/whatsnew/';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=nintendo.com&sz=64';
  public readonly categories = ['Gaming'];

  /**
   * Fetches and normalizes news articles from Nintendo.
   */
  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const jsonResponse = await fetchProviderJson<NintendoApiResponse>(
      this.id,
      this.name,
      options
    );

    if (!jsonResponse || !jsonResponse.data?.collection?.items) {
      console.warn('[NintendoProvider] Received empty or unexpected JSON response from gateway');
      return [];
    }

    const rawItems = jsonResponse.data.collection.items;
    const articles: Article[] = [];

    rawItems.forEach((item, index) => {
      try {
        const article = this.normalizeItem(item, index);
        if (article) {
          articles.push(article);
        }
      } catch (itemError) {
        console.warn(
          `[NintendoProvider] Skipped malformed item at index ${index}:`,
          itemError
        );
      }
    });

    // Sort chronologically newest-first
    articles.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });

    return articles;
  }

  /**
   * Normalizes a single Nintendo news item into an Article model.
   */
  private normalizeItem(item: NintendoRawArticle, fallbackIndex: number): Article | null {
    // 1. Title
    const rawTitle = item.title || '';
    const title = decodeHtmlEntities(rawTitle.trim());
    if (!title) {
      return null;
    }

    // 2. Link / URL (handling relative paths)
    const rawPath = item.url || item['url({"relative":true})'] || (item.slug ? `/us/whatsnew/${item.slug}/` : '');
    if (!rawPath) {
      return null;
    }

    let url: string;
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      url = rawPath;
    } else {
      url = new URL(rawPath.startsWith('/') ? rawPath : `/${rawPath}`, 'https://www.nintendo.com').href;
    }

    // 3. ID
    const id = item.id ? String(item.id).trim() : `nintendo-${fallbackIndex}-${Date.now()}`;

    // 4. Publication Date
    const publishedAt = item.publishDate ? item.publishDate.trim() : undefined;

    // 5. Author (Nintendo does not publish individual article authors)
    const author: string | undefined = undefined;

    // 6. Summary / Description
    let summary: string | undefined;
    const rawBody =
      item.body?.snippet ||
      item.body?.text ||
      (typeof item.body === 'string' ? item.body : undefined) ||
      '';

    if (rawBody) {
      const cleaned = decodeHtmlEntities(stripHtmlTags(rawBody)).trim();
      if (cleaned) {
        summary = cleaned.length > 280 ? cleaned.slice(0, 277) + '...' : cleaned;
      }
    }

    // 7. Image Extraction
    let imageUrl: string | undefined;
    const publicId = item.media?.publicId;
    if (publicId && item.media?.resourceType !== 'video') {
      if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
        imageUrl = publicId;
      } else {
        imageUrl = `https://assets.nintendo.com/image/upload/ar_16:9,b_auto:border,c_lpad/b_white/f_auto/q_auto/dpr_1.5/${publicId}`;
      }
    }

    // 8. Categories / Tags
    const categories: string[] = [];
    if (Array.isArray(item.tags)) {
      item.tags.forEach((tag) => {
        let tagId = '';
        if (typeof tag === 'string') {
          tagId = tag;
        } else if (tag && typeof tag === 'object') {
          if ('id' in tag && typeof tag.id === 'string') {
            tagId = tag.id;
          } else if ('__ref' in tag && typeof tag.__ref === 'string') {
            tagId = tag.__ref.replace(/^ContentTag:/, '');
          }
        }

        if (tagId && NINTENDO_TAG_MAP[tagId]) {
          const categoryName = NINTENDO_TAG_MAP[tagId];
          if (!categories.includes(categoryName)) {
            categories.push(categoryName);
          }
        }
      });
    }

    // Default to Gaming category if no specific category was tagged
    if (categories.length === 0) {
      categories.push('Gaming');
    }

    const article: Article = {
      id,
      title,
      url,
      providerId: this.id,
      publishedAt,
      author,
      summary,
      imageUrl,
      categories: categories.length > 0 ? categories : undefined,
    };

    return article;
  }
}

// Export a singleton instance of the Nintendo provider
export const nintendoProvider = new NintendoProvider();

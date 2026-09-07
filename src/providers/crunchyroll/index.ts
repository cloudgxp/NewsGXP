import { Article, NewsProvider } from '../../types';
import { decodeHtmlEntities, stripHtmlTags } from '../../utils/text';
import { fetchProviderXml } from '../../services/feedClient';

/**
 * Crunchyroll News Provider
 *
 * Implements the minimal NewsProvider contract for Crunchyroll.
 * All fetching, XML parsing, sanitization, and normalization
 * are self-contained in this provider module.
 */
export class CrunchyrollProvider implements NewsProvider {
  public readonly id = 'crunchyroll';
  public readonly name = 'Crunchyroll';
  public readonly description =
    'Anime industry news, breaking series announcements, features, and streaming updates from Crunchyroll News.';
  public readonly homepage = 'https://www.crunchyroll.com/news';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=crunchyroll.com&sz=64';
  public readonly categories = ['Anime', 'Manga', 'Industry', 'Streaming'];

  /**
   * Fetches and normalizes news articles from Crunchyroll.
   */
  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const xmlText = await fetchProviderXml(this.id, this.name, options);
    if (!xmlText || xmlText.trim().length === 0) {
      console.warn('[CrunchyrollProvider] Received empty response body from feed');
      return [];
    }

    return this.parseRssXml(xmlText);
  }

  /**
   * Parses raw RSS XML into normalized Article models.
   * Tolerates malformed individual items without crashing the feed.
   */
  private parseRssXml(xmlString: string): Article[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Check for XML parsing syntax errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error(
        '[CrunchyrollProvider] XML DOMParser syntax error:',
        parseError.textContent
      );
      throw new Error('RSS XML parsing failed for Crunchyroll.');
    }

    const itemElements = xmlDoc.querySelectorAll('item');
    const articles: Article[] = [];

    itemElements.forEach((item, index) => {
      try {
        const article = this.normalizeItem(item, index);
        if (article) {
          articles.push(article);
        }
      } catch (itemError) {
        console.warn(
          `[CrunchyrollProvider] Skipped malformed item at index ${index}:`,
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
   * Normalizes a single RSS <item> element into an Article.
   */
  private normalizeItem(item: Element, fallbackIndex: number): Article | null {
    // 1. Title
    const rawTitle = item.querySelector('title')?.textContent || '';
    const title = decodeHtmlEntities(rawTitle.trim());
    if (!title) {
      return null; // Title is required
    }

    // 2. Link / URL
    const rawUrl = item.querySelector('link')?.textContent || '';
    const url = rawUrl.trim();
    if (!url || !url.startsWith('http')) {
      return null; // Valid URL is required
    }

    // 3. ID / GUID
    const rawGuid = item.querySelector('guid')?.textContent || '';
    const id = rawGuid.trim() || url || `cr-article-${fallbackIndex}-${Date.now()}`;

    // 4. Publication Date
    const rawPubDate = item.querySelector('pubDate')?.textContent || '';
    const publishedAt = rawPubDate.trim() || undefined;

    // 5. Author
    const rawAuthor =
      item.querySelector('author')?.textContent ||
      item.getElementsByTagNameNS('*', 'creator')[0]?.textContent ||
      '';
    const author = decodeHtmlEntities(rawAuthor.trim()) || undefined;

    // 6. Summary / Description
    let summary: string | undefined;
    const rawDesc = item.querySelector('description')?.textContent || '';
    if (rawDesc) {
      const cleaned = decodeHtmlEntities(stripHtmlTags(rawDesc));
      if (cleaned) {
        // Truncate cleanly if overly long
        summary = cleaned.length > 280 ? cleaned.slice(0, 277) + '...' : cleaned;
      }
    }

    // 7. Image URL
    let imageUrl: string | undefined;
    // Check <media:thumbnail url="...">
    const mediaThumb = item.getElementsByTagNameNS('*', 'thumbnail')[0];
    if (mediaThumb) {
      imageUrl = mediaThumb.getAttribute('url') || undefined;
    }
    // Fallback to <media:content url="...">
    if (!imageUrl) {
      const mediaContent = item.getElementsByTagNameNS('*', 'content')[0];
      if (mediaContent) {
        imageUrl = mediaContent.getAttribute('url') || undefined;
      }
    }
    // Fallback to <enclosure url="...">
    if (!imageUrl) {
      const enclosure = item.querySelector('enclosure');
      if (enclosure) {
        const encUrl = enclosure.getAttribute('url');
        const encType = enclosure.getAttribute('type') || '';
        if (encUrl && (encType.startsWith('image/') || /\.(jpe?g|png|webp)/i.test(encUrl))) {
          imageUrl = encUrl;
        }
      }
    }

    // 8. Categories / Tags
    const categoryElements = item.querySelectorAll('category');
    const categories: string[] = [];
    categoryElements.forEach((catEl) => {
      const catText = decodeHtmlEntities(catEl.textContent || '').trim();
      if (catText && !categories.includes(catText)) {
        categories.push(catText);
      }
    });

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

// Export a singleton instance of the Crunchyroll provider
export const crunchyrollProvider = new CrunchyrollProvider();

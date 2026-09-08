import { Article, NewsProvider } from '../../types';
import { decodeHtmlEntities, stripHtmlTags } from '../../utils/text';
import { fetchProviderXml } from '../../services/feedClient';

/**
 * Xbox Wire News Provider
 *
 * Implements the NewsProvider contract for Xbox Wire.
 * Retrieves and normalizes the official RSS feed into shared Article models.
 */
export class XboxProvider implements NewsProvider {
  public readonly id = 'xbox';
  public readonly name = 'Xbox Wire';
  public readonly description =
    'Official Xbox news, game announcements, Game Pass updates, developer stories, and more.';
  public readonly homepage = 'https://news.xbox.com/en-us/';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=news.xbox.com&sz=64';
  public readonly categories = ['Gaming'];

  /**
   * Fetches and normalizes news articles from Xbox Wire.
   */
  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const xmlText = await fetchProviderXml(this.id, this.name, options);
    if (!xmlText || xmlText.trim().length === 0) {
      console.warn('[XboxProvider] Received empty response body from feed');
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
        '[XboxProvider] XML DOMParser syntax error:',
        parseError.textContent
      );
      throw new Error('RSS XML parsing failed for Xbox Wire.');
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
          `[XboxProvider] Skipped malformed item at index ${index}:`,
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
    const id = rawGuid.trim() || url || `xbox-article-${fallbackIndex}-${Date.now()}`;

    // 4. Publication Date
    const rawPubDate = item.querySelector('pubDate')?.textContent || '';
    const publishedAt = rawPubDate.trim() || undefined;

    // 5. Author (from dc:creator or author tag)
    const rawAuthor =
      item.getElementsByTagNameNS('*', 'creator')[0]?.textContent ||
      item.querySelector('author')?.textContent ||
      '';
    const author = decodeHtmlEntities(rawAuthor.trim()) || undefined;

    // 6. Summary / Description
    let summary: string | undefined;
    const rawDesc = item.querySelector('description')?.textContent || '';
    if (rawDesc) {
      const cleaned = decodeHtmlEntities(stripHtmlTags(rawDesc));
      if (cleaned) {
        summary = cleaned.length > 280 ? cleaned.slice(0, 277) + '...' : cleaned;
      }
    }

    // 7. Image Extraction
    let imageUrl: string | undefined;

    // Check enclosure for direct image link
    const enclosure = item.querySelector('enclosure');
    if (enclosure) {
      const encUrl = enclosure.getAttribute('url');
      const encType = enclosure.getAttribute('type') || '';
      if (encUrl && (encType.startsWith('image/') || /\.(jpe?g|png|webp|gif)/i.test(encUrl))) {
        imageUrl = encUrl;
      }
    }

    // Check <content:encoded> for <img> tags
    if (!imageUrl) {
      const encodedContent = item.getElementsByTagNameNS('*', 'encoded')[0]?.textContent || '';
      if (encodedContent) {
        const imgMatch = encodedContent.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch && imgMatch[1]) {
          imageUrl = imgMatch[1];
        }
      }
    }

    // Fallback to <description> for <img> tags if needed
    if (!imageUrl && rawDesc) {
      const descImgMatch = rawDesc.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (descImgMatch && descImgMatch[1]) {
        imageUrl = descImgMatch[1];
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

// Export a singleton instance of the Xbox Wire provider
export const xboxProvider = new XboxProvider();

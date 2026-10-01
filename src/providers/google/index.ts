import { Article, NewsProvider } from '../../types';
import { decodeHtmlEntities, stripHtmlTags } from '../../utils/text';
import { fetchProviderXml } from '../../services/feedClient';

/**
 * Google Blog News Provider (The Keyword)
 *
 * Implements the NewsProvider contract for Google Blog.
 * Retrieves and normalizes stories from https://blog.google/rss/.
 */
export class GoogleProvider implements NewsProvider {
  public readonly id = 'google';
  public readonly name = 'Google Blog';
  public readonly topic = 'Technology';
  public readonly description =
    'Official news, product innovations, Gemini and AI updates, and technology stories across Google.';
  public readonly homepage = 'https://blog.google/';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=blog.google&sz=64';
  public readonly categories = ['Technology', 'AI', 'Products', 'Innovation'];

  /**
   * Fetches and normalizes news articles from Google Blog.
   */
  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const xmlText = await fetchProviderXml(this.id, this.name, options);
    if (!xmlText || xmlText.trim().length === 0) {
      console.warn('[GoogleProvider] Received empty response body from feed');
      return [];
    }

    return this.parseRssXml(xmlText);
  }

  /**
   * Parses raw RSS XML into normalized Article models.
   */
  private parseRssXml(xmlString: string): Article[] {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error(
        '[GoogleProvider] XML DOMParser syntax error:',
        parseError.textContent
      );
      throw new Error('RSS XML parsing failed for Google Blog.');
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
          `[GoogleProvider] Skipped malformed item at index ${index}:`,
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
      return null;
    }

    // 2. Link / URL
    const rawUrl = item.querySelector('link')?.textContent || '';
    const url = rawUrl.trim();
    if (!url || !url.startsWith('http')) {
      return null;
    }

    // 3. ID / GUID
    const rawGuid = item.querySelector('guid')?.textContent || '';
    const id = rawGuid.trim() || url || `google-article-${fallbackIndex}-${Date.now()}`;

    // 4. Publication Date
    const rawPubDate = item.querySelector('pubDate')?.textContent || '';
    const publishedAt = rawPubDate.trim() || undefined;

    // 5. Author (Google RSS uses <author><name>...</name></author> or dc:creator)
    let author: string | undefined;
    const authorEl = item.querySelector('author');
    if (authorEl) {
      const nameEl = authorEl.querySelector('name');
      const authorText = nameEl?.textContent || authorEl.textContent || '';
      author = decodeHtmlEntities(authorText.trim()) || undefined;
    }
    if (!author) {
      const creator = item.getElementsByTagNameNS('*', 'creator')[0]?.textContent || '';
      author = decodeHtmlEntities(creator.trim()) || undefined;
    }

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
    const mediaContent = item.getElementsByTagNameNS('*', 'content')[0];
    if (mediaContent) {
      imageUrl = mediaContent.getAttribute('url') || undefined;
    }

    if (!imageUrl) {
      const mediaThumb = item.getElementsByTagNameNS('*', 'thumbnail')[0];
      if (mediaThumb) {
        imageUrl = mediaThumb.getAttribute('url') || undefined;
      }
    }

    if (!imageUrl && rawDesc) {
      const imgMatch = rawDesc.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgMatch && imgMatch[1]) {
        imageUrl = imgMatch[1];
      }
    }

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

    if (categories.length === 0) {
      categories.push('Technology');
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

export const googleProvider = new GoogleProvider();

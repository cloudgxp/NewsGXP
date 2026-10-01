import { Article, NewsProvider } from '../../types';
import { decodeHtmlEntities, stripHtmlTags } from '../../utils/text';
import { fetchProviderXml } from '../../services/feedClient';

/**
 * Microsoft Skills Hub News Provider
 *
 * Implements the NewsProvider contract for Microsoft Tech Community - Skills Hub Blog.
 * Retrieves and normalizes the official RSS feed.
 */
export class MicrosoftSkillsProvider implements NewsProvider {
  public readonly id = 'microsoft-skills';
  public readonly name = 'Microsoft Skills Hub';
  public readonly topic = 'Technology';
  public readonly description =
    'Insights, skilling strategies, and guidance on navigating AI adoption and technical fluency from Microsoft.';
  public readonly homepage =
    'https://techcommunity.microsoft.com/category/skills-hub/blog/skills-hub-blog';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=microsoft.com&sz=64';
  public readonly categories = ['Technology', 'AI Skills', 'Workplace', 'Adoption'];

  /**
   * Fetches and normalizes news articles from Microsoft Skills Hub.
   */
  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const xmlText = await fetchProviderXml(this.id, this.name, options);
    if (!xmlText || xmlText.trim().length === 0) {
      console.warn('[MicrosoftSkillsProvider] Received empty response body from feed');
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
        '[MicrosoftSkillsProvider] XML DOMParser syntax error:',
        parseError.textContent
      );
      throw new Error('RSS XML parsing failed for Microsoft Skills Hub.');
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
          `[MicrosoftSkillsProvider] Skipped malformed item at index ${index}:`,
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
    const id = rawGuid.trim() || url || `ms-skills-article-${fallbackIndex}-${Date.now()}`;

    // 4. Publication Date
    const rawPubDate = item.querySelector('pubDate')?.textContent || '';
    const publishedAt = rawPubDate.trim() || undefined;

    // 5. Author
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
    if (rawDesc) {
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

export const microsoftSkillsProvider = new MicrosoftSkillsProvider();

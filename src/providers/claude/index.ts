import { Article, NewsProvider } from '../../types';
import { decodeHtmlEntities, stripHtmlTags } from '../../utils/text';
import { fetchProviderHtml } from '../../services/feedClient';

/**
 * Claude Blog News Provider
 *
 * Implements the NewsProvider contract for Claude by Anthropic.
 * Retrieves the official blog from https://claude.com/blog via the gateway
 * and normalizes published blog articles into shared Article models.
 */
export class ClaudeProvider implements NewsProvider {
  public readonly id = 'claude';
  public readonly name = 'Claude Blog';
  public readonly topic = 'AI';
  public readonly description =
    'Official guides, product releases, research, and enterprise use cases for Claude by Anthropic.';
  public readonly homepage = 'https://claude.com/blog';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=claude.com&sz=64';
  public readonly categories = ['AI', 'Agents', 'Product', 'Enterprise AI'];

  /**
   * Fetches and normalizes news articles from Claude Blog.
   */
  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const htmlText = await fetchProviderHtml(this.id, this.name, options);
    if (!htmlText || htmlText.trim().length === 0) {
      console.warn('[ClaudeProvider] Received empty response body from feed gateway');
      return [];
    }

    return this.parseBlogHtml(htmlText);
  }

  /**
   * Parses raw HTML into normalized Article models.
   * Tolerates variations in Webflow CMS DOM structure.
   */
  private parseBlogHtml(html: string): Article[] {
    const articles: Article[] = [];
    const seenUrls = new Set<string>();

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Select all candidate article link elements
      const linkElements = doc.querySelectorAll('a[href^="/blog/"]');

      linkElements.forEach((linkEl, index) => {
        const rawHref = linkEl.getAttribute('href') || '';
        const cleanPath = rawHref.split('?')[0].split('#')[0].replace(/\/+$/, '');

        // Exclude root /blog or already seen links
        if (!cleanPath || cleanPath === '/blog' || seenUrls.has(cleanPath)) {
          return;
        }

        const fullUrl = cleanPath.startsWith('http')
          ? cleanPath
          : `https://claude.com${cleanPath}`;

        // Title from data-cta-copy, heading attribute, or textContent
        let title =
          linkEl.getAttribute('data-cta-copy') ||
          linkEl.textContent?.replace(/Read more/gi, '').trim() ||
          '';

        // Find surrounding card container (listitem or closest parent container)
        const cardContainer =
          linkEl.closest('[role="listitem"]') ||
          linkEl.closest('.w-dyn-item') ||
          linkEl.parentElement;

        if (!title && cardContainer) {
          const heading =
            cardContainer.querySelector('[fs-list-field="heading"]') ||
            cardContainer.querySelector('h1, h2, h3, h4, h5, h6') ||
            cardContainer.querySelector('.card_blog_title');
          if (heading) {
            title = heading.textContent || '';
          }
        }

        title = decodeHtmlEntities(title.trim());
        if (!title || title.length < 3) {
          return;
        }

        seenUrls.add(cleanPath);

        // Date extraction
        let publishedAt: string | undefined;
        if (cardContainer) {
          const dateEl =
            cardContainer.querySelector('[fs-list-field="date"]') ||
            cardContainer.querySelector('[fs-list-fieldtype="date"]') ||
            cardContainer.querySelector('.u-foreground-tertiary');
          if (dateEl && dateEl.textContent) {
            const dateCandidate = dateEl.textContent.trim();
            // Validate it looks like a date (e.g. Month Day, Year or similar)
            if (/[A-Za-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2}/.test(dateCandidate)) {
              publishedAt = dateCandidate;
            }
          }
        }

        // Category extraction
        const categories: string[] = [];
        if (cardContainer) {
          const catEl = cardContainer.querySelector('[fs-list-field="category"]');
          if (catEl && catEl.textContent) {
            const catText = decodeHtmlEntities(catEl.textContent.trim());
            if (catText && !categories.includes(catText)) {
              categories.push(catText);
            }
          }
        }
        if (categories.length === 0) {
          categories.push('AI');
        }

        // Image extraction
        let imageUrl: string | undefined;
        if (cardContainer) {
          const imgEl = cardContainer.querySelector('img');
          if (imgEl) {
            const src = imgEl.getAttribute('src');
            if (src && !src.includes('data:image') && !src.includes('blank')) {
              imageUrl = src.startsWith('http') ? src : `https://claude.com${src}`;
            }
          }
        }

        const id = `claude-${cleanPath.replace('/blog/', '') || index}`;

        articles.push({
          id,
          title,
          url: fullUrl,
          providerId: this.id,
          publishedAt,
          summary: undefined,
          imageUrl,
          categories,
        });
      });
    } catch (domErr) {
      console.warn('[ClaudeProvider] DOM parsing failed, falling back to regex extraction:', domErr);
    }

    // Fallback: If DOMParser didn't extract any articles (e.g. environment issue), use regex
    if (articles.length === 0) {
      const linkRegex = /<a\b[^>]*\bhref=["'](\/blog\/[^"'#]+)["'][^>]*>/gi;
      let match: RegExpExecArray | null;

      while ((match = linkRegex.exec(html)) !== null) {
        const path = match[1].replace(/\/+$/, '');
        if (!path || path === '/blog' || seenUrls.has(path)) {
          continue;
        }

        const tag = match[0];
        const titleMatch = tag.match(/data-cta-copy=["']([^"']+)["']/i);
        const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '';
        if (!title) continue;

        seenUrls.add(path);
        const window = html.slice(Math.max(0, match.index - 1200), Math.min(html.length, match.index + 1200));

        const dateMatch = window.match(/(?:fs-list-field=["']date["'][^>]*>|u-foreground-tertiary[^>]*>)([A-Za-z]+ \d{1,2}, \d{4})/i);
        const catMatch = window.match(/fs-list-field=["']category["'][^>]*>([^<]+)</i);
        const imgMatch = window.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i);

        const categories = catMatch ? [decodeHtmlEntities(catMatch[1].trim())] : ['AI'];

        articles.push({
          id: `claude-${path.replace('/blog/', '')}`,
          title,
          url: `https://claude.com${path}`,
          providerId: this.id,
          publishedAt: dateMatch ? dateMatch[1] : undefined,
          imageUrl: imgMatch ? imgMatch[1] : undefined,
          categories,
        });
      }
    }

    // Sort chronologically newest-first
    articles.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });

    return articles;
  }
}

export const claudeProvider = new ClaudeProvider();

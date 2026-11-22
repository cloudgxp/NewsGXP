import { Article, NewsProvider } from '../types';
import { decodeHtmlEntities, stripHtmlTags } from '../utils/text';
import { fetchProviderXml } from '../services/feedClient';

export interface RssProviderConfig {
  id: string;
  name: string;
  topic: string;
  description?: string;
  homepage: string;
  icon?: string;
  categories?: string[];
  filterFn?: (article: Article) => boolean;
}

/**
 * BaseRssProvider
 *
 * Generic, resilient RSS 2.0 / Atom 1.0 / RDF provider implementation.
 * Supports native DOMParser parsing with regex fallbacks for maximum resilience.
 */
export class BaseRssProvider implements NewsProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly topic: string;
  public readonly description?: string;
  public readonly homepage: string;
  public readonly icon?: string;
  public readonly categories?: string[];
  private readonly filterFn?: (article: Article) => boolean;

  constructor(config: RssProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.topic = config.topic;
    this.description = config.description;
    this.homepage = config.homepage;
    this.icon = config.icon || `https://www.google.com/s2/favicons?domain=${new URL(config.homepage).hostname}&sz=64`;
    this.categories = config.categories || [config.topic];
    this.filterFn = config.filterFn;
  }

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const xmlText = await fetchProviderXml(this.id, this.name, options);
    if (!xmlText || xmlText.trim().length === 0) {
      console.warn(`[${this.name}] Received empty XML response body`);
      return [];
    }

    let articles: Article[] = [];
    try {
      if (typeof DOMParser !== 'undefined') {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const parseError = xmlDoc.querySelector('parsererror');
        if (!parseError) {
          articles = this.parseXmlDom(xmlDoc);
        }
      }
    } catch {
      // Fall through to regex parser
    }

    if (articles.length === 0) {
      articles = this.parseXmlRegex(xmlText);
    }

    if (this.filterFn) {
      articles = articles.filter(this.filterFn);
    }

    // Sort chronologically newest-first
    articles.sort((a, b) => {
      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return timeB - timeA;
    });

    return articles;
  }

  private parseXmlDom(doc: Document): Article[] {
    const isAtom = doc.documentElement.tagName.toLowerCase() === 'feed';
    return isAtom ? this.parseAtomDom(doc) : this.parseRssDom(doc);
  }

  private parseRssDom(doc: Document): Article[] {
    const items = doc.querySelectorAll('item');
    const articles: Article[] = [];

    items.forEach((item, index) => {
      try {
        const rawTitle = item.querySelector('title')?.textContent || '';
        const title = decodeHtmlEntities(rawTitle.trim());
        if (!title) return;

        const rawUrl = item.querySelector('link')?.textContent || '';
        const url = rawUrl.trim();
        if (!url || !url.startsWith('http')) return;

        const guid = item.querySelector('guid')?.textContent?.trim() || url || `${this.id}-${index}-${Date.now()}`;
        const rawPubDate = item.querySelector('pubDate')?.textContent || item.querySelector('date')?.textContent || '';
        const publishedAt = rawPubDate.trim() || undefined;

        let author: string | undefined;
        const authorEl = item.querySelector('author');
        if (authorEl) {
          author = decodeHtmlEntities(authorEl.querySelector('name')?.textContent || authorEl.textContent || '').trim();
        }
        if (!author) {
          const creator = item.getElementsByTagNameNS('*', 'creator')[0]?.textContent || '';
          author = decodeHtmlEntities(creator.trim()) || undefined;
        }

        let summary: string | undefined;
        const rawDesc = item.querySelector('description')?.textContent || item.getElementsByTagNameNS('*', 'encoded')[0]?.textContent || '';
        if (rawDesc) {
          const cleaned = decodeHtmlEntities(stripHtmlTags(rawDesc));
          if (cleaned) {
            summary = cleaned.length > 280 ? cleaned.slice(0, 277) + '...' : cleaned;
          }
        }

        let imageUrl: string | undefined;
        const enclosure = item.querySelector('enclosure');
        if (enclosure) {
          const encUrl = enclosure.getAttribute('url');
          const encType = enclosure.getAttribute('type') || '';
          if (encUrl && (encType.startsWith('image/') || /\.(jpe?g|png|webp|gif)/i.test(encUrl))) {
            imageUrl = encUrl;
          }
        }
        if (!imageUrl) {
          const mediaContent = item.getElementsByTagNameNS('*', 'content')[0];
          if (mediaContent) {
            imageUrl = mediaContent.getAttribute('url') || undefined;
          }
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

        const categories: string[] = [];
        const catElements = item.querySelectorAll('category');
        catElements.forEach((cat) => {
          const val = decodeHtmlEntities(cat.textContent || '').trim();
          if (val && !categories.includes(val)) {
            categories.push(val);
          }
        });
        if (categories.length === 0 && this.categories) {
          categories.push(...this.categories);
        }

        articles.push({
          id: guid,
          title,
          url,
          providerId: this.id,
          publishedAt,
          author,
          summary,
          imageUrl,
          categories: categories.length > 0 ? categories : undefined,
        });
      } catch {
        // Skip malformed item
      }
    });

    return articles;
  }

  private parseAtomDom(doc: Document): Article[] {
    const entries = doc.querySelectorAll('entry');
    const articles: Article[] = [];

    entries.forEach((entry, index) => {
      try {
        const rawTitle = entry.querySelector('title')?.textContent || '';
        const title = decodeHtmlEntities(rawTitle.trim());
        if (!title) return;

        let url = '';
        const linkEls = entry.querySelectorAll('link');
        linkEls.forEach((link) => {
          const rel = link.getAttribute('rel');
          const href = link.getAttribute('href');
          if ((!rel || rel === 'alternate') && href && !url) {
            url = href.trim();
          }
        });
        if (!url && linkEls.length > 0) {
          url = linkEls[0].getAttribute('href')?.trim() || '';
        }
        if (!url || !url.startsWith('http')) return;

        const id = entry.querySelector('id')?.textContent?.trim() || url || `${this.id}-${index}-${Date.now()}`;
        const rawPubDate = entry.querySelector('published')?.textContent || entry.querySelector('updated')?.textContent || '';
        const publishedAt = rawPubDate.trim() || undefined;

        let author: string | undefined;
        const authorEl = entry.querySelector('author');
        if (authorEl) {
          author = decodeHtmlEntities(authorEl.querySelector('name')?.textContent || authorEl.textContent || '').trim() || undefined;
        }

        let summary: string | undefined;
        const rawSummary = entry.querySelector('summary')?.textContent || entry.querySelector('content')?.textContent || '';
        if (rawSummary) {
          const cleaned = decodeHtmlEntities(stripHtmlTags(rawSummary));
          if (cleaned) {
            summary = cleaned.length > 280 ? cleaned.slice(0, 277) + '...' : cleaned;
          }
        }

        let imageUrl: string | undefined;
        const mediaContent = entry.getElementsByTagNameNS('*', 'content')[0];
        if (mediaContent) {
          imageUrl = mediaContent.getAttribute('url') || undefined;
        }
        if (!imageUrl && rawSummary) {
          const imgMatch = rawSummary.match(/<img[^>]+src=["']([^"']+)["']/i);
          if (imgMatch && imgMatch[1]) {
            imageUrl = imgMatch[1];
          }
        }

        const categories: string[] = [];
        const catElements = entry.querySelectorAll('category');
        catElements.forEach((cat) => {
          const term = cat.getAttribute('term') || cat.textContent || '';
          const val = decodeHtmlEntities(term.trim());
          if (val && !categories.includes(val)) {
            categories.push(val);
          }
        });
        if (categories.length === 0 && this.categories) {
          categories.push(...this.categories);
        }

        articles.push({
          id,
          title,
          url,
          providerId: this.id,
          publishedAt,
          author,
          summary,
          imageUrl,
          categories: categories.length > 0 ? categories : undefined,
        });
      } catch {
        // Skip malformed entry
      }
    });

    return articles;
  }

  private parseXmlRegex(xmlString: string): Article[] {
    const articles: Article[] = [];
    const isAtom =
      /<feed\b/i.test(xmlString) &&
      (/<entry\b/i.test(xmlString) || /\bxmlns\s*=\s*["'][^"']*\/2005\/Atom["']/i.test(xmlString));

    if (isAtom) {
      const entryRegex = /<entry[\s\S]*?<\/entry>/gi;
      let entryMatch: RegExpExecArray | null;
      let idx = 0;
      while ((entryMatch = entryRegex.exec(xmlString)) !== null) {
        const entryXml = entryMatch[0];
        const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? decodeHtmlEntities(stripHtmlTags(titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))) : '';

        const linkMatch = entryXml.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']alternate["']/i) ||
                          entryXml.match(/<link[^>]+href=["']([^"']+)["']/i) ||
                          entryXml.match(/<link>([^<]+)<\/link>/i);
        const url = linkMatch ? linkMatch[1].trim() : '';
        if (!title || !url || !url.startsWith('http')) continue;

        const idMatch = entryXml.match(/<id>([^<]+)<\/id>/i);
        const id = (idMatch ? idMatch[1].trim() : '') || url || `${this.id}-${idx}`;

        const dateMatch = entryXml.match(/<published>([^<]+)<\/published>/i) || entryXml.match(/<updated>([^<]+)<\/updated>/i);
        const publishedAt = dateMatch ? dateMatch[1].trim() : undefined;

        const summaryMatch = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || entryXml.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
        let summary: string | undefined;
        if (summaryMatch) {
          const cleaned = decodeHtmlEntities(stripHtmlTags(summaryMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')));
          if (cleaned) {
            summary = cleaned.length > 280 ? cleaned.slice(0, 277) + '...' : cleaned;
          }
        }

        const imgMatch = entryXml.match(/<enclosure[^>]+url=["']([^"']+)["']/i) || entryXml.match(/<img[^>]+src=["']([^"']+)["']/i);
        const imageUrl = imgMatch ? imgMatch[1].trim() : undefined;

        articles.push({
          id,
          title,
          url,
          providerId: this.id,
          publishedAt,
          summary,
          imageUrl,
          categories: this.categories,
        });
        idx++;
      }
    } else {
      const itemRegex = /<item[\s\S]*?<\/item>/gi;
      let itemMatch: RegExpExecArray | null;
      let idx = 0;
      while ((itemMatch = itemRegex.exec(xmlString)) !== null) {
        const itemXml = itemMatch[0];
        const titleMatch = itemXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? decodeHtmlEntities(stripHtmlTags(titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'))) : '';

        const linkMatch = itemXml.match(/<link[^>]*>([\s\S]*?)<\/link>/i) ||
                          itemXml.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i);
        const url = linkMatch ? linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
        if (!title || !url || !url.startsWith('http')) continue;

        const guidMatch = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
        const id = (guidMatch ? guidMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '') || url || `${this.id}-${idx}`;

        const pubDateMatch = itemXml.match(/<pubDate>([^<]+)<\/pubDate>/i) || itemXml.match(/<dc:date>([^<]+)<\/dc:date>/i);
        const publishedAt = pubDateMatch ? pubDateMatch[1].trim() : undefined;

        const descMatch = itemXml.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || itemXml.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
        let summary: string | undefined;
        if (descMatch) {
          const cleaned = decodeHtmlEntities(stripHtmlTags(descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')));
          if (cleaned) {
            summary = cleaned.length > 280 ? cleaned.slice(0, 277) + '...' : cleaned;
          }
        }

        const imgMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i) ||
                         itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
                         itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
                         itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
        const imageUrl = imgMatch ? imgMatch[1].trim() : undefined;

        articles.push({
          id,
          title,
          url,
          providerId: this.id,
          publishedAt,
          summary,
          imageUrl,
          categories: this.categories,
        });
        idx++;
      }
    }

    return articles;
  }
}

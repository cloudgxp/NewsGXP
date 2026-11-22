/**
 * Workers-Native Feed & HTML Parsers (Zero DOM Dependency)
 *
 * Parses RSS 2.0, Atom 1.0, and approved HTML newsroom pages directly inside Cloudflare Workers.
 */

import { decodeHTML } from 'entities';

export interface ParsedArticle {
  id: string;
  canonicalUrl: string;
  url: string;
  title: string;
  providerId: string;
  topic: string;
  publishedAt: string | null;
  author: string | null;
  summary: string | null;
  imageUrl: string | null;
  categories: string[];
}

export function normalizeCanonicalUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    u.hash = '';
    // Strip common tracking query params while preserving meaningful ones
    for (const key of Array.from(u.searchParams.keys())) {
      if (key.startsWith('utm_') || key === 'ref' || key === 'source') {
        u.searchParams.delete(key);
      }
    }
    const qs = u.searchParams.toString();
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}${qs ? `?${qs}` : ''}`.toLowerCase();
  } catch {
    return rawUrl.trim().replace(/\/+$/, '').toLowerCase();
  }
}

export function normalizeIsoDate(raw?: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const parsed = new Date(raw.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export function stripTags(html: string): string {
  let prev: string;
  let curr = html;
  do {
    prev = curr;
    curr = curr.replace(/<[^>]*>/g, ' ');
  } while (curr !== prev);
  return curr.replace(/[<>]/g, '').replace(/\s{2,}/g, ' ').trim();
}

function cleanCdata(value: string): string {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function slugToTitle(slug: string): string {
  return slug
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function makeSummary(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = decodeHTML(stripTags(cleanCdata(raw)));
  if (!cleaned) return null;
  return cleaned.length > 320 ? `${cleaned.slice(0, 317)}...` : cleaned;
}

function buildArticleId(providerId: string, canonicalUrl: string): string {
  // Deterministic URL-safe ID based on provider + canonical URL
  let hash = 2166136261;
  for (let i = 0; i < canonicalUrl.length; i++) {
    hash ^= canonicalUrl.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${providerId}-${(hash >>> 0).toString(36)}`;
}

/**
 * Parses RSS 2.0 or Atom 1.0 XML into normalized ParsedArticle objects.
 */
export function parseRssOrAtom(
  xmlString: string,
  providerId: string,
  topic: string,
  defaultCategories: string[]
): ParsedArticle[] {
  if (!xmlString || !xmlString.trim()) return [];

  const articles: ParsedArticle[] = [];
  const isAtom =
    /<feed\b/i.test(xmlString) &&
    (/<entry\b/i.test(xmlString) || /\bxmlns\s*=\s*["'][^"']*\/2005\/Atom["']/i.test(xmlString));

  if (isAtom) {
    const entryRegex = /<entry\b[\s\S]*?<\/entry>/gi;
    let m: RegExpExecArray | null;
    while ((m = entryRegex.exec(xmlString)) !== null) {
      const entry = m[0];
      const titleMatch = entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? decodeHTML(stripTags(cleanCdata(titleMatch[1]))).trim() : '';

      const linkMatch =
        entry.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i) ||
        entry.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["']/i) ||
        entry.match(/<link[^>]+href=["']([^"']+)["']/i) ||
        entry.match(/<link>([^<]+)<\/link>/i);
      const url = linkMatch ? decodeHTML(linkMatch[1].trim()) : '';
      if (!title || !url || !url.startsWith('http')) continue;

      const dateMatch =
        entry.match(/<published[^>]*>([^<]+)<\/published>/i) ||
        entry.match(/<updated[^>]*>([^<]+)<\/updated>/i);
      const authorMatch =
        entry.match(/<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i) ||
        entry.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i);
      const summaryMatch =
        entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) ||
        entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i);
      const imgMatch =
        entry.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
        entry.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
        entry.match(/<enclosure[^>]+url=["']([^"']+)["']/i) ||
        entry.match(/<img[^>]+src=["']([^"']+)["']/i);

      const cats = extractXmlCategories(entry, defaultCategories);
      const canonicalUrl = normalizeCanonicalUrl(url);

      articles.push({
        id: buildArticleId(providerId, canonicalUrl),
        canonicalUrl,
        url,
        title,
        providerId,
        topic,
        publishedAt: normalizeIsoDate(dateMatch?.[1]),
        author: authorMatch ? decodeHTML(stripTags(cleanCdata(authorMatch[1]))).trim() || null : null,
        summary: makeSummary(summaryMatch?.[1]),
        imageUrl: imgMatch ? decodeHTML(imgMatch[1].trim()) : null,
        categories: cats,
      });
    }
  } else {
    const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(xmlString)) !== null) {
      const item = m[0];
      const titleMatch = item.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? decodeHTML(stripTags(cleanCdata(titleMatch[1]))).trim() : '';

      const linkMatch =
        item.match(/<link[^>]*>([\s\S]*?)<\/link>/i) ||
        item.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i);
      const url = linkMatch ? decodeHTML(cleanCdata(linkMatch[1]).trim()) : '';
      if (!title || !url || !url.startsWith('http')) continue;

      const dateMatch =
        item.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/i) ||
        item.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/i) ||
        item.match(/<date[^>]*>([^<]+)<\/date>/i);
      const authorMatch =
        item.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) ||
        item.match(/<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i) ||
        item.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
      const descMatch =
        item.match(/<description[^>]*>([\s\S]*?)<\/description>/i) ||
        item.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i);
      const imgMatch =
        item.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i) ||
        item.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
        item.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) ||
        item.match(/<img[^>]+src=["']([^"']+)["']/i);

      const cats = extractXmlCategories(item, defaultCategories);
      const canonicalUrl = normalizeCanonicalUrl(url);

      articles.push({
        id: buildArticleId(providerId, canonicalUrl),
        canonicalUrl,
        url,
        title,
        providerId,
        topic,
        publishedAt: normalizeIsoDate(dateMatch?.[1]),
        author: authorMatch ? decodeHTML(stripTags(cleanCdata(authorMatch[1]))).trim() || null : null,
        summary: makeSummary(descMatch?.[1]),
        imageUrl: imgMatch ? decodeHTML(imgMatch[1].trim()) : null,
        categories: cats,
      });
    }
  }

  // Provider-specific filtering (OpenAI Research filters the shared OpenAI RSS feed)
  if (providerId === 'openai-research') {
    return articles.filter((art) => {
      const text = `${art.title} ${art.url} ${art.summary || ''} ${art.categories.join(' ')}`.toLowerCase();
      return (
        art.url.includes('/research') ||
        art.url.includes('/index/') ||
        text.includes('research') ||
        text.includes('paper') ||
        text.includes('model') ||
        text.includes('gpt') ||
        text.includes('safety') ||
        text.includes('benchmark')
      );
    });
  }

  return articles;
}

function extractXmlCategories(fragment: string, fallback: string[]): string[] {
  const cats: string[] = [];
  const catRegex = /<category\b([^>]*)>([\s\S]*?)<\/category>|<category\b[^>]*term=["']([^"']+)["'][^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = catRegex.exec(fragment)) !== null) {
    const raw = m[3] || m[2] || '';
    const cleaned = decodeHTML(stripTags(cleanCdata(raw))).trim();
    if (cleaned && !cats.includes(cleaned)) {
      cats.push(cleaned);
    }
  }
  return cats.length > 0 ? cats.slice(0, 5) : [...fallback];
}

/**
 * Parses HTML newsroom/blog pages for the approved non-RSS AI & Tech providers.
 */
export function parseHtmlProvider(
  providerId: string,
  html: string,
  topic: string,
  defaultCategories: string[]
): ParsedArticle[] {
  if (!html || !html.trim()) return [];

  // Some providers (e.g. apple-intelligence, meta-ai) fall back to RSS XML when primary fails
  const trimmed = html.trim();
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<rss') || trimmed.startsWith('<feed')) {
    return parseRssOrAtom(html, providerId, topic, defaultCategories);
  }

  switch (providerId) {
    case 'anthropic':
      return parseAnthropicHtml(html, providerId, topic, defaultCategories);
    case 'meta-ai':
      return parseMetaAiHtml(html, providerId, topic, defaultCategories);
    case 'cohere':
      return parseCohereHtml(html, providerId, topic, defaultCategories);
    case 'perplexity':
      return parsePerplexityHtml(html, providerId, topic, defaultCategories);
    case 'amd-blogs':
      return parseAmdHtml(html, providerId, topic, defaultCategories);
    case 'apple-intelligence':
      return parseAppleIntelligenceHtml(html, providerId, topic, defaultCategories);
    case 'runway-news':
      return parseSlugListHtml(
        html,
        providerId,
        topic,
        defaultCategories,
        /\/news\/([a-zA-Z0-9_-]+)/g,
        'https://runway.com/news/',
        ['customers', 'research', 'company-news', 'developers', 'safety', 'engineering']
      );
    case 'pika-blog':
      return parseSlugListHtml(
        html,
        providerId,
        topic,
        defaultCategories,
        /href=["']\/blog\/([a-zA-Z0-9_-]+)["']/gi,
        'https://pika.art/blog/',
        ['blog-og.jpg']
      );
    case 'luma-news':
      return parseSlugListHtml(
        html,
        providerId,
        topic,
        defaultCategories,
        /href=["']\/news\/([a-zA-Z0-9_-]+)["']/gi,
        'https://lumalabs.ai/news/',
        []
      );
    case 'elevenlabs-product':
    case 'elevenlabs-research':
      return parseSlugListHtml(
        html,
        providerId,
        topic,
        defaultCategories,
        /href=["']\/blog\/([a-zA-Z0-9_-]+)["']/gi,
        'https://elevenlabs.io/blog/',
        ['category']
      );
    case 'suno-blog':
      return parseSlugListHtml(
        html,
        providerId,
        topic,
        defaultCategories,
        /href=["']\/blog\/([a-zA-Z0-9_-]+)["']/gi,
        'https://suno.com/blog/',
        []
      );
    case 'suno-release-notes':
      return parseSlugListHtml(
        html,
        providerId,
        topic,
        defaultCategories,
        /href=["']\/release-notes\/([a-zA-Z0-9_-]+)["']/gi,
        'https://suno.com/release-notes/',
        []
      );
    default:
      return [];
  }
}

function parseAnthropicHtml(
  html: string,
  providerId: string,
  topic: string,
  defaultCategories: string[]
): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const linkRegex = /<a[^>]+href=["'](\/news\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const ignoreSlugs = new Set([
    'announcements',
    'product',
    'research',
    'policy',
    'company',
    'features',
    'stories',
    'updates',
    'press',
  ]);
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(html)) !== null) {
    const path = m[1].replace(/\/+$/, '');
    const slug = path.replace(/^\/news\//, '').toLowerCase();
    if (!slug || path === '/news' || ignoreSlugs.has(slug) || seen.has(path)) continue;
    seen.add(path);

    const inner = m[2];
    const dateMatch = inner.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
    const catMatch = inner.match(/<span[^>]*class="[^"]*subject[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const titleMatch =
      inner.match(/<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
      inner.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);

    const rawTitle = titleMatch ? titleMatch[1] : inner;
    const title = decodeHTML(stripTags(rawTitle)).trim();
    if (title.length <= 5 || ignoreSlugs.has(title.toLowerCase())) continue;

    const url = `https://www.anthropic.com${path}`;
    const canonicalUrl = normalizeCanonicalUrl(url);
    articles.push({
      id: buildArticleId(providerId, canonicalUrl),
      canonicalUrl,
      url,
      title,
      providerId,
      topic,
      publishedAt: normalizeIsoDate(dateMatch?.[1]),
      author: null,
      summary: null,
      imageUrl: null,
      categories: catMatch ? [decodeHTML(stripTags(catMatch[1])).trim()] : [...defaultCategories],
    });
  }

  return articles;
}

function parseMetaAiHtml(
  html: string,
  providerId: string,
  topic: string,
  defaultCategories: string[]
): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const linkRegex = /href=["'](https:\/\/ai\.meta\.com\/blog\/([a-zA-Z0-9_-]+)\/)["']/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(html)) !== null) {
    const url = m[1];
    const slug = m[2];
    if (seen.has(url) || slug === 'blog' || slug.includes('page')) continue;
    seen.add(url);

    const slice = html.slice(Math.max(0, m.index - 500), Math.min(html.length, m.index + 800));
    const headingMatch = slice.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
    const imgMatch = slice.match(/<img[^>]+src=["'](https:\/\/scontent[^"']+)["']/i);
    const title = headingMatch
      ? decodeHTML(stripTags(headingMatch[1])).trim()
      : slugToTitle(slug);

    const canonicalUrl = normalizeCanonicalUrl(url);
    articles.push({
      id: buildArticleId(providerId, canonicalUrl),
      canonicalUrl,
      url,
      title,
      providerId,
      topic,
      publishedAt: null,
      author: null,
      summary: null,
      imageUrl: imgMatch ? decodeHTML(imgMatch[1]) : null,
      categories: [...defaultCategories],
    });
  }

  return articles;
}

function parseCohereHtml(
  html: string,
  providerId: string,
  topic: string,
  defaultCategories: string[]
): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const linkRegex = /href=["'](\/blog\/([a-zA-Z0-9_-]+))["']/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(html)) !== null) {
    const path = m[1];
    const slug = m[2];
    if (seen.has(path) || slug === 'tag' || slug === 'category') continue;
    seen.add(path);

    const slice = html.slice(Math.max(0, m.index - 400), Math.min(html.length, m.index + 600));
    const headingMatch =
      slice.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i) ||
      slice.match(/<p[^>]*class="[^"]*text-web3-16[^"]*"[^>]*>([\s\S]*?)<\/p>/i);

    const title = headingMatch
      ? decodeHTML(stripTags(headingMatch[1])).trim()
      : slugToTitle(slug);
    if (!title || title.length <= 5) continue;

    const url = `https://cohere.com${path}`;
    const canonicalUrl = normalizeCanonicalUrl(url);
    articles.push({
      id: buildArticleId(providerId, canonicalUrl),
      canonicalUrl,
      url,
      title,
      providerId,
      topic,
      publishedAt: null,
      author: null,
      summary: null,
      imageUrl: null,
      categories: [...defaultCategories],
    });
  }

  return articles;
}

function parsePerplexityHtml(
  html: string,
  providerId: string,
  topic: string,
  defaultCategories: string[]
): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const headingRegex = /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi;
  const ignore = new Set([
    'What’s new in Perplexity',
    "What's new in Perplexity",
    'Products',
    'Solutions',
    'By Size',
    'By Industry',
    'By Team',
    'Pricing',
    'Resources',
    'Company',
    'Documentation Index',
  ]);
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = headingRegex.exec(html)) !== null) {
    const title = decodeHTML(stripTags(m[1])).trim();
    if (title.length <= 5 || ignore.has(title) || seen.has(title)) continue;
    seen.add(title);

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64);
    const url = `https://www.perplexity.ai/changelog#${slug}`;
    // Keep anchor distinct in canonicalUrl for changelog entries
    const canonicalUrl = `https://www.perplexity.ai/changelog#${slug}`;

    articles.push({
      id: buildArticleId(providerId, canonicalUrl),
      canonicalUrl,
      url,
      title,
      providerId,
      topic,
      publishedAt: null,
      author: null,
      summary: null,
      imageUrl: null,
      categories: [...defaultCategories],
    });
  }

  return articles;
}

function parseAmdHtml(
  html: string,
  providerId: string,
  topic: string,
  defaultCategories: string[]
): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const linkRegex =
    /<a[^>]+href=["'](https:\/\/(?:www\.amd\.com\/en\/blogs\/[0-9]{4}\/[^"']+|rocm\.blogs\.amd\.com\/[^"']+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(html)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    const title = decodeHTML(stripTags(m[2])).trim();
    if (title.length <= 8 || title.includes('Read more')) continue;
    seen.add(url);

    const canonicalUrl = normalizeCanonicalUrl(url);
    articles.push({
      id: buildArticleId(providerId, canonicalUrl),
      canonicalUrl,
      url,
      title,
      providerId,
      topic,
      publishedAt: null,
      author: null,
      summary: null,
      imageUrl: null,
      categories: [...defaultCategories],
    });
  }

  return articles;
}

function parseAppleIntelligenceHtml(
  html: string,
  providerId: string,
  topic: string,
  defaultCategories: string[]
): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const linkRegex =
    /<a[^>]+href=["'](\/newsroom\/[0-9]{4}\/[0-9]{2}\/[^"']+)["'][^>]*aria-label=["']([^"']+)["']/gi;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = linkRegex.exec(html)) !== null) {
    const path = m[1];
    if (seen.has(path)) continue;
    seen.add(path);

    const parts = m[2].split(' - Posted on ');
    const title = decodeHTML(
      (parts[0] || '').replace(/ - (UPDATE|PRESS RELEASE|FEATURE)/gi, '').trim()
    );
    const url = `https://www.apple.com${path}`;
    const canonicalUrl = normalizeCanonicalUrl(url);

    articles.push({
      id: buildArticleId(providerId, canonicalUrl),
      canonicalUrl,
      url,
      title: title || 'Apple Intelligence Update',
      providerId,
      topic,
      publishedAt: normalizeIsoDate(parts[1]),
      author: null,
      summary: null,
      imageUrl: null,
      categories: [...defaultCategories],
    });
  }

  return articles;
}

function parseSlugListHtml(
  html: string,
  providerId: string,
  topic: string,
  defaultCategories: string[],
  regex: RegExp,
  baseUrl: string,
  ignoreList: string[]
): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const seen = new Set<string>();
  const ignore = new Set(ignoreList);
  let m: RegExpExecArray | null;

  while ((m = regex.exec(html)) !== null) {
    const slug = m[1];
    if (
      !slug ||
      seen.has(slug) ||
      ignore.has(slug) ||
      /^\d+$/.test(slug) ||
      slug.startsWith('category') ||
      slug.includes('thumb') ||
      slug.includes('cover') ||
      slug.includes('post')
    ) {
      continue;
    }
    seen.add(slug);

    const url = `${baseUrl}${slug}`;
    const canonicalUrl = normalizeCanonicalUrl(url);
    articles.push({
      id: buildArticleId(providerId, canonicalUrl),
      canonicalUrl,
      url,
      title: slugToTitle(slug),
      providerId,
      topic,
      publishedAt: null,
      author: null,
      summary: null,
      imageUrl: null,
      categories: [...defaultCategories],
    });
  }

  // Cap large unfiltered HTML link lists (e.g. Luma index) to newest 30 links per run
  return articles.slice(0, 30);
}

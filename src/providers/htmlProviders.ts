import { Article, NewsProvider } from '../types';
import { decodeHtmlEntities, stripHtmlTags } from '../utils/text';
import { fetchProviderHtml } from '../services/feedClient';

function slugToTitle(slug: string): string {
  return slug
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

// 1. Anthropic News
export class AnthropicProvider implements NewsProvider {
  public readonly id = 'anthropic';
  public readonly name = 'Anthropic News';
  public readonly topic = 'Frontier Labs';
  public readonly description =
    'Research, safety findings, policy perspectives, and frontier model developments from Anthropic.';
  public readonly homepage = 'https://www.anthropic.com/news';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=anthropic.com&sz=64';
  public readonly categories = ['AI', 'Anthropic', 'Frontier Safety', 'Research'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex = /<a[^>]+href=["'](\/news\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1].replace(/\/+$/, '');
      if (path === '/news' || seen.has(path)) continue;
      seen.add(path);

      const inner = m[2];
      const dateMatch = inner.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
      const catMatch = inner.match(/<span[^>]*class="[^"]*subject[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const titleMatch =
        inner.match(/<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>/i) ||
        inner.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);

      const rawTitle = titleMatch ? titleMatch[1] : inner;
      const title = decodeHtmlEntities(stripHtmlTags(rawTitle));

      if (title.length > 5) {
        articles.push({
          id: `anthropic-${path.replace('/news/', '')}`,
          title,
          url: `https://www.anthropic.com${path}`,
          providerId: this.id,
          publishedAt: dateMatch ? dateMatch[1].trim() : undefined,
          categories: catMatch ? [decodeHtmlEntities(catMatch[1].trim())] : this.categories,
        });
      }
    }

    return articles;
  }
}
export const anthropicProvider = new AnthropicProvider();

// 2. Meta AI
export class MetaAiProvider implements NewsProvider {
  public readonly id = 'meta-ai';
  public readonly name = 'Meta AI';
  public readonly topic = 'Frontier Labs';
  public readonly description =
    'Foundational research, open science, Llama developments, and AI infrastructure from Meta.';
  public readonly homepage = 'https://ai.meta.com/blog/';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=meta.com&sz=64';
  public readonly categories = ['AI', 'Meta', 'Open Source', 'Research'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex = /href=["'](https:\/\/ai\.meta\.com\/blog\/([a-zA-Z0-9_-]+)\/)["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const url = m[1];
      const slug = m[2];
      if (seen.has(url) || slug === 'blog' || slug.includes('page')) continue;
      seen.add(url);

      const window = html.slice(Math.max(0, m.index - 500), Math.min(html.length, m.index + 800));
      const headingMatch = window.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i);
      const imgMatch = window.match(/<img[^>]+src=["'](https:\/\/scontent[^"']+)["']/i);

      const title = headingMatch
        ? decodeHtmlEntities(stripHtmlTags(headingMatch[1]))
        : slugToTitle(slug);

      articles.push({
        id: `meta-ai-${slug}`,
        title,
        url,
        providerId: this.id,
        imageUrl: imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : undefined,
        categories: this.categories,
      });
    }

    return articles;
  }
}
export const metaAiProvider = new MetaAiProvider();

// 3. Cohere Blog
export class CohereProvider implements NewsProvider {
  public readonly id = 'cohere';
  public readonly name = 'Cohere Blog';
  public readonly topic = 'Frontier Labs';
  public readonly description =
    'Enterprise AI models, Embeddings, Command R series, and multilingual NLP from Cohere.';
  public readonly homepage = 'https://cohere.com/blog';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=cohere.com&sz=64';
  public readonly categories = ['AI', 'Cohere', 'Enterprise AI', 'NLP'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex = /href=["'](\/blog\/([a-zA-Z0-9_-]+))["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      const slug = m[2];
      if (seen.has(path) || slug === 'tag' || slug === 'category') continue;
      seen.add(path);

      const window = html.slice(Math.max(0, m.index - 400), Math.min(html.length, m.index + 600));
      const headingMatch =
        window.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i) ||
        window.match(/<p[^>]*class="[^"]*text-web3-16[^"]*"[^>]*>([\s\S]*?)<\/p>/i);

      const title = headingMatch
        ? decodeHtmlEntities(stripHtmlTags(headingMatch[1]))
        : slugToTitle(slug);

      if (title && title.length > 5) {
        articles.push({
          id: `cohere-${slug}`,
          title,
          url: `https://cohere.com${path}`,
          providerId: this.id,
          categories: this.categories,
        });
      }
    }

    return articles;
  }
}
export const cohereProvider = new CohereProvider();

// 5. Perplexity Changelog
export class PerplexityProvider implements NewsProvider {
  public readonly id = 'perplexity';
  public readonly name = 'Perplexity Changelog';
  public readonly topic = 'Cloud & Engineering';
  public readonly description =
    'Product updates, conversational search enhancements, API releases, and model integrations from Perplexity.';
  public readonly homepage = 'https://www.perplexity.ai/changelog';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64';
  public readonly categories = ['AI', 'Search', 'Perplexity', 'Changelog'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const headingRegex = /<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi;
    let m: RegExpExecArray | null;
    let idx = 0;
    const ignore = [
      'What’s new in Perplexity',
      'Products',
      'Solutions',
      'By Size',
      'By Industry',
      'By Team',
      'Pricing',
      'Resources',
      'Company',
      'Documentation Index',
    ];

    while ((m = headingRegex.exec(html)) !== null) {
      const title = decodeHtmlEntities(stripHtmlTags(m[1]));
      if (title.length > 5 && !ignore.includes(title)) {
        articles.push({
          id: `perplexity-changelog-${idx}`,
          title,
          url: `https://www.perplexity.ai/changelog#entry-${idx}`,
          providerId: this.id,
          categories: this.categories,
        });
        idx++;
      }
    }

    return articles;
  }
}
export const perplexityProvider = new PerplexityProvider();

// 6. AMD AI & Computing Blog
export class AmdBlogsProvider implements NewsProvider {
  public readonly id = 'amd-blogs';
  public readonly name = 'AMD AI & Computing Blog';
  public readonly topic = 'Hardware & Edge';
  public readonly description =
    'ROCm open software ecosystem, Instinct GPU acceleration, Ryzen AI, and agentic compute from AMD.';
  public readonly homepage = 'https://www.amd.com/en/blogs.html';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=amd.com&sz=64';
  public readonly categories = ['AI', 'Hardware', 'ROCm', 'AMD'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex =
      /<a[^>]+href=["'](https:\/\/(?:www\.amd\.com\/en\/blogs\/[0-9]{4}\/[^"']+|rocm\.blogs\.amd\.com\/[^"']+))["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const url = m[1];
      if (seen.has(url)) continue;
      const inner = m[2];
      const title = decodeHtmlEntities(stripHtmlTags(inner));

      if (title.length > 8 && !title.includes('Read more')) {
        seen.add(url);
        const slug = url.split('/').pop()?.replace('.html', '') || `${articles.length}`;
        articles.push({
          id: `amd-${slug}`,
          title,
          url,
          providerId: this.id,
          categories: this.categories,
        });
      }
    }

    return articles;
  }
}
export const amdBlogsProvider = new AmdBlogsProvider();

// 7. Runway News
export class RunwayProvider implements NewsProvider {
  public readonly id = 'runway-news';
  public readonly name = 'Runway News';
  public readonly topic = 'Generative Media';
  public readonly description =
    'Generative video breakthroughs, Gen-series foundational models, AI film, and creative tools from Runway.';
  public readonly homepage = 'https://runwayml.com/news';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=runwayml.com&sz=64';
  public readonly categories = ['AI', 'Video Generation', 'Generative Media', 'Runway'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const pathRegex = /\/news\/([a-zA-Z0-9_-]+)/g;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    const ignore = ['customers', 'research', 'company-news', 'developers', 'safety', 'engineering'];

    while ((m = pathRegex.exec(html)) !== null) {
      const slug = m[1];
      if (
        seen.has(slug) ||
        ignore.includes(slug) ||
        /^\d+$/.test(slug) ||
        slug.includes('thumb') ||
        slug.includes('cover') ||
        slug.includes('post')
      ) {
        continue;
      }
      seen.add(slug);
      const title = slugToTitle(slug);

      articles.push({
        id: `runway-${slug}`,
        title,
        url: `https://runway.com/news/${slug}`,
        providerId: this.id,
        categories: this.categories,
      });
    }

    return articles;
  }
}
export const runwayProvider = new RunwayProvider();

// 8. Pika Blog
export class PikaBlogProvider implements NewsProvider {
  public readonly id = 'pika-blog';
  public readonly name = 'Pika Blog';
  public readonly topic = 'Generative Media';
  public readonly description =
    'Creative video effects, sound effects, character animation, and feature releases from Pika.';
  public readonly homepage = 'https://pika.art/blog';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=pika.art&sz=64';
  public readonly categories = ['AI', 'Video', 'Creative AI', 'Pika'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex = /href=["'](\/blog\/([a-zA-Z0-9_-]+))["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      const slug = m[2];
      if (seen.has(path) || slug === 'blog-og.jpg') continue;
      seen.add(path);

      const title = slugToTitle(slug);
      articles.push({
        id: `pika-${slug}`,
        title,
        url: `https://pika.art${path}`,
        providerId: this.id,
        categories: this.categories,
      });
    }

    return articles;
  }
}
export const pikaBlogProvider = new PikaBlogProvider();

// 9. Luma AI News
export class LumaNewsProvider implements NewsProvider {
  public readonly id = 'luma-news';
  public readonly name = 'Luma AI News';
  public readonly topic = 'Generative Media';
  public readonly description =
    'Dream Machine generative video, interactive 3D neural rendering, and camera motion tools from Luma AI.';
  public readonly homepage = 'https://lumalabs.ai/news';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=lumalabs.ai&sz=64';
  public readonly categories = ['AI', 'Video', '3D', 'Luma AI'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex = /href=["'](\/news\/([a-zA-Z0-9_-]+))["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      const slug = m[2];
      if (seen.has(path)) continue;
      seen.add(path);

      const title = slugToTitle(slug);
      articles.push({
        id: `luma-${slug}`,
        title,
        url: `https://lumalabs.ai${path}`,
        providerId: this.id,
        categories: this.categories,
      });
    }

    return articles;
  }
}
export const lumaNewsProvider = new LumaNewsProvider();

// 10. ElevenLabs Product Blog
export class ElevenLabsProductProvider implements NewsProvider {
  public readonly id = 'elevenlabs-product';
  public readonly name = 'ElevenLabs Product';
  public readonly topic = 'Generative Media';
  public readonly description =
    'Conversational AI agents, text-to-speech tools, voice cloning, and product releases from ElevenLabs.';
  public readonly homepage = 'https://elevenlabs.io/blog/category/product';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=elevenlabs.io&sz=64';
  public readonly categories = ['AI', 'Audio', 'Voice AI', 'Product'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex = /href=["'](\/blog\/([a-zA-Z0-9_-]+))["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      const slug = m[2];
      if (seen.has(path) || slug.startsWith('category')) continue;
      seen.add(path);

      const title = slugToTitle(slug);
      articles.push({
        id: `elevenlabs-prod-${slug}`,
        title,
        url: `https://elevenlabs.io${path}`,
        providerId: this.id,
        categories: this.categories,
      });
    }

    return articles;
  }
}
export const elevenLabsProductProvider = new ElevenLabsProductProvider();

// 11. ElevenLabs Research Blog
export class ElevenLabsResearchProvider implements NewsProvider {
  public readonly id = 'elevenlabs-research';
  public readonly name = 'ElevenLabs Research';
  public readonly topic = 'Generative Media';
  public readonly description =
    'Audio foundation models, voice research, dubbing algorithms, and speech synthesis breakthroughs.';
  public readonly homepage = 'https://elevenlabs.io/blog/category/research';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=elevenlabs.io&sz=64';
  public readonly categories = ['AI', 'Audio Research', 'Speech Synthesis', 'Research'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex = /href=["'](\/blog\/([a-zA-Z0-9_-]+))["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      const slug = m[2];
      if (seen.has(path) || slug.startsWith('category')) continue;
      seen.add(path);

      const title = slugToTitle(slug);
      articles.push({
        id: `elevenlabs-res-${slug}`,
        title,
        url: `https://elevenlabs.io${path}`,
        providerId: this.id,
        categories: this.categories,
      });
    }

    return articles;
  }
}
export const elevenLabsResearchProvider = new ElevenLabsResearchProvider();

// 12. Suno Blog
export class SunoBlogProvider implements NewsProvider {
  public readonly id = 'suno-blog';
  public readonly name = 'Suno Blog';
  public readonly topic = 'Generative Media';
  public readonly description =
    'Music foundation models, songwriting tools, creator stories, and generative audio features from Suno.';
  public readonly homepage = 'https://suno.com/blog';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=suno.com&sz=64';
  public readonly categories = ['AI', 'Music AI', 'Creative Audio', 'Suno'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex = /href=["'](\/blog\/([a-zA-Z0-9_-]+))["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      const slug = m[2];
      if (seen.has(path)) continue;
      seen.add(path);

      const title = slugToTitle(slug);
      articles.push({
        id: `suno-blog-${slug}`,
        title,
        url: `https://suno.com${path}`,
        providerId: this.id,
        categories: this.categories,
      });
    }

    return articles;
  }
}
export const sunoBlogProvider = new SunoBlogProvider();

// 13. Suno Release Notes
export class SunoReleaseNotesProvider implements NewsProvider {
  public readonly id = 'suno-release-notes';
  public readonly name = 'Suno Release Notes';
  public readonly topic = 'Generative Media';
  public readonly description =
    'Product changelog, model versions, audio stem separation, and studio release notes from Suno.';
  public readonly homepage = 'https://suno.com/release-notes';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=suno.com&sz=64';
  public readonly categories = ['AI', 'Music AI', 'Release Notes', 'Changelog'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex = /href=["'](\/release-notes\/([a-zA-Z0-9_-]+))["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      const slug = m[2];
      if (seen.has(path)) continue;
      seen.add(path);

      const title = slugToTitle(slug);
      articles.push({
        id: `suno-release-${slug}`,
        title,
        url: `https://suno.com${path}`,
        providerId: this.id,
        categories: this.categories,
      });
    }

    return articles;
  }
}
export const sunoReleaseNotesProvider = new SunoReleaseNotesProvider();

// 14. Apple Intelligence News
export class AppleIntelligenceProvider implements NewsProvider {
  public readonly id = 'apple-intelligence';
  public readonly name = 'Apple Intelligence News';
  public readonly topic = 'Hardware & Edge';
  public readonly description =
    'Personal intelligence system releases, on-device foundation models, and Siri updates from Apple Newsroom.';
  public readonly homepage = 'https://www.apple.com/newsroom/topics/apple-intelligence/';
  public readonly icon = 'https://www.google.com/s2/favicons?domain=apple.com&sz=64';
  public readonly categories = ['AI', 'Apple Intelligence', 'On-Device AI', 'iOS'];

  public async fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]> {
    const html = await fetchProviderHtml(this.id, this.name, options);
    if (!html || !html.trim()) return [];

    const articles: Article[] = [];
    const linkRegex =
      /<a[^>]+href=["'](\/newsroom\/[0-9]{4}\/[0-9]{2}\/[^"']+)["'][^>]*aria-label=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();

    while ((m = linkRegex.exec(html)) !== null) {
      const path = m[1];
      const rawLabel = m[2];
      if (seen.has(path)) continue;
      seen.add(path);

      const parts = rawLabel.split(' - Posted on ');
      const title = decodeHtmlEntities((parts[0] || '').replace(/ - (UPDATE|PRESS RELEASE|FEATURE)/gi, '').trim());
      const date = parts[1] ? parts[1].trim() : undefined;

      articles.push({
        id: `apple-${path.replace(/^\/newsroom\/|\/$/g, '').replace(/\//g, '-')}`,
        title: title || 'Apple Intelligence Update',
        url: `https://www.apple.com${path}`,
        providerId: this.id,
        publishedAt: date,
        categories: this.categories,
      });
    }

    return articles;
  }
}
export const appleIntelligenceProvider = new AppleIntelligenceProvider();

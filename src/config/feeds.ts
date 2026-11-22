/**
 * Shared Feed Gateway Allowlist
 *
 * Single source of truth for approved upstream AI & Tech provider feeds.
 * Consumed by the Cloudflare Worker gateway, local Express server, and Vite dev server.
 */

export interface FeedConfig {
  url: string;
  name: string;
  contentType?: string;
  headers?: Record<string, string>;
  fallbackUrl?: string;
}

// Strict provider allowlist - prevents open proxy vulnerabilities
export const ALLOWED_FEEDS: Record<string, FeedConfig> = {
  // Frontier Labs
  openai: {
    url: 'https://openai.com/news/rss.xml',
    name: 'OpenAI News',
  },
  'openai-research': {
    url: 'https://openai.com/news/rss.xml',
    name: 'OpenAI Research',
  },
  anthropic: {
    url: 'https://www.anthropic.com/news',
    name: 'Anthropic News',
    contentType: 'text/html; charset=utf-8',
  },
  'google-ai': {
    url: 'https://blog.google/innovation-and-ai/technology/ai/rss/',
    name: 'Google AI Blog',
  },
  'google-gemini': {
    url: 'https://blog.google/products-and-platforms/products/gemini/rss/',
    name: 'Google Gemini',
  },
  'google-deepmind': {
    url: 'https://deepmind.google/blog/rss.xml',
    name: 'Google DeepMind',
    fallbackUrl: 'https://deepmind.google/discover/blog/',
  },
  'meta-ai': {
    url: 'https://ai.meta.com/blog/',
    name: 'Meta AI',
    contentType: 'text/html; charset=utf-8',
    headers: {
      'User-Agent': 'curl/8.0',
    },
    fallbackUrl: 'https://about.fb.com/news/tag/ai/feed/',
  },
  mistral: {
    url: 'https://mistral.ai/news/rss',
    name: 'Mistral AI',
  },
  cohere: {
    url: 'https://cohere.com/blog',
    name: 'Cohere Blog',
    contentType: 'text/html; charset=utf-8',
  },

  // Cloud & Engineering
  google: {
    url: 'https://blog.google/rss/',
    name: 'Google Blog',
  },
  'google-developers': {
    url: 'https://developers.googleblog.com/feed/',
    name: 'Google Developers Blog',
  },
  'microsoft-ai': {
    url: 'https://news.microsoft.com/source/topics/ai/feed/',
    name: 'Microsoft AI Blog',
  },
  'azure-foundry': {
    url: 'https://azure.microsoft.com/en-us/blog/product/microsoft-foundry/feed/',
    name: 'Azure AI Foundry',
  },
  'microsoft-skills': {
    url: 'https://techcommunity.microsoft.com/t5/s/gxcuf89792/rss/board?board.id=skills-hub-blog',
    name: 'Microsoft Skills Hub',
  },
  'aws-genai': {
    url: 'https://aws.amazon.com/blogs/aws/category/artificial-intelligence/generative-ai/feed/',
    name: 'AWS Generative AI',
  },
  'aws-ml': {
    url: 'https://aws.amazon.com/blogs/machine-learning/category/artificial-intelligence/generative-ai/feed/',
    name: 'AWS Machine Learning',
  },
  'github-blog': {
    url: 'https://github.blog/feed/',
    name: 'GitHub Blog',
  },
  'github-changelog': {
    url: 'https://github.blog/changelog/feed/',
    name: 'GitHub Changelog',
  },
  huggingface: {
    url: 'https://huggingface.co/blog/feed.xml',
    name: 'Hugging Face Blog',
  },
  perplexity: {
    url: 'https://www.perplexity.ai/changelog',
    name: 'Perplexity Changelog',
    contentType: 'text/html; charset=utf-8',
    headers: {
      'User-Agent': 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    },
    fallbackUrl: 'https://docs.perplexity.ai/changelog',
  },

  // Hardware & Edge
  'nvidia-genai': {
    url: 'https://blogs.nvidia.com/blog/category/generative-ai/feed/',
    name: 'NVIDIA Generative AI',
  },
  'nvidia-developer': {
    url: 'https://developer.nvidia.com/blog/feed/',
    name: 'NVIDIA Developer Blog',
  },
  'amd-blogs': {
    url: 'https://www.amd.com/en/blogs.html',
    name: 'AMD AI & Computing Blog',
    contentType: 'text/html; charset=utf-8',
  },
  'apple-intelligence': {
    url: 'https://www.apple.com/newsroom/topics/apple-intelligence/',
    name: 'Apple Intelligence News',
    contentType: 'text/html; charset=utf-8',
    fallbackUrl: 'https://www.apple.com/newsroom/rss-feed.rss',
  },

  // Generative Media
  'stability-ai': {
    url: 'https://stability.ai/news-updates?format=rss',
    name: 'Stability AI News',
  },
  'runway-news': {
    url: 'https://runway.com/news',
    name: 'Runway News',
    contentType: 'text/html; charset=utf-8',
  },
  'pika-blog': {
    url: 'https://pika.art/blog',
    name: 'Pika Blog',
    contentType: 'text/html; charset=utf-8',
  },
  'luma-news': {
    url: 'https://lumalabs.ai/news',
    name: 'Luma AI News',
    contentType: 'text/html; charset=utf-8',
  },
  'elevenlabs-product': {
    url: 'https://elevenlabs.io/blog/category/product',
    name: 'ElevenLabs Product',
    contentType: 'text/html; charset=utf-8',
  },
  'elevenlabs-research': {
    url: 'https://elevenlabs.io/blog/category/research',
    name: 'ElevenLabs Research',
    contentType: 'text/html; charset=utf-8',
  },
  'suno-blog': {
    url: 'https://suno.com/blog',
    name: 'Suno Blog',
    contentType: 'text/html; charset=utf-8',
  },
  'suno-release-notes': {
    url: 'https://suno.com/release-notes',
    name: 'Suno Release Notes',
    contentType: 'text/html; charset=utf-8',
  },
};

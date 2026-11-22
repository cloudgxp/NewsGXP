/**
 * Direct Company Career-Page Registry
 *
 * Tracks 21 official company career portals / public ATS endpoints (NO third-party job aggregators)
 * for remote AI job aggregation and weekly YouTube/LinkedIn segment curation.
 */

export type CompanyAtsType =
  | 'greenhouse'
  | 'ashby'
  | 'workable'
  | 'jibe'
  | 'google_careers'
  | 'microsoft_eightfold';

export type CompanyTier = 'big_tech' | 'frontier_lab' | 'ai_infra' | 'gen_media';

export interface CompanyCareerConfig {
  id: string;
  name: string;
  ats: CompanyAtsType;
  slug?: string;
  apiUrl: string;
  careersUrl: string;
  domain: string;
  isAiNative: boolean;
  tier: CompanyTier;
}

export const TRACKED_COMPANIES: CompanyCareerConfig[] = [
  // Big Tech
  {
    id: 'google',
    name: 'Google',
    ats: 'google_careers',
    apiUrl:
      'https://www.google.com/about/careers/applications/jobs/results/?q=AI&has_remote=true',
    careersUrl:
      'https://www.google.com/about/careers/applications/jobs/results/?q=AI&has_remote=true',
    domain: 'google.com',
    isAiNative: false,
    tier: 'big_tech',
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    ats: 'microsoft_eightfold',
    apiUrl:
      'https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=AI&location=Remote&start=0&sort_by=timestamp',
    careersUrl: 'https://careers.microsoft.com',
    domain: 'microsoft.com',
    isAiNative: false,
    tier: 'big_tech',
  },
  {
    id: 'github',
    name: 'GitHub',
    ats: 'jibe',
    apiUrl: 'https://www.github.careers/api/jobs?keywords=AI&page=1&limit=50',
    careersUrl: 'https://www.github.careers',
    domain: 'github.com',
    isAiNative: false,
    tier: 'big_tech',
  },
  {
    id: 'amd',
    name: 'AMD',
    ats: 'jibe',
    apiUrl: 'https://careers.amd.com/api/jobs?keywords=AI&page=1&limit=50',
    careersUrl: 'https://careers.amd.com',
    domain: 'amd.com',
    isAiNative: false,
    tier: 'big_tech',
  },

  // Frontier Labs
  {
    id: 'openai',
    name: 'OpenAI',
    ats: 'ashby',
    slug: 'openai',
    apiUrl: 'https://api.ashbyhq.com/posting-api/job-board/openai',
    careersUrl: 'https://openai.com/careers',
    domain: 'openai.com',
    isAiNative: true,
    tier: 'frontier_lab',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    ats: 'greenhouse',
    slug: 'anthropic',
    apiUrl: 'https://boards-api.greenhouse.io/v1/boards/anthropic/jobs?content=false',
    careersUrl: 'https://www.anthropic.com/careers',
    domain: 'anthropic.com',
    isAiNative: true,
    tier: 'frontier_lab',
  },
  {
    id: 'cohere',
    name: 'Cohere',
    ats: 'ashby',
    slug: 'cohere',
    apiUrl: 'https://api.ashbyhq.com/posting-api/job-board/cohere',
    careersUrl: 'https://cohere.com/careers',
    domain: 'cohere.com',
    isAiNative: true,
    tier: 'frontier_lab',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    ats: 'ashby',
    slug: 'perplexity',
    apiUrl: 'https://api.ashbyhq.com/posting-api/job-board/perplexity',
    careersUrl: 'https://www.perplexity.ai/hub/careers',
    domain: 'perplexity.ai',
    isAiNative: true,
    tier: 'frontier_lab',
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    ats: 'workable',
    slug: 'huggingface',
    apiUrl: 'https://apply.workable.com/api/v1/widget/accounts/huggingface',
    careersUrl: 'https://apply.workable.com/huggingface/',
    domain: 'huggingface.co',
    isAiNative: true,
    tier: 'frontier_lab',
  },
  {
    id: 'stabilityai',
    name: 'Stability AI',
    ats: 'greenhouse',
    slug: 'stabilityai',
    apiUrl: 'https://boards-api.greenhouse.io/v1/boards/stabilityai/jobs?content=false',
    careersUrl: 'https://stability.ai/careers',
    domain: 'stability.ai',
    isAiNative: true,
    tier: 'frontier_lab',
  },

  // AI Cloud, Data & Dev Infrastructure
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    ats: 'greenhouse',
    slug: 'cloudflare',
    apiUrl: 'https://boards-api.greenhouse.io/v1/boards/cloudflare/jobs?content=false',
    careersUrl: 'https://www.cloudflare.com/careers/jobs/',
    domain: 'cloudflare.com',
    isAiNative: false,
    tier: 'ai_infra',
  },
  {
    id: 'databricks',
    name: 'Databricks',
    ats: 'greenhouse',
    slug: 'databricks',
    apiUrl: 'https://boards-api.greenhouse.io/v1/boards/databricks/jobs?content=false',
    careersUrl: 'https://www.databricks.com/company/careers',
    domain: 'databricks.com',
    isAiNative: false,
    tier: 'ai_infra',
  },
  {
    id: 'scaleai',
    name: 'Scale AI',
    ats: 'greenhouse',
    slug: 'scaleai',
    apiUrl: 'https://boards-api.greenhouse.io/v1/boards/scaleai/jobs?content=false',
    careersUrl: 'https://scale.com/careers',
    domain: 'scale.com',
    isAiNative: true,
    tier: 'ai_infra',
  },
  {
    id: 'vercel',
    name: 'Vercel',
    ats: 'greenhouse',
    slug: 'vercel',
    apiUrl: 'https://boards-api.greenhouse.io/v1/boards/vercel/jobs?content=false',
    careersUrl: 'https://vercel.com/careers',
    domain: 'vercel.com',
    isAiNative: false,
    tier: 'ai_infra',
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    ats: 'greenhouse',
    slug: 'gitlab',
    apiUrl: 'https://boards-api.greenhouse.io/v1/boards/gitlab/jobs?content=false',
    careersUrl: 'https://about.gitlab.com/jobs/',
    domain: 'gitlab.com',
    isAiNative: false,
    tier: 'ai_infra',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    ats: 'ashby',
    slug: 'cursor',
    apiUrl: 'https://api.ashbyhq.com/posting-api/job-board/cursor',
    careersUrl: 'https://cursor.com/careers',
    domain: 'cursor.com',
    isAiNative: true,
    tier: 'ai_infra',
  },
  {
    id: 'langchain',
    name: 'LangChain',
    ats: 'ashby',
    slug: 'langchain',
    apiUrl: 'https://api.ashbyhq.com/posting-api/job-board/langchain',
    careersUrl: 'https://www.langchain.com/careers',
    domain: 'langchain.com',
    isAiNative: true,
    tier: 'ai_infra',
  },
  {
    id: 'stripe',
    name: 'Stripe',
    ats: 'greenhouse',
    slug: 'stripe',
    apiUrl: 'https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=false',
    careersUrl: 'https://stripe.com/jobs',
    domain: 'stripe.com',
    isAiNative: false,
    tier: 'ai_infra',
  },

  // Generative Media
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    ats: 'ashby',
    slug: 'elevenlabs',
    apiUrl: 'https://api.ashbyhq.com/posting-api/job-board/elevenlabs',
    careersUrl: 'https://elevenlabs.io/careers',
    domain: 'elevenlabs.io',
    isAiNative: true,
    tier: 'gen_media',
  },
  {
    id: 'runway',
    name: 'Runway',
    ats: 'ashby',
    slug: 'runway',
    apiUrl: 'https://api.ashbyhq.com/posting-api/job-board/runway',
    careersUrl: 'https://runwayml.com/careers',
    domain: 'runwayml.com',
    isAiNative: true,
    tier: 'gen_media',
  },
  {
    id: 'suno',
    name: 'Suno',
    ats: 'ashby',
    slug: 'suno',
    apiUrl: 'https://api.ashbyhq.com/posting-api/job-board/suno',
    careersUrl: 'https://suno.com/careers',
    domain: 'suno.com',
    isAiNative: true,
    tier: 'gen_media',
  },
];

export const COMPANY_BY_ID: Record<string, CompanyCareerConfig> = Object.fromEntries(
  TRACKED_COMPANIES.map((company) => [company.id, company])
);

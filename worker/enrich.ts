/**
 * Workers AI Article & Job Enrichment
 *
 * Uses @cf/google/gemma-4-26b-a4b-it within the 10,000 free daily Neurons budget,
 * bounded by MAX_AI_ENRICH_PER_RUN / MAX_AI_JOBS_ENRICH_PER_RUN to prevent unexpected overages.
 */

import { JobAiCategory } from './jobParsers';

export const WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';

export interface ArticleEnrichmentInput {
  id: string;
  title: string;
  providerId: string;
  topic: string;
  url: string;
  summary: string | null;
}

export interface ArticleEnrichmentResult {
  aiSummary: string;
  aiTags: string[];
  aiQualityScore: number;
}

export interface JobEnrichmentInput {
  id: string;
  companyName: string;
  title: string;
  department: string | null;
  locationRaw: string;
  aiCategory: string;
  descriptionSnippet: string | null;
}

export interface JobEnrichmentResult {
  summary: string;
  isRemote: boolean;
  isAiRole: boolean;
  aiCategory: JobAiCategory | null;
}

interface AiTextResponse {
  response?: string;
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const VALID_JOB_CATEGORIES = new Set<JobAiCategory>([
  'ML & Research',
  'Applied AI & Agents',
  'AI Infrastructure',
  'AI Product & Solutions',
  'AI Security & Safety',
  'Engineering (AI Co.)',
]);

function extractResponseText(raw: unknown): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  const obj = raw as AiTextResponse;
  if (typeof obj.response === 'string') return obj.response;
  const choiceContent = obj.choices?.[0]?.message?.content;
  if (typeof choiceContent === 'string') return choiceContent;
  return null;
}

function extractJsonObject(rawText: string): Record<string, unknown> | null {
  if (!rawText) return null;

  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    return null;
  }

  try {
    const parsed = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function parseEnrichmentJson(rawText: string): ArticleEnrichmentResult | null {
  const parsed = extractJsonObject(rawText);
  if (!parsed) return null;

  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!summary) return null;

  const tags: string[] = Array.isArray(parsed.tags)
    ? parsed.tags
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim())
        .slice(0, 3)
    : [];

  const rawScore = Number(parsed.quality_score ?? parsed.qualityScore ?? 3);
  const qualityScore = Number.isFinite(rawScore)
    ? Math.min(5, Math.max(1, Math.round(rawScore)))
    : 3;

  return {
    aiSummary: summary.length > 360 ? `${summary.slice(0, 357)}...` : summary,
    aiTags: tags,
    aiQualityScore: qualityScore,
  };
}

export function parseJobEnrichmentJson(rawText: string): JobEnrichmentResult | null {
  const parsed = extractJsonObject(rawText);
  if (!parsed) return null;

  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!summary) return null;

  const isRemote =
    typeof parsed.is_remote === 'boolean'
      ? parsed.is_remote
      : typeof parsed.isRemote === 'boolean'
        ? parsed.isRemote
        : true;

  const isAiRole =
    typeof parsed.is_ai_role === 'boolean'
      ? parsed.is_ai_role
      : typeof parsed.isAiRole === 'boolean'
        ? parsed.isAiRole
        : true;

  const rawCat = typeof parsed.ai_category === 'string' ? parsed.ai_category.trim() : '';
  const aiCategory = VALID_JOB_CATEGORIES.has(rawCat as JobAiCategory)
    ? (rawCat as JobAiCategory)
    : null;

  return {
    summary: summary.length > 260 ? `${summary.slice(0, 257)}...` : summary,
    isRemote,
    isAiRole,
    aiCategory,
  };
}

async function runPrompt(ai: Ai, prompt: string, maxTokens = 280): Promise<string | null> {
  const raw = await ai.run(WORKERS_AI_MODEL as keyof AiModels, {
    messages: [
      {
        role: 'system',
        content: 'Respond strictly with compact JSON matching the requested schema.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    max_tokens: maxTokens,
    temperature: 0.2,
    chat_template_kwargs: {
      enable_thinking: false,
    },
  });

  const text = extractResponseText(raw);
  if (!text) {
    const keys = raw && typeof raw === 'object' ? Object.keys(raw as Record<string, unknown>).join(',') : typeof raw;
    console.warn(`[WorkersAI] Empty text response; keys=${keys}`);
  }
  return text;
}

export async function enrichArticleWithWorkersAI(
  ai: Ai,
  article: ArticleEnrichmentInput
): Promise<ArticleEnrichmentResult | null> {
  const prompt = [
    'You are an AI & Tech news analyst helping an AI engineer and tech YouTube creator triage daily news.',
    'Given the article metadata below, return ONLY a valid JSON object with no extra text:',
    '{"summary": "<1-2 concise sentences explaining what happened and why it matters>", "tags": ["Tag1", "Tag2"], "quality_score": <integer 1-5>}',
    'Scoring guide: 5 = major model/platform release or breakthrough, 4 = notable product/research update, 3 = useful engineering/industry post, 2 = routine changelog/minor update, 1 = marketing fluff or unclear stub.',
    '',
    `Source: ${article.providerId} (${article.topic})`,
    `Title: ${article.title}`,
    `URL: ${article.url}`,
    article.summary ? `Excerpt: ${article.summary}` : 'Excerpt: (not provided)',
  ].join('\n');

  try {
    const text = await runPrompt(ai, prompt, 280);
    if (!text) return null;
    const parsed = parseEnrichmentJson(text);
    if (!parsed) {
      console.warn(`[WorkersAI] Failed to parse article JSON for ${article.id}: ${text.slice(0, 120)}`);
    }
    return parsed;
  } catch (err) {
    console.warn(`[WorkersAI] Article enrichment failed for ${article.id}:`, err);
    return null;
  }
}

export async function enrichJobWithWorkersAI(
  ai: Ai,
  job: JobEnrichmentInput
): Promise<JobEnrichmentResult | null> {
  const prompt = [
    'You are reviewing a job posting collected from an official company career page for a remote AI jobs board.',
    'Verify whether it appears genuinely remote-eligible and genuinely in the AI/ML/Tech product/engineering/research/solutions space, and write a 1-sentence summary of the role.',
    'Return ONLY valid JSON with no extra text:',
    '{"summary": "<1 crisp sentence summarizing the role focus>", "is_remote": <true|false>, "is_ai_role": <true|false>, "ai_category": "<ML & Research|Applied AI & Agents|AI Infrastructure|AI Product & Solutions|AI Security & Safety|Engineering (AI Co.)>"}',
    '',
    `Company: ${job.companyName}`,
    `Title: ${job.title}`,
    `Department: ${job.department || 'Unspecified'}`,
    `Location: ${job.locationRaw}`,
    `Initial Category: ${job.aiCategory}`,
    job.descriptionSnippet ? `Excerpt: ${job.descriptionSnippet}` : 'Excerpt: (not provided)',
  ].join('\n');

  try {
    const text = await runPrompt(ai, prompt, 260);
    if (!text) return null;
    const parsed = parseJobEnrichmentJson(text);
    if (!parsed) {
      console.warn(`[WorkersAI] Failed to parse job JSON for ${job.id}: ${text.slice(0, 120)}`);
    }
    return parsed;
  } catch (err) {
    console.warn(`[WorkersAI] Job enrichment failed for ${job.id}:`, err);
    return null;
  }
}

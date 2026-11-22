/**
 * Direct Company Career-Page Parsers & Classifiers
 *
 * Supports 6 official company career portal / ATS formats without any third-party aggregators:
 * - Greenhouse (boards-api.greenhouse.io)
 * - Ashby (api.ashbyhq.com)
 * - Workable (apply.workable.com)
 * - Jibe / iCIMS (github.careers, careers.amd.com)
 * - Google Careers embedded AF_initDataCallback JSON
 * - Microsoft Careers (Eightfold PCSX JSON API)
 */

import { decodeHTML } from 'entities';
import { CompanyCareerConfig } from '../src/config/companies';
import { normalizeCanonicalUrl, normalizeIsoDate } from './parsers';

export type JobAiCategory =
  | 'ML & Research'
  | 'Applied AI & Agents'
  | 'AI Infrastructure'
  | 'AI Product & Solutions'
  | 'AI Security & Safety'
  | 'Engineering (AI Co.)';

export type JobRegion = 'US' | 'Global' | 'EMEA' | 'APAC' | 'Americas' | 'Other';

export interface ParsedJob {
  id: string;
  canonicalUrl: string;
  companyId: string;
  companyName: string;
  title: string;
  url: string;
  department: string | null;
  locationRaw: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  region: JobRegion;
  aiCategory: JobAiCategory;
  salaryRange: string | null;
  descriptionSnippet: string | null;
  postedAt: string | null;
}

const REMOTE_TEXT_REGEX =
  /\b(remote|work from home|wfh|telecommute|distributed|anywhere|virtual)\b/i;

const NON_TECHNICAL_EXCLUDE_REGEX =
  /\b(payroll|recruiter|recruiting|talent acquisition|facilities|office manager|accounting|accountant|tax|audit|receptionist|executive assistant|admin assistant|event coordinator|events|culinary|chef|janitor|legal counsel|paralegal|real estate|workplace operations|compensation|benefits specialist|graphic designer|brand campaign|brand marketing|communications|public relations|social media|copywriter)\b/i;

const AI_NATIVE_INCLUDE_REGEX =
  /\b(engineer|developer|architect|scientist|research|machine learning|ml\b|ai\b|artificial intelligence|llms?|agents?|nlp|product manager|technical program|solutions|forward deployed|field engineer|developer advocate|devrel|security|safety|alignment|data|analytics|inference|cuda|infrastructure|platform|systems|fullstack|full-stack|backend|frontend|mobile|design|designer|policy)\b/i;

const EXPLICIT_AI_KEYWORD_REGEX =
  /\b(ai|artificial intelligence|machine learning|deep learning|llms?|large language|generative ai|genai|gen ai|agents?|agentic|copilot|nlp|natural language|computer vision|multimodal|neural|transformer|diffusion|foundation model|applied scientist|research scientist|mlops|inference|gpu|cuda|rocm|vector|rag|embedding|fine-tuning|reinforcement learning)\b/i;

function stripHtml(html: string): string {
  return decodeHTML(html.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim());
}

function makeSnippet(raw?: string | null): string | null {
  if (!raw) return null;
  const cleaned = stripHtml(raw);
  if (!cleaned) return null;
  return cleaned.length > 420 ? `${cleaned.slice(0, 417)}...` : cleaned;
}

function extractSalaryRange(text?: string | null): string | null {
  if (!text) return null;
  const clean = stripHtml(text);
  const match = clean.match(
    /(?:\$|USD\s*\$?)\s?\d{2,3}(?:,\d{3})*(?:\s?[kK])?\s*(?:-|–|—|to)\s*(?:\$|USD\s*\$?)?\s?\d{2,3}(?:,\d{3})*(?:\s?[kK])?(?:\s*\(?(?:USD|per year|annually)\)?)?/
  );
  return match ? match[0].replace(/\s+/g, ' ').trim() : null;
}

function buildJobId(companyId: string, canonicalUrl: string): string {
  let hash = 2166136261;
  for (let i = 0; i < canonicalUrl.length; i++) {
    hash ^= canonicalUrl.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${companyId}-${(hash >>> 0).toString(36)}`;
}

export function detectRegion(locationRaw: string): JobRegion {
  const loc = locationRaw.toLowerCase();
  if (!loc) return 'Other';

  if (
    /\b(global|worldwide|anywhere|everywhere|all locations|remote - global|remote \(global\))\b/i.test(
      loc
    )
  ) {
    return 'Global';
  }

  if (
    /\b(us|u\.s\.|usa|united states|north america|san francisco|new york|nyc|seattle|austin|boston|chicago|los angeles|california|texas|washington|pennsylvania|colorado|massachusetts|georgia|virginia)\b/i.test(
      loc
    ) ||
    /,\s*(al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/i.test(
      loc
    )
  ) {
    return 'US';
  }

  if (
    /\b(emea|europe|eu|uk|united kingdom|london|dublin|ireland|germany|berlin|munich|france|paris|netherlands|amsterdam|spain|madrid|poland|sweden|switzerland|zurich|italy|belgium|portugal|israel|tel aviv|uae|dubai)\b/i.test(
      loc
    )
  ) {
    return 'EMEA';
  }

  if (
    /\b(apac|asia|japan|tokyo|singapore|india|bangalore|bengaluru|hyderabad|australia|sydney|melbourne|korea|seoul|taiwan|china|hong kong|new zealand)\b/i.test(
      loc
    )
  ) {
    return 'APAC';
  }

  if (
    /\b(americas|canada|toronto|vancouver|montreal|ontario|latam|latin america|brazil|sao paulo|mexico|argentina|colombia|chile)\b/i.test(
      loc
    )
  ) {
    return 'Americas';
  }

  if (loc.trim() === 'remote') {
    return 'Global';
  }

  return 'Other';
}

export function classifyAiJob(
  title: string,
  department: string | null,
  snippet: string | null,
  isAiNative: boolean
): { matches: boolean; category: JobAiCategory } {
  const titleLower = title.toLowerCase();
  const deptLower = (department || '').toLowerCase();
  const combined = `${title} ${department || ''} ${snippet || ''}`;

  if (NON_TECHNICAL_EXCLUDE_REGEX.test(titleLower)) {
    return { matches: false, category: 'Engineering (AI Co.)' };
  }

  const hasExplicitAi = EXPLICIT_AI_KEYWORD_REGEX.test(combined);
  if (!isAiNative && !hasExplicitAi) {
    return { matches: false, category: 'Engineering (AI Co.)' };
  }

  if (isAiNative && !hasExplicitAi && !AI_NATIVE_INCLUDE_REGEX.test(`${titleLower} ${deptLower}`)) {
    return { matches: false, category: 'Engineering (AI Co.)' };
  }

  // Categorize matched role
  if (
    /\b(security|safety|alignment|trust|red team|adversarial|risk|threat|privacy)\b/i.test(
      `${title} ${department || ''}`
    )
  ) {
    return { matches: true, category: 'AI Security & Safety' };
  }

  if (
    /\b(research|scientist|pre-training|pretraining|post-training|posttraining|rlhf|reasoning|interpretability|multimodal|foundation model|deep learning|computer vision|nlp)\b/i.test(
      `${title} ${department || ''}`
    )
  ) {
    return { matches: true, category: 'ML & Research' };
  }

  if (
    /\b(infrastructure|infra|distributed|kernel|cuda|rocm|gpu|cluster|compiler|serving|inference|systems|sre|reliability|platform|data platform|mlops|compute)\b/i.test(
      `${title} ${department || ''}`
    )
  ) {
    return { matches: true, category: 'AI Infrastructure' };
  }

  if (
    /\b(product manager|solutions|forward deployed|field engineer|customer engineer|sales engineer|developer advocate|devrel|evangelist|architect|designer)\b/i.test(
      `${title} ${department || ''}`
    )
  ) {
    return { matches: true, category: 'AI Product & Solutions' };
  }

  if (
    /\b(agents?|agentic|applied ai|copilot|rag|prompt|ai engineer|ml engineer|machine learning engineer|llms?|genai|generative ai)\b/i.test(
      combined
    )
  ) {
    return { matches: true, category: 'Applied AI & Agents' };
  }

  return { matches: true, category: 'Engineering (AI Co.)' };
}

function finalizeJob(
  company: CompanyCareerConfig,
  raw: {
    title: string;
    url: string;
    department: string | null;
    locationRaw: string;
    salaryRange?: string | null;
    snippet?: string | null;
    postedAt?: string | null;
  }
): ParsedJob | null {
  const title = decodeHTML(raw.title).trim();
  const url = raw.url.trim();
  if (!title || !url || !url.startsWith('http')) return null;

  const classification = classifyAiJob(
    title,
    raw.department,
    raw.snippet || null,
    company.isAiNative
  );
  if (!classification.matches) return null;

  const canonicalUrl = normalizeCanonicalUrl(url);
  const locationRaw = raw.locationRaw.trim() || 'Remote';

  return {
    id: buildJobId(company.id, canonicalUrl),
    canonicalUrl,
    companyId: company.id,
    companyName: company.name,
    title,
    url,
    department: raw.department ? decodeHTML(raw.department).trim() : null,
    locationRaw,
    workMode: 'remote',
    region: detectRegion(locationRaw),
    aiCategory: classification.category,
    salaryRange: raw.salaryRange || extractSalaryRange(raw.snippet) || null,
    descriptionSnippet: raw.snippet || null,
    postedAt: normalizeIsoDate(raw.postedAt),
  };
}

/**
 * 1. Greenhouse public board API parser
 */
export function parseGreenhouseJobs(payload: unknown, company: CompanyCareerConfig): ParsedJob[] {
  const data = payload as { jobs?: Array<any> };
  if (!data || !Array.isArray(data.jobs)) return [];

  const results: ParsedJob[] = [];
  for (const job of data.jobs) {
    const title = String(job.title || '').trim();
    const locationRaw = String(job.location?.name || '').trim();
    const url = String(job.absolute_url || '').trim();
    if (!title || !url) continue;

    // Require explicit remote signal in location or title
    if (!REMOTE_TEXT_REGEX.test(locationRaw) && !REMOTE_TEXT_REGEX.test(title)) {
      continue;
    }

    const department =
      Array.isArray(job.departments) && job.departments[0]?.name
        ? String(job.departments[0].name)
        : null;
    const snippet = job.content ? makeSnippet(String(job.content)) : null;
    const parsed = finalizeJob(company, {
      title,
      url,
      department,
      locationRaw,
      snippet,
      postedAt: job.first_published || job.updated_at || null,
    });
    if (parsed) results.push(parsed);
  }
  return results;
}

/**
 * 2. Ashby public posting API parser
 * Guards against Ashby's quirk where `isRemote: true` can appear on Hybrid/OnSite listings.
 */
export function parseAshbyJobs(payload: unknown, company: CompanyCareerConfig): ParsedJob[] {
  const data = payload as { jobs?: Array<any> };
  if (!data || !Array.isArray(data.jobs)) return [];

  const results: ParsedJob[] = [];
  for (const job of data.jobs) {
    const title = String(job.title || '').trim();
    const url = String(job.jobUrl || '').trim();
    if (!title || !url) continue;

    const primaryLoc = String(job.location || '').trim();
    const secondaryLocs = Array.isArray(job.secondaryLocations)
      ? job.secondaryLocations.map((s: any) => String(s?.location || '').trim()).filter(Boolean)
      : [];
    const locationRaw = [primaryLoc, ...secondaryLocs].filter(Boolean).join('; ') || 'Remote';

    const wt = String(job.workplaceType || '').toLowerCase();
    const isRemote =
      wt === 'remote' ||
      (job.isRemote === true && wt !== 'hybrid' && wt !== 'onsite') ||
      /\bremote\b/i.test(locationRaw) ||
      /\bremote\b/i.test(title);

    if (!isRemote) continue;

    const department = job.department ? String(job.department) : job.team ? String(job.team) : null;
    const snippet = job.descriptionPlain ? makeSnippet(String(job.descriptionPlain)) : null;
    const salaryRange = job.compensation?.compensationTierSummary
      ? String(job.compensation.compensationTierSummary).trim()
      : extractSalaryRange(job.descriptionPlain);

    const parsed = finalizeJob(company, {
      title,
      url,
      department,
      locationRaw: locationRaw.includes('Remote') || wt !== 'remote' ? locationRaw : `Remote (${locationRaw})`,
      salaryRange,
      snippet,
      postedAt: job.publishedAt || null,
    });
    if (parsed) results.push(parsed);
  }
  return results;
}

/**
 * 3. Workable public widget API parser
 */
export function parseWorkableJobs(payload: unknown, company: CompanyCareerConfig): ParsedJob[] {
  const data = payload as { jobs?: Array<any> };
  if (!data || !Array.isArray(data.jobs)) return [];

  const results: ParsedJob[] = [];
  for (const job of data.jobs) {
    const title = String(job.title || '').trim();
    const url = String(job.url || job.shortlink || '').trim();
    if (!title || !url) continue;

    const locParts = [job.city, job.state, job.country].filter(Boolean).map(String);
    const locationRaw =
      (locParts.length > 0 ? locParts.join(', ') : '') ||
      (job.telecommuting ? 'Remote' : '');

    const isRemote =
      job.telecommuting === true ||
      REMOTE_TEXT_REGEX.test(locationRaw) ||
      REMOTE_TEXT_REGEX.test(title);
    if (!isRemote) continue;

    const parsed = finalizeJob(company, {
      title,
      url,
      department: job.department ? String(job.department) : null,
      locationRaw:
        locationRaw && !REMOTE_TEXT_REGEX.test(locationRaw)
          ? `Remote (${locationRaw})`
          : locationRaw || 'Remote',
      snippet: null,
      postedAt: job.published_on || job.created_at || null,
    });
    if (parsed) results.push(parsed);
  }
  return results;
}

/**
 * 4. Jibe / iCIMS public JSON parser (GitHub Careers, AMD Careers)
 */
export function parseJibeJobs(payload: unknown, company: CompanyCareerConfig): ParsedJob[] {
  const data = payload as { jobs?: Array<{ data?: any }> };
  if (!data || !Array.isArray(data.jobs)) return [];

  const results: ParsedJob[] = [];
  for (const wrapper of data.jobs) {
    const job = wrapper?.data;
    if (!job) continue;

    const title = String(job.title || '').trim();
    const locationRaw = String(job.full_location || job.short_location || '').trim();
    const locType = String(job.location_type || '').toUpperCase();
    const url = String(job.meta_data?.canonical_url || job.apply_url || '').trim();
    if (!title || !url) continue;

    const isRemote =
      locType === 'ANY' ||
      REMOTE_TEXT_REGEX.test(locationRaw) ||
      REMOTE_TEXT_REGEX.test(title);
    if (!isRemote) continue;

    const department =
      Array.isArray(job.categories) && job.categories[0]?.name
        ? String(job.categories[0].name)
        : null;
    const snippet = job.description ? makeSnippet(String(job.description)) : null;

    const parsed = finalizeJob(company, {
      title,
      url,
      department,
      locationRaw:
        locType === 'ANY' && !REMOTE_TEXT_REGEX.test(locationRaw)
          ? `Remote (${locationRaw || 'Flexible'})`
          : locationRaw || 'Remote',
      salaryRange: extractSalaryRange(job.description),
      snippet,
      postedAt: job.posted_date || null,
    });
    if (parsed) results.push(parsed);
  }
  return results;
}

/**
 * 5. Google Careers HTML AF_initDataCallback('ds:1') parser
 */
export function parseGoogleCareersHtml(html: string, company: CompanyCareerConfig): ParsedJob[] {
  if (!html) return [];

  const regex = /AF_initDataCallback\(\{key:\s*'([^']+)'[^]*?data:([\s\S]*?),\s*sideChannel:/g;
  let items: any[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    if (match[1] === 'ds:1' || match[2].includes('jobs/results/')) {
      try {
        const parsed = JSON.parse(match[2]);
        if (Array.isArray(parsed?.[0])) {
          items = parsed[0];
          break;
        }
      } catch {
        // Continue checking callbacks
      }
    }
  }

  if (items.length === 0) return [];

  const results: ParsedJob[] = [];
  for (const item of items) {
    if (!Array.isArray(item) || !item[0] || !item[1]) continue;

    const jobId = String(item[0]).trim();
    const title = String(item[1]).trim();
    const url = `https://www.google.com/about/careers/applications/jobs/results/${encodeURIComponent(jobId)}`;

    const rawLocs = Array.isArray(item[9])
      ? item[9].map((locTuple: any) => String(locTuple?.[0] || '').trim()).filter(Boolean)
      : [];
    const locationNote = typeof item[18]?.[1] === 'string' ? stripHtml(item[18][1]) : '';
    const locationRaw = rawLocs.join('; ') || locationNote || 'Remote';

    const hasRemoteSignal =
      REMOTE_TEXT_REGEX.test(locationNote) ||
      REMOTE_TEXT_REGEX.test(locationRaw) ||
      REMOTE_TEXT_REGEX.test(title);
    if (!hasRemoteSignal) continue;

    const descHtml = typeof item[10]?.[1] === 'string' ? item[10][1] : '';
    const respHtml = typeof item[3]?.[1] === 'string' ? item[3][1] : '';
    const snippet = makeSnippet(descHtml || respHtml);
    const salaryRange = extractSalaryRange(descHtml);

    let postedAt: string | null = null;
    const unixSec = Number(item[12]?.[0]);
    if (Number.isFinite(unixSec) && unixSec > 0) {
      postedAt = new Date(unixSec * 1000).toISOString();
    }

    const remoteDisplay =
      locationNote && /remote location\(s\):\s*([^.]+)/i.test(locationNote)
        ? `Remote (${locationNote.match(/remote location\(s\):\s*([^.]+)/i)?.[1]?.trim()})`
        : REMOTE_TEXT_REGEX.test(locationRaw)
          ? locationRaw
          : `Remote (${locationRaw})`;

    const parsed = finalizeJob(company, {
      title,
      url,
      department: null,
      locationRaw: remoteDisplay,
      salaryRange,
      snippet,
      postedAt,
    });
    if (parsed) results.push(parsed);
  }

  return results;
}

/**
 * 6. Microsoft Careers (Eightfold PCSX JSON API) parser
 */
export function parseMicrosoftEightfoldJobs(
  payload: unknown,
  company: CompanyCareerConfig
): ParsedJob[] {
  const data = payload as { data?: { positions?: Array<any> } };
  const positions = data?.data?.positions;
  if (!Array.isArray(positions)) return [];

  const results: ParsedJob[] = [];
  for (const pos of positions) {
    const title = String(pos.name || '').trim();
    const posUrl = String(pos.positionUrl || '').trim();
    if (!title || !posUrl) continue;

    const url = posUrl.startsWith('http')
      ? posUrl
      : `https://apply.careers.microsoft.com${posUrl.startsWith('/') ? '' : '/'}${posUrl}`;

    const locations = Array.isArray(pos.locations)
      ? pos.locations.map(String).filter(Boolean)
      : Array.isArray(pos.standardizedLocations)
        ? pos.standardizedLocations.map(String).filter(Boolean)
        : [];
    const locationRaw = locations.join('; ') || 'Remote';
    const workOpt = String(pos.workLocationOption || '').toLowerCase();
    const flex = String(pos.locationFlexibility || '');

    const isRemote =
      workOpt === 'remote' ||
      /\b(remote|virtual|work from home|100% work from home)\b/i.test(
        `${flex} ${locationRaw} ${title}`
      );
    if (!isRemote) continue;

    let postedAt: string | null = null;
    const postedTs = Number(pos.postedTs);
    if (Number.isFinite(postedTs) && postedTs > 0) {
      postedAt = new Date(postedTs * 1000).toISOString();
    }

    const parsed = finalizeJob(company, {
      title,
      url,
      department: pos.department ? String(pos.department) : null,
      locationRaw: REMOTE_TEXT_REGEX.test(locationRaw) ? locationRaw : `Remote (${locationRaw})`,
      snippet: null,
      postedAt,
    });
    if (parsed) results.push(parsed);
  }

  return results;
}

/**
 * Dispatches raw HTTP response text to the appropriate company career parser.
 */
export function parseCompanyJobsResponse(
  rawBody: string,
  company: CompanyCareerConfig
): ParsedJob[] {
  if (!rawBody || !rawBody.trim()) return [];

  if (company.ats === 'google_careers') {
    return parseGoogleCareersHtml(rawBody, company);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch (err) {
    throw new Error(
      `Invalid JSON from ${company.name} (${company.ats}): ${err instanceof Error ? err.message : 'parse error'}`
    );
  }

  switch (company.ats) {
    case 'greenhouse':
      return parseGreenhouseJobs(parsedJson, company);
    case 'ashby':
      return parseAshbyJobs(parsedJson, company);
    case 'workable':
      return parseWorkableJobs(parsedJson, company);
    case 'jibe':
      return parseJibeJobs(parsedJson, company);
    case 'microsoft_eightfold':
      return parseMicrosoftEightfoldJobs(parsedJson, company);
    default:
      return [];
  }
}

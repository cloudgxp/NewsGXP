/**
 * NewsGXP Shared Core Models
 *
 * Principle: Providers know how to fetch and normalize content.
 * The application knows how to display content.
 */

export interface Article {
  id: string;
  title: string;
  url: string;
  providerId: string;

  publishedAt?: string;
  firstSeenAt?: string;
  sortAt?: string;
  author?: string;
  summary?: string;
  aiSummary?: string;
  aiTags?: string[];
  aiQualityScore?: number;
  imageUrl?: string;
  categories?: string[];
}

export interface SyncRunSummary {
  id: string;
  triggerType: string;
  startedAt: string;
  finishedAt?: string | null;
  providersTotal: number;
  providersSucceeded: number;
  providersFailed: number;
  articlesInserted: number;
  articlesEnriched: number;
  articlesPruned: number;
  status: string;
}

export interface ArticlesApiResponse {
  articles: Article[];
  total: number;
  lastSyncedAt: string | null;
  lastSyncRun: SyncRunSummary | null;
  needsInitialSync: boolean;
}

export interface JobPosting {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  url: string;
  department?: string;
  locationRaw: string;
  workMode: 'remote' | 'hybrid' | 'onsite';
  region: string;
  aiCategory: string;
  salaryRange?: string;
  descriptionSnippet?: string;
  aiSummary?: string;
  aiVerifiedRemote?: boolean;
  aiVerifiedAi?: boolean;
  postedAt?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  isActive: boolean;
}

export interface JobSyncRunSummary {
  id: string;
  triggerType: string;
  startedAt: string;
  finishedAt?: string | null;
  companiesTotal: number;
  companiesSucceeded: number;
  companiesFailed: number;
  jobsDiscovered: number;
  jobsActive: number;
  jobsClosed: number;
  jobsEnriched: number;
  jobsPruned: number;
  status: string;
}

export interface JobsApiResponse {
  jobs: JobPosting[];
  total: number;
  newThisWeekCount: number;
  companyCounts: Record<string, number>;
  lastSyncedAt: string | null;
  lastSyncRun: JobSyncRunSummary | null;
  needsInitialSync: boolean;
}

export interface WeeklyDigestResponse {
  generatedAt: string;
  windowDays: number;
  topArticles: Article[];
  newJobs: JobPosting[];
  markdown: string;
}

export interface NewsProvider {
  id: string;
  name: string;
  topic: string;
  description?: string;
  homepage: string;
  icon?: string;
  categories?: string[];

  fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]>;
}

export interface FeedState {
  articles: Article[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

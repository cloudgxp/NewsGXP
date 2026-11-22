import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Article, JobPosting } from './types';
import { feedService, DEFAULT_FOLLOWED_PROVIDERS } from './services/feedService';
import { fetchJobs } from './services/jobsService';
import { TRACKED_COMPANIES } from './config/companies';
import { Header, ActiveTab } from './components/Header';
import { SourcesBar } from './components/SourcesBar';
import { FeedView, TimeframeFilter } from './components/FeedView';
import { JobsView } from './components/JobsView';
import { ProvidersView } from './components/ProvidersView';
import { AboutModal } from './components/AboutModal';

const STORAGE_KEY_FOLLOWED_PROVIDERS = 'newsgxp_followed_providers';
const STORAGE_KEY_SAVED_ARTICLES = 'newsgxp_saved_articles';
const STORAGE_KEY_SAVED_JOBS = 'newsgxp_saved_jobs';

function loadInitialFollowedProviders(): string[] {
  const validIds = new Set(feedService.getAllProviders().map((p) => p.id));

  try {
    const saved = localStorage.getItem(STORAGE_KEY_FOLLOWED_PROVIDERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        if (parsed.length === 0) return [];

        const validSaved = parsed.filter(
          (id): id is string => typeof id === 'string' && validIds.has(id)
        );

        const resolved = validSaved.length > 0 ? validSaved : DEFAULT_FOLLOWED_PROVIDERS;
        if (validSaved.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEY_FOLLOWED_PROVIDERS, JSON.stringify(resolved));
        }
        return resolved;
      }
    }
  } catch (e) {
    console.warn('[NewsGXP] Failed to load followed providers from localStorage:', e);
  }

  return DEFAULT_FOLLOWED_PROVIDERS;
}

function loadSavedRecord<T>(storageKey: string): Record<string, T> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, T>;
      }
    }
  } catch (e) {
    console.warn(`[NewsGXP] Failed to load ${storageKey} from localStorage:`, e);
  }
  return {};
}

function resolveTabFromLocation(): ActiveTab {
  if (typeof window !== 'undefined') {
    if (window.location.pathname === '/providers' || window.location.hash === '#providers') {
      return 'providers';
    }
    if (window.location.pathname === '/jobs' || window.location.hash === '#jobs') {
      return 'jobs';
    }
  }
  return 'latest';
}

export default function App() {
  const [followedProviders, setFollowedProviders] = useState<string[]>(
    loadInitialFollowedProviders
  );
  const [savedArticlesMap, setSavedArticlesMap] = useState<Record<string, Article>>(() =>
    loadSavedRecord<Article>(STORAGE_KEY_SAVED_ARTICLES)
  );
  const [savedJobsMap, setSavedJobsMap] = useState<Record<string, JobPosting>>(() =>
    loadSavedRecord<JobPosting>(STORAGE_KEY_SAVED_JOBS)
  );

  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  const [activeTab, setActiveTab] = useState<ActiveTab>(resolveTabFromLocation);

  // News state
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Jobs state
  const [jobs, setJobs] = useState<JobPosting[]>([]);
  const [companyCounts, setCompanyCounts] = useState<Record<string, number>>({});
  const [newThisWeekJobsCount, setNewThisWeekJobsCount] = useState<number>(0);
  const [jobsNeedsInitialSync, setJobsNeedsInitialSync] = useState<boolean>(false);
  const [jobsLoading, setJobsLoading] = useState<boolean>(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const allProviders = useMemo(() => feedService.getAllProviders(), []);

  const followedProviderObjects = useMemo(
    () => allProviders.filter((p) => followedProviders.includes(p.id)),
    [allProviders, followedProviders]
  );

  const handleSelectTab = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      if (tab === 'providers' && window.location.pathname !== '/providers') {
        window.history.pushState({ tab }, '', '/providers');
      } else if (tab === 'jobs' && window.location.pathname !== '/jobs') {
        window.history.pushState({ tab }, '', '/jobs');
      } else if (tab === 'latest' && window.location.pathname !== '/') {
        window.history.pushState({ tab }, '', '/');
      }
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(resolveTabFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleToggleSaveArticle = useCallback((article: Article) => {
    setSavedArticlesMap((prev) => {
      const next = { ...prev };
      if (next[article.id]) {
        delete next[article.id];
      } else {
        next[article.id] = article;
      }
      try {
        localStorage.setItem(STORAGE_KEY_SAVED_ARTICLES, JSON.stringify(next));
      } catch (e) {
        console.warn('[NewsGXP] Failed to persist saved articles:', e);
      }
      return next;
    });
  }, []);

  const handleToggleSaveJob = useCallback((job: JobPosting) => {
    setSavedJobsMap((prev) => {
      const next = { ...prev };
      if (next[job.id]) {
        delete next[job.id];
      } else {
        next[job.id] = job;
      }
      try {
        localStorage.setItem(STORAGE_KEY_SAVED_JOBS, JSON.stringify(next));
      } catch (e) {
        console.warn('[NewsGXP] Failed to persist saved jobs:', e);
      }
      return next;
    });
  }, []);

  const handleToggleFollow = useCallback(
    (providerId: string) => {
      setFollowedProviders((prev) => {
        const next = prev.includes(providerId)
          ? prev.filter((id) => id !== providerId)
          : [...prev, providerId];

        try {
          localStorage.setItem(STORAGE_KEY_FOLLOWED_PROVIDERS, JSON.stringify(next));
        } catch (e) {
          console.warn('[NewsGXP] Failed to persist followed providers:', e);
        }

        if (selectedProviderId === providerId && !next.includes(providerId)) {
          setSelectedProviderId(null);
        }

        return next;
      });
    },
    [selectedProviderId]
  );

  const handleToggleFollowTopic = useCallback(
    (topic: string, shouldFollow: boolean) => {
      const topicProviderIds = feedService.getProviderIdsForTopic(topic);
      if (topicProviderIds.length === 0) return;

      setFollowedProviders((prev) => {
        let next: string[];
        if (shouldFollow) {
          const toAdd = topicProviderIds.filter((id) => !prev.includes(id));
          next = [...prev, ...toAdd];
        } else {
          next = prev.filter((id) => !topicProviderIds.includes(id));
        }

        try {
          localStorage.setItem(STORAGE_KEY_FOLLOWED_PROVIDERS, JSON.stringify(next));
        } catch (e) {
          console.warn('[NewsGXP] Failed to persist followed providers:', e);
        }

        if (selectedProviderId && topicProviderIds.includes(selectedProviderId) && !shouldFollow) {
          setSelectedProviderId(null);
        }

        return next;
      });
    },
    [selectedProviderId]
  );

  const loadFeed = useCallback(
    async (forceFresh = false) => {
      if (followedProviders.length === 0) {
        setArticles([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null);
        return;
      }

      if (forceFresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const result = await feedService.getStoredArticles(followedProviders, { forceFresh });
        setArticles(result.articles);
        setLastUpdated(result.lastSyncedAt || new Date());
      } catch (err: any) {
        console.error('[NewsGXP App] Error loading articles from feed service:', err);
        setError(
          err?.message ||
            'Failed to retrieve stories from followed providers. Please check connection and try again.'
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [followedProviders]
  );

  const loadJobs = useCallback(async (forceFresh = false) => {
    if (!forceFresh) {
      setJobsLoading(true);
    }
    setJobsError(null);

    try {
      const payload = await fetchJobs({ forceFresh, limit: 200 });
      setJobs(payload.jobs);
      setCompanyCounts(payload.companyCounts || {});
      setNewThisWeekJobsCount(payload.newThisWeekCount || 0);
      setJobsNeedsInitialSync(Boolean(payload.needsInitialSync));
    } catch (err: any) {
      console.warn('[NewsGXP App] Error loading remote AI jobs:', err);
      setJobsError(err?.message || 'Failed to load remote AI jobs.');
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleRefreshAll = useCallback(() => {
    loadFeed(true);
    loadJobs(true);
  }, [loadFeed, loadJobs]);

  const savedArticleIds = useMemo(() => new Set(Object.keys(savedArticlesMap)), [savedArticlesMap]);
  const savedJobIds = useMemo(() => new Set(Object.keys(savedJobsMap)), [savedJobsMap]);
  const savedJobsList = useMemo<JobPosting[]>(
    () => Object.values(savedJobsMap) as JobPosting[],
    [savedJobsMap]
  );

  const sourceArticles = useMemo<Article[]>(() => {
    if (timeframe === 'saved') {
      return (Object.values(savedArticlesMap) as Article[]).sort((a, b) => {
        const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return timeB - timeA;
      });
    }
    return articles;
  }, [articles, savedArticlesMap, timeframe]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    sourceArticles.forEach((art) => {
      art.categories?.forEach((cat) => set.add(cat));
      art.aiTags?.forEach((tag) => set.add(tag));
    });
    return Array.from(set).sort();
  }, [sourceArticles]);

  const filteredArticles = useMemo(() => {
    const nowMs = Date.now();
    const cutoffMs =
      timeframe === '1d'
        ? nowMs - 24 * 60 * 60 * 1000
        : timeframe === '7d'
          ? nowMs - 7 * 24 * 60 * 60 * 1000
          : 0;

    return sourceArticles.filter((article) => {
      if (timeframe !== 'saved' && !followedProviders.includes(article.providerId)) {
        return false;
      }

      if (selectedProviderId && article.providerId !== selectedProviderId) {
        return false;
      }

      if (cutoffMs > 0) {
        const dateStr = article.sortAt || article.publishedAt || article.firstSeenAt;
        const articleMs = dateStr ? new Date(dateStr).getTime() : 0;
        if (!articleMs || articleMs < cutoffMs) {
          return false;
        }
      }

      if (selectedCategory) {
        const inCat = article.categories?.includes(selectedCategory) ?? false;
        const inAiTags = article.aiTags?.includes(selectedCategory) ?? false;
        if (!inCat && !inAiTags) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inTitle = article.title.toLowerCase().includes(query);
        const inSummary = article.summary?.toLowerCase().includes(query) ?? false;
        const inAiSummary = article.aiSummary?.toLowerCase().includes(query) ?? false;
        const inAuthor = article.author?.toLowerCase().includes(query) ?? false;
        if (!inTitle && !inSummary && !inAiSummary && !inAuthor) {
          return false;
        }
      }

      return true;
    });
  }, [sourceArticles, followedProviders, selectedProviderId, timeframe, selectedCategory, searchQuery]);

  const sourceLabel = useMemo(() => {
    if (timeframe === 'saved') {
      return 'Saved Stories & Video Queue';
    }
    if (selectedProviderId) {
      const p = feedService.getProvider(selectedProviderId);
      return p ? `Latest from ${p.name}` : 'Latest AI & Tech News';
    }
    return 'Latest AI & Tech News';
  }, [selectedProviderId, timeframe]);

  return (
    <div className="min-h-screen bg-[#F7F7F2] text-[#2D2D2D] flex flex-col font-sans selection:bg-[#F47521]/20 selection:text-[#F47521]">
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onRefresh={handleRefreshAll}
        isRefreshing={isRefreshing || jobsLoading}
        lastUpdated={lastUpdated}
        articleCount={filteredArticles.length}
        jobCount={jobs.length}
      />

      {activeTab !== 'jobs' && (
        <SourcesBar
          followedProviders={followedProviderObjects}
          selectedProviderId={selectedProviderId}
          onSelectProvider={setSelectedProviderId}
          onManageProviders={() => handleSelectTab('providers')}
        />
      )}

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'providers' ? (
          <ProvidersView
            allProviders={allProviders}
            followedProviderIds={followedProviders}
            onToggleFollow={handleToggleFollow}
            onToggleFollowTopic={handleToggleFollowTopic}
            onNavigateToFeed={() => handleSelectTab('latest')}
          />
        ) : activeTab === 'jobs' ? (
          <JobsView
            jobs={jobs}
            companyCounts={companyCounts}
            newThisWeekCount={newThisWeekJobsCount}
            isLoading={jobsLoading}
            error={jobsError}
            needsInitialSync={jobsNeedsInitialSync}
            savedJobIds={savedJobIds}
            savedJobsList={savedJobsList}
            onToggleSaveJob={handleToggleSaveJob}
            onRetry={() => loadJobs(true)}
          />
        ) : (
          <FeedView
            articles={filteredArticles}
            isLoading={isLoading}
            error={error}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            timeframe={timeframe}
            onSelectTimeframe={setTimeframe}
            savedArticleIds={savedArticleIds}
            savedCount={savedArticleIds.size}
            onToggleSave={handleToggleSaveArticle}
            sourceLabel={sourceLabel}
            followedProviderCount={followedProviders.length}
            onRetry={() => loadFeed(true)}
            onClearFilters={() => {
              setSelectedCategory(null);
              setSearchQuery('');
              setTimeframe('all');
            }}
            onNavigateToProviders={() => handleSelectTab('providers')}
          />
        )}
      </main>

      <footer
        id="newsgxp-footer"
        className="mt-12 bg-[#F1F1EB] border-t border-[#D1D1CB] py-4 text-[10px] font-bold uppercase tracking-widest text-[#A1A19A] font-mono-accent"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="text-[#1A1A1A]">&copy; 2026 NewsGXP Project</span>
            <span>•</span>
            <span className="normal-case tracking-normal text-[#666660] italic font-editorial">
              AI &amp; Tech news. Remote AI jobs.
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-end">
            <span>{allProviders.length} AI &amp; Tech Sources</span>
            <span>•</span>
            <span>{TRACKED_COMPANIES.length} Company Career Pages</span>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleSelectTab('providers')}
              className="text-[#F47521] hover:underline uppercase cursor-pointer"
            >
              Sources
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleSelectTab('jobs')}
              className="text-[#F47521] hover:underline uppercase cursor-pointer"
            >
              Jobs
            </button>
          </div>
        </div>
      </footer>

      <AboutModal isOpen={activeTab === 'about'} onClose={() => setActiveTab('latest')} />
    </div>
  );
}

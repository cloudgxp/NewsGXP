import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Article, NewsProvider } from './types';
import { feedService } from './services/feedService';
import { Header } from './components/Header';
import { SourcesBar } from './components/SourcesBar';
import { FeedView } from './components/FeedView';
import { ProvidersView } from './components/ProvidersView';
import { AboutModal } from './components/AboutModal';

const STORAGE_KEY_FOLLOWED_PROVIDERS = 'newsgxp_followed_providers';

export default function App() {
  // Provider preference state persisted to localStorage
  const [followedProviders, setFollowedProviders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FOLLOWED_PROVIDERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('[NewsGXP] Failed to load followed providers from localStorage:', e);
    }
    return ['crunchyroll'];
  });

  // Selected source filter in Sources bar (null = All followed sources)
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // Active view tab (syncs with /providers route)
  const [activeTab, setActiveTab] = useState<'latest' | 'providers' | 'about'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/providers' || window.location.hash === '#providers') {
        return 'providers';
      }
    }
    return 'latest';
  });

  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // All available providers from feedService
  const allProviders = useMemo(() => {
    return feedService.getAllProviders();
  }, []);

  // Filtered list of followed provider objects for the Sources bar
  const followedProviderObjects = useMemo(() => {
    return allProviders.filter((p) => followedProviders.includes(p.id));
  }, [allProviders, followedProviders]);

  // Sync browser URL with tab changes
  const handleSelectTab = useCallback((tab: 'latest' | 'providers' | 'about') => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      if (tab === 'providers') {
        if (window.location.pathname !== '/providers') {
          window.history.pushState({ tab }, '', '/providers');
        }
      } else if (tab === 'latest') {
        if (window.location.pathname !== '/') {
          window.history.pushState({ tab }, '', '/');
        }
      }
    }
  }, []);

  // Listen to browser navigation (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === '/providers' || window.location.hash === '#providers') {
        setActiveTab('providers');
      } else {
        setActiveTab('latest');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Toggle follow/unfollow for a provider
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

        // If the unfollowed provider was the active filter, reset filter to All
        if (selectedProviderId === providerId && !next.includes(providerId)) {
          setSelectedProviderId(null);
        }

        return next;
      });
    },
    [selectedProviderId]
  );

  // Load articles for all followed providers
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
        const data = await feedService.getArticlesForProviders(followedProviders, { forceFresh });
        setArticles(data);
        setLastUpdated(new Date());
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

  // Reload feed whenever followed providers change
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Extract unique categories across loaded articles
  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach((art) => {
      art.categories?.forEach((cat) => set.add(cat));
    });
    return Array.from(set).sort();
  }, [articles]);

  // Filter articles by followed provider, active source filter, topic, and search query
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      // Must be from a followed provider
      if (!followedProviders.includes(article.providerId)) {
        return false;
      }

      // Filter by active provider if not "All"
      if (selectedProviderId && article.providerId !== selectedProviderId) {
        return false;
      }

      // Category filter
      if (selectedCategory && (!article.categories || !article.categories.includes(selectedCategory))) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inTitle = article.title.toLowerCase().includes(query);
        const inSummary = article.summary?.toLowerCase().includes(query) ?? false;
        const inAuthor = article.author?.toLowerCase().includes(query) ?? false;
        if (!inTitle && !inSummary && !inAuthor) {
          return false;
        }
      }

      return true;
    });
  }, [articles, followedProviders, selectedProviderId, selectedCategory, searchQuery]);

  // Dynamic label for current feed
  const sourceLabel = useMemo(() => {
    if (selectedProviderId) {
      const p = feedService.getProvider(selectedProviderId);
      return p ? `Latest from ${p.name}` : 'Latest News';
    }
    return 'Latest News';
  }, [selectedProviderId]);

  return (
    <div className="min-h-screen bg-[#F7F7F2] text-[#2D2D2D] flex flex-col font-sans selection:bg-[#F47521]/20 selection:text-[#F47521]">
      {/* Primary Site Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onRefresh={() => loadFeed(true)}
        isRefreshing={isRefreshing}
        lastUpdated={lastUpdated}
        articleCount={filteredArticles.length}
      />

      {/* Horizontal Sources Bar (Followed providers filter + Manage shortcut) */}
      <SourcesBar
        followedProviders={followedProviderObjects}
        selectedProviderId={selectedProviderId}
        onSelectProvider={setSelectedProviderId}
        onManageProviders={() => handleSelectTab('providers')}
      />

      {/* Main Content Area (Wide, centered layout with no developer sidebar) */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'providers' ? (
          <ProvidersView
            allProviders={allProviders}
            followedProviderIds={followedProviders}
            onToggleFollow={handleToggleFollow}
            onNavigateToFeed={() => handleSelectTab('latest')}
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
            sourceLabel={sourceLabel}
            followedProviderCount={followedProviders.length}
            onRetry={() => loadFeed(true)}
            onClearFilters={() => {
              setSelectedCategory(null);
              setSearchQuery('');
            }}
            onManageProviders={() => handleSelectTab('providers')}
          />
        )}
      </main>

      {/* Footer Bar */}
      <footer
        id="newsgxp-footer"
        className="mt-12 bg-[#F1F1EB] border-t border-[#D1D1CB] py-4 text-[10px] font-bold uppercase tracking-widest text-[#A1A19A] font-mono-accent"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="text-[#1A1A1A]">&copy; 2026 NewsGXP Project</span>
            <span>•</span>
            <span className="normal-case tracking-normal text-[#666660] italic font-editorial">
              Your news. Your providers.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Sources:</span>
            {allProviders.map((p, i) => (
              <React.Fragment key={p.id}>
                {i > 0 && <span>•</span>}
                <a
                  href={p.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F47521] hover:underline"
                >
                  {p.name}
                </a>
              </React.Fragment>
            ))}
          </div>
        </div>
      </footer>

      {/* About Modal / Dialog */}
      <AboutModal
        isOpen={activeTab === 'about'}
        onClose={() => setActiveTab('latest')}
      />
    </div>
  );
}

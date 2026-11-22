import React, { useState } from 'react';
import { Article } from '../types';
import { ArticleItem } from './ArticleItem';
import { fetchWeeklyDigest } from '../services/jobsService';
import {
  AlertCircle,
  RefreshCw,
  FileText,
  Search,
  ChevronDown,
  Plus,
  Bookmark,
  Copy,
  Check,
} from 'lucide-react';

export type TimeframeFilter = 'all' | '7d' | '1d' | 'saved';

interface FeedViewProps {
  articles: Article[];
  isLoading: boolean;
  error: string | null;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  timeframe: TimeframeFilter;
  onSelectTimeframe: (tf: TimeframeFilter) => void;
  savedArticleIds: Set<string>;
  savedCount: number;
  onToggleSave: (article: Article) => void;
  sourceLabel: string;
  followedProviderCount: number;
  onRetry: () => void;
  onClearFilters: () => void;
  onNavigateToProviders: () => void;
}

export const FeedView: React.FC<FeedViewProps> = ({
  articles,
  isLoading,
  error,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  timeframe,
  onSelectTimeframe,
  savedArticleIds,
  savedCount,
  onToggleSave,
  sourceLabel,
  followedProviderCount,
  onRetry,
  onClearFilters,
  onNavigateToProviders,
}) => {
  const [copiedDigest, setCopiedDigest] = useState(false);

  const handleCopyWeeklyDigest = async () => {
    try {
      let markdown = '';
      if (timeframe === 'saved') {
        const lines = ['## Saved AI & Tech Stories for Video Prep', ''];
        for (const a of articles) {
          const note = a.aiSummary || a.summary;
          lines.push(`- **[${a.title}](${a.url})** (${a.providerId})`);
          if (note) lines.push(`  - ${note}`);
        }
        markdown = lines.join('\n');
      } else {
        try {
          const digest = await fetchWeeklyDigest();
          markdown = digest.markdown;
        } catch {
          const lines = ['## Top AI & Tech Stories', ''];
          for (const a of articles.slice(0, 15)) {
            const note = a.aiSummary || a.summary;
            lines.push(`- **[${a.title}](${a.url})** (${a.providerId})`);
            if (note) lines.push(`  - ${note}`);
          }
          markdown = lines.join('\n');
        }
      }
      await navigator.clipboard.writeText(markdown);
      setCopiedDigest(true);
      setTimeout(() => setCopiedDigest(false), 2200);
    } catch (err) {
      console.warn('[FeedView] Failed to copy weekly digest:', err);
    }
  };

  const timeframeTabs: { id: TimeframeFilter; label: string }[] = [
    { id: 'all', label: 'All (45d)' },
    { id: '7d', label: 'This Week' },
    { id: '1d', label: 'Today' },
    { id: 'saved', label: `Saved${savedCount > 0 ? ` (${savedCount})` : ''}` },
  ];

  const showEmptySources = followedProviderCount === 0 && timeframe !== 'saved';

  return (
    <div id="newsgxp-feed-view" className="space-y-4">
      {/* Feed Toolbar */}
      <div className="bg-white border border-[#D1D1CB] p-4 sm:p-5 rounded-sm shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left: Heading & Count */}
          <div className="flex items-baseline gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1A1A1A]">
              {sourceLabel}
            </h1>
            {!isLoading && !error && !showEmptySources && (
              <span className="text-[11px] font-mono-accent text-[#888880] uppercase tracking-wider">
                • {articles.length} {articles.length === 1 ? 'story' : 'stories'}
              </span>
            )}
          </div>

          {/* Right: Search + Category Dropdown */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-[#888880] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="feed-search-input"
                type="text"
                placeholder="Search headlines & summaries..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm text-[#1A1A1A] placeholder-[#888880] focus:outline-hidden focus:border-[#1A1A1A] font-mono-accent transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#888880] hover:text-[#1A1A1A] cursor-pointer"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="relative shrink-0">
              <select
                id="feed-topic-select"
                value={selectedCategory || ''}
                onChange={(e) => onSelectCategory(e.target.value ? e.target.value : null)}
                className="appearance-none bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm text-xs font-mono-accent text-[#1A1A1A] py-1.5 pl-3 pr-8 focus:outline-hidden focus:border-[#1A1A1A] cursor-pointer hover:border-[#A1A19A] transition-colors"
              >
                <option value="">All Tags</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#888880] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Timeframe & Saved Queue Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#F1F1EB]">
          {timeframeTabs.map((tab) => {
            const active = timeframe === tab.id;
            return (
              <button
                key={tab.id}
                id={`timeframe-filter-${tab.id}`}
                type="button"
                onClick={() => onSelectTimeframe(tab.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-mono-accent uppercase tracking-wider font-bold transition-all cursor-pointer border ${
                  active
                    ? 'bg-[#1A1A1A] text-[#F7F7F2] border-[#1A1A1A]'
                    : 'bg-[#F7F7F2] text-[#666660] border-[#D1D1CB] hover:border-[#A1A19A] hover:text-[#1A1A1A]'
                }`}
              >
                {tab.id === 'saved' && <Bookmark className="w-3 h-3 text-[#F47521]" />}
                <span>{tab.label}</span>
              </button>
            );
          })}

          {(selectedCategory || searchQuery || timeframe !== 'all') && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[11px] text-[#F47521] hover:underline font-bold uppercase tracking-wider font-mono-accent cursor-pointer"
            >
              Reset View
            </button>
          )}

          <button
            id="copy-weekly-digest-btn"
            type="button"
            onClick={handleCopyWeeklyDigest}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-mono-accent uppercase tracking-wider font-bold bg-[#1A1A1A] hover:bg-[#333238] text-[#F7F7F2] transition-colors cursor-pointer ml-auto"
            title="Copy Markdown summary of weekly AI stories & jobs for YouTube/LinkedIn"
          >
            {copiedDigest ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-[#F47521]" />
                <span>Copy Weekly Digest</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* No Sources Followed State */}
      {showEmptySources && (
        <div
          id="no-sources-followed-state"
          className="bg-white border border-[#D1D1CB] rounded-sm p-8 text-center space-y-3 shadow-xs"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#F1F1EB] text-[#888880] mb-1">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold font-editorial text-[#1A1A1A]">
            No Providers Followed
          </h3>
          <p className="text-xs sm:text-sm text-[#666660] max-w-md mx-auto leading-relaxed">
            You are not following any AI &amp; Tech sources right now. Choose providers in the
            directory to populate your NewsGXP feed.
          </p>
          <div className="pt-2">
            <button
              id="empty-manage-providers-btn"
              type="button"
              onClick={onNavigateToProviders}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A1A1A] hover:bg-[#333238] text-[#F7F7F2] text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#F47521]" />
              <span>Manage Providers</span>
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && !showEmptySources && (
        <div
          id="feed-error-state"
          className="bg-white border border-[#D1D1CB] rounded-sm p-8 text-center space-y-3 shadow-xs"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#fae8e6] text-[#c53929] mb-1">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold font-editorial text-[#1A1A1A]">
            Feed Temporarily Unavailable
          </h3>
          <p className="text-xs sm:text-sm text-[#666660] max-w-md mx-auto leading-relaxed">
            {error}
          </p>
          <div className="pt-2">
            <button
              id="retry-fetch-button"
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A1A1A] hover:bg-[#333238] text-[#F7F7F2] text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton State */}
      {isLoading && !showEmptySources && (
        <div id="feed-loading-state" className="space-y-3.5">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-[#D1D1CB] p-5 rounded-sm animate-pulse space-y-3 shadow-xs"
            >
              <div className="flex gap-6">
                <div className="w-32 h-20 bg-[#E8E8E1] rounded-xs shrink-0 hidden sm:block"></div>
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 bg-[#E8E8E1] rounded-xs w-4/6"></div>
                  <div className="h-3 bg-[#F1F1EB] rounded-xs w-1/3"></div>
                  <div className="h-3 bg-[#F7F7F2] rounded-xs w-full"></div>
                  <div className="h-3 bg-[#F7F7F2] rounded-xs w-5/6"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty Filter Results State */}
      {!isLoading && !error && !showEmptySources && articles.length === 0 && (
        <div
          id="feed-empty-state"
          className="bg-white border border-[#D1D1CB] rounded-sm p-8 text-center space-y-3 shadow-xs"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#F1F1EB] text-[#666660]">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold font-editorial text-[#1A1A1A]">
            {timeframe === 'saved' ? 'No Saved Stories Yet' : 'No Articles Found'}
          </h3>
          <p className="text-xs sm:text-sm text-[#666660] max-w-sm mx-auto leading-relaxed">
            {timeframe === 'saved'
              ? 'Click the Save button on any article to queue it here for reading or YouTube prep.'
              : selectedCategory || searchQuery || timeframe !== 'all'
                ? 'No stories match your current timeframe, tag, or search keyword.'
                : 'No stories are currently available from the selected provider.'}
          </p>
          {(selectedCategory || searchQuery || timeframe !== 'all') && (
            <div className="pt-2">
              <button
                id="reset-empty-filters-btn"
                type="button"
                onClick={onClearFilters}
                className="px-4 py-2 bg-[#F1F1EB] hover:bg-[#E8E8E1] text-[#1A1A1A] text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer border border-[#D1D1CB]"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Article Feed List */}
      {!isLoading && !error && !showEmptySources && articles.length > 0 && (
        <div id="articles-list" className="space-y-3.5">
          {articles.map((article, index) => (
            <ArticleItem
              key={article.id}
              article={article}
              index={index}
              isSaved={savedArticleIds.has(article.id)}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
};

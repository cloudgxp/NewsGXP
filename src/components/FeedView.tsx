import React from 'react';
import { Article } from '../types';
import { ArticleItem } from './ArticleItem';
import { AlertCircle, RefreshCw, FileText, Search, ChevronDown, Plus } from 'lucide-react';

interface FeedViewProps {
  articles: Article[];
  isLoading: boolean;
  error: string | null;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
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
  sourceLabel,
  followedProviderCount,
  onRetry,
  onClearFilters,
  onNavigateToProviders,
}) => {
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
            {!isLoading && !error && followedProviderCount > 0 && (
              <span className="text-[11px] font-mono-accent text-[#888880] uppercase tracking-wider">
                • {articles.length} {articles.length === 1 ? 'story' : 'stories'}
              </span>
            )}
          </div>

          {/* Right: Search + Topics */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            {/* Search headlines */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 text-[#888880] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="feed-search-input"
                type="text"
                placeholder="Search headlines..."
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

            {/* All Topics dropdown */}
            <div className="relative shrink-0">
              <select
                id="feed-topic-select"
                value={selectedCategory || ''}
                onChange={(e) => onSelectCategory(e.target.value ? e.target.value : null)}
                className="appearance-none bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm text-xs font-mono-accent text-[#1A1A1A] py-1.5 pl-3 pr-8 focus:outline-hidden focus:border-[#1A1A1A] cursor-pointer hover:border-[#A1A19A] transition-colors"
              >
                <option value="">All Topics</option>
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

        {/* Active Filter Badges (if search or topic active) */}
        {(selectedCategory || searchQuery) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F1F1EB] text-xs font-mono-accent">
            <span className="text-[10px] uppercase font-bold text-[#A1A19A] tracking-wider">
              Filter:
            </span>
            {selectedCategory && (
              <span className="inline-flex items-center gap-1 bg-[#F1F1EB] border border-[#D1D1CB] px-2 py-0.5 rounded-sm text-[11px] text-[#1A1A1A]">
                Topic: {selectedCategory}
                <button
                  type="button"
                  onClick={() => onSelectCategory(null)}
                  className="text-[#888880] hover:text-[#1A1A1A] ml-1 cursor-pointer"
                  aria-label="Remove topic filter"
                >
                  ✕
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 bg-[#F1F1EB] border border-[#D1D1CB] px-2 py-0.5 rounded-sm text-[11px] text-[#1A1A1A]">
                &ldquo;{searchQuery}&rdquo;
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="text-[#888880] hover:text-[#1A1A1A] ml-1 cursor-pointer"
                  aria-label="Remove search query"
                >
                  ✕
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[11px] text-[#F47521] hover:underline font-bold uppercase tracking-wider ml-auto cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* No Sources Followed State */}
      {followedProviderCount === 0 && (
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
            You are not following any news sources right now. Choose providers in the directory to
            populate your NewsGXP feed.
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
      {error && !isLoading && followedProviderCount > 0 && (
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
      {isLoading && followedProviderCount > 0 && (
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
      {!isLoading && !error && followedProviderCount > 0 && articles.length === 0 && (
        <div
          id="feed-empty-state"
          className="bg-white border border-[#D1D1CB] rounded-sm p-8 text-center space-y-3 shadow-xs"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#F1F1EB] text-[#666660]">
            <FileText className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold font-editorial text-[#1A1A1A]">
            No Articles Found
          </h3>
          <p className="text-xs sm:text-sm text-[#666660] max-w-sm mx-auto leading-relaxed">
            {selectedCategory || searchQuery
              ? 'No stories match your current topic or search keyword.'
              : 'No stories are currently available from the selected provider.'}
          </p>
          {(selectedCategory || searchQuery) && (
            <div className="pt-2">
              <button
                id="reset-empty-filters-btn"
                type="button"
                onClick={onClearFilters}
                className="px-4 py-2 bg-[#F1F1EB] hover:bg-[#E8E8E1] text-[#1A1A1A] text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer border border-[#D1D1CB]"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Article Feed List */}
      {!isLoading && !error && followedProviderCount > 0 && articles.length > 0 && (
        <div id="articles-list" className="space-y-3.5">
          {articles.map((article, index) => (
            <ArticleItem key={article.id} article={article} index={index} />
          ))}
        </div>
      )}
    </div>
  );
};

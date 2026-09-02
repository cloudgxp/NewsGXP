import React, { useState, useMemo } from 'react';
import { NewsProvider } from '../types';
import { Search, Check, Plus, ExternalLink, Globe, Rss } from 'lucide-react';

interface ProvidersViewProps {
  allProviders: NewsProvider[];
  followedProviderIds: string[];
  onToggleFollow: (providerId: string) => void;
  onNavigateToFeed: () => void;
}

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  allProviders,
  followedProviderIds,
  onToggleFollow,
  onNavigateToFeed,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [failedFavicons, setFailedFavicons] = useState<Record<string, boolean>>({});

  const handleImageError = (providerId: string) => {
    setFailedFavicons((prev) => ({ ...prev, [providerId]: true }));
  };

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allProviders;
    return allProviders.filter((p) => {
      const inName = p.name.toLowerCase().includes(q);
      const inDesc = p.description?.toLowerCase().includes(q) ?? false;
      const inCat = p.categories?.some((c) => c.toLowerCase().includes(q)) ?? false;
      return inName || inDesc || inCat;
    });
  }, [allProviders, searchQuery]);

  return (
    <div id="newsgxp-providers-view" className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Page Header */}
      <div className="bg-white border border-[#D1D1CB] p-6 sm:p-8 rounded-sm shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] font-mono-accent block mb-1">
              Source Directory
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A1A1A]">
              Providers
            </h1>
          </div>

          <button
            id="back-to-feed-btn"
            type="button"
            onClick={onNavigateToFeed}
            className="text-xs font-bold uppercase tracking-wider text-[#F47521] hover:underline font-mono-accent cursor-pointer"
          >
            ← Return to Feed
          </button>
        </div>

        <p className="text-sm sm:text-base text-[#666660] leading-relaxed max-w-2xl font-sans">
          Providers determine which sources appear in your NewsGXP feed. Follow the publishers,
          studios, and outlets you want to see stories from.
        </p>

        {/* Search Bar */}
        <div className="pt-2">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-[#888880] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="provider-search-input"
              type="text"
              placeholder="Search providers by name or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm text-[#1A1A1A] placeholder-[#888880] focus:outline-hidden focus:border-[#1A1A1A] transition-colors font-mono-accent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#888880] hover:text-[#1A1A1A] font-mono-accent cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Provider List Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-mono-accent text-[#888880] px-1">
          <span className="uppercase tracking-wider font-bold text-[10px] text-[#A1A19A]">
            Available Providers ({filteredProviders.length})
          </span>
          <span>
            {followedProviderIds.length} of {allProviders.length} Following
          </span>
        </div>

        {filteredProviders.length === 0 ? (
          <div className="bg-white border border-[#D1D1CB] p-8 text-center rounded-sm space-y-2">
            <p className="text-sm text-[#666660]">
              No providers match your search query &ldquo;{searchQuery}&rdquo;.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold uppercase tracking-wider text-[#F47521] hover:underline font-mono-accent cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProviders.map((provider) => {
              const isFollowed = followedProviderIds.includes(provider.id);
              const hasFailed = failedFavicons[provider.id];
              const iconUrl =
                provider.icon ||
                `https://www.google.com/s2/favicons?domain=${new URL(provider.homepage).hostname}&sz=64`;

              return (
                <div
                  key={provider.id}
                  id={`provider-card-${provider.id}`}
                  className="bg-white border border-[#D1D1CB] p-5 sm:p-6 rounded-sm shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-colors hover:border-[#A1A19A]"
                >
                  {/* Left: Icon, Name, Homepage, Description, Categories */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-full border border-[#D1D1CB] bg-[#F7F7F2] shrink-0 flex items-center justify-center p-2 mt-0.5">
                      {!hasFailed ? (
                        <img
                          src={iconUrl}
                          alt={provider.name}
                          onError={() => handleImageError(provider.id)}
                          className="w-6 h-6 object-contain rounded-full"
                        />
                      ) : (
                        <Globe className="w-5 h-5 text-[#888880]" />
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-[#1A1A1A] font-editorial leading-tight">
                          {provider.name}
                        </h2>
                        <a
                          href={provider.homepage}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#888880] hover:text-[#F47521] hover:underline font-mono-accent"
                          title="Visit homepage"
                        >
                          <span className="truncate max-w-[160px]">
                            {new URL(provider.homepage).hostname}
                          </span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>

                      {provider.description && (
                        <p className="text-xs sm:text-sm text-[#666660] leading-relaxed">
                          {provider.description}
                        </p>
                      )}

                      {/* Categories */}
                      {provider.categories && provider.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {provider.categories.map((category) => (
                            <span
                              key={category}
                              className="text-[10px] uppercase tracking-wider font-mono-accent px-1.5 py-0.5 bg-[#F1F1EB] text-[#666660] border border-[#E8E8E1] rounded-xs"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Follow / Following Action */}
                  <div className="shrink-0 self-end sm:self-center">
                    <button
                      id={`toggle-follow-btn-${provider.id}`}
                      type="button"
                      onClick={() => onToggleFollow(provider.id)}
                      className={`px-4 py-2 rounded-sm text-xs font-mono-accent uppercase tracking-wider font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                        isFollowed
                          ? 'bg-[#F1F1EB] hover:bg-[#E8E8E1] text-[#1A1A1A] border border-[#D1D1CB]'
                          : 'bg-[#1A1A1A] hover:bg-[#333238] text-[#F7F7F2] shadow-2xs'
                      }`}
                      aria-pressed={isFollowed}
                    >
                      {isFollowed ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-[#F47521]" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* User guidance note */}
      <div className="p-4 bg-[#E8E8E1] border border-[#D1D1CB] rounded-sm text-[11px] text-[#666660] leading-relaxed font-mono-accent">
        <strong className="text-[#1A1A1A] block uppercase font-bold mb-0.5">
          Followed Sources
        </strong>
        Followed providers appear in your top Sources bar. Stories from followed providers are
        chronologically assembled in your Latest News feed.
      </div>
    </div>
  );
};

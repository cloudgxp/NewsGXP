import React, { useState, useMemo } from 'react';
import { NewsProvider } from '../types';
import {
  Search,
  Check,
  Plus,
  ExternalLink,
  Globe,
  Sparkles,
  Cpu,
  Gamepad2,
  Tv,
  Layers,
  CheckCheck,
} from 'lucide-react';

interface ProvidersViewProps {
  allProviders: NewsProvider[];
  followedProviderIds: string[];
  onToggleFollow: (providerId: string) => void;
  onToggleFollowTopic: (topic: string, shouldFollow: boolean) => void;
  onNavigateToFeed: () => void;
}

const TOPIC_ORDER = ['AI', 'Technology', 'Gaming', 'Anime'];

const getTopicIcon = (topic: string) => {
  switch (topic.toLowerCase()) {
    case 'ai':
      return <Sparkles className="w-4 h-4 text-[#F47521]" />;
    case 'technology':
      return <Cpu className="w-4 h-4 text-[#3B82F6]" />;
    case 'gaming':
      return <Gamepad2 className="w-4 h-4 text-[#8B5CF6]" />;
    case 'anime':
      return <Tv className="w-4 h-4 text-[#EC4899]" />;
    default:
      return <Layers className="w-4 h-4 text-[#888880]" />;
  }
};

export const ProvidersView: React.FC<ProvidersViewProps> = ({
  allProviders,
  followedProviderIds,
  onToggleFollow,
  onToggleFollowTopic,
  onNavigateToFeed,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);
  const [failedFavicons, setFailedFavicons] = useState<Record<string, boolean>>({});

  const handleImageError = (providerId: string) => {
    setFailedFavicons((prev) => ({ ...prev, [providerId]: true }));
  };

  // Canonical list of topics
  const allTopics = useMemo(() => {
    const discovered: string[] = Array.from(new Set(allProviders.map((p) => p.topic)));
    return [
      ...TOPIC_ORDER.filter((t) => discovered.includes(t)),
      ...discovered.filter((t) => !TOPIC_ORDER.includes(t)),
    ];
  }, [allProviders]);

  // Grouped providers and search filtering
  const topicGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allTopics
      .filter((topic) => !selectedTopicFilter || topic.toLowerCase() === selectedTopicFilter.toLowerCase())
      .map((topic) => {
        const topicProviders = allProviders.filter(
          (p) => p.topic.toLowerCase() === topic.toLowerCase()
        );

        const matchedProviders = topicProviders.filter((p) => {
          if (!q) return true;
          const inName = p.name.toLowerCase().includes(q);
          const inDesc = p.description?.toLowerCase().includes(q) ?? false;
          const inTopic = p.topic.toLowerCase().includes(q);
          const inCat = p.categories?.some((c) => c.toLowerCase().includes(q)) ?? false;
          return inName || inDesc || inTopic || inCat;
        });

        const followedCount = topicProviders.filter((p) =>
          followedProviderIds.includes(p.id)
        ).length;

        const isAllFollowed =
          topicProviders.length > 0 && followedCount === topicProviders.length;
        const isPartiallyFollowed = followedCount > 0 && !isAllFollowed;

        return {
          topic,
          topicProviders,
          matchedProviders,
          followedCount,
          isAllFollowed,
          isPartiallyFollowed,
        };
      })
      .filter((group) => group.matchedProviders.length > 0 || !searchQuery);
  }, [allProviders, allTopics, followedProviderIds, searchQuery, selectedTopicFilter]);

  const totalMatchingProviders = useMemo(() => {
    return topicGroups.reduce((acc, g) => acc + g.matchedProviders.length, 0);
  }, [topicGroups]);

  return (
    <div id="newsgxp-providers-view" className="space-y-6 max-w-4xl mx-auto py-2">
      {/* Page Header */}
      <div className="bg-white border border-[#D1D1CB] p-6 sm:p-8 rounded-sm shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] font-mono-accent block mb-1">
              Source Directory
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#1A1A1A]">
              Providers &amp; Topics
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
          Organize your news feed by topic or publisher. Subscribe to an entire topic (such as all AI
          or Gaming sources), or follow individual outlets based on your personal interests.
        </p>

        {/* Search Bar & Topic Filter Bar */}
        <div className="pt-2 space-y-3">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 text-[#888880] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="provider-search-input"
              type="text"
              placeholder="Search providers by name, topic, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm text-[#1A1A1A] placeholder-[#888880] focus:outline-hidden focus:border-[#1A1A1A] transition-colors font-mono-accent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#888880] hover:text-[#1A1A1A] font-mono-accent cursor-pointer"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Topic Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <button
              id="topic-filter-all"
              type="button"
              onClick={() => setSelectedTopicFilter(null)}
              className={`px-2.5 py-1 rounded-sm text-[11px] font-mono-accent uppercase tracking-wider font-bold transition-all cursor-pointer border ${
                selectedTopicFilter === null
                  ? 'bg-[#1A1A1A] text-[#F7F7F2] border-[#1A1A1A] shadow-2xs'
                  : 'bg-[#F7F7F2] text-[#666660] border-[#D1D1CB] hover:border-[#A1A19A] hover:text-[#1A1A1A]'
              }`}
            >
              All Topics ({allProviders.length})
            </button>

            {allTopics.map((topic) => {
              const count = allProviders.filter((p) => p.topic.toLowerCase() === topic.toLowerCase()).length;
              const isSelected = selectedTopicFilter?.toLowerCase() === topic.toLowerCase();
              return (
                <button
                  key={topic}
                  id={`topic-filter-${topic.toLowerCase()}`}
                  type="button"
                  onClick={() => setSelectedTopicFilter(isSelected ? null : topic)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-mono-accent uppercase tracking-wider font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#1A1A1A] text-[#F7F7F2] border-[#1A1A1A] shadow-2xs'
                      : 'bg-[#F7F7F2] text-[#666660] border-[#D1D1CB] hover:border-[#A1A19A] hover:text-[#1A1A1A]'
                  }`}
                >
                  {getTopicIcon(topic)}
                  <span>{topic}</span>
                  <span className="text-[10px] opacity-75">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Directory Status Subheader */}
      <div className="flex items-center justify-between text-xs font-mono-accent text-[#888880] px-1">
        <span className="uppercase tracking-wider font-bold text-[10px] text-[#A1A19A]">
          {selectedTopicFilter ? `${selectedTopicFilter} Topic` : 'All Topics'} (
          {totalMatchingProviders} {totalMatchingProviders === 1 ? 'provider' : 'providers'})
        </span>
        <span>
          {followedProviderIds.length} of {allProviders.length} Following
        </span>
      </div>

      {/* Empty State */}
      {topicGroups.length === 0 || totalMatchingProviders === 0 ? (
        <div className="bg-white border border-[#D1D1CB] p-8 text-center rounded-sm space-y-2">
          <p className="text-sm text-[#666660]">
            No providers match your search query &ldquo;{searchQuery}&rdquo;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedTopicFilter(null);
            }}
            className="text-xs font-bold uppercase tracking-wider text-[#F47521] hover:underline font-mono-accent cursor-pointer"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        /* Topic Groups */
        <div className="space-y-6">
          {topicGroups.map((group) => {
            const {
              topic,
              topicProviders,
              matchedProviders,
              followedCount,
              isAllFollowed,
              isPartiallyFollowed,
            } = group;

            if (matchedProviders.length === 0) return null;

            return (
              <section
                key={topic}
                id={`topic-section-${topic.toLowerCase()}`}
                className="bg-white border border-[#D1D1CB] rounded-sm shadow-xs overflow-hidden"
              >
                {/* Topic Group Header Bar */}
                <div className="bg-[#F7F7F2] border-b border-[#D1D1CB] px-5 py-3.5 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-[#D1D1CB] flex items-center justify-center shrink-0">
                      {getTopicIcon(topic)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-bold font-editorial text-[#1A1A1A]">
                          {topic}
                        </h2>
                        {isAllFollowed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold font-mono-accent px-1.5 py-0.5 rounded-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
                            <Check className="w-2.5 h-2.5" />
                            Subscribed
                          </span>
                        ) : isPartiallyFollowed ? (
                          <span className="text-[10px] uppercase font-bold font-mono-accent px-1.5 py-0.5 rounded-xs bg-amber-100 text-amber-800 border border-amber-300">
                            {followedCount} of {topicProviders.length} Following
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold font-mono-accent px-1.5 py-0.5 rounded-xs bg-[#E8E8E1] text-[#666660]">
                            {topicProviders.length} {topicProviders.length === 1 ? 'provider' : 'providers'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#888880] font-sans">
                        {topic === 'AI' && 'Frontier models, AI tooling, and research updates'}
                        {topic === 'Technology' && 'Cloud, enterprise platforms, developer ecosystems, and hardware'}
                        {topic === 'Gaming' && 'First-party studio releases, game updates, and console platforms'}
                        {topic === 'Anime' && 'Streaming announcements, manga industry, and series releases'}
                      </span>
                    </div>
                  </div>

                  {/* Topic-Level Subscribe / Unsubscribe Button */}
                  <div className="shrink-0 self-end sm:self-center">
                    <button
                      id={`topic-follow-btn-${topic.toLowerCase()}`}
                      type="button"
                      onClick={() => onToggleFollowTopic(topic, !isAllFollowed)}
                      className={`px-3.5 py-1.5 rounded-sm text-xs font-mono-accent uppercase tracking-wider font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                        isAllFollowed
                          ? 'bg-white hover:bg-[#F1F1EB] text-[#1A1A1A] border border-[#D1D1CB]'
                          : 'bg-[#1A1A1A] hover:bg-[#333238] text-[#F7F7F2] shadow-2xs'
                      }`}
                      title={
                        isAllFollowed
                          ? `Unsubscribe from all ${topic} providers`
                          : `Subscribe to all ${topicProviders.length} providers in ${topic}`
                      }
                    >
                      {isAllFollowed ? (
                        <>
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Following Topic</span>
                        </>
                      ) : isPartiallyFollowed ? (
                        <>
                          <Plus className="w-3.5 h-3.5 text-[#F47521]" />
                          <span>Follow All in Topic</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 text-[#F47521]" />
                          <span>Follow Topic</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Individual Providers in this Topic */}
                <div className="divide-y divide-[#E8E8E1]">
                  {matchedProviders.map((provider) => {
                    const isFollowed = followedProviderIds.includes(provider.id);
                    const hasFailed = failedFavicons[provider.id];
                    const iconUrl =
                      provider.icon ||
                      `https://www.google.com/s2/favicons?domain=${new URL(provider.homepage).hostname}&sz=64`;

                    return (
                      <div
                        key={provider.id}
                        id={`provider-card-${provider.id}`}
                        className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 transition-colors hover:bg-[#FDFDFB]"
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
                              <h3 className="text-lg font-bold text-[#1A1A1A] font-editorial leading-tight">
                                {provider.name}
                              </h3>
                              <a
                                href={provider.homepage}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-[#888880] hover:text-[#F47521] hover:underline font-mono-accent"
                                title="Visit homepage"
                              >
                                <span className="truncate max-w-[180px]">
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

                            {/* Category chips */}
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

                        {/* Right: Individual Follow / Following Toggle Button */}
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
              </section>
            );
          })}
        </div>
      )}

      {/* User guidance note */}
      <div className="p-4 bg-[#E8E8E1] border border-[#D1D1CB] rounded-sm text-[11px] text-[#666660] leading-relaxed font-mono-accent">
        <strong className="text-[#1A1A1A] block uppercase font-bold mb-0.5">
          Custom Feed Curation
        </strong>
        Subscribe to whole topics or select individual publishers within each topic. Stories from all
        followed sources are chronologically combined in your Latest News feed.
      </div>
    </div>
  );
};

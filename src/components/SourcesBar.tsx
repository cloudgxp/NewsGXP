import React, { useState } from 'react';
import { NewsProvider } from '../types';
import { SlidersHorizontal, Plus, Globe } from 'lucide-react';

interface SourcesBarProps {
  followedProviders: NewsProvider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string | null) => void;
  onManageProviders: () => void;
}

export const SourcesBar: React.FC<SourcesBarProps> = ({
  followedProviders,
  selectedProviderId,
  onSelectProvider,
  onManageProviders,
}) => {
  const [failedFavicons, setFailedFavicons] = useState<Record<string, boolean>>({});

  const handleImageError = (providerId: string) => {
    setFailedFavicons((prev) => ({ ...prev, [providerId]: true }));
  };

  return (
    <div
      id="newsgxp-sources-bar"
      className="bg-[#F1F1EB] border-b border-[#D1D1CB] py-2.5 px-4 sm:px-6 sticky top-[57px] z-20 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left / Scrollable Section: Label + Providers */}
        <div className="flex items-center gap-3 min-w-0 overflow-x-auto no-scrollbar py-0.5">
          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A1A19A] select-none font-mono-accent">
              Sources
            </span>
          </div>

          {/* All Sources Pill */}
          <button
            id="source-filter-all"
            type="button"
            onClick={() => onSelectProvider(null)}
            className={`shrink-0 px-2.5 py-1 rounded-sm text-xs font-mono-accent uppercase tracking-wider font-bold transition-all cursor-pointer border ${
              selectedProviderId === null
                ? 'bg-[#1A1A1A] text-[#F7F7F2] border-[#1A1A1A] shadow-2xs'
                : 'bg-white text-[#666660] border-[#D1D1CB] hover:border-[#A1A19A] hover:text-[#1A1A1A]'
            }`}
            title="Show articles from all followed sources"
            aria-label="All Sources"
          >
            All
          </button>

          {/* Followed Provider Favicon Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {followedProviders.map((provider) => {
              const isSelected = selectedProviderId === provider.id;
              const hasFailed = failedFavicons[provider.id];
              const iconUrl =
                provider.icon ||
                `https://www.google.com/s2/favicons?domain=${new URL(provider.homepage).hostname}&sz=64`;

              return (
                <button
                  key={provider.id}
                  id={`source-btn-${provider.id}`}
                  type="button"
                  onClick={() => onSelectProvider(provider.id)}
                  title={provider.name}
                  aria-label={`Filter by ${provider.name}`}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center p-1 transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'border-2 border-[#F47521] ring-2 ring-[#F47521]/25 bg-white scale-105'
                      : 'border border-[#D1D1CB] bg-white opacity-85 hover:opacity-100 hover:border-[#A1A19A] hover:scale-105'
                  }`}
                >
                  {!hasFailed ? (
                    <img
                      src={iconUrl}
                      alt={provider.name}
                      onError={() => handleImageError(provider.id)}
                      className="w-4 h-4 sm:w-4.5 sm:h-4.5 object-contain rounded-full pointer-events-none"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-[#1A1A1A] font-mono-accent">
                      {provider.name.charAt(0)}
                    </span>
                  )}

                  {/* Accessible Hover Tooltip */}
                  <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-[#1A1A1A] text-[#F7F7F2] text-[10px] font-mono-accent uppercase tracking-wider px-2 py-0.5 rounded-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30 shadow-md">
                    {provider.name}
                  </span>
                </button>
              );
            })}

            {followedProviders.length === 0 && (
              <span className="text-xs text-[#888880] italic px-1 font-editorial">
                No sources followed
              </span>
            )}
          </div>
        </div>

        {/* Right Section: Manage Providers Link */}
        <div className="shrink-0 pl-2">
          <button
            id="manage-providers-shortcut-btn"
            type="button"
            onClick={onManageProviders}
            className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#F47521] hover:text-[#df5a00] hover:underline transition-colors cursor-pointer py-1 font-mono-accent"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Manage Providers</span>
            <span className="sm:hidden">Manage</span>
          </button>
        </div>
      </div>
    </div>
  );
};

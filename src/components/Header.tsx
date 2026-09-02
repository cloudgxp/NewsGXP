import React from 'react';
import { RefreshCw, Info, Newspaper, Radio } from 'lucide-react';
import { formatRelativeTime } from '../utils/text';

interface HeaderProps {
  activeTab: 'latest' | 'providers' | 'about';
  onSelectTab: (tab: 'latest' | 'providers' | 'about') => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  articleCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onRefresh,
  isRefreshing,
  lastUpdated,
  articleCount,
}) => {
  return (
    <header
      id="newsgxp-header"
      className="bg-white border-b border-[#D1D1CB] sticky top-0 z-30"
    >
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Branding */}
        <div className="flex items-baseline gap-4">
          <button
            id="brand-home-button"
            onClick={() => onSelectTab('latest')}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-hidden"
          >
            <span className="font-mono-accent text-xs bg-[#1A1A1A] text-[#F7F7F2] px-1.5 py-0.5 font-bold tracking-wider rounded-sm">
              GXP
            </span>
            <h1 className="text-2xl font-black tracking-tighter text-[#1A1A1A] group-hover:text-[#F47521] transition-colors">
              NewsGXP
            </h1>
          </button>
          <span className="text-xs font-medium uppercase tracking-widest text-[#888880] border-l border-[#D1D1CB] pl-4 hidden md:inline">
            Your news. Your providers.
          </span>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-4 sm:gap-5 text-sm font-bold uppercase tracking-tight">
          {/* Navigation Links */}
          <nav className="flex items-center gap-4 sm:gap-6">
            <button
              id="nav-latest-btn"
              onClick={() => onSelectTab('latest')}
              className={`pb-1 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
                activeTab === 'latest'
                  ? 'text-[#F47521] border-[#F47521]'
                  : 'text-[#888880] border-transparent hover:text-[#2D2D2D]'
              }`}
            >
              <Newspaper className="w-4 h-4" />
              <span>Latest</span>
              {articleCount > 0 && activeTab === 'latest' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-sm font-mono-accent bg-[#F47521]/15 text-[#F47521]">
                  {articleCount}
                </span>
              )}
            </button>

            <button
              id="nav-providers-btn"
              onClick={() => onSelectTab('providers')}
              className={`pb-1 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
                activeTab === 'providers'
                  ? 'text-[#F47521] border-[#F47521]'
                  : 'text-[#888880] border-transparent hover:text-[#2D2D2D]'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Providers</span>
            </button>

            <button
              id="nav-about-btn"
              onClick={() => onSelectTab('about')}
              className={`pb-1 transition-colors cursor-pointer flex items-center gap-1.5 border-b-2 ${
                activeTab === 'about'
                  ? 'text-[#F47521] border-[#F47521]'
                  : 'text-[#888880] border-transparent hover:text-[#2D2D2D]'
              }`}
            >
              <Info className="w-4 h-4" />
              <span>About</span>
            </button>
          </nav>

          {/* Refresh Action & Status */}
          <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-[#D1D1CB]">
            <button
              id="refresh-feed-btn"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Fetch fresh feed from followed sources"
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-[#F1F1EB] active:bg-[#E8E8E1] border border-[#D1D1CB] text-[#1A1A1A] rounded-sm text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#F47521] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {lastUpdated && (
              <span className="text-[10px] text-[#A1A19A] font-bold uppercase tracking-tighter hidden lg:inline">
                Synced {formatRelativeTime(lastUpdated.toISOString())}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

import React, { useState, useMemo } from 'react';
import { JobPosting } from '../types';
import { TRACKED_COMPANIES, COMPANY_BY_ID } from '../config/companies';
import { fetchWeeklyDigest } from '../services/jobsService';
import { formatDate } from '../utils/text';
import {
  Briefcase,
  Search,
  ChevronDown,
  Bookmark,
  ExternalLink,
  Copy,
  Check,
  MapPin,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Building2,
} from 'lucide-react';

export type JobsFilterTab = 'all' | 'new_week' | 'saved';

const JOB_CATEGORIES = [
  'ML & Research',
  'Applied AI & Agents',
  'AI Infrastructure',
  'AI Product & Solutions',
  'AI Security & Safety',
  'Engineering (AI Co.)',
];

const JOB_REGIONS = ['US', 'Global', 'EMEA', 'Americas', 'APAC', 'Other'];

interface JobsViewProps {
  jobs: JobPosting[];
  companyCounts: Record<string, number>;
  newThisWeekCount: number;
  isLoading: boolean;
  error: string | null;
  needsInitialSync: boolean;
  savedJobIds: Set<string>;
  savedJobsList: JobPosting[];
  onToggleSaveJob: (job: JobPosting) => void;
  onRetry: () => void;
}

function isDiscoveredWithin7Days(isoDate: string): boolean {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 7 * 24 * 60 * 60 * 1000;
}

function formatJobsAsMarkdown(jobs: JobPosting[], heading: string): string {
  const lines = [`## ${heading}`, ''];
  if (jobs.length === 0) {
    lines.push('_No matching remote AI roles._');
  } else {
    for (const job of jobs) {
      const meta = [job.aiCategory, job.region, job.salaryRange].filter(Boolean).join(' • ');
      lines.push(`- **${job.companyName}** — [${job.title}](${job.url}) (${meta})`);
      if (job.aiSummary) {
        lines.push(`  - ${job.aiSummary}`);
      }
    }
  }
  return lines.join('\n');
}

export const JobsView: React.FC<JobsViewProps> = ({
  jobs,
  companyCounts,
  newThisWeekCount,
  isLoading,
  error,
  needsInitialSync,
  savedJobIds,
  savedJobsList,
  onToggleSaveJob,
  onRetry,
}) => {
  const [filterTab, setFilterTab] = useState<JobsFilterTab>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCompanies, setShowCompanies] = useState<boolean>(false);
  const [copiedState, setCopiedState] = useState<'idle' | 'copied'>('idle');

  const sourceList = useMemo<JobPosting[]>(() => {
    if (filterTab === 'saved') {
      return [...savedJobsList].sort(
        (a, b) => new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime()
      );
    }
    return jobs;
  }, [filterTab, jobs, savedJobsList]);

  const filteredJobs = useMemo<JobPosting[]>(() => {
    const q = searchQuery.trim().toLowerCase();

    return sourceList.filter((job) => {
      if (filterTab === 'new_week' && !isDiscoveredWithin7Days(job.firstSeenAt)) {
        return false;
      }
      if (selectedCompany && job.companyId !== selectedCompany) {
        return false;
      }
      if (selectedCategory && job.aiCategory !== selectedCategory) {
        return false;
      }
      if (selectedRegion && job.region !== selectedRegion) {
        return false;
      }
      if (q) {
        const hay = [
          job.title,
          job.companyName,
          job.department || '',
          job.locationRaw,
          job.aiSummary || '',
          job.descriptionSnippet || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sourceList, filterTab, selectedCompany, selectedCategory, selectedRegion, searchQuery]);

  const handleCopyWeeklySegment = async () => {
    try {
      let markdown = '';
      if (filterTab === 'saved') {
        markdown = formatJobsAsMarkdown(filteredJobs, 'Saved Remote AI Roles');
      } else {
        try {
          const digest = await fetchWeeklyDigest();
          markdown = digest.markdown;
        } catch {
          markdown = formatJobsAsMarkdown(
            filteredJobs.slice(0, 30),
            'New Remote AI Jobs This Week'
          );
        }
      }
      await navigator.clipboard.writeText(markdown);
      setCopiedState('copied');
      setTimeout(() => setCopiedState('idle'), 2200);
    } catch (err) {
      console.warn('[JobsView] Failed to copy weekly segment:', err);
    }
  };

  const hasActiveFilters =
    Boolean(selectedCompany) ||
    Boolean(selectedCategory) ||
    Boolean(selectedRegion) ||
    Boolean(searchQuery.trim()) ||
    filterTab !== 'all';

  const clearFilters = () => {
    setFilterTab('all');
    setSelectedCompany('');
    setSelectedCategory('');
    setSelectedRegion('');
    setSearchQuery('');
  };

  return (
    <div id="newsgxp-jobs-view" className="space-y-4">
      {/* Jobs Toolbar */}
      <div className="bg-white border border-[#D1D1CB] p-4 sm:p-5 rounded-sm shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1A1A1A]">
                Remote AI Jobs
              </h1>
              {!isLoading && !error && (
                <span className="text-[11px] font-mono-accent text-[#888880] uppercase tracking-wider">
                  • {filteredJobs.length} {filteredJobs.length === 1 ? 'role' : 'roles'} across{' '}
                  {TRACKED_COMPANIES.length} direct career pages
                </span>
              )}
            </div>
            <p className="text-xs text-[#666660] mt-0.5">
              Direct company career portals only — no third-party aggregators. Synced nightly at 8:00
              PM EST.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="toggle-tracked-companies-btn"
              type="button"
              onClick={() => setShowCompanies((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F7F2] hover:bg-[#F1F1EB] border border-[#D1D1CB] text-[#1A1A1A] rounded-sm text-xs font-mono-accent font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-[#F47521]" />
              <span>{showCompanies ? 'Hide Companies' : `Companies (${TRACKED_COMPANIES.length})`}</span>
            </button>

            <button
              id="copy-weekly-segment-btn"
              type="button"
              onClick={handleCopyWeeklySegment}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#333238] text-[#F7F7F2] rounded-sm text-xs font-mono-accent font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-2xs"
              title="Copy Markdown summary for weekly YouTube or LinkedIn segment"
            >
              {copiedState === 'copied' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied Markdown!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#F47521]" />
                  <span>Copy Weekly Segment</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Direct Company Career Pages Drawer */}
        {showCompanies && (
          <div
            id="tracked-companies-drawer"
            className="p-3 bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm space-y-2"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#888880] font-mono-accent">
              Official Career Pages Monitored Directly
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {TRACKED_COMPANIES.map((company) => {
                const count = companyCounts[company.id] || 0;
                const isSelected = selectedCompany === company.id;
                return (
                  <div
                    key={company.id}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm border text-xs transition-colors ${
                      isSelected
                        ? 'bg-white border-[#F47521]'
                        : 'bg-white border-[#D1D1CB] hover:border-[#A1A19A]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCompany(isSelected ? '' : company.id)
                      }
                      className="flex items-center gap-1.5 min-w-0 text-left cursor-pointer"
                    >
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${company.domain}&sz=32`}
                        alt=""
                        className="w-3.5 h-3.5 rounded-xs shrink-0"
                      />
                      <span className="font-bold text-[#1A1A1A] truncate">{company.name}</span>
                      <span className="text-[10px] font-mono-accent text-[#888880]">({count})</span>
                    </button>
                    <a
                      href={company.careersUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#888880] hover:text-[#F47521] shrink-0"
                      title={`Open ${company.name} official career page`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[#F1F1EB]">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#888880] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="jobs-search-input"
              type="text"
              placeholder="Search role, company, skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm text-[#1A1A1A] placeholder-[#888880] focus:outline-hidden focus:border-[#1A1A1A] font-mono-accent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#888880] hover:text-[#1A1A1A] cursor-pointer"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Company Dropdown */}
          <div className="relative">
            <select
              id="jobs-company-select"
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full appearance-none bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm text-xs font-mono-accent text-[#1A1A1A] py-1.5 pl-3 pr-8 focus:outline-hidden focus:border-[#1A1A1A] cursor-pointer"
            >
              <option value="">All Companies ({TRACKED_COMPANIES.length})</option>
              {TRACKED_COMPANIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({companyCounts[c.id] || 0})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#888880] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* AI Role Category Dropdown */}
          <div className="relative">
            <select
              id="jobs-category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm text-xs font-mono-accent text-[#1A1A1A] py-1.5 pl-3 pr-8 focus:outline-hidden focus:border-[#1A1A1A] cursor-pointer"
            >
              <option value="">All AI Tracks</option>
              {JOB_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#888880] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Region Dropdown */}
          <div className="relative">
            <select
              id="jobs-region-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full appearance-none bg-[#F7F7F2] border border-[#D1D1CB] rounded-sm text-xs font-mono-accent text-[#1A1A1A] py-1.5 pl-3 pr-8 focus:outline-hidden focus:border-[#1A1A1A] cursor-pointer"
            >
              <option value="">All Regions</option>
              {JOB_REGIONS.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#888880] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Quick Segment Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#F1F1EB]">
          <button
            id="jobs-tab-all"
            type="button"
            onClick={() => setFilterTab('all')}
            className={`px-2.5 py-1 rounded-sm text-[11px] font-mono-accent uppercase tracking-wider font-bold transition-all cursor-pointer border ${
              filterTab === 'all'
                ? 'bg-[#1A1A1A] text-[#F7F7F2] border-[#1A1A1A]'
                : 'bg-[#F7F7F2] text-[#666660] border-[#D1D1CB] hover:border-[#A1A19A] hover:text-[#1A1A1A]'
            }`}
          >
            All Active ({jobs.length})
          </button>

          <button
            id="jobs-tab-new-week"
            type="button"
            onClick={() => setFilterTab('new_week')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-mono-accent uppercase tracking-wider font-bold transition-all cursor-pointer border ${
              filterTab === 'new_week'
                ? 'bg-[#1A1A1A] text-[#F7F7F2] border-[#1A1A1A]'
                : 'bg-[#F7F7F2] text-[#666660] border-[#D1D1CB] hover:border-[#A1A19A] hover:text-[#1A1A1A]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-[#F47521]" />
            <span>New This Week ({newThisWeekCount})</span>
          </button>

          <button
            id="jobs-tab-saved"
            type="button"
            onClick={() => setFilterTab('saved')}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-mono-accent uppercase tracking-wider font-bold transition-all cursor-pointer border ${
              filterTab === 'saved'
                ? 'bg-[#1A1A1A] text-[#F7F7F2] border-[#1A1A1A]'
                : 'bg-[#F7F7F2] text-[#666660] border-[#D1D1CB] hover:border-[#A1A19A] hover:text-[#1A1A1A]'
            }`}
          >
            <Bookmark className="w-3 h-3 text-[#F47521]" />
            <span>Saved ({savedJobIds.size})</span>
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11px] text-[#F47521] hover:underline font-bold uppercase tracking-wider ml-auto font-mono-accent cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div id="jobs-loading-state" className="space-y-3">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-[#D1D1CB] p-5 rounded-sm animate-pulse space-y-2.5 shadow-xs"
            >
              <div className="h-4 bg-[#E8E8E1] rounded-xs w-1/3"></div>
              <div className="h-5 bg-[#E8E8E1] rounded-xs w-3/4"></div>
              <div className="h-3 bg-[#F1F1EB] rounded-xs w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div
          id="jobs-error-state"
          className="bg-white border border-[#D1D1CB] rounded-sm p-8 text-center space-y-3 shadow-xs"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#fae8e6] text-[#c53929]">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold font-editorial text-[#1A1A1A]">
            Remote AI Jobs Temporarily Unavailable
          </h3>
          <p className="text-xs sm:text-sm text-[#666660] max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A1A1A] hover:bg-[#333238] text-[#F7F7F2] text-xs font-bold uppercase tracking-wider rounded-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredJobs.length === 0 && (
        <div
          id="jobs-empty-state"
          className="bg-white border border-[#D1D1CB] rounded-sm p-8 text-center space-y-3 shadow-xs"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#F1F1EB] text-[#666660]">
            <Briefcase className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold font-editorial text-[#1A1A1A]">
            {needsInitialSync
              ? 'Initial Career Sync Pending'
              : filterTab === 'saved'
                ? 'No Saved Roles Yet'
                : 'No Matching Remote AI Roles'}
          </h3>
          <p className="text-xs sm:text-sm text-[#666660] max-w-md mx-auto leading-relaxed">
            {needsInitialSync
              ? 'The nightly career-page sync populates this board at 8:00 PM EST (or when /api/sync runs).'
              : filterTab === 'saved'
                ? 'Click Save on any job below to highlight it for applications or your weekly YouTube/LinkedIn segment.'
                : 'Try adjusting your company, AI track, region, or keyword filter.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-4 py-2 bg-[#F1F1EB] hover:bg-[#E8E8E1] text-[#1A1A1A] text-xs font-bold uppercase tracking-wider rounded-sm border border-[#D1D1CB] cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Jobs List */}
      {!isLoading && !error && filteredJobs.length > 0 && (
        <div id="jobs-list" className="space-y-3">
          {filteredJobs.map((job) => {
            const companyMeta = COMPANY_BY_ID[job.companyId];
            const isNew = isDiscoveredWithin7Days(job.firstSeenAt);
            const isSaved = savedJobIds.has(job.id);
            const snippet = job.aiSummary || job.descriptionSnippet;

            return (
              <article
                key={job.id}
                id={`job-item-${job.id}`}
                className="bg-white border border-[#D1D1CB] hover:border-[#A1A19A] p-4 sm:p-5 rounded-sm transition-colors shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* Company Icon */}
                    <div className="w-10 h-10 rounded-sm border border-[#D1D1CB] bg-[#F7F7F2] shrink-0 flex items-center justify-center p-1.5 mt-0.5">
                      {companyMeta ? (
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${companyMeta.domain}&sz=64`}
                          alt={job.companyName}
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Building2 className="w-4 h-4 text-[#888880]" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black bg-[#F47521] text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono-accent">
                          {job.aiCategory}
                        </span>
                        {isNew && (
                          <span className="text-[10px] font-bold bg-[#1A1A1A] text-[#F7F7F2] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono-accent">
                            New This Week
                          </span>
                        )}
                        <span className="text-[10px] font-bold bg-[#F1F1EB] text-[#1A1A1A] border border-[#D1D1CB] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono-accent">
                          Remote • {job.region}
                        </span>
                        {job.salaryRange && (
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-sm font-mono-accent">
                            {job.salaryRange}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold leading-snug text-[#1A1A1A] font-editorial">
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[#F47521] hover:underline transition-colors"
                        >
                          {job.title}
                        </a>
                      </h3>

                      <div className="flex items-center gap-2 text-xs font-mono-accent text-[#666660] flex-wrap">
                        <span className="font-bold text-[#1A1A1A]">{job.companyName}</span>
                        {job.department && (
                          <>
                            <span>•</span>
                            <span>{job.department}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#888880]" />
                          {job.locationRaw}
                        </span>
                        <span>•</span>
                        <span className="text-[#888880]">
                          Seen {formatDate(job.postedAt || job.firstSeenAt)}
                        </span>
                      </div>

                      {snippet && (
                        <p className="text-xs sm:text-sm text-[#666660] leading-snug line-clamp-2 pt-0.5">
                          {job.aiSummary && (
                            <span className="text-[10px] font-mono-accent uppercase tracking-wider font-bold text-[#F47521] mr-1.5">
                              AI Summary:
                            </span>
                          )}
                          {snippet}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1A1A1A] hover:bg-[#333238] text-[#F7F7F2] text-[11px] font-bold uppercase tracking-wider rounded-sm font-mono-accent transition-colors"
                    >
                      <span>Apply Directly</span>
                      <ExternalLink className="w-3 h-3 text-[#F47521]" />
                    </a>

                    <button
                      type="button"
                      onClick={() => onToggleSaveJob(job)}
                      aria-pressed={isSaved}
                      className={`inline-flex items-center gap-1 text-[11px] font-mono-accent uppercase tracking-wider font-bold px-2.5 py-1 rounded-sm border transition-colors cursor-pointer ${
                        isSaved
                          ? 'bg-[#F47521]/15 border-[#F47521] text-[#F47521]'
                          : 'bg-[#F7F7F2] border-[#D1D1CB] text-[#888880] hover:text-[#1A1A1A] hover:border-[#A1A19A]'
                      }`}
                    >
                      <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-[#F47521]' : ''}`} />
                      <span>{isSaved ? 'Saved' : 'Save'}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Bookmark, Sparkles } from 'lucide-react';
import { Article } from '../types';
import { formatDate } from '../utils/text';
import { feedService } from '../services/feedService';

interface ArticleItemProps {
  article: Article;
  index: number;
  isSaved: boolean;
  onToggleSave: (article: Article) => void;
}

export const ArticleItem: React.FC<ArticleItemProps> = ({
  article,
  index,
  isSaved,
  onToggleSave,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const primaryCategory =
    article.aiTags && article.aiTags.length > 0
      ? article.aiTags[0]
      : article.categories && article.categories.length > 0
        ? article.categories[0]
        : 'AI & Tech';
  const provider = feedService.getProvider(article.providerId);
  const providerDisplayName = provider
    ? provider.name
    : article.providerId
      ? article.providerId.charAt(0).toUpperCase() + article.providerId.slice(1)
      : 'News';

  const displaySummary = article.aiSummary || article.summary;
  const secondaryTags = [
    ...(article.aiTags?.slice(1) || []),
    ...(article.categories || []),
  ]
    .filter((t, i, arr) => t !== primaryCategory && arr.indexOf(t) === i)
    .slice(0, 2);

  return (
    <article
      id={`article-item-${article.id || index}`}
      className="bg-white border border-[#D1D1CB] hover:border-[#A1A19A] p-4 sm:p-5 rounded-sm transition-colors group shadow-xs"
    >
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
        {/* Editorial Thumbnail */}
        <div className="w-full sm:w-32 h-36 sm:h-20 bg-[#E8E8E1] border border-[#D1D1CB] shrink-0 flex items-center justify-center overflow-hidden rounded-xs relative">
          {article.imageUrl && !imageFailed ? (
            <img
              src={article.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
              className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-200"
            />
          ) : (
            <div className="text-[10px] font-bold text-[#A1A19A] uppercase font-mono-accent tracking-wider px-2 text-center">
              {providerDisplayName}
            </div>
          )}
        </div>

        {/* Content Column */}
        <div className="flex-1 min-w-0">
          {/* Metadata Row */}
          <div className="flex items-center gap-2 sm:gap-2.5 mb-1.5 flex-wrap">
            <span className="text-[10px] font-black bg-[#F47521] text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono-accent">
              {primaryCategory}
            </span>

            {article.aiQualityScore !== undefined && article.aiQualityScore >= 4 && (
              <span
                title={`Workers AI signal score: ${article.aiQualityScore}/5`}
                className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-[#1A1A1A] text-[#F7F7F2] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono-accent"
              >
                <Sparkles className="w-2.5 h-2.5 text-[#F47521]" />
                {article.aiQualityScore === 5 ? 'Top Signal' : 'High Signal'}
              </span>
            )}

            <span className="text-[10px] font-bold text-[#A1A19A] uppercase tracking-tighter font-mono-accent">
              {article.publishedAt ? formatDate(article.publishedAt) : 'Recent'} • {providerDisplayName}
              {article.author ? ` • ${article.author}` : ''}
            </span>

            {secondaryTags.length > 0 && (
              <div className="hidden md:flex items-center gap-1">
                {secondaryTags.map((cat) => (
                  <span
                    key={cat}
                    className="text-[9px] px-1 py-0.2 bg-[#F1F1EB] text-[#666660] rounded-xs font-mono-accent border border-[#E8E8E1] uppercase"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Headline */}
          <h3 className="text-lg sm:text-xl font-bold leading-tight group-hover:underline cursor-pointer mb-2 text-[#1A1A1A] font-editorial">
            <a
              id={`article-title-link-${article.id || index}`}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1A1A1A] hover:text-[#F47521] transition-colors"
            >
              {article.title}
            </a>
          </h3>

          {/* Summary (prefers Workers AI takeaway when available) */}
          {displaySummary && (
            <p
              id={`article-summary-${article.id || index}`}
              className="text-sm text-[#666660] line-clamp-2 leading-snug mb-2"
            >
              {article.aiSummary && (
                <span className="text-[10px] font-mono-accent uppercase tracking-wider font-bold text-[#F47521] mr-1.5">
                  AI Takeaway:
                </span>
              )}
              {displaySummary}
            </p>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between gap-4">
            <a
              id={`article-read-link-${article.id || index}`}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#F47521] hover:underline uppercase tracking-wider font-mono-accent"
            >
              <span>Read original →</span>
            </a>

            <button
              id={`article-save-btn-${article.id || index}`}
              type="button"
              onClick={() => onToggleSave(article)}
              aria-pressed={isSaved}
              className={`inline-flex items-center gap-1 text-[11px] font-mono-accent uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm border transition-colors cursor-pointer ${
                isSaved
                  ? 'bg-[#F47521]/15 border-[#F47521] text-[#F47521]'
                  : 'bg-[#F7F7F2] border-[#D1D1CB] text-[#888880] hover:text-[#1A1A1A] hover:border-[#A1A19A]'
              }`}
              title={isSaved ? 'Remove from Saved queue' : 'Save story for later or video prep'}
            >
              <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-[#F47521]' : ''}`} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

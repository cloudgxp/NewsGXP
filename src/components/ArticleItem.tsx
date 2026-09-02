import React, { useState } from 'react';
import { ExternalLink, Calendar, User, Tag, Image as ImageIcon } from 'lucide-react';
import { Article } from '../types';
import { formatDate, formatRelativeTime } from '../utils/text';
import { feedService } from '../services/feedService';

interface ArticleItemProps {
  article: Article;
  index: number;
}

export const ArticleItem: React.FC<ArticleItemProps> = ({ article, index }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const primaryCategory = article.categories && article.categories.length > 0
    ? article.categories[0]
    : 'News';
  const provider = feedService.getProvider(article.providerId);
  const providerDisplayName = provider
    ? provider.name
    : (article.providerId
      ? article.providerId.charAt(0).toUpperCase() + article.providerId.slice(1)
      : 'News');

  return (
    <article
      id={`article-item-${article.id || index}`}
      className="bg-white border border-[#D1D1CB] hover:border-[#A1A19A] p-4 sm:p-5 rounded-sm transition-colors group shadow-xs"
    >
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start">
        {/* Editorial Thumbnail (Restrained & proportional) */}
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
            <div className="text-[10px] font-bold text-[#A1A19A] uppercase font-mono-accent tracking-wider">
              {providerDisplayName}
            </div>
          )}
        </div>

        {/* Content Column */}
        <div className="flex-1 min-w-0">
          {/* Metadata Row */}
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5 flex-wrap">
            <span className="text-[10px] font-black bg-[#F47521] text-white px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono-accent">
              {primaryCategory}
            </span>

            <span className="text-[10px] font-bold text-[#A1A19A] uppercase tracking-tighter font-mono-accent">
              {article.publishedAt ? formatDate(article.publishedAt) : 'Recent'} • {providerDisplayName}
              {article.author ? ` • ${article.author}` : ''}
            </span>

            {/* Additional tags if available */}
            {article.categories && article.categories.length > 1 && (
              <div className="hidden md:flex items-center gap-1">
                {article.categories.slice(1, 3).map((cat, i) => (
                  <span
                    key={i}
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

          {/* Summary */}
          {article.summary && (
            <p
              id={`article-summary-${article.id || index}`}
              className="text-sm text-[#666660] line-clamp-2 leading-snug mb-2"
            >
              {article.summary}
            </p>
          )}

          {/* Action Link */}
          <div>
            <a
              id={`article-read-link-${article.id || index}`}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#F47521] hover:underline uppercase tracking-wider font-mono-accent"
            >
              <span>Read original →</span>
            </a>
          </div>
        </div>
      </div>
    </article>
  );
};

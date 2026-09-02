/**
 * NewsGXP Shared Core Models
 *
 * Principle: Providers know how to fetch and normalize content.
 * The application knows how to display content.
 */

export interface Article {
  id: string;
  title: string;
  url: string;
  providerId: string;

  publishedAt?: string;
  author?: string;
  summary?: string;
  imageUrl?: string;
  categories?: string[];
}

export interface NewsProvider {
  id: string;
  name: string;
  description?: string;
  homepage: string;
  icon?: string;
  categories?: string[];

  fetchArticles(options?: { forceFresh?: boolean }): Promise<Article[]>;
}

export interface FeedState {
  articles: Article[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

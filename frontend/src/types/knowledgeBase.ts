import type { PaginationMeta } from './api';

export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface ArticleCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt?: string;
  articleCount?: number;
}

export interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content?: string;
  status: ArticleStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  authorName?: string;
  author?: {
    id: string;
    name: string;
    email?: string;
    role: string;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  };
  department?: {
    id: string;
    name: string;
  } | null;
  helpfulCount: number;
  notHelpfulCount: number;
}

export interface PublicArticlesResponse {
  articles: Article[];
  pagination: PaginationMeta;
}

export interface PublicArticleDetailResponse {
  article: Article;
}

export interface PublicCategoriesResponse {
  categories: ArticleCategory[];
}

export interface CreateArticlePayload {
  title: string;
  summary: string;
  content: string;
  categoryId: string;
  departmentId?: string | null;
  status?: ArticleStatus;
}

export interface UpdateArticlePayload {
  title?: string;
  summary?: string;
  content?: string;
  categoryId?: string;
  departmentId?: string | null;
  status?: ArticleStatus;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string | null;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string | null;
}

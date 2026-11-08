import apiClient from './client';
import type { ApiResponse } from '../types/api';
import type {
  Article,
  ArticleCategory,
  PublicArticlesResponse,
  PublicArticleDetailResponse,
  PublicCategoriesResponse,
  CreateArticlePayload,
  UpdateArticlePayload,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '../types/knowledgeBase';

export const knowledgeBaseApi = {
  // Public
  async getCategories(): Promise<ArticleCategory[]> {
    const res = await apiClient.get<ApiResponse<PublicCategoriesResponse>>('/knowledge-base/categories');
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve categories');
    }
    return res.data.data.categories;
  },

  async getArticles(params?: {
    search?: string;
    category?: string;
    departmentId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PublicArticlesResponse> {
    const res = await apiClient.get<ApiResponse<PublicArticlesResponse>>('/knowledge-base/articles', {
      params,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve articles');
    }
    return res.data.data;
  },

  async getArticleBySlug(slug: string): Promise<Article> {
    const res = await apiClient.get<ApiResponse<PublicArticleDetailResponse>>(
      `/knowledge-base/articles/${encodeURIComponent(slug)}`
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Article not found');
    }
    return res.data.data.article;
  },

  async submitFeedback(articleId: string, helpful: boolean): Promise<void> {
    const res = await apiClient.post<ApiResponse<void>>(
      `/knowledge-base/articles/${encodeURIComponent(articleId)}/feedback`,
      { helpful }
    );
    if (!res.data.success) {
      throw new Error(res.data.message || 'Failed to submit feedback');
    }
  },

  // Staff Management
  async getManagedArticles(params?: {
    search?: string;
    status?: string;
    categoryId?: string;
    departmentId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PublicArticlesResponse> {
    const res = await apiClient.get<ApiResponse<PublicArticlesResponse>>('/knowledge-base/manage/articles', {
      params,
    });
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to retrieve managed articles');
    }
    return res.data.data;
  },

  async createArticle(payload: CreateArticlePayload): Promise<Article> {
    const res = await apiClient.post<ApiResponse<{ article: Article }>>('/knowledge-base/articles', payload);
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to create article');
    }
    return res.data.data.article;
  },

  async updateArticle(id: string, payload: UpdateArticlePayload): Promise<Article> {
    const res = await apiClient.patch<ApiResponse<{ article: Article }>>(
      `/knowledge-base/articles/${encodeURIComponent(id)}`,
      payload
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to update article');
    }
    return res.data.data.article;
  },

  async deleteArticle(id: string, permanent = false): Promise<void> {
    const res = await apiClient.delete<ApiResponse<void>>(
      `/knowledge-base/articles/${encodeURIComponent(id)}${permanent ? '?permanent=true' : ''}`
    );
    if (!res.data.success) {
      throw new Error(res.data.message || 'Failed to delete article');
    }
  },

  async createCategory(payload: CreateCategoryPayload): Promise<ArticleCategory> {
    const res = await apiClient.post<ApiResponse<{ category: ArticleCategory }>>(
      '/knowledge-base/categories',
      payload
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to create category');
    }
    return res.data.data.category;
  },

  async updateCategory(id: string, payload: UpdateCategoryPayload): Promise<ArticleCategory> {
    const res = await apiClient.patch<ApiResponse<{ category: ArticleCategory }>>(
      `/knowledge-base/categories/${encodeURIComponent(id)}`,
      payload
    );
    if (!res.data.data) {
      throw new Error(res.data.message || 'Failed to update category');
    }
    return res.data.data.category;
  },
};

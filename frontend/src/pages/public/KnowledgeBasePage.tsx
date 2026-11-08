import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '../../components/common/Card';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { knowledgeBaseApi } from '../../api/knowledgeBase.api';
import type { Article, ArticleCategory } from '../../types/knowledgeBase';
import {
  Search,
  BookOpen,
  ArrowRight,
  ThumbsUp,
  Tag,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
} from 'lucide-react';

export function KnowledgeBasePage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentCategory = searchParams.get('category') || '';
  const currentSearch = searchParams.get('q') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const [searchInput, setSearchInput] = useState(currentSearch);

  // Load categories
  useEffect(() => {
    knowledgeBaseApi
      .getCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load KB categories:', err));
  }, []);

  // Load articles
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    knowledgeBaseApi
      .getArticles({
        search: currentSearch || undefined,
        category: currentCategory || undefined,
        page: currentPage,
        pageSize: 10,
      })
      .then((res) => {
        if (isMounted) {
          setArticles(res.articles);
          setTotal(res.pagination.total);
          setTotalPages(res.pagination.totalPages);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t('kb.loadError', 'Failed to load articles'));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentSearch, currentCategory, currentPage, t]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set('q', searchInput.trim());
    } else {
      params.delete('q');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleCategorySelect = (slug: string) => {
    const params = new URLSearchParams(searchParams);
    if (slug) {
      params.set('category', slug);
    } else {
      params.delete('category');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const locale = i18n.language === 'am' ? 'am-ET' : 'en-US';

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/support" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              M
            </div>
            <div>
              <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                MelaDesk
              </span>
              <span className="text-xs text-slate-400 block -mt-0.5">
                {t('kb.title', 'Knowledge Base')}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link to="/support" className="text-sm font-medium text-slate-600 hover:text-blue-600">
              {t('portal.supportHome', 'Support Portal')}
            </Link>
            <Link to="/support/submit">
              <Button size="sm" variant="primary">
                {t('portal.submitTicketAction', 'Submit Ticket')}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <div className="bg-gradient-to-b from-blue-50/70 to-transparent border-b border-blue-100/50 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t('kb.badge', 'Help & Guides')}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
            {t('kb.heroTitle', 'How can we help you today?')}
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            {t(
              'kb.heroSubtitle',
              'Search our knowledge base for solutions, tutorials, and answers to frequently asked customer questions.'
            )}
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="mt-8 max-w-2xl mx-auto relative">
            <div className="relative">
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t('kb.searchPlaceholder', 'Search for topics, guides, keywords...')}
                className="pl-12 pr-28 py-3.5 text-base rounded-2xl shadow-sm border-slate-300 focus:border-blue-500 bg-white"
                leftIcon={<Search className="w-5 h-5 text-slate-400" />}
              />
              <div className="absolute right-2 top-2 bottom-2 flex items-center">
                <Button type="submit" size="sm" variant="primary" className="h-full px-5 rounded-xl">
                  {t('common.search', 'Search')}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Categories Bar */}
        <div className="mb-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => handleCategorySelect('')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                currentCategory === ''
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {t('kb.allCategories', 'All Categories')}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.slug)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  currentCategory === cat.slug
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{cat.name}</span>
                {cat.articleCount !== undefined && (
                  <span
                    className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                      currentCategory === cat.slug
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cat.articleCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-20 text-center text-slate-500">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">{t('common.loading', 'Loading articles...')}</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-700 my-6">
            <p className="font-semibold text-sm">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && articles.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">
              {t('kb.noArticlesFound', 'No articles found')}
            </h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
              {currentSearch
                ? t('kb.noSearchMatches', 'No articles matched your search query. Try different keywords.')
                : t('kb.noCategoryArticles', 'There are no published articles in this category yet.')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {currentSearch && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    handleSearchSubmit({ preventDefault: () => {} } as any);
                  }}
                >
                  {t('kb.clearSearch', 'Clear Search')}
                </Button>
              )}
              <Link to="/support/submit">
                <Button variant="primary" size="sm">
                  {t('portal.submitTicketAction', 'Submit a Support Ticket')}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Articles Grid */}
        {!isLoading && !error && articles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span>
                {t('kb.showingCount', {
                  count: articles.length,
                  total,
                  defaultValue: `Showing ${articles.length} of ${total} articles`,
                })}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {articles.map((art) => (
                <Link
                  key={art.id}
                  to={`/knowledge-base/${art.slug}`}
                  className="block group focus:outline-none"
                >
                  <Card className="h-full transition-all duration-200 border border-slate-200 hover:border-blue-400 hover:shadow-md rounded-2xl">
                    <CardContent className="p-5 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                            <Tag className="w-3 h-3" />
                            {art.category.name}
                          </span>
                          {art.department && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                              {art.department.name}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {art.title}
                        </h3>

                        <p className="mt-2 text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {art.summary}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {new Date(art.publishedAt || art.createdAt).toLocaleDateString(locale, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>

                        <div className="flex items-center gap-3">
                          {art.helpfulCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                              <ThumbsUp className="w-3 h-3" />
                              {art.helpfulCount}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-0.5 text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">
                            {t('kb.readMore', 'Read')}
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2 pt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  leftIcon={<ChevronLeft className="w-4 h-4" />}
                >
                  {t('common.previous', 'Previous')}
                </Button>
                <span className="text-xs font-medium text-slate-600 px-3">
                  {t('common.pageOf', { page: currentPage, totalPages, defaultValue: `Page ${currentPage} of ${totalPages}` })}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  {t('common.next', 'Next')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Need More Help CTA */}
        <div className="mt-16 bg-blue-600 rounded-3xl p-8 sm:p-10 text-white shadow-md relative overflow-hidden">
          <div className="max-w-2xl relative z-1">
            <div className="w-10 h-10 rounded-xl bg-blue-500/80 flex items-center justify-center mb-4">
              <LifeBuoy className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold">
              {t('kb.ctaTitle', "Didn't find what you need?")}
            </h2>
            <p className="mt-2 text-sm text-blue-100 leading-relaxed">
              {t(
                'kb.ctaSubtitle',
                'Our customer support team is ready to assist you. Submit a support ticket and we will get back to you shortly.'
              )}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/support/submit">
                <Button variant="secondary" className="bg-white text-blue-700 hover:bg-blue-50">
                  {t('portal.submitTicketAction', 'Submit a Support Ticket')}
                </Button>
              </Link>
              <Link to="/support/track">
                <Button variant="ghost" className="text-white hover:bg-blue-700/60">
                  {t('portal.trackButton', 'Track Existing Ticket')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

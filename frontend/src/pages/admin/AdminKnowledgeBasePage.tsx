import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '../../components/common/Input';
import { Textarea } from '../../components/common/Textarea';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/common/Table';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { knowledgeBaseApi } from '../../api/knowledgeBase.api';
import { departmentApi } from '../../api/departments.api';
import { useAuth } from '../../context/AuthContext';
import type { Article, ArticleCategory, ArticleStatus } from '../../types/knowledgeBase';
import type { Department } from '../../types/auth';
import type { PaginationMeta } from '../../types/api';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  ThumbsUp,
  FolderPlus,
  Archive,
  FolderOpen,
} from 'lucide-react';

export function AdminKnowledgeBasePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });

  // Filter states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Article Modal State
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formDepartmentId, setFormDepartmentId] = useState<string>('');
  const [formStatus, setFormStatus] = useState<ArticleStatus>('draft');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category Modal State (Admin only)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  const isHeadReadOnly = user?.role === 'head';
  const isAdmin = user?.role === 'admin';

  // Load categories & departments
  useEffect(() => {
    knowledgeBaseApi
      .getCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories:', err));

    if (isAdmin || user?.role === 'head') {
      departmentApi
        .getDepartments({ page: 1, pageSize: 100 })
        .then((res) => setDepartments(res.departments))
        .catch(() => {});
    }
  }, [isAdmin, user?.role]);

  // Load managed articles
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    knowledgeBaseApi
      .getManagedArticles({
        search: search || undefined,
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        departmentId: departmentFilter || undefined,
        page,
        pageSize: 20,
      })
      .then((res) => {
        if (isMounted) {
          setArticles(res.articles);
          setPagination(res.pagination);
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
  }, [search, statusFilter, categoryFilter, departmentFilter, page, refreshTrigger, t]);

  const openCreateModal = () => {
    setEditingArticle(null);
    setFormTitle('');
    setFormSummary('');
    setFormContent('');
    setFormCategoryId(categories[0]?.id || '');
    setFormDepartmentId(user?.departmentId || '');
    setFormStatus('draft');
    setError(null);
    setIsArticleModalOpen(true);
  };

  const openEditModal = (art: Article) => {
    setEditingArticle(art);
    setFormTitle(art.title);
    setFormSummary(art.summary);
    setFormContent(art.content || '');
    setFormCategoryId(art.category.id);
    setFormDepartmentId(art.department?.id || '');
    setFormStatus(art.status);
    setError(null);
    setIsArticleModalOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSummary.trim() || !formContent.trim() || !formCategoryId) {
      setError(t('kb.fillRequiredFields', 'Please fill in all required fields.'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingArticle) {
        await knowledgeBaseApi.updateArticle(editingArticle.id, {
          title: formTitle.trim(),
          summary: formSummary.trim(),
          content: formContent.trim(),
          categoryId: formCategoryId,
          departmentId: formDepartmentId === '' ? null : formDepartmentId,
          status: formStatus,
        });
        setSuccessMessage(t('kb.articleUpdatedSuccess', 'Article updated successfully.'));
      } else {
        await knowledgeBaseApi.createArticle({
          title: formTitle.trim(),
          summary: formSummary.trim(),
          content: formContent.trim(),
          categoryId: formCategoryId,
          departmentId: formDepartmentId === '' ? null : formDepartmentId,
          status: formStatus,
        });
        setSuccessMessage(t('kb.articleCreatedSuccess', 'Article created successfully.'));
      }

      setIsArticleModalOpen(false);
      setRefreshTrigger((r) => r + 1);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('kb.saveError', 'Failed to save article.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveArticle = async (art: Article) => {
    if (!window.confirm(t('kb.archiveConfirm', 'Are you sure you want to archive this article?'))) return;

    try {
      await knowledgeBaseApi.deleteArticle(art.id, false);
      setSuccessMessage(t('kb.archivedSuccess', 'Article archived safely.'));
      setRefreshTrigger((r) => r + 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive article');
    }
  };

  const handleDeletePermanent = async (art: Article) => {
    if (!window.confirm(t('kb.deletePermanentConfirm', 'Are you sure you want to PERMANENTLY delete this article?'))) return;

    try {
      await knowledgeBaseApi.deleteArticle(art.id, true);
      setSuccessMessage(t('kb.deletedSuccess', 'Article permanently deleted.'));
      setRefreshTrigger((r) => r + 1);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete article');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    setIsSubmittingCategory(true);
    try {
      const created = await knowledgeBaseApi.createCategory({
        name: catName.trim(),
        description: catDescription.trim() || null,
      });
      setCategories((prev) => [...prev, created]);
      setCatName('');
      setCatDescription('');
      setIsCategoryModalOpen(false);
      setSuccessMessage(t('kb.categoryCreatedSuccess', 'Category created successfully.'));
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const getStatusBadge = (status: ArticleStatus) => {
    switch (status) {
      case 'published':
        return <Badge variant="emerald">{t('kb.statusPublished', 'Published')}</Badge>;
      case 'draft':
        return <Badge variant="amber">{t('kb.statusDraft', 'Draft')}</Badge>;
      case 'archived':
        return <Badge variant="slate">{t('kb.statusArchived', 'Archived')}</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const locale = i18n.language === 'am' ? 'am-ET' : 'en-US';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
            {t('kb.manageTitle', 'Knowledge Base Articles')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t(
              'kb.manageSubtitle',
              'Create, edit, publish, and organize customer help documentation and solutions.'
            )}
          </p>
        </div>

        {!isHeadReadOnly && (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCategoryModalOpen(true)}
                leftIcon={<FolderPlus className="w-4 h-4" />}
              >
                {t('kb.manageCategories', 'New Category')}
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              {t('kb.newArticle', 'New Article')}
            </Button>
          </div>
        )}
      </div>

      {successMessage && <Alert type="success">{successMessage}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      {/* Filters Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            placeholder={t('kb.searchArticlesPlaceholder', 'Search title, summary, slug...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: t('kb.allStatuses', 'All Statuses') },
              { value: 'published', label: t('kb.statusPublished', 'Published') },
              { value: 'draft', label: t('kb.statusDraft', 'Draft') },
              { value: 'archived', label: t('kb.statusArchived', 'Archived') },
            ]}
          />

          <Select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: t('kb.allCategories', 'All Categories') },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          {(isAdmin || user?.role === 'head') && (
            <Select
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: t('kb.allDepartments', 'All Departments') },
                { value: 'null', label: t('kb.globalArticles', 'Global (No Department)') },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          )}
        </div>
      </div>

      {/* Articles Table */}
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('kb.articleTitle', 'Title')}</TableHead>
              <TableHead>{t('kb.category', 'Category')}</TableHead>
              <TableHead>{t('kb.department', 'Department')}</TableHead>
              <TableHead>{t('kb.status', 'Status')}</TableHead>
              <TableHead>{t('kb.feedback', 'Helpful')}</TableHead>
              <TableHead>{t('kb.lastUpdated', 'Updated')}</TableHead>
              <TableHead className="text-right">{t('common.actions', 'Actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  {t('common.loading', 'Loading articles...')}
                </TableCell>
              </TableRow>
            )}

            {!isLoading && articles.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-slate-400">
                  <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  {t('kb.noArticlesFound', 'No articles match the selected filters.')}
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              articles.map((art) => (
                <TableRow key={art.id}>
                  <TableCell className="max-w-xs font-semibold text-slate-900">
                    <div>
                      <span className="block truncate">{art.title}</span>
                      <span className="text-[11px] text-slate-400 font-mono font-normal truncate block">
                        /{art.slug}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-slate-700 font-medium">
                      {art.category.name}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="text-xs text-slate-600">
                      {art.department?.name || <span className="text-slate-400 italic">Global</span>}
                    </span>
                  </TableCell>

                  <TableCell>{getStatusBadge(art.status)}</TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                      <ThumbsUp className="w-3 h-3" />
                      {art.helpfulCount} / {art.helpfulCount + art.notHelpfulCount}
                    </span>
                  </TableCell>

                  <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(art.updatedAt || art.createdAt).toLocaleDateString(locale, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {art.status === 'published' && (
                        <a
                          href={`/knowledge-base/${art.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-blue-600"
                          title="View live article"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}

                      {!isHeadReadOnly && (
                        <>
                          <button
                            onClick={() => openEditModal(art)}
                            className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                            title="Edit article"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {art.status !== 'archived' && (
                            <button
                              onClick={() => handleArchiveArticle(art)}
                              className="p-1 text-slate-400 hover:text-amber-600 cursor-pointer"
                              title="Archive article"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => handleDeletePermanent(art)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <span>
            {t('common.showingPagination', {
              page: pagination.page,
              totalPages: pagination.totalPages,
              total: pagination.total,
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t('common.previous', 'Previous')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('common.next', 'Next')}
            </Button>
          </div>
        </div>
      )}

      {/* Article Create / Edit Modal */}
      <Modal
        isOpen={isArticleModalOpen}
        onClose={() => setIsArticleModalOpen(false)}
        title={editingArticle ? t('kb.editArticle', 'Edit Article') : t('kb.createArticle', 'Create New Article')}
      >
        <form onSubmit={handleSaveArticle} className="space-y-4">
          <Input
            label={t('kb.articleTitle', 'Article Title')}
            placeholder={t('kb.titlePlaceholder', 'e.g., Setting up two-factor authentication')}
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={t('kb.category', 'Category')}
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              required
            />

            <Select
              label={t('kb.status', 'Status')}
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as ArticleStatus)}
              options={[
                { value: 'draft', label: t('kb.statusDraft', 'Draft') },
                { value: 'published', label: t('kb.statusPublished', 'Published') },
                { value: 'archived', label: t('kb.statusArchived', 'Archived') },
              ]}
            />
          </div>

          {isAdmin && (
            <Select
              label={t('kb.department', 'Department Scope')}
              value={formDepartmentId}
              onChange={(e) => setFormDepartmentId(e.target.value)}
              options={[
                { value: '', label: t('kb.globalArticleAll', 'Global (Visible across all departments)') },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          )}

          <Textarea
            label={t('kb.summary', 'Summary (Short Preview)')}
            placeholder={t('kb.summaryPlaceholder', 'A concise summary visible on search cards...')}
            rows={2}
            value={formSummary}
            onChange={(e) => setFormSummary(e.target.value)}
            required
          />

          <Textarea
            label={t('kb.content', 'Full Article Content')}
            placeholder={t('kb.contentPlaceholder', 'Detailed steps, guidelines, or troubleshooting instructions... Use # for headings, - for bullet lists.')}
            rows={8}
            value={formContent}
            onChange={(e) => setFormContent(e.target.value)}
            required
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsArticleModalOpen(false)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingArticle ? t('common.saveChanges', 'Save Changes') : t('kb.saveArticle', 'Publish / Save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Category Creation Modal (Admin Only) */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title={t('kb.createCategory', 'Create Article Category')}
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <Input
            label={t('kb.categoryName', 'Category Name')}
            placeholder={t('kb.categoryPlaceholder', 'e.g., Security & Passwords')}
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />

          <Textarea
            label={t('kb.categoryDesc', 'Description (Optional)')}
            placeholder={t('kb.categoryDescPlaceholder', 'Briefly describe this category...')}
            rows={3}
            value={catDescription}
            onChange={(e) => setCatDescription(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmittingCategory}>
              {t('kb.createCategoryBtn', 'Create Category')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

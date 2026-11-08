import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { knowledgeBaseApi } from '../../api/knowledgeBase.api';
import type { Article } from '../../types/knowledgeBase';
import {
  ArrowLeft,
  Calendar,
  User,
  Tag,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Share2,
  Check,
  Building2,
} from 'lucide-react';

export function ArticleDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Feedback state
  const [hasVoted, setHasVoted] = useState(false);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackFeedback, setFeedbackFeedback] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!slug) return;

    setIsLoading(true);
    setError(null);
    setHasVoted(false);
    setFeedbackFeedback(null);

    knowledgeBaseApi
      .getArticleBySlug(slug)
      .then((data) => {
        if (isMounted) {
          setArticle(data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : t('kb.articleNotFound', 'Article not found'));
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
  }, [slug, t]);

  const handleFeedback = async (helpful: boolean) => {
    if (!article || hasVoted || isSubmittingFeedback) return;

    setIsSubmittingFeedback(true);
    try {
      await knowledgeBaseApi.submitFeedback(article.id, helpful);
      setHasVoted(true);
      setFeedbackFeedback(t('kb.feedbackThanks', 'Thank you for your feedback!'));

      // Optimistically update counts
      setArticle((prev) =>
        prev
          ? {
              ...prev,
              helpfulCount: helpful ? prev.helpfulCount + 1 : prev.helpfulCount,
              notHelpfulCount: !helpful ? prev.notHelpfulCount + 1 : prev.notHelpfulCount,
            }
          : null
      );
    } catch {
      setFeedbackFeedback(t('kb.feedbackError', 'Could not record feedback.'));
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  /**
   * Safely renders article text content without raw HTML injection (XSS-safe).
   * Parses standard paragraphs, headings, and code blocks safely.
   */
  const renderSafeContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = (index: number) => {
      if (currentParagraph.length > 0) {
        elements.push(
          <p key={`p-${index}`} className="text-sm sm:text-base text-slate-700 leading-relaxed mb-4">
            {currentParagraph.join(' ')}
          </p>
        );
        currentParagraph = [];
      }
    };

    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim();

      if (!line) {
        flushParagraph(idx);
        return;
      }

      if (line.startsWith('### ')) {
        flushParagraph(idx);
        elements.push(
          <h3 key={`h3-${idx}`} className="text-base sm:text-lg font-bold text-slate-900 mt-6 mb-2">
            {line.replace(/^###\s+/, '')}
          </h3>
        );
      } else if (line.startsWith('## ')) {
        flushParagraph(idx);
        elements.push(
          <h2 key={`h2-${idx}`} className="text-lg sm:text-xl font-bold text-slate-900 mt-8 mb-3 pb-1 border-b border-slate-100">
            {line.replace(/^##\s+/, '')}
          </h2>
        );
      } else if (line.startsWith('# ')) {
        flushParagraph(idx);
        elements.push(
          <h1 key={`h1-${idx}`} className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-8 mb-4">
            {line.replace(/^#\s+/, '')}
          </h1>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        flushParagraph(idx);
        elements.push(
          <li key={`li-${idx}`} className="text-sm sm:text-base text-slate-700 ml-5 list-disc mb-1 leading-relaxed">
            {line.replace(/^[-*]\s+/, '')}
          </li>
        );
      } else if (/^\d+\.\s+/.test(line)) {
        flushParagraph(idx);
        elements.push(
          <li key={`oli-${idx}`} className="text-sm sm:text-base text-slate-700 ml-5 list-decimal mb-1 leading-relaxed">
            {line.replace(/^\d+\.\s+/, '')}
          </li>
        );
      } else {
        currentParagraph.push(line);
      }
    });

    flushParagraph(lines.length);

    return <div className="article-body">{elements}</div>;
  };

  const locale = i18n.language === 'am' ? 'am-ET' : 'en-US';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] py-20 text-center text-slate-500">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">{t('kb.loadingArticle', 'Loading article...')}</p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] py-16 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-4">
          <Alert type="error">{error || t('kb.articleNotFound', 'Article not found')}</Alert>
          <Button variant="secondary" onClick={() => navigate('/knowledge-base')}>
            {t('kb.backToKnowledgeBase', 'Back to Knowledge Base')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-10 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            to="/knowledge-base"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('kb.backToKnowledgeBase', 'Back to Knowledge Base')}</span>
          </Link>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyLink}
            className="text-xs text-slate-600"
            leftIcon={copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
          >
            {copiedLink ? t('common.copied', 'Copied Link!') : t('kb.shareArticle', 'Share')}
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-slate-400 mb-6">
          <Link to="/support" className="hover:text-blue-600">
            {t('portal.supportHome', 'Support')}
          </Link>
          <span>/</span>
          <Link to="/knowledge-base" className="hover:text-blue-600">
            {t('kb.title', 'Knowledge Base')}
          </Link>
          <span>/</span>
          <Link
            to={`/knowledge-base?category=${article.category.slug}`}
            className="hover:text-blue-600 font-medium text-slate-600"
          >
            {article.category.name}
          </Link>
        </nav>

        {/* Article Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-xs mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700">
              <Tag className="w-3 h-3" />
              {article.category.name}
            </span>
            {article.department && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                <Building2 className="w-3 h-3" />
                {article.department.name}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F172A] tracking-tight leading-tight">
            {article.title}
          </h1>

          {/* Metadata Row */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {article.authorName && (
              <span className="inline-flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{article.authorName}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {new Date(article.publishedAt || article.createdAt).toLocaleDateString(locale, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </span>
          </div>

          {/* Summary Box */}
          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-sm font-medium text-slate-700 leading-relaxed">
            {article.summary}
          </div>

          {/* Article Body */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            {renderSafeContent(article.content || '')}
          </div>

          {/* Feedback Section */}
          <div className="mt-12 pt-8 border-t border-slate-100 text-center">
            <h4 className="text-sm font-bold text-slate-800 mb-2">
              {t('kb.wasThisHelpful', 'Was this article helpful?')}
            </h4>

            {feedbackFeedback ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl mt-2">
                <CheckCircle className="w-4 h-4" />
                <span>{feedbackFeedback}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 mt-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleFeedback(true)}
                  disabled={isSubmittingFeedback || hasVoted}
                  leftIcon={<ThumbsUp className="w-4 h-4 text-emerald-600" />}
                  className="px-5 hover:border-emerald-300"
                >
                  {t('common.yes', 'Yes')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleFeedback(false)}
                  disabled={isSubmittingFeedback || hasVoted}
                  leftIcon={<ThumbsDown className="w-4 h-4 text-rose-500" />}
                  className="px-5 hover:border-rose-300"
                >
                  {t('common.no', 'No')}
                </Button>
              </div>
            )}

            <div className="mt-3 text-[11px] text-slate-400">
              {t('kb.feedbackRatio', {
                helpful: article.helpfulCount,
                total: article.helpfulCount + article.notHelpfulCount,
                defaultValue: `${article.helpfulCount} of ${
                  article.helpfulCount + article.notHelpfulCount
                } found this helpful`,
              })}
            </div>
          </div>
        </div>

        {/* Still Need Assistance Banner */}
        <div className="p-6 sm:p-8 bg-blue-50 border border-blue-200/70 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-blue-950">
              {t('kb.stillNeedHelpTitle', 'Still need help with your issue?')}
            </h3>
            <p className="text-xs sm:text-sm text-blue-700 mt-0.5">
              {t('kb.stillNeedHelpDesc', 'Submit a support ticket and our dedicated support agents will resolve it.')}
            </p>
          </div>
          <Link to="/support/submit" className="shrink-0">
            <Button variant="primary" size="sm">
              {t('portal.submitTicketAction', 'Submit a Ticket')}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

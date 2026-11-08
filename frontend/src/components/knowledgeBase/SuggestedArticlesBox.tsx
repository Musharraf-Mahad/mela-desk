import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { knowledgeBaseApi } from '../../api/knowledgeBase.api';
import type { Article } from '../../types/knowledgeBase';
import { BookOpen, ExternalLink, ThumbsUp, Tag, ArrowRight } from 'lucide-react';

interface SuggestedArticlesBoxProps {
  query: string;
}

export function SuggestedArticlesBox({ query }: SuggestedArticlesBoxProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<Article[]>([]);
  const [activeModalArticle, setActiveModalArticle] = useState<Article | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(() => {
      knowledgeBaseApi
        .getArticles({ search: trimmed, pageSize: 3 })
        .then((res) => setSuggestions(res.articles))
        .catch(() => setSuggestions([]));
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <>
      <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
          <span>{t('kb.suggestedHelp', 'Help articles that might solve your issue before submitting:')}</span>
        </div>

        <div className="space-y-1.5">
          {suggestions.map((art) => (
            <div
              key={art.id}
              className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-blue-100/80 shadow-2xs hover:border-blue-300 transition-colors"
            >
              <div className="pr-2 min-w-0">
                <span className="font-semibold text-slate-800 truncate block">
                  {art.title}
                </span>
                <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  {art.summary}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setActiveModalArticle(art)}
                className="shrink-0 text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 text-[11px] cursor-pointer px-2 py-1 rounded-lg hover:bg-blue-50"
              >
                <span>{t('kb.preview', 'Quick View')}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Article Quick-View Modal */}
      {activeModalArticle && (
        <Modal
          isOpen={!!activeModalArticle}
          onClose={() => setActiveModalArticle(null)}
          title={activeModalArticle.title}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                <Tag className="w-3 h-3" />
                {activeModalArticle.category.name}
              </span>
              {activeModalArticle.helpfulCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <ThumbsUp className="w-3 h-3" />
                  {activeModalArticle.helpfulCount} {t('kb.foundHelpful', 'found helpful')}
                </span>
              )}
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
              {activeModalArticle.summary}
            </div>

            <div className="text-xs sm:text-sm text-slate-700 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap pr-1">
              {activeModalArticle.content || activeModalArticle.summary}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <a
                href={`/knowledge-base/${activeModalArticle.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <span>{t('kb.openInNewTab', 'Open full article in new tab')}</span>
                <ArrowRight className="w-3 h-3" />
              </a>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveModalArticle(null)}
              >
                {t('common.close', 'Close & Return to Form')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

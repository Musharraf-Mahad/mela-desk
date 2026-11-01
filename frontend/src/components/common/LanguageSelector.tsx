import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Check, ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  variant?: 'topNav' | 'auth' | 'compact';
  className?: string;
}

export function LanguageSelector({ variant = 'topNav', className = '' }: LanguageSelectorProps) {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language?.startsWith('am') ? 'am' : 'en';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectLanguage = (langCode: 'en' | 'am') => {
    i18n.changeLanguage(langCode);
    setIsOpen(false);
  };

  const languages = [
    { code: 'en' as const, label: 'English', subLabel: 'English' },
    { code: 'am' as const, label: 'አማርኛ', subLabel: 'Amharic' },
  ];

  if (variant === 'auth') {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={t('language.switchAria', 'Select application language')}
          aria-expanded={isOpen}
          aria-haspopup="true"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/90 shadow-2xs backdrop-blur-xs transition-colors cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-blue-600" />
          <span>{currentLang === 'am' ? 'አማርኛ' : 'English'}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 text-left">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                  currentLang === lang.code
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>{lang.label}</span>
                {currentLang === lang.code && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // TopNav / Default variant
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('language.switchAria', 'Select application language')}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        title={t('language.switchAria', 'Select application language')}
      >
        <Globe className="w-4 h-4 text-slate-500" />
        <span className="font-medium">{currentLang === 'am' ? 'አማርኛ' : 'English'}</span>
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-36 bg-white rounded-xl shadow-xl border border-[#E2E8F0] py-1.5 z-50 text-left">
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-400 border-b border-slate-100 mb-1">
            {t('language.select', 'Language')}
          </div>
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelectLanguage(lang.code)}
              className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                currentLang === lang.code
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{lang.label}</span>
              {currentLang === lang.code && <Check className="w-3.5 h-3.5 text-blue-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

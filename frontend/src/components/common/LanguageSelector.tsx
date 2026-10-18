import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { LANGUAGE_OPTIONS, Language } from '../../i18n';

interface LanguageSelectorProps {
  variant?: 'segmented' | 'dropdown' | 'compact';
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'segmented',
  className = '',
}) => {
  const { language, setLanguage, t } = useLanguage();

  if (variant === 'dropdown') {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className="relative inline-flex items-center">
          <Globe className="w-4 h-4 text-[#3B82F6] dark:text-[#38BDF8] absolute left-3 pointer-events-none" />
          <select
            aria-label={t('nav.selectLanguage')}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="pl-9 pr-8 py-1.5 bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#CBD5E1] dark:hover:border-[#3B82F6]/50 text-[#172033] dark:text-[#F1F5F9] text-xs font-semibold rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] cursor-pointer transition-colors"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code} className="bg-white dark:bg-[#111C2E] text-[#172033] dark:text-[#F1F5F9]">
                {opt.nativeLabel} ({opt.label})
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('nav.selectLanguage')}
      className={`inline-flex items-center bg-white dark:bg-[#111C2E] border border-[#E2E8F0] dark:border-[#1E293B] rounded-lg p-1 shadow-sm transition-colors ${className}`}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] border-r border-[#E2E8F0] dark:border-[#1E293B] mr-1">
        <Globe className="w-3.5 h-3.5 text-[#3B82F6] dark:text-[#38BDF8] shrink-0" />
        <span className="hidden sm:inline">{t('dashboard.languageLabel')}:</span>
      </div>
      <div className="flex items-center gap-1">
        {LANGUAGE_OPTIONS.map((opt) => {
          const isActive = language === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              onClick={() => setLanguage(opt.code)}
              aria-pressed={isActive}
              title={`Switch language to ${opt.label} (${opt.nativeLabel})`}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] ${
                isActive
                  ? 'bg-[#3B82F6] text-white shadow-sm'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#172033] dark:hover:text-[#F1F5F9] hover:bg-[#F1F5F9] dark:hover:bg-[#162238]'
              }`}
            >
              {opt.nativeLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
};

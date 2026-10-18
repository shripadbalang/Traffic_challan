import { enTranslations } from './locales/en';
import { mrTranslations } from './locales/mr';
import { hiTranslations } from './locales/hi';

export type Language = 'en' | 'mr' | 'hi';

export interface LanguageOption {
  code: Language;
  label: string;
  nativeLabel: string;
  shortLabel: string;
  locale: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', shortLabel: 'EN', locale: 'en-IN' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', shortLabel: 'मराठी', locale: 'mr-IN' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', shortLabel: 'हिन्दी', locale: 'hi-IN' },
];

export const translations: Record<Language, Record<string, string>> = {
  en: enTranslations,
  mr: mrTranslations,
  hi: hiTranslations,
};

export { enTranslations } from './locales/en';
export { mrTranslations } from './locales/mr';
export { hiTranslations } from './locales/hi';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Language, LANGUAGE_OPTIONS, translations } from '../i18n/translations';

const STORAGE_KEY = 'echallan_owner_lang';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  translateViolation: (violation: string) => string;
  translateVehicleClass: (vehicleClass?: string) => string;
  formatDate: (dateInput?: string | Date | null, includeTime?: boolean) => string;
  formatCurrency: (amount: number) => string;
  formatNumber: (num: number) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const getInitialLanguage = (): Language => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'mr' || saved === 'hi') {
      return saved;
    }
  } catch {
    // ignore storage access issues
  }
  return 'en';
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let template = translations[language]?.[key] ?? translations.en[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
          template = template.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
        });
      }
      return template;
    },
    [language]
  );

  const translateViolation = useCallback(
    (violation: string): string => {
      if (!violation) return '';
      const trimmed = violation.trim();
      const key = `violation.${trimmed}`;
      if (translations[language]?.[key]) {
        return translations[language][key];
      }
      // Partial match fallback for composite violation strings
      const knownKeys = [
        'Triple Riding',
        'No Helmet',
        'Signal Jump',
        'Red Light Violation',
        'Over Speeding',
        'Wrong Side Driving',
        'Using Mobile Phone',
        'No Seatbelt',
        'Fancy Number Plate',
        'No Parking',
      ];
      for (const known of knownKeys) {
        if (trimmed.toLowerCase().includes(known.toLowerCase())) {
          const matchedKey = `violation.${known}`;
          if (translations[language]?.[matchedKey]) {
            return translations[language][matchedKey];
          }
        }
      }
      return violation;
    },
    [language]
  );

  const translateVehicleClass = useCallback(
    (vehicleClass?: string): string => {
      if (!vehicleClass) return translations[language]?.['vehicles.class.2Wheeler'] ?? '2-Wheeler';
      const normalized = vehicleClass.toLowerCase();
      if (normalized.includes('2') || normalized.includes('two') || normalized.includes('motor') || normalized.includes('scoot')) {
        return translations[language]?.['vehicles.class.2Wheeler'] ?? vehicleClass;
      }
      if (normalized.includes('4') || normalized.includes('four') || normalized.includes('car') || normalized.includes('suv')) {
        return translations[language]?.['vehicles.class.4Wheeler'] ?? vehicleClass;
      }
      if (normalized.includes('comm') || normalized.includes('truck') || normalized.includes('bus')) {
        return translations[language]?.['vehicles.class.Commercial'] ?? vehicleClass;
      }
      if (normalized.includes('ev') || normalized.includes('elec')) {
        return translations[language]?.['vehicles.class.EV'] ?? vehicleClass;
      }
      return vehicleClass;
    },
    [language]
  );

  const getLocale = useCallback((): string => {
    const found = LANGUAGE_OPTIONS.find((opt) => opt.code === language);
    return found ? found.locale : 'en-IN';
  }, [language]);

  const formatDate = useCallback(
    (dateInput?: string | Date | null, includeTime = false): string => {
      if (!dateInput) return t('common.NA');
      const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      if (Number.isNaN(d.getTime())) return String(dateInput);
      try {
        return new Intl.DateTimeFormat(getLocale(), {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        }).format(d);
      } catch {
        return d.toLocaleDateString();
      }
    },
    [getLocale, t]
  );

  const formatCurrency = useCallback(
    (amount: number): string => {
      try {
        return new Intl.NumberFormat(getLocale(), {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0,
        }).format(amount || 0);
      } catch {
        return `₹${amount || 0}`;
      }
    },
    [getLocale]
  );

  const formatNumber = useCallback(
    (num: number): string => {
      try {
        return new Intl.NumberFormat(getLocale()).format(num || 0);
      } catch {
        return String(num || 0);
      }
    },
    [getLocale]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        translateViolation,
        translateVehicleClass,
        formatDate,
        formatCurrency,
        formatNumber,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
};

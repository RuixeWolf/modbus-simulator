'use client';

import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';

/**
 * Button that toggles the UI language between English and Chinese.
 * Persists the choice to localStorage as `i18nextLng`.
 */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh';
    localStorage.setItem('i18nextLng', next);
    void i18n.changeLanguage(next);
  };

  return (
    <Button size="sm" variant="ghost" onPress={toggleLanguage} className="text-xs font-medium rounded-full bg-surface shadow-sm px-3">
      {i18n.language === 'zh' ? t('language.en') : t('language.zh')}
    </Button>
  );
}

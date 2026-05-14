'use client'

import { useTranslation } from 'react-i18next'
import { Button } from '@heroui/react'

/**
 * Button that toggles the UI language between English and Chinese.
 * Persists the choice to localStorage as `i18nextLng`.
 */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const toggleLanguage = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh'
    localStorage.setItem('i18nextLng', next)
    void i18n.changeLanguage(next)
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onPress={toggleLanguage}
      className="bg-surface rounded-full px-3 text-xs font-medium shadow-sm"
    >
      {i18n.language === 'zh' ? t('language.en') : t('language.zh')}
    </Button>
  )
}

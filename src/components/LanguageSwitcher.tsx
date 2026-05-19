'use client'

import { useTranslation } from 'react-i18next'
import { Label, ListBox, Select } from '@heroui/react'
import type { Key } from '@heroui/react'

const LANGUAGES = ['en', 'zh', 'fr', 'ja'] as const

/**
 * Dropdown that lets the user pick the UI language.
 * Persists the choice to localStorage as `i18nextLng`.
 */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()

  const handleChange = (value: Key | null) => {
    const next = String(value ?? 'en')
    localStorage.setItem('i18nextLng', next)
    void i18n.changeLanguage(next)
  }

  return (
    <Select value={i18n.language} onChange={handleChange} className="w-32">
      <Label className="sr-only">{t('language.en')}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {LANGUAGES.map((lng) => (
            <ListBox.Item key={lng} id={lng} textValue={t(`language.${lng}`)}>
              {t(`language.${lng}`)}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  )
}

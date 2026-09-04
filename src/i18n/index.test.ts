import { describe, expect, it } from 'vitest'
import en from '@/public/locales/en/translation.json'
import fr from '@/public/locales/fr/translation.json'
import ja from '@/public/locales/ja/translation.json'
import zh from '@/public/locales/zh/translation.json'

function flattenKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof child === 'object' && child !== null
      ? flattenKeys(child as Record<string, unknown>, path)
      : [path]
  })
}

describe('translation resources', () => {
  it('keeps all locale keys in parity', () => {
    const expected = flattenKeys(en).sort()
    expect(flattenKeys(zh).sort()).toEqual(expected)
    expect(flattenKeys(fr).sort()).toEqual(expected)
    expect(flattenKeys(ja).sort()).toEqual(expected)
  })
})

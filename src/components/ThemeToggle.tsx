'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from '@/src/hooks/useTheme'
import { icons as lucideIcons } from '@iconify-json/lucide'
import { addCollection, Icon } from '@iconify/react/offline'

/**
 * Register the bundled Lucide icon set so that all string references
 * (e.g. "lucide:sun") resolve instantly without network requests.
 * This makes the component safe for SSR / hydration.
 */
addCollection(lucideIcons)

/** Resolve icon name from trusted theme literals without dynamic object lookup. */
function getThemeIcon(themeKey: 'light' | 'dark' | 'system'): string {
  switch (themeKey) {
    case 'light':
      return 'lucide:sun'
    case 'dark':
      return 'lucide:moon'
    case 'system':
      return 'lucide:monitor'
    default:
      return 'lucide:monitor'
  }
}

/**
 * Returns false during SSR and true on the client.
 * Used to avoid hydration mismatches in theme-dependent renders.
 */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

/** Icon-driven theme selector with pill-style segmented control. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  // Stable placeholder during SSR / before hydration
  if (!mounted) {
    return (
      <div className="bg-default/50 flex items-center gap-1 rounded-full p-1">
        <div className="bg-surface flex h-8 w-8 items-center justify-center rounded-full shadow-sm">
          <Icon icon="lucide:sun" width={16} height={16} className="text-foreground" />
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full">
          <Icon icon="lucide:moon" width={16} height={16} className="text-text-muted" />
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full">
          <Icon icon="lucide:monitor" width={16} height={16} className="text-text-muted" />
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-default/50 flex flex-row gap-1 rounded-full p-1"
      role="radiogroup"
      aria-label="Theme"
    >
      {(['light', 'dark', 'system'] as const).map((key) => {
        const selected = theme === key
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(key)}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
              selected
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            <Icon icon={getThemeIcon(key)} width={16} height={16} />
          </button>
        )
      })}
    </div>
  )
}

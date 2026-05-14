'use client';

import { useSyncExternalStore } from 'react';
import { Icon, addCollection } from '@iconify/react/offline';
import { icons as lucideIcons } from '@iconify-json/lucide';
import { useTheme } from '@/src/hooks/useTheme';

/**
 * Register the bundled Lucide icon set so that all string references
 * (e.g. "lucide:sun") resolve instantly without network requests.
 * This makes the component safe for SSR / hydration.
 */
addCollection(lucideIcons);

/**
 * Returns false during SSR and true on the client.
 * Used to avoid hydration mismatches in theme-dependent renders.
 */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/** Icon-driven theme selector with pill-style segmented control. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  // Stable placeholder during SSR / before hydration
  if (!mounted) {
    return (
      <div className="flex items-center bg-muted/50 rounded-full p-1 gap-1">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-surface shadow-sm">
          <Icon icon="lucide:sun" width={16} height={16} className="text-foreground" />
        </div>
        <div className="flex items-center justify-center w-8 h-8 rounded-full">
          <Icon icon="lucide:moon" width={16} height={16} className="text-text-muted" />
        </div>
        <div className="flex items-center justify-center w-8 h-8 rounded-full">
          <Icon icon="lucide:monitor" width={16} height={16} className="text-text-muted" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-row bg-muted/50 rounded-full p-1 gap-1"
      role="radiogroup"
      aria-label="Theme"
    >
      {(['light', 'dark', 'system'] as const).map((key) => {
        const selected = theme === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(key)}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
              selected
                ? 'bg-surface text-foreground shadow-sm'
                : 'text-text-muted hover:text-foreground'
            }`}
          >
            <Icon
              icon={
                key === 'light' ? 'lucide:sun' : key === 'dark' ? 'lucide:moon' : 'lucide:monitor'
              }
              width={16}
              height={16}
            />
          </button>
        );
      })}
    </div>
  );
}

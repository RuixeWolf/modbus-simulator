import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

/** Supported theme preferences. */
type Theme = 'light' | 'dark' | 'system'

/** localStorage key used to persist the user's theme choice. */
const STORAGE_KEY = 'theme-preference'

/**
 * @returns The current OS-level color scheme preference.
 */
function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Adds or removes the `.dark` class on `<html>` to match the resolved theme.
 * @param theme – User preference; "system" is resolved against the OS preference.
 */
function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

/**
 * Subscribes to OS color-scheme changes.
 * @param callback – Invoked whenever the preference changes.
 * @returns Cleanup function that removes the listener.
 */
function subscribeSystem(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}

/**
 * Hook that tracks the user's theme preference (light / dark / system),
 * persists it to localStorage, and keeps the `.dark` class in sync.
 *
 * @returns Current theme, resolved effective theme, and a setter.
 */
export function useTheme() {
  const systemTheme = useSyncExternalStore(subscribeSystem, getSystemTheme, () => 'light' as const)

  const [themeState, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    } catch {
      // ignore
    }
    return 'system'
  })

  const resolvedTheme = themeState === 'system' ? systemTheme : themeState

  useEffect(() => {
    applyTheme(themeState)
  }, [themeState])

  /**
   * Updates the stored theme and immediately applies it.
   * @param t – New theme preference.
   */
  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    applyTheme(t)
    try {
      localStorage.setItem(STORAGE_KEY, t)
    } catch {
      // ignore
    }
  }, [])

  return { theme: themeState, setTheme, resolvedTheme }
}

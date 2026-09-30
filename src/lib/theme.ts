import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

/** Keep in sync with the pre-paint script in index.html. */
const STORAGE_KEY = 'noir-theme'

/** The inline head script has already applied the stored theme to <html>. */
function readThemeFromDom(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readThemeFromDom)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff')
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}

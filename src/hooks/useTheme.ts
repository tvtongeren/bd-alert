import { useEffect } from 'react'
import type { Settings } from '../types'

/** Applies the chosen appearance, following the system when asked to. */
export function useTheme(theme: Settings['theme']): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document
        .querySelector('meta[name="theme-color"]:not([media])')
        ?.setAttribute('content', dark ? '#0b1120' : '#ffffff')
    }

    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

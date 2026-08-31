import { useEffect } from 'react';
import { useSettings } from '../stores/settings.js';

/**
 * Applies the resolved theme to the document root. `system` follows the OS via
 * matchMedia, which Chromium keeps in sync with the desktop preference.
 */
export function useAppliedTheme(): void {
  const preference = useSettings((state) => state.settings.appearance.theme);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const apply = (): void => {
      const resolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
      document.documentElement.dataset['theme'] = resolved;
    };

    apply();
    if (preference !== 'system') return;

    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);
}

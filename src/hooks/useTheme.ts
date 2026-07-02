/**
 * Dark/light theme hook.
 *
 * The choice is stored in localStorage under a non-sensitive key (a theme
 * preference is not a secret — the "no localStorage" security rule applies
 * to passwords/keys/decrypted data only). The initial value is applied by
 * an inline script in index.html before React mounts, so there is no flash.
 */

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'metacrypt-theme';

function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  // Keep the <html> class and persisted preference in sync with state.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* private browsing — theme simply won't persist */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}

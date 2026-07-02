/** Theme toggle — sun/moon icon button, state handled by useTheme(). */

import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useTranslation();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={t('theme.toggle')} title={t('theme.toggle')}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}

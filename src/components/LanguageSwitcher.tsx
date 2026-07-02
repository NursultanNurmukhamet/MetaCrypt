/**
 * Language switcher. The system language is detected automatically on first
 * visit (see src/i18n); this control lets the user override it, and the
 * override is remembered.
 */

import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { LANGUAGES } from '@/i18n';
import { Select } from '@/components/ui/select';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  // i18n.language can be "ru-RU"; normalize to our supported base codes.
  const current = LANGUAGES.find((l) => i18n.language.startsWith(l.code))?.code ?? 'en';

  return (
    <div className="flex items-center gap-1.5">
      <Languages aria-hidden className="size-4 text-muted-foreground" />
      <Select
        aria-label={t('lang.label')}
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className="h-8 w-auto min-w-[7.5rem] border-none bg-transparent shadow-none"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

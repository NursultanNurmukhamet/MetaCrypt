/** 404 page — kept minimal; with HashRouter this is rarely reachable. */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="container py-16">
      <EmptyState icon={Compass} title={t('notFound.title')}>
        <Link
          to="/"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          {t('notFound.goHome')}
        </Link>
      </EmptyState>
    </div>
  );
}

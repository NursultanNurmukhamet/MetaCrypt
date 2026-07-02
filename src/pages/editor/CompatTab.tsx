/**
 * Compatibility tab — per-platform verdicts on whether this image's
 * metadata (and any MetaCrypt vault inside it) survives the trip.
 */

import { useTranslation } from 'react-i18next';
import { CheckCircle2, MinusCircle, ShieldAlert, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useImageStore } from '@/hooks/useImageStore';
import { checkCompatibility, type CompatStatus } from '@/metadata/compat';

const STATUS_META: Record<CompatStatus, { icon: typeof CheckCircle2; variant: 'success' | 'destructive' | 'warning' }> = {
  preserved: { icon: CheckCircle2, variant: 'success' },
  lost: { icon: XCircle, variant: 'destructive' },
  partial: { icon: MinusCircle, variant: 'warning' },
};

export function CompatTab() {
  const { t } = useTranslation();
  const { parsed } = useImageStore();
  if (!parsed) return null;

  const verdicts = checkCompatibility(parsed.summary);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('compat.title')}</CardTitle>
        <CardDescription>{t('compat.desc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y rounded-md border">
          {verdicts.map((v) => {
            const meta = STATUS_META[v.status];
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <meta.icon
                  aria-hidden
                  className={
                    v.status === 'preserved'
                      ? 'size-5 shrink-0 text-success'
                      : v.status === 'lost'
                        ? 'size-5 shrink-0 text-destructive'
                        : 'size-5 shrink-0 text-warning'
                  }
                />
                <span className="min-w-[160px] font-medium">{t(`compat.platforms.${v.id}`)}</span>
                <Badge variant={meta.variant}>{t(`compat.status.${v.status}`)}</Badge>
                {v.destroysVault && (
                  <Badge variant="destructive">
                    <ShieldAlert aria-hidden />
                    {t('compat.vaultDanger')}
                  </Badge>
                )}
                <span className="basis-full text-sm text-muted-foreground sm:basis-auto sm:flex-1 sm:text-right">
                  {t(`compat.notes.${v.noteKey}`)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

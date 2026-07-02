/**
 * Overview tab — image facts, metadata status per section, GPS presence,
 * SHA-256 checksum, and the "encrypted metadata detected" callout.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, MapPin, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useImageStore } from '@/hooks/useImageStore';
import { useSha256 } from '@/hooks/useSha256';
import { formatBytes, formatDate } from '@/utils/format';

/** Facts we can read from ExifReader's expanded output, best-effort. */
function useFileFacts() {
  const { parsed } = useImageStore();
  const raw = (parsed?.raw ?? {}) as {
    file?: Record<string, { description?: string | number; value?: unknown }>;
    png?: Record<string, { description?: string | number }>;
    exif?: Record<string, { description?: string | number }>;
  };
  const colorSpace =
    raw.exif?.ColorSpace?.description ??
    raw.png?.['Color Type']?.description ??
    raw.file?.['Color Components']?.description ??
    null;
  const bitDepth = raw.png?.['Bit Depth']?.description ?? raw.file?.['Bits Per Sample']?.description ?? null;
  return { colorSpace, bitDepth };
}

export function OverviewTab({ onNavigateTab }: { onNavigateTab: (tab: string) => void }) {
  const { t, i18n } = useTranslation();
  const { image, parsed } = useImageStore();
  const hash = useSha256(image?.bytes ?? null);
  const { colorSpace, bitDepth } = useFileFacts();

  if (!image || !parsed) return null;
  const { summary } = parsed;

  // JPEG can never carry alpha; for PNG we look at the IHDR color type.
  const pngColorType = (parsed.raw as { png?: Record<string, { description?: string }> }).png?.['Color Type']
    ?.description;
  const transparency =
    image.format === 'jpeg'
      ? t('overview.absent')
      : image.format === 'png'
        ? /alpha/i.test(String(pngColorType ?? '')) ? t('overview.present') : t('overview.absent')
        : '—';

  const sections = [
    { key: 'exif', present: summary.hasExif, tab: 'exif' },
    { key: 'xmp', present: summary.hasXmp, tab: 'xmp' },
    { key: 'iptc', present: summary.hasIptc, tab: 'iptc' },
    { key: 'pngText', present: summary.hasPngText, tab: 'png' },
    { key: 'icc', present: summary.hasIcc, tab: 'cleaner' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Encrypted payload callout — the most important signal on this tab. */}
      {summary.hasMetaCrypt && parsed.envelope && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Lock aria-hidden className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('overview.encryptedTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {t('overview.encryptedDesc')}{' '}
                <span className="whitespace-nowrap">
                  {t('overview.created', { date: formatDate(parsed.envelope.created, i18n.language) })}
                </span>
              </p>
            </div>
            <Link
              to="/vault"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              {t('overview.openVault')}
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* ---- Image facts ---- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('overview.image')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {[
                [t('overview.fileName'), image.fileName],
                [t('overview.size'), formatBytes(image.bytes.length)],
                [
                  t('overview.resolution'),
                  image.width > 0 ? `${image.width} × ${image.height} px` : '—',
                ],
                [t('overview.format'), image.format.toUpperCase()],
                [t('overview.colorSpace'), String(colorSpace ?? '—') + (bitDepth ? ` · ${bitDepth} bit` : '')],
                [t('overview.transparency'), String(transparency)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b pb-2 last:border-0 last:pb-0">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="truncate text-right font-medium" title={String(value)}>{value}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-1 pt-1">
                <dt className="text-muted-foreground">{t('overview.checksum')}</dt>
                <dd className="break-all font-mono text-xs">{hash ?? t('common.loading')}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* ---- Metadata status ---- */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('overview.metadataStatus')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('overview.tags', { count: summary.tagCount })}</p>
            <ul className="space-y-2">
              {sections.map((section) => (
                <li key={section.key} className="flex items-center justify-between gap-3 text-sm">
                  <button
                    type="button"
                    className="font-medium underline-offset-4 hover:underline"
                    onClick={() => onNavigateTab(section.tab)}
                  >
                    {t(`overview.sections.${section.key}`)}
                  </button>
                  <Badge variant={section.present ? 'success' : 'secondary'}>
                    {section.present ? t('overview.present') : t('overview.absent')}
                  </Badge>
                </li>
              ))}
            </ul>

            {/* GPS is the most privacy-sensitive field — call it out explicitly. */}
            <div className="flex items-start gap-2 rounded-md border p-3 text-sm">
              {summary.gps ? (
                <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              ) : (
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{t('overview.gps')}</p>
                <p className="text-muted-foreground">
                  {summary.gps
                    ? `${t('overview.gpsPresent')} (${summary.gps.latitude.toFixed(5)}, ${summary.gps.longitude.toFixed(5)})`
                    : t('overview.gpsAbsent')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

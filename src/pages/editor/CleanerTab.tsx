/**
 * Cleaner tab — one-click metadata removal. Options are per-family toggles;
 * "Remove everything" flips them all. Cleaning applies to the working copy
 * (so the user can inspect the result) and offers an immediate download.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Download, Eraser, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/EmptyState';
import { useImageStore } from '@/hooks/useImageStore';
import { CLEAN_EVERYTHING, CLEAN_NOTHING, cleanImage, type CleanOptions } from '@/metadata/cleaner';
import { downloadBytes, suffixFileName } from '@/utils/download';
import { formatBytes } from '@/utils/format';

/** Which toggles make sense for each format. */
const OPTION_KEYS: Array<{ key: keyof CleanOptions; formats: Array<'jpeg' | 'png'> }> = [
  { key: 'exif', formats: ['jpeg', 'png'] },
  { key: 'xmp', formats: ['jpeg', 'png'] },
  { key: 'iptc', formats: ['jpeg'] },
  { key: 'pngText', formats: ['png'] },
  { key: 'comments', formats: ['jpeg', 'png'] },
  { key: 'icc', formats: ['jpeg', 'png'] },
];

export function CleanerTab() {
  const { t } = useTranslation();
  const { image, parsed, applyBytes } = useImageStore();
  const [opts, setOpts] = useState<CleanOptions>({ ...CLEAN_NOTHING, exif: true });
  const [result, setResult] = useState<{ before: number; after: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!image || !parsed) return null;

  if (image.format !== 'jpeg' && image.format !== 'png') {
    return <EmptyState icon={Eraser} title={t('cleaner.unsupported')} />;
  }

  const visibleOptions = OPTION_KEYS.filter((o) => o.formats.includes(image.format as 'jpeg' | 'png'));
  const anySelected = visibleOptions.some((o) => opts[o.key]);

  const run = async () => {
    setError(null);
    setResult(null);
    try {
      const before = image.bytes.length;
      const cleaned = cleanImage(image.bytes, image.format, opts);
      await applyBytes(cleaned);
      setResult({ before, after: cleaned.length });
    } catch (e) {
      setError(t('errors.writeFailed', { message: e instanceof Error ? e.message : String(e) }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eraser aria-hidden className="size-5 text-primary" />
          {t('cleaner.title')}
        </CardTitle>
        <CardDescription>{t('cleaner.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-md border">
          {visibleOptions.map(({ key }) => (
            <li key={key} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium">{t(`cleaner.options.${key}`)}</p>
                {key === 'icc' && (
                  <p className="text-xs text-muted-foreground">{t('cleaner.iccWarning')}</p>
                )}
              </div>
              <Switch
                checked={opts[key]}
                onChange={(e) => {
                  setOpts({ ...opts, [key]: e.target.checked });
                  setResult(null);
                }}
                aria-label={t(`cleaner.options.${key}`)}
              />
            </li>
          ))}
        </ul>

        {/* Destroying the vault deserves an explicit warning. */}
        {opts.xmp && parsed.summary.hasMetaCrypt && (
          <p className="flex items-start gap-2 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
            {t('cleaner.vaultWarning')}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setOpts(CLEAN_EVERYTHING); setResult(null); }}>
            <Sparkles />
            {t('cleaner.removeEverything')}
          </Button>
          <Button onClick={() => void run()} disabled={!anySelected}>
            <Eraser />
            {t('cleaner.clean')}
          </Button>
          {result && (
            <Button
              variant="secondary"
              onClick={() => downloadBytes(image.bytes, suffixFileName(image.fileName, '-clean'), image.mime)}
            >
              <Download />
              {t('cleaner.download')}
            </Button>
          )}
        </div>

        {result && (
          <p className="text-sm font-medium text-success" role="status">
            {t('cleaner.result', {
              before: formatBytes(result.before),
              after: formatBytes(result.after),
            })}
          </p>
        )}
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Editor workspace: sidebar (preview + file facts + download/reset) and the
 * tabbed metadata inspector. Tabs are lazy — only the active panel renders,
 * which keeps huge files responsive.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Braces,
  Download,
  Eraser,
  FileImage,
  FileText,
  Gauge,
  ImageOff,
  Info,
  RotateCcw,
  Send,
  Tags,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { useImageStore } from '@/hooks/useImageStore';
import { downloadBytes } from '@/utils/download';
import { formatBytes } from '@/utils/format';
import { OverviewTab } from './OverviewTab';
import { ExifTab } from './ExifTab';
import { XmpTab } from './XmpTab';
import { IptcTab } from './IptcTab';
import { PngTab } from './PngTab';
import { RawTab } from './RawTab';
import { CleanerTab } from './CleanerTab';
import { ExportTab } from './ExportTab';
import { CompatTab } from './CompatTab';

const TAB_DEFS = [
  { value: 'overview', icon: Info },
  { value: 'exif', icon: Tags },
  { value: 'xmp', icon: Braces },
  { value: 'iptc', icon: FileText },
  { value: 'png', icon: FileImage },
  { value: 'raw', icon: Gauge },
  { value: 'cleaner', icon: Eraser },
  { value: 'export', icon: Download },
  { value: 'compat', icon: Send },
] as const;

export function EditorPage() {
  const { t } = useTranslation();
  const { image, parsed, previewUrl, resetToOriginal } = useImageStore();
  const [tab, setTab] = useState('overview');

  if (!image || !parsed) {
    return (
      <div className="container py-16">
        <EmptyState icon={ImageOff} title={t('editor.noImageTitle')} description={t('editor.noImageDesc')}>
          <Link
            to="/"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            {t('editor.goHome')}
          </Link>
        </EmptyState>
      </div>
    );
  }

  const modified = image.bytes !== image.originalBytes;

  return (
    <div className="container grid gap-6 py-6 lg:grid-cols-[300px_1fr]">
      {/* ---- Sidebar: preview + facts + actions ---- */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="p-3">
            {/* checkerboard background reveals transparency in previews */}
            <div
              className="flex max-h-64 items-center justify-center overflow-hidden rounded-md border"
              style={{
                backgroundImage:
                  'conic-gradient(hsl(var(--muted)) 25%, transparent 25% 50%, hsl(var(--muted)) 50% 75%, transparent 75%)',
                backgroundSize: '16px 16px',
              }}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={image.fileName}
                  className="max-h-64 w-auto max-w-full object-contain"
                />
              ) : (
                <ImageOff aria-hidden className="my-10 size-8 text-muted-foreground" />
              )}
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('overview.fileName')}</dt>
                <dd className="truncate font-medium" title={image.fileName}>{image.fileName}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('overview.size')}</dt>
                <dd className="font-medium">{formatBytes(image.bytes.length)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('overview.resolution')}</dt>
                <dd className="font-medium">
                  {image.width > 0 ? `${image.width} × ${image.height}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{t('overview.format')}</dt>
                <dd className="font-medium uppercase">{image.format}</dd>
              </div>
            </dl>
            {modified && (
              <Badge variant="warning" className="mt-2">{t('common.modified')}</Badge>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button onClick={() => downloadBytes(image.bytes, image.fileName, image.mime)}>
            <Download />
            {t('common.download')}
          </Button>
          {modified && (
            <Button variant="outline" onClick={() => void resetToOriginal()}>
              <RotateCcw />
              {t('common.resetEdits')}
            </Button>
          )}
        </div>
      </aside>

      {/* ---- Tabbed inspector ---- */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-0.5">
          {TAB_DEFS.map((def) => (
            <TabsTrigger key={def.value} value={def.value}>
              <def.icon aria-hidden />
              <span className="hidden sm:inline">{t(`editor.tabs.${def.value}`)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview"><OverviewTab onNavigateTab={setTab} /></TabsContent>
        <TabsContent value="exif"><ExifTab /></TabsContent>
        <TabsContent value="xmp"><XmpTab /></TabsContent>
        <TabsContent value="iptc"><IptcTab /></TabsContent>
        <TabsContent value="png"><PngTab /></TabsContent>
        <TabsContent value="raw"><RawTab /></TabsContent>
        <TabsContent value="cleaner"><CleanerTab /></TabsContent>
        <TabsContent value="export"><ExportTab /></TabsContent>
        <TabsContent value="compat"><CompatTab /></TabsContent>
      </Tabs>
    </div>
  );
}

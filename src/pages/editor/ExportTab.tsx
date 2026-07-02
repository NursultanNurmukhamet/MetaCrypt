/**
 * Export / Import tab.
 * Export: JSON / XML / TXT snapshot of all parsed metadata.
 * Import: MetaCrypt JSON/XML export → applies the writable sections
 * (XMP properties, PNG text) onto the current image.
 */

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Braces, CodeXml, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCapabilities, useImageStore } from '@/hooks/useImageStore';
import { buildExport, parseImport, toJson, toTxt, toXml } from '@/metadata/exporter';
import { applyPngText, applyXmp } from '@/metadata/writer';
import { downloadText } from '@/utils/download';

export function ExportTab() {
  const { t } = useTranslation();
  const { image, parsed, applyBytes } = useImageStore();
  const caps = useCapabilities();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!image || !parsed) return null;

  const doc = buildExport(image, parsed);
  const base = image.fileName.replace(/\.[^.]+$/, '');

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    try {
      const imported = parseImport(await file.text());
      let bytes = image.bytes;
      // Apply only what the current format can hold.
      if (caps.xmpWrite && imported.xmp.length > 0) {
        bytes = applyXmp(bytes, image.format, imported.xmp);
      }
      if (caps.pngTextWrite && imported.pngText.length > 0) {
        // XMP may have just been rewritten — reuse the imported packet state
        // by reading nothing: applyPngText preserves the current packet.
        bytes = applyPngText(bytes, image.format, imported.pngText, parsed.xmpRaw);
      }
      await applyBytes(bytes);
      setMessage({
        kind: 'ok',
        text: t('export.applied', { xmp: imported.xmp.length, png: imported.pngText.length }),
      });
    } catch {
      setMessage({ kind: 'error', text: t('export.importError') });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('export.title')}</CardTitle>
          <CardDescription>{t('export.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => downloadText(toJson(doc), `${base}.metadata.json`, 'application/json')}>
            <Braces />
            JSON
          </Button>
          <Button variant="secondary" onClick={() => downloadText(toXml(doc), `${base}.metadata.xml`, 'application/xml')}>
            <CodeXml />
            XML
          </Button>
          <Button variant="secondary" onClick={() => downloadText(toTxt(doc), `${base}.metadata.txt`)}>
            <FileText />
            TXT
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('export.importTitle')}</CardTitle>
          <CardDescription>{t('export.importDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.xml,application/json,application/xml,text/xml"
            className="sr-only"
            onChange={(e) => {
              void onImportFile(e.target.files?.[0] ?? undefined);
              e.target.value = '';
            }}
            tabIndex={-1}
            aria-hidden
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!caps.xmpWrite}>
            <Upload />
            {t('export.importBtn')}
          </Button>
          {message && (
            <p
              role={message.kind === 'error' ? 'alert' : 'status'}
              className={
                message.kind === 'error'
                  ? 'text-sm font-medium text-destructive'
                  : 'text-sm font-medium text-success'
              }
            >
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

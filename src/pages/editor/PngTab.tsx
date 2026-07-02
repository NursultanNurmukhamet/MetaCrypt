/**
 * PNG text tab — tEXt / zTXt / iTXt chunk editor. New entries are written
 * as tEXt when the text is pure Latin-1 and iTXt (UTF-8) otherwise, so
 * Cyrillic/Kazakh values are always preserved correctly.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileImage, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/EmptyState';
import { MetaTable, type MetaTableRow } from '@/components/MetaTable';
import { useCapabilities, useImageStore } from '@/hooks/useImageStore';
import type { PngTextEntry } from '@/types/image';
import { applyPngText } from '@/metadata/writer';

/** Choose the right chunk type for a value: tEXt for Latin-1, else iTXt. */
function kindFor(text: string): PngTextEntry['kind'] {
  // eslint-disable-next-line no-control-regex
  return /^[\x00-\xff]*$/.test(text) ? 'tEXt' : 'iTXt';
}

export function PngTab() {
  const { t } = useTranslation();
  const { image, parsed, applyBytes } = useImageStore();
  const caps = useCapabilities();
  const [error, setError] = useState<string | null>(null);
  const [newKeyword, setNewKeyword] = useState('');
  const [newText, setNewText] = useState('');

  if (!image || !parsed) return null;

  if (image.format !== 'png') {
    return <EmptyState icon={FileImage} title={t('png.notPng')} />;
  }

  const entries = parsed.pngText;
  const rows: MetaTableRow[] = entries.map((e, i) => ({
    id: String(i),
    key: e.keyword,
    value: e.text,
    hint: e.kind,
    editable: true,
    keyEditable: true,
  }));

  const write = async (next: PngTextEntry[]) => {
    setError(null);
    try {
      await applyBytes(applyPngText(image.bytes, image.format, next, parsed.xmpRaw));
    } catch (e) {
      setError(t('errors.writeFailed', { message: e instanceof Error ? e.message : String(e) }));
    }
  };

  const onCommit = (id: string, patch: { key?: string; value?: string }) => {
    const index = Number(id);
    void write(
      entries.map((e, i) => {
        if (i !== index) return e;
        const updated = { ...e };
        if (patch.key !== undefined && patch.key.trim()) updated.keyword = patch.key.trim();
        if (patch.value !== undefined) {
          updated.text = patch.value;
          // Upgrade tEXt→iTXt automatically if the new text needs Unicode.
          if (updated.kind === 'tEXt' && kindFor(patch.value) === 'iTXt') updated.kind = 'iTXt';
        }
        return updated;
      }),
    );
  };

  const onDelete = (id: string) => {
    void write(entries.filter((_, i) => i !== Number(id)));
  };

  const onAdd = () => {
    if (!newKeyword.trim()) return;
    void write([...entries, { keyword: newKeyword.trim(), text: newText, kind: kindFor(newText) }]);
    setNewKeyword('');
    setNewText('');
  };

  return (
    <div className="space-y-3">
      <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{t('png.xmpNote')}</p>

      {rows.length === 0 ? (
        <EmptyState icon={FileImage} title={t('png.empty')} />
      ) : (
        <MetaTable rows={rows} editable={caps.pngTextWrite} onCommit={onCommit} onDelete={onDelete} />
      )}

      {caps.pngTextWrite && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <Input
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder={t('png.keyword')}
            aria-label={t('png.keyword')}
            className="w-48"
            maxLength={79}
          />
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder={t('png.text')}
            aria-label={t('png.text')}
            className="min-w-[220px] flex-1"
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          />
          <Button onClick={onAdd} disabled={!newKeyword.trim()}>
            <Plus />
            {t('png.addEntry')}
          </Button>
        </div>
      )}

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

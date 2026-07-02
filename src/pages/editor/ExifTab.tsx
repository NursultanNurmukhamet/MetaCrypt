/**
 * EXIF tab — editable table backed by piexifjs (JPEG). Every commit writes a
 * fresh EXIF block into the working bytes and re-parses, so the table always
 * mirrors the real file. Non-JPEG formats get a read-only view.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Tags, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { MetaTable } from '@/components/MetaTable';
import { useCapabilities, useImageStore } from '@/hooks/useImageStore';
import {
  deleteExifTag,
  knownExifTags,
  loadExifDict,
  parseEntryId,
  setExifTag,
} from '@/metadata/exif';
import { applyExif } from '@/metadata/writer';
import { stripJpeg } from '@/metadata/jpeg';

export function ExifTab() {
  const { t } = useTranslation();
  const { image, parsed, applyBytes } = useImageStore();
  const caps = useCapabilities();
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');

  // The full catalogue of writable tags, for the "Add field" picker.
  const catalogue = useMemo(() => knownExifTags(), []);

  if (!image || !parsed) return null;

  const entries = parsed.exifEntries;

  /** Run a dict mutation + write + re-parse, surfacing failures inline. */
  const mutate = async (fn: (dict: ReturnType<typeof loadExifDict>) => ReturnType<typeof loadExifDict>) => {
    setError(null);
    try {
      const dict = fn(loadExifDict(image.bytes));
      await applyBytes(applyExif(image.bytes, image.format, dict));
    } catch (e) {
      setError(
        e instanceof Error && e.message.startsWith('Invalid')
          ? t('table.invalidValue')
          : t('errors.writeFailed', { message: e instanceof Error ? e.message : String(e) }),
      );
    }
  };

  const onCommit = (id: string, patch: { key?: string; value?: string }) => {
    if (patch.value === undefined) return;
    const { ifd, tag } = parseEntryId(id);
    void mutate((dict) => setExifTag(dict, ifd, tag, patch.value!));
  };

  const onDelete = (id: string) => {
    const { ifd, tag } = parseEntryId(id);
    void mutate((dict) => deleteExifTag(dict, ifd, tag));
  };

  const onAdd = () => {
    const spec = catalogue.find((c) => `${c.ifd}/${c.tag}` === newTagKey);
    if (!spec || !newTagValue.trim()) return;
    void mutate((dict) => setExifTag(dict, spec.ifd, spec.tag, newTagValue));
    setNewTagKey('');
    setNewTagValue('');
  };

  const onDeleteAll = async () => {
    if (!window.confirm(t('table.confirmDeleteAll'))) return;
    setError(null);
    try {
      await applyBytes(
        stripJpeg(image.bytes, { exif: true, xmp: false, iptc: false, icc: false, comments: false }),
      );
    } catch (e) {
      setError(t('errors.writeFailed', { message: e instanceof Error ? e.message : String(e) }));
    }
  };

  if (entries.length === 0 && !caps.exifWrite) {
    return <EmptyState icon={Tags} title={t('exif.empty')} />;
  }

  return (
    <div className="space-y-3">
      {!caps.exifWrite && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{t('exif.readOnly')}</p>
      )}

      {/* Toolbar: search + delete-all */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('table.searchPlaceholder')}
          aria-label={t('common.search')}
          className="max-w-xs"
        />
        {caps.exifWrite && entries.length > 0 && (
          <Button variant="destructive" size="sm" className="ml-auto" onClick={() => void onDeleteAll()}>
            <Trash2 />
            {t('table.deleteAll')}
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={Tags} title={t('exif.empty')} />
      ) : (
        <MetaTable
          rows={entries}
          editable={caps.exifWrite}
          onCommit={onCommit}
          onDelete={onDelete}
          filter={filter}
        />
      )}

      {/* Add new field */}
      {caps.exifWrite && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="min-w-[220px] flex-1">
            <Select
              aria-label={t('table.addField')}
              value={newTagKey}
              onChange={(e) => setNewTagKey(e.target.value)}
            >
              <option value="">{t('exif.selectTag')}</option>
              {catalogue.map((c) => (
                <option key={`${c.ifd}/${c.tag}`} value={`${c.ifd}/${c.tag}`}>
                  {c.name} ({c.ifd} · {c.type})
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[220px] flex-[2]">
            <Input
              value={newTagValue}
              onChange={(e) => setNewTagValue(e.target.value)}
              placeholder={t('common.value')}
              aria-label={t('common.value')}
              onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            />
          </div>
          <Button onClick={onAdd} disabled={!newTagKey || !newTagValue.trim()}>
            <Plus />
            {t('common.add')}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
      )}
    </div>
  );
}

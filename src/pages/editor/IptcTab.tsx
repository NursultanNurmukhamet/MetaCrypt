/**
 * IPTC tab — editorial fields (title, author, copyright, caption…) stored
 * in the Photoshop APP13 segment. Known record-2 datasets are editable;
 * unknown/binary datasets are preserved and shown read-only.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/EmptyState';
import { MetaTable, type MetaTableRow } from '@/components/MetaTable';
import { useCapabilities, useImageStore } from '@/hooks/useImageStore';
import { IPTC_FIELDS, iptcFieldName, isIptcEditable, type IptcDataSet } from '@/metadata/iptc';
import { applyIptc } from '@/metadata/writer';
import { utf8 } from '@/utils/binary';

export function IptcTab() {
  const { t } = useTranslation();
  const { image, parsed, applyBytes } = useImageStore();
  const caps = useCapabilities();
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newField, setNewField] = useState('');
  const [newValue, setNewValue] = useState('');

  if (!image || !parsed) return null;
  const sets = parsed.iptcSets;

  const rows: MetaTableRow[] = sets.map((set, i) => ({
    id: String(i),
    key: iptcFieldName(set),
    value: isIptcEditable(set) ? set.value : `(${t('iptc.binary')}, ${set.raw.length} B)`,
    hint: `${set.record}:${set.dataset}`,
    editable: isIptcEditable(set),
  }));

  const write = async (next: IptcDataSet[]) => {
    setError(null);
    try {
      await applyBytes(applyIptc(image.bytes, image.format, next));
    } catch (e) {
      setError(t('errors.writeFailed', { message: e instanceof Error ? e.message : String(e) }));
    }
  };

  const onCommit = (id: string, patch: { key?: string; value?: string }) => {
    if (patch.value === undefined) return;
    const index = Number(id);
    void write(sets.map((s, i) => (i === index ? { ...s, value: patch.value!, raw: utf8.encode(patch.value!) } : s)));
  };

  const onDelete = (id: string) => {
    void write(sets.filter((_, i) => i !== Number(id)));
  };

  const onAdd = () => {
    const dataset = Number(newField);
    if (!dataset || !newValue.trim()) return;
    void write([...sets, { record: 2, dataset, value: newValue, raw: utf8.encode(newValue) }]);
    setNewField('');
    setNewValue('');
  };

  const onDeleteAll = () => {
    if (!window.confirm(t('table.confirmDeleteAll'))) return;
    void write([]);
  };

  return (
    <div className="space-y-3">
      {!caps.iptcWrite && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{t('iptc.readOnly')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('table.searchPlaceholder')}
          aria-label={t('common.search')}
          className="max-w-xs"
        />
        {caps.iptcWrite && sets.length > 0 && (
          <Button variant="destructive" size="sm" className="ml-auto" onClick={onDeleteAll}>
            <Trash2 />
            {t('table.deleteAll')}
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title={t('iptc.empty')} />
      ) : (
        <MetaTable rows={rows} editable={caps.iptcWrite} onCommit={onCommit} onDelete={onDelete} filter={filter} />
      )}

      {caps.iptcWrite && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="min-w-[220px] flex-1">
            <Select
              aria-label={t('iptc.addField')}
              value={newField}
              onChange={(e) => setNewField(e.target.value)}
            >
              <option value="">{t('iptc.selectField')}</option>
              {Object.entries(IPTC_FIELDS).map(([dataset, name]) => (
                <option key={dataset} value={dataset}>
                  {name} (2:{dataset})
                </option>
              ))}
            </Select>
          </div>
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={t('common.value')}
            aria-label={t('common.value')}
            className="min-w-[220px] flex-[2]"
            onKeyDown={(e) => e.key === 'Enter' && onAdd()}
          />
          <Button onClick={onAdd} disabled={!newField || !newValue.trim()}>
            <Plus />
            {t('common.add')}
          </Button>
        </div>
      )}

      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
